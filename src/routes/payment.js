import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';

export const paymentRoutes = new Hono();

// Saudi payment gateways configuration
const PAYMENT_GATEWAYS = {
  moyasar: {
    apiKey: process.env.MOYASAR_API_KEY,
    secretKey: process.env.MOYASAR_SECRET_KEY,
    baseUrl: 'https://api.moyasar.com/v1'
  },
  tap: {
    apiKey: process.env.TAP_API_KEY,
    baseUrl: 'https://api.tap.company/v2'
  },
  stcpay: {
    merchantId: process.env.STCPAY_MERCHANT_ID,
    baseUrl: 'https://api.stcpay.com.sa/v2'
  }
};

// Pricing tiers (in SAR)
const PRICING_TIERS = {
  free: {
    price: 0,
    credits: 10,
    features: ['10 OCR credits/month', 'Basic support']
  },
  starter: {
    price: 49,
    credits: 100,
    features: ['100 OCR credits/month', 'Priority support', 'API access']
  },
  professional: {
    price: 199,
    credits: 500,
    features: ['500 OCR credits/month', 'Priority support', 'API access', 'Batch processing', 'RAG integration']
  },
  enterprise: {
    price: 999,
    credits: -1, // Unlimited
    features: ['Unlimited OCR credits', 'Dedicated support', 'API access', 'Custom integration', 'SLA']
  }
};

// Create payment session (Moyasar)
paymentRoutes.post('/create-session', async (c) => {
  const { tier, paymentMethod } = await c.req.json();
  const userId = c.get('userId');
  
  if (!PRICING_TIERS[tier]) {
    return c.json({ error: 'Invalid tier' }, 400);
  }
  
  const tierInfo = PRICING_TIERS[tier];
  const orderId = uuidv4();
  
  try {
    // Create payment with Moyasar
    const response = await fetch(`${PAYMENT_GATEWAYS.moyasar.baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${PAYMENT_GATEWAYS.moyasar.secretKey  }:`)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: tierInfo.price * 100, // Convert to halalas
        currency: 'SAR',
        description: `BrainSAIT OCR - ${tier} subscription`,
        callback_url: `${c.req.url.origin}/api/payment/callback`,
        source: {
          type: paymentMethod || 'creditcard'
        },
        metadata: {
          user_id: userId,
          tier,
          order_id: orderId
        }
      })
    });
    
    const payment = await response.json();
    
    // Store payment intent
    await c.env.DB.prepare(
      `INSERT INTO payments (id, user_id, amount, currency, tier, status, gateway, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(orderId, userId, tierInfo.price, 'SAR', tier, 'pending', 'moyasar').run();
    
    return c.json({
      success: true,
      paymentUrl: payment.url,
      orderId
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    return c.json({ error: 'Failed to create payment session' }, 500);
  }
});

// Payment callback
paymentRoutes.post('/callback', async (c) => {
  const { id, status, metadata } = await c.req.json();
  
  try {
    // Verify payment with Moyasar
    const response = await fetch(`${PAYMENT_GATEWAYS.moyasar.baseUrl}/payments/${id}`, {
      headers: {
        'Authorization': `Basic ${btoa(`${PAYMENT_GATEWAYS.moyasar.secretKey  }:`)}`
      }
    });
    
    const payment = await response.json();
    
    if (payment.status === 'paid') {
      const { user_id, tier, order_id } = payment.metadata;
      const tierInfo = PRICING_TIERS[tier];
      
      // Update payment status
      await c.env.DB.prepare(
        'UPDATE payments SET status = ?, updated_at = datetime("now") WHERE id = ?'
      ).bind('completed', order_id).run();
      
      // Update user subscription
      await c.env.DB.prepare(
        `UPDATE users 
         SET subscription_tier = ?, 
             credits = CASE WHEN ? = -1 THEN credits ELSE credits + ? END,
             subscription_date = datetime('now'),
             subscription_expiry = datetime('now', '+1 month')
         WHERE id = ?`
      ).bind(tier, tierInfo.credits, tierInfo.credits, user_id).run();
      
      // Create invoice
      await c.env.DB.prepare(
        `INSERT INTO invoices (id, user_id, payment_id, amount, currency, issued_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).bind(uuidv4(), user_id, order_id, tierInfo.price, 'SAR').run();
      
      return c.json({ success: true, message: 'Payment processed successfully' });
    } else {
      // Update payment status
      await c.env.DB.prepare(
        'UPDATE payments SET status = ?, updated_at = datetime("now") WHERE id = ?'
      ).bind('failed', metadata.order_id).run();
      
      return c.json({ success: false, message: 'Payment failed' });
    }
  } catch (error) {
    console.error('Payment callback error:', error);
    return c.json({ error: 'Failed to process payment' }, 500);
  }
});

// Get pricing information
paymentRoutes.get('/pricing', (c) => {
  return c.json({
    currency: 'SAR',
    tiers: PRICING_TIERS
  });
});

// Get user's payment history
paymentRoutes.get('/history', async (c) => {
  const userId = c.get('userId');
  
  try {
    const payments = await c.env.DB.prepare(
      `SELECT p.*, i.id as invoice_id 
       FROM payments p
       LEFT JOIN invoices i ON p.id = i.payment_id
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC
       LIMIT 50`
    ).bind(userId).all();
    
    return c.json({
      success: true,
      payments: payments.results
    });
  } catch (error) {
    console.error('Payment history error:', error);
    return c.json({ error: 'Failed to fetch payment history' }, 500);
  }
});

// Process Apple Pay payment
paymentRoutes.post('/apple-pay', async (c) => {
  const { paymentData, tier } = await c.req.json();
  const userId = c.get('userId');
  
  // Process Apple Pay token with payment gateway
  // Implementation depends on chosen gateway
  
  return c.json({ 
    success: true, 
    message: 'Apple Pay integration pending' 
  });
});

// Process Mada card payment
paymentRoutes.post('/mada', async (c) => {
  const { cardDetails, tier } = await c.req.json();
  const userId = c.get('userId');
  
  // Process Mada card with local payment gateway
  // Mada is Saudi Arabia's national payment network
  
  return c.json({ 
    success: true, 
    message: 'Mada integration pending' 
  });
});