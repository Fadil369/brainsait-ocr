import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';

export const ragRoutes = new Hono();

// Create or update document in RAG system
ragRoutes.post('/documents', async (c) => {
  const userId = c.get('userId');
  const { name, content, metadata } = await c.req.json();
  
  if (!name || !content) {
    return c.json({ error: 'Name and content required' }, 400);
  }
  
  try {
    // Generate embeddings using Cloudflare AI
    const embedding = await generateEmbedding(content, c.env);
    
    const docId = uuidv4();
    
    // Store document with embedding
    await c.env.DB.prepare(
      `INSERT INTO rag_documents (id, user_id, document_name, content, embedding, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      docId,
      userId,
      name,
      content,
      embedding,
      JSON.stringify(metadata || {})
    ).run();
    
    return c.json({
      success: true,
      documentId: docId,
      message: 'Document indexed successfully'
    });
    
  } catch (error) {
    console.error('Document indexing error:', error);
    return c.json({ error: 'Failed to index document' }, 500);
  }
});

// Query RAG system
ragRoutes.post('/query', async (c) => {
  const userId = c.get('userId');
  const { query, conversationId, maxResults = 5 } = await c.req.json();
  
  if (!query) {
    return c.json({ error: 'Query required' }, 400);
  }
  
  try {
    // Check user tier for RAG access
    const user = await c.env.DB.prepare(
      'SELECT subscription_tier FROM users WHERE id = ?'
    ).bind(userId).first();
    
    if (!['professional', 'enterprise'].includes(user.subscription_tier)) {
      return c.json({ error: 'RAG requires Professional or Enterprise tier' }, 403);
    }
    
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query, c.env);
    
    // Search for similar documents (vector similarity search)
    // Note: D1 doesn't support vector operations natively, so we'll use a workaround
    const documents = await c.env.DB.prepare(
      `SELECT id, document_name, content, metadata 
       FROM rag_documents 
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    ).bind(userId, maxResults).all();
    
    // Score documents based on similarity (simplified)
    const scoredDocs = documents.results.map(doc => ({
      ...doc,
      score: calculateSimilarity(query, doc.content)
    })).sort((a, b) => b.score - a.score);
    
    // Get top relevant documents
    const relevantDocs = scoredDocs.slice(0, Math.min(3, scoredDocs.length));
    
    // Generate response using context
    const response = await generateRAGResponse(
      query,
      relevantDocs,
      c.env
    );
    
    // Create or update conversation
    let convId = conversationId;
    if (!convId) {
      convId = uuidv4();
      await c.env.DB.prepare(
        `INSERT INTO rag_conversations (id, user_id, title, created_at)
         VALUES (?, ?, ?, datetime('now'))`
      ).bind(convId, userId, query.substring(0, 100)).run();
    }
    
    // Store messages
    const userMessageId = uuidv4();
    const assistantMessageId = uuidv4();
    
    await c.env.DB.prepare(
      `INSERT INTO rag_messages (id, conversation_id, user_id, role, content, created_at)
       VALUES (?, ?, ?, 'user', ?, datetime('now'))`
    ).bind(userMessageId, convId, userId, query).run();
    
    await c.env.DB.prepare(
      `INSERT INTO rag_messages (id, conversation_id, user_id, role, content, document_references, created_at)
       VALUES (?, ?, ?, 'assistant', ?, ?, datetime('now'))`
    ).bind(
      assistantMessageId,
      convId,
      userId,
      response,
      JSON.stringify(relevantDocs.map(d => d.id))
    ).run();
    
    return c.json({
      success: true,
      response,
      conversationId: convId,
      sources: relevantDocs.map(doc => ({
        id: doc.id,
        name: doc.document_name,
        relevance: doc.score
      }))
    });
    
  } catch (error) {
    console.error('RAG query error:', error);
    return c.json({ error: 'Failed to process query' }, 500);
  }
});

