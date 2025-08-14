import { Hono } from 'hono';

export const userRoutes = new Hono();

// Get user profile
userRoutes.get('/profile', async (c) => {
  const userId = c.get('userId');
  
  try {
    const user = await c.env.DB.prepare(
      `SELECT id, email, name, phone, avatar_url, credits, 
              subscription_tier, subscription_date, subscription_expiry,
              created_at, last_login
       FROM users WHERE id = ?`
    ).bind(userId).first();
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    // Get usage statistics
    const stats = await c.env.DB.prepare(
      `SELECT 
        COUNT(*) as total_documents,
        SUM(credits_used) as total_credits_used,
        AVG(confidence) as avg_confidence,
        AVG(processing_time) as avg_processing_time
       FROM ocr_history 
       WHERE user_id = ? AND status = 'completed'`
    ).bind(userId).first();
    
    return c.json({
      success: true,
      user: {
        ...user,
        password: undefined // Remove password from response
      },
      statistics: stats
    });
    
  } catch (error) {
    console.error('Profile fetch error:', error);
    return c.json({ error: 'Failed to fetch profile' }, 500);
  }
});

// Update user profile
userRoutes.put('/profile', async (c) => {
  const userId = c.get('userId');
  const { name, phone, avatar_url } = await c.req.json();
  
  try {
    await c.env.DB.prepare(
      `UPDATE users 
       SET name = COALESCE(?, name),
           phone = COALESCE(?, phone),
           avatar_url = COALESCE(?, avatar_url)
       WHERE id = ?`
    ).bind(name, phone, avatar_url, userId).run();
    
    return c.json({
      success: true,
      message: 'Profile updated successfully'
    });
    
  } catch (error) {
    console.error('Profile update error:', error);
    return c.json({ error: 'Failed to update profile' }, 500);
  }
});

// Get user's API keys
userRoutes.get('/api-keys', async (c) => {
  const userId = c.get('userId');
  
  try {
    const keys = await c.env.DB.prepare(
      `SELECT id, name, last_used, created_at, expires_at, is_active
       FROM api_keys
       WHERE user_id = ?
       ORDER BY created_at DESC`
    ).bind(userId).all();
    
    return c.json({
      success: true,
      apiKeys: keys.results
    });
    
  } catch (error) {
    console.error('API keys fetch error:', error);
    return c.json({ error: 'Failed to fetch API keys' }, 500);
  }
});

// Create new API key
userRoutes.post('/api-keys', async (c) => {
  const userId = c.get('userId');
  const { name } = await c.req.json();
  
  try {
    // Check user tier
    const user = await c.env.DB.prepare(
      'SELECT subscription_tier FROM users WHERE id = ?'
    ).bind(userId).first();
    
    if (user.subscription_tier === 'free') {
      return c.json({ error: 'API access requires paid subscription' }, 403);
    }
    
    // Generate API key
    const apiKey = `sk_${generateRandomString(32)}`;
    const keyHash = await hashApiKey(apiKey);
    const keyId = generateRandomString(16);
    
    // Store hashed key
    await c.env.DB.prepare(
      `INSERT INTO api_keys (id, user_id, key_hash, name, created_at, is_active)
       VALUES (?, ?, ?, ?, datetime('now'), 1)`
    ).bind(keyId, userId, keyHash, name || 'API Key').run();
    
    return c.json({
      success: true,
      apiKey: apiKey, // Only returned once
      keyId: keyId,
      message: 'Save this key securely. It won\'t be shown again.'
    });
    
  } catch (error) {
    console.error('API key creation error:', error);
    return c.json({ error: 'Failed to create API key' }, 500);
  }
});

// Delete API key
userRoutes.delete('/api-keys/:id', async (c) => {
  const userId = c.get('userId');
  const keyId = c.req.param('id');
  
  try {
    const result = await c.env.DB.prepare(
      'DELETE FROM api_keys WHERE id = ? AND user_id = ?'
    ).bind(keyId, userId).run();
    
    if (result.changes === 0) {
      return c.json({ error: 'API key not found' }, 404);
    }
    
    return c.json({
      success: true,
      message: 'API key deleted successfully'
    });
    
  } catch (error) {
    console.error('API key deletion error:', error);
    return c.json({ error: 'Failed to delete API key' }, 500);
  }
});

