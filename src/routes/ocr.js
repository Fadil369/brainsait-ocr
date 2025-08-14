import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';

export const ocrRoutes = new Hono();

// Process OCR request
ocrRoutes.post('/process', async (c) => {
  const userId = c.get('userId');
  
  try {
    // Get user credits
    const user = await c.env.DB.prepare(
      'SELECT credits, subscription_tier FROM users WHERE id = ?'
    ).bind(userId).first();
    
    if (user.credits <= 0 && user.subscription_tier === 'free') {
      return c.json({ error: 'Insufficient credits' }, 402);
    }
    
    // Parse form data
    const formData = await c.req.formData();
    const file = formData.get('file');
    const options = {
      extractImages: formData.get('extractImages') === 'true',
      preserveFormatting: formData.get('preserveFormatting') === 'true',
      autoTranslate: formData.get('autoTranslate') === 'true'
    };
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }
    
    // Validate file
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_SIZE) {
      return c.json({ error: 'File too large' }, 413);
    }
    
    // Check supported file types
    const supportedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!supportedTypes.includes(file.type)) {
      return c.json({ error: `Unsupported file type: ${file.type}. Supported types: PDF, PNG, JPG, JPEG, WEBP` }, 400);
    }
    
    // Calculate file hash for caching
    const arrayBuffer = await file.arrayBuffer();
    const fileHash = crypto
      .createHash('sha256')
      .update(Buffer.from(arrayBuffer))
      .digest('hex');
    
    // Check cache
    const cachedResult = await c.env.CACHE.get(`ocr_${fileHash}`, 'json');
    if (cachedResult) {
      // Log cache hit
      await logOCRRequest(c.env.DB, userId, file, cachedResult, 'cached');
      return c.json({
        success: true,
        cached: true,
        result: cachedResult
      });
    }
    
    // Convert file to base64
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const dataUri = `data:${file.type};base64,${base64}`;
    
    // Process with Mistral API (or Cloudflare AI when available)
    const ocrResult = await processWithMistral(dataUri, options, c.env);
    
    // Store in cache with metadata
    await c.env.CACHE.put(
      `ocr_${fileHash}`,
      JSON.stringify(ocrResult),
      {
        expirationTtl: 7 * 24 * 60 * 60, // 7 days
        metadata: {
          timestamp: Date.now(),
          userId: userId
        }
      }
    );
    
    // Store file in R2 if configured
    if (c.env.STORAGE) {
      const fileKey = `ocr/${userId}/${fileHash}`;
      await c.env.STORAGE.put(fileKey, arrayBuffer, {
        customMetadata: {
          userId,
          fileName: file.name,
          fileType: file.type,
          processedAt: new Date().toISOString()
        }
      });
    }
    
    // Log OCR request
    const historyId = await logOCRRequest(c.env.DB, userId, file, ocrResult, 'completed');
    
    // Deduct credits for free tier
    if (user.subscription_tier === 'free') {
      await c.env.DB.prepare(
        'UPDATE users SET credits = credits - 1 WHERE id = ?'
      ).bind(userId).run();
    }
    
    return c.json({
      success: true,
      cached: false,
      result: ocrResult,
      historyId,
      creditsRemaining: user.subscription_tier === 'free' ? user.credits - 1 : 'unlimited'
    });
    
  } catch (error) {
    console.error('OCR processing error:', error);
    return c.json({ 
      error: 'OCR processing failed',
      details: error.message,
      stack: error.stack
    }, 500);
  }
});

