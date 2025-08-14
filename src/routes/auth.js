import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { v4 as uuidv4 } from 'uuid';

export const authRoutes = new Hono();

// Register
authRoutes.post('/register', async (c) => {
  const { email, password, name, phone } = await c.req.json();
  
  // Validate input
  if (!email || !password || !name) {
    return c.json({ error: 'Missing required fields' }, 400);
  }
  
  try {
    // Check if user exists
    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();
    
    if (existingUser) {
      return c.json({ error: 'User already exists' }, 409);
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    
    // Create user
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, password, name, phone, created_at, credits, subscription_tier) 
       VALUES (?, ?, ?, ?, ?, datetime('now'), 10, 'free')`
    ).bind(userId, email, hashedPassword, name, phone).run();
    
    // Generate JWT
    const token = await new SignJWT({ sub: userId, email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode(c.env.JWT_SECRET));
    
    return c.json({
      success: true,
      token,
      user: {
        id: userId,
        email,
        name,
        credits: 10,
        subscription_tier: 'free'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'Registration failed' }, 500);
  }
});

// Login
authRoutes.post('/login', async (c) => {
  const { email, password } = await c.req.json();
  
  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400);
  }
  
  try {
    // Get user
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first();
    
    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    // Update last login
    await c.env.DB.prepare(
      'UPDATE users SET last_login = datetime("now") WHERE id = ?'
    ).bind(user.id).run();
    
    // Generate JWT
    const token = await new SignJWT({ sub: user.id, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode(c.env.JWT_SECRET));
    
    return c.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        credits: user.credits,
        subscription_tier: user.subscription_tier
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Login failed' }, 500);
  }
});

// Logout
authRoutes.post('/logout', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (token) {
    // Add token to blacklist in KV with TTL
    await c.env.SESSIONS.put(`blacklist_${token}`, 'true', {
      expirationTtl: 7 * 24 * 60 * 60 // 7 days
    });
  }
  
  return c.json({ success: true, message: 'Logged out successfully' });
});

// Password reset request
authRoutes.post('/forgot-password', async (c) => {
  const { email } = await c.req.json();
  
  if (!email) {
    return c.json({ error: 'Email required' }, 400);
  }
  
  try {
    const user = await c.env.DB.prepare(
      'SELECT id, name FROM users WHERE email = ?'
    ).bind(email).first();
    
    if (user) {
      // Generate reset token
      const resetToken = uuidv4();
      const resetExpiry = new Date(Date.now() + 3600000).toISOString(); // 1 hour
      
      // Store reset token
      await c.env.DB.prepare(
        'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?'
      ).bind(resetToken, resetExpiry, user.id).run();
      
      // TODO: Send email with reset link
      // For now, return token (in production, never do this)
      return c.json({
        success: true,
        message: 'Password reset link sent to email',
        // Remove in production:
        resetToken
      });
    }
    
    // Don't reveal if user exists
    return c.json({
      success: true,
      message: 'If the email exists, a reset link has been sent'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return c.json({ error: 'Failed to process request' }, 500);
  }
});

// Reset password
authRoutes.post('/reset-password', async (c) => {
  const { token, newPassword } = await c.req.json();
  
  if (!token || !newPassword) {
    return c.json({ error: 'Token and new password required' }, 400);
  }
  
  try {
    // Find user with valid reset token
    const user = await c.env.DB.prepare(
      `SELECT id FROM users 
       WHERE reset_token = ? 
       AND reset_token_expiry > datetime('now')`
    ).bind(token).first();
    
    if (!user) {
      return c.json({ error: 'Invalid or expired token' }, 400);
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password and clear reset token
    await c.env.DB.prepare(
      `UPDATE users 
       SET password = ?, reset_token = NULL, reset_token_expiry = NULL 
       WHERE id = ?`
    ).bind(hashedPassword, user.id).run();
    
    return c.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return c.json({ error: 'Failed to reset password' }, 500);
  }
});