// Get user's documents
ragRoutes.get('/documents', async (c) => {
  const userId = c.get('userId');
  const { page = 1, limit = 20 } = c.req.query();
  
  try {
    const offset = (page - 1) * limit;
    
    const documents = await c.env.DB.prepare(
      `SELECT id, document_name, created_at, updated_at
       FROM rag_documents
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(userId, limit, offset).all();
    
    const total = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM rag_documents WHERE user_id = ?'
    ).bind(userId).first();
    
    return c.json({
      success: true,
      documents: documents.results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total.count,
        totalPages: Math.ceil(total.count / limit)
      }
    });
    
  } catch (error) {
    console.error('Documents fetch error:', error);
    return c.json({ error: 'Failed to fetch documents' }, 500);
  }
});

// Get conversations
ragRoutes.get('/conversations', async (c) => {
  const userId = c.get('userId');
  
  try {
    const conversations = await c.env.DB.prepare(
      `SELECT c.*, 
              (SELECT COUNT(*) FROM rag_messages WHERE conversation_id = c.id) as message_count
       FROM rag_conversations c
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC, c.created_at DESC
       LIMIT 50`
    ).bind(userId).all();
    
    return c.json({
      success: true,
      conversations: conversations.results
    });
    
  } catch (error) {
    console.error('Conversations fetch error:', error);
    return c.json({ error: 'Failed to fetch conversations' }, 500);
  }
});

// Get conversation messages
ragRoutes.get('/conversations/:id', async (c) => {
  const userId = c.get('userId');
  const conversationId = c.req.param('id');
  
  try {
    // Verify conversation ownership
    const conv = await c.env.DB.prepare(
      'SELECT id FROM rag_conversations WHERE id = ? AND user_id = ?'
    ).bind(conversationId, userId).first();
    
    if (!conv) {
      return c.json({ error: 'Conversation not found' }, 404);
    }
    
    const messages = await c.env.DB.prepare(
      `SELECT * FROM rag_messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC`
    ).bind(conversationId).all();
    
    return c.json({
      success: true,
      conversationId,
      messages: messages.results
    });
    
  } catch (error) {
    console.error('Messages fetch error:', error);
    return c.json({ error: 'Failed to fetch messages' }, 500);
  }
});

// Delete document
ragRoutes.delete('/documents/:id', async (c) => {
  const userId = c.get('userId');
  const documentId = c.req.param('id');
  
  try {
    const result = await c.env.DB.prepare(
      'DELETE FROM rag_documents WHERE id = ? AND user_id = ?'
    ).bind(documentId, userId).run();
    
    if (result.changes === 0) {
      return c.json({ error: 'Document not found' }, 404);
    }
    
    return c.json({
      success: true,
      message: 'Document deleted successfully'
    });
    
  } catch (error) {
    console.error('Document deletion error:', error);
    return c.json({ error: 'Failed to delete document' }, 500);
  }
});

// Helper functions
async function generateEmbedding(text, env) {
  // Use Cloudflare AI for embeddings when available
  // For now, return a placeholder
  if (env.AI) {
    try {
      const response = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text
      });
      return JSON.stringify(response.data[0]);
    } catch (error) {
      console.error('Embedding generation error:', error);
    }
  }
  
  // Fallback: Simple hash-based pseudo-embedding
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  );
  return JSON.stringify(Array.from(new Uint8Array(hash)).slice(0, 128));
}

function calculateSimilarity(query, content) {
  // Simple text similarity (Jaccard similarity)
  const queryWords = new Set(query.toLowerCase().split(/\s+/));
  const contentWords = new Set(content.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...queryWords].filter(x => contentWords.has(x)));
  const union = new Set([...queryWords, ...contentWords]);
  
  return intersection.size / union.size;
}

async function generateRAGResponse(query, documents, env) {
  // Prepare context from documents
  const context = documents.map(doc => 
    `Document: ${doc.document_name}\n${doc.content.substring(0, 500)}...`
  ).join('\n\n');
  
  // Generate response using Mistral or Cloudflare AI
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that answers questions based on the provided context.
                   Use the context to provide accurate and relevant answers.
                   If the context doesn't contain relevant information, say so.`
        },
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${query}`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to generate response');
  }
  
  const result = await response.json();
  return result.choices[0].message.content;
}