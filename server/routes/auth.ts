import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db.js';
import { getJwtSecret } from '../utils/secret.js';

const router = express.Router();
const JWT_SECRET = getJwtSecret();

// In-memory store for tracking failed login attempts
const loginAttempts = new Map<string, { count: number, lockUntil: number }>();

router.post('/login', async (req, res) => {
  const { username, password, rememberMe } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const now = Date.now();
  const attempt = loginAttempts.get(username) || { count: 0, lockUntil: 0 };

  // Check if account is currently locked
  if (attempt.lockUntil > now) {
    const remainingMinutes = Math.ceil((attempt.lockUntil - now) / 60000);
    return res.status(429).json({ error: `Account locked due to too many failed attempts. Try again in ${remainingMinutes} minute(s).` });
  }

  // Reset count if lock period has expired
  if (attempt.lockUntil !== 0 && attempt.lockUntil <= now) {
    attempt.count = 0;
    attempt.lockUntil = 0;
  }

  const [rows]: any = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  const user = rows[0];

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    attempt.count += 1;
    if (attempt.count >= 5) {
      attempt.lockUntil = now + 10 * 60 * 1000; // Lock for 10 minutes
    }
    loginAttempts.set(username, attempt);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Successful login - reset attempts
  loginAttempts.delete(username);

  const expiresIn = rememberMe ? '30d' : '1d';
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn });
  
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  
  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge
  });
  
  res.cookie('csrf_token', csrfToken, {
    httpOnly: false, // Must be readable by client JS
    secure: true,
    sameSite: 'none',
    maxAge
  });

  res.json({ id: user.id, username: user.username, role: user.role, token });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.clearCookie('csrf_token');
  res.json({ success: true });
});

router.get('/me', async (req, res) => {
  let token = req.cookies.token;
  
  // Prefer Authorization header if present
  if (req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      const headerToken = authHeader.substring(7);
      if (headerToken && headerToken !== 'undefined' && headerToken !== 'null') {
        token = headerToken;
      }
    }
  }

  // Sanitize token
  if (token === 'undefined' || token === 'null') {
    token = null;
  }

  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const [userRows]: any = await pool.query('SELECT id, username, role FROM users WHERE id = ?', [decoded.id]);
    const user = userRows[0];
    
    if (!user) return res.status(401).json({ error: 'User not found' });

    // If viewer, get their allowed modules and products
    let allowedModules: string[] = [];
    let allowedProducts: string[] = [];
    
    if (user.role === 'viewer') {
      const [modules]: any = await pool.query('SELECT module_id FROM user_modules WHERE user_id = ?', [user.id]);
      allowedModules = modules.map((m: any) => m.module_id);
      
      const [products]: any = await pool.query('SELECT product_slug FROM user_products WHERE user_id = ?', [user.id]);
      allowedProducts = products.map((p: any) => p.product_slug);
    }

    res.json({ ...user, allowedModules, allowedProducts });
  } catch (err: any) {
    if (err.name !== 'TokenExpiredError') {
      console.error('Auth Me Error:', err.message);
    }
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
