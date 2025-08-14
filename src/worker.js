import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwtVerify } from 'jose';
import { authRoutes } from './routes/auth';
import { ocrRoutes } from './routes/ocr';
import { paymentRoutes } from './routes/payment';
import { ragRoutes } from './routes/rag';
import { userRoutes } from './routes/users';

const app = new Hono();

// CORS middleware
app.use('*', cors({
  origin: [
    'https://brainsait-ocr.pages.dev', 
    'https://0fdf3dfe.brainsait-ocr.pages.dev',
    'https://c11886df.brainsait-ocr.pages.dev',
    'http://localhost:3000'
  ],
  credentials: true,
}));

// Public routes
app.route('/api/auth', authRoutes);
app.route('/api/payment', paymentRoutes);

// Protected routes
app.use('/api/*', async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    c.set('userId', payload.sub);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

app.route('/api/ocr', ocrRoutes);
app.route('/api/rag', ragRoutes);
app.route('/api/users', userRoutes);

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy',
    service: 'BrainSAIT OCR Worker',
    timestamp: new Date().toISOString()
  });
});

// Scheduled tasks (cron)
export async function scheduled(event, env, ctx) {
  switch (event.cron) {
    case "0 */6 * * *":
      // Clean up old cache entries every 6 hours
      await cleanupCache(env);
      break;
  }
}

async function cleanupCache(env) {
  const keys = await env.CACHE.list();
  const now = Date.now();
  const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  for (const key of keys.keys) {
    const metadata = key.metadata;
    if (metadata && metadata.timestamp && (now - metadata.timestamp > MAX_AGE)) {
      await env.CACHE.delete(key.name);
    }
  }
}

export default {
  fetch: app.fetch,
  scheduled
};