// Batch processing
ocrRoutes.post('/batch', async (c) => {
  const userId = c.get('userId');
  
  try {
    const user = await c.env.DB.prepare(
      'SELECT credits, subscription_tier FROM users WHERE id = ?'
    ).bind(userId).first();
    
    // Check if user has batch processing access
    if (!['professional', 'enterprise'].includes(user.subscription_tier)) {
      return c.json({ error: 'Batch processing requires Professional or Enterprise tier' }, 403);
    }
    
    const formData = await c.req.formData();
    const files = formData.getAll('files');
    
    if (!files || files.length === 0) {
      return c.json({ error: 'No files provided' }, 400);
    }
    
    if (files.length > 10) {
      return c.json({ error: 'Maximum 10 files per batch' }, 400);
    }
    
    const results = [];
    const errors = [];
    
    for (const file of files) {
      try {
        // Process each file
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        const dataUri = `data:${file.type};base64,${base64}`;
        
        const ocrResult = await processWithMistral(dataUri, {}, c.env);
        
        results.push({
          fileName: file.name,
          success: true,
          result: ocrResult
        });
        
        // Log each file
        await logOCRRequest(c.env.DB, userId, file, ocrResult, 'completed');
        
      } catch (error) {
        errors.push({
          fileName: file.name,
          success: false,
          error: error.message
        });
      }
    }
    
    return c.json({
      success: true,
      totalFiles: files.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors
    });
    
  } catch (error) {
    console.error('Batch processing error:', error);
    return c.json({ error: 'Batch processing failed' }, 500);
  }
});

// Get OCR history
ocrRoutes.get('/history', async (c) => {
  const userId = c.get('userId');
  const { page = 1, limit = 20 } = c.req.query();
  
  try {
    const offset = (page - 1) * limit;
    
    const history = await c.env.DB.prepare(
      `SELECT id, file_name, file_size, file_type, language, 
              confidence, processing_time, credits_used, status, 
              created_at
       FROM ocr_history 
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(userId, limit, offset).all();
    
    const total = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM ocr_history WHERE user_id = ?'
    ).bind(userId).first();
    
    return c.json({
      success: true,
      history: history.results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total.count,
        totalPages: Math.ceil(total.count / limit)
      }
    });
    
  } catch (error) {
    console.error('History fetch error:', error);
    return c.json({ error: 'Failed to fetch history' }, 500);
  }
});

// Get specific OCR result
ocrRoutes.get('/result/:id', async (c) => {
  const userId = c.get('userId');
  const resultId = c.req.param('id');
  
  try {
    const result = await c.env.DB.prepare(
      `SELECT * FROM ocr_history 
       WHERE id = ? AND user_id = ?`
    ).bind(resultId, userId).first();
    
    if (!result) {
      return c.json({ error: 'Result not found' }, 404);
    }
    
    return c.json({
      success: true,
      result
    });
    
  } catch (error) {
    console.error('Result fetch error:', error);
    return c.json({ error: 'Failed to fetch result' }, 500);
  }
});

// Helper function to process with Mistral
async function processWithMistral(dataUri, options, env) {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: 'pixtral-12b-2409',
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(options)
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: dataUri }
            },
            {
              type: 'text',
              text: 'Process this document according to the system instructions.'
            }
          ]
        }
      ]
    })
  });
  
  if (!response.ok) {
    throw new Error(`Mistral API error: ${response.status}`);
  }
  
  const result = await response.json();
  const extractedText = result.choices[0].message.content;
  
  // Detect language
  const language = detectLanguage(extractedText);
  
  return {
    text: extractedText,
    language,
    confidence: 0.95,
    processingTime: Date.now()
  };
}

function buildSystemPrompt(options) {
  let prompt = `You are an advanced OCR system. Extract ALL text from the document with high accuracy.
Instructions:
1. Extract all text maintaining original structure
2. Preserve formatting, headers, paragraphs, lists
3. For Arabic text: Pay attention to RTL direction and diacritics
4. Output in clean Markdown format`;
  
  if (options.extractImages) {
    prompt += '\n5. Describe any images, charts, or diagrams';
  }
  if (options.autoTranslate) {
    prompt += '\n6. Provide English translation for Arabic text';
  }
  
  return prompt;
}

function detectLanguage(text) {
  // Simple Arabic detection
  const arabicPattern = /[\u0600-\u06FF]/;
  if (arabicPattern.test(text)) {
    return 'ar';
  }
  return 'en';
}

async function logOCRRequest(db, userId, file, result, status) {
  const id = uuidv4();
  
  await db.prepare(
    `INSERT INTO ocr_history 
     (id, user_id, file_name, file_size, file_type, extracted_text, 
      language, confidence, processing_time, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    id,
    userId,
    file.name,
    file.size,
    file.type,
    result.text,
    result.language,
    result.confidence,
    result.processingTime,
    status
  ).run();
  
  return id;
}