// Get usage statistics
userRoutes.get('/usage', async (c) => {
  const userId = c.get('userId');
  const { period = 'month' } = c.req.query();
  
  try {
    let dateFilter = "datetime('now', '-1 month')";
    if (period === 'week') {
      dateFilter = "datetime('now', '-7 days')";
    } else if (period === 'year') {
      dateFilter = "datetime('now', '-1 year')";
    }
    
    // Get usage by day
    const usage = await c.env.DB.prepare(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as documents_processed,
        SUM(credits_used) as credits_used
       FROM ocr_history
       WHERE user_id = ? AND created_at > ${dateFilter}
       GROUP BY DATE(created_at)
       ORDER BY date DESC`
    ).bind(userId).all();
    
    // Get file type distribution
    const fileTypes = await c.env.DB.prepare(
      `SELECT 
        file_type,
        COUNT(*) as count
       FROM ocr_history
       WHERE user_id = ? AND created_at > ${dateFilter}
       GROUP BY file_type`
    ).bind(userId).all();
    
    // Get language distribution
    const languages = await c.env.DB.prepare(
      `SELECT 
        language,
        COUNT(*) as count
       FROM ocr_history
       WHERE user_id = ? AND created_at > ${dateFilter}
       GROUP BY language`
    ).bind(userId).all();
    
    return c.json({
      success: true,
      usage: usage.results,
      fileTypes: fileTypes.results,
      languages: languages.results
    });
    
  } catch (error) {
    console.error('Usage statistics error:', error);
    return c.json({ error: 'Failed to fetch usage statistics' }, 500);
  }
});

// Get billing information
userRoutes.get('/billing', async (c) => {
  const userId = c.get('userId');
  
  try {
    // Get current subscription
    const subscription = await c.env.DB.prepare(
      `SELECT subscription_tier, subscription_date, subscription_expiry, credits
       FROM users WHERE id = ?`
    ).bind(userId).first();
    
    // Get recent invoices
    const invoices = await c.env.DB.prepare(
      `SELECT i.*, p.amount, p.currency, p.status as payment_status
       FROM invoices i
       JOIN payments p ON i.payment_id = p.id
       WHERE i.user_id = ?
       ORDER BY i.issued_at DESC
       LIMIT 10`
    ).bind(userId).all();
    
    // Get next billing date
    const nextBilling = subscription.subscription_expiry || null;
    
    return c.json({
      success: true,
      subscription,
      invoices: invoices.results,
      nextBilling
    });
    
  } catch (error) {
    console.error('Billing info error:', error);
    return c.json({ error: 'Failed to fetch billing information' }, 500);
  }
});

// Download invoice
userRoutes.get('/invoices/:id', async (c) => {
  const userId = c.get('userId');
  const invoiceId = c.req.param('id');
  
  try {
    const invoice = await c.env.DB.prepare(
      `SELECT i.*, u.name, u.email, p.amount, p.currency
       FROM invoices i
       JOIN users u ON i.user_id = u.id
       JOIN payments p ON i.payment_id = p.id
       WHERE i.id = ? AND i.user_id = ?`
    ).bind(invoiceId, userId).first();
    
    if (!invoice) {
      return c.json({ error: 'Invoice not found' }, 404);
    }
    
    // Generate PDF invoice (simplified)
    const invoiceHtml = generateInvoiceHtml(invoice);
    
    return c.html(invoiceHtml);
    
  } catch (error) {
    console.error('Invoice download error:', error);
    return c.json({ error: 'Failed to download invoice' }, 500);
  }
});

// Helper functions
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function hashApiKey(key) {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

function generateInvoiceHtml(invoice) {
  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Invoice #${invoice.invoice_number || invoice.id}</title>
    <style>
        body { font-family: 'Arial', sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #667eea; padding-bottom: 20px; margin-bottom: 30px; }
        .invoice-details { margin-bottom: 30px; }
        .table { width: 100%; border-collapse: collapse; }
        .table th, .table td { padding: 10px; text-align: right; border-bottom: 1px solid #ddd; }
        .total { font-size: 1.2em; font-weight: bold; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>فاتورة ضريبية</h1>
        <p>BrainSAIT OCR</p>
    </div>
    
    <div class="invoice-details">
        <p><strong>رقم الفاتورة:</strong> ${invoice.invoice_number || invoice.id}</p>
        <p><strong>التاريخ:</strong> ${new Date(invoice.issued_at).toLocaleDateString('ar-SA')}</p>
        <p><strong>العميل:</strong> ${invoice.name}</p>
        <p><strong>البريد الإلكتروني:</strong> ${invoice.email}</p>
    </div>
    
    <table class="table">
        <thead>
            <tr>
                <th>الوصف</th>
                <th>المبلغ</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>اشتراك BrainSAIT OCR</td>
                <td>${invoice.amount} ${invoice.currency}</td>
            </tr>
            <tr>
                <td>ضريبة القيمة المضافة (15%)</td>
                <td>${(invoice.amount * 0.15).toFixed(2)} ${invoice.currency}</td>
            </tr>
        </tbody>
    </table>
    
    <div class="total">
        <p>المجموع الكلي: ${(invoice.amount * 1.15).toFixed(2)} ${invoice.currency}</p>
    </div>
</body>
</html>
  `;
}