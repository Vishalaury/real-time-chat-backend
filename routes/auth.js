import express from 'express';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { hashPassword, verifyPassword, signToken, requireAuth } from '../auth.js';

const router = express.Router();

// Basic rate limiting for auth endpoints
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

router.post('/register', limiter, async (req, res) => {
  try {
    const { username, password, email } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (username.length < 3) return res.status(400).json({ error: 'Username too short' });
    if (password.length < 6) return res.status(400).json({ error: 'Password too short' });

    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ error: 'Username already taken' });

    const hashed = await hashPassword(password);
    const user = await User.create({ username, email, password: hashed });

    const token = signToken({ id: user._id, username: user.username });
    res.json({ token, user: { id: user._id, username: user.username, email: user.email } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', limiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await verifyPassword(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ id: user._id, username: user.username });
    res.json({ token, user: { id: user._id, username: user.username, email: user.email } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  // req.user from token
  res.json({ user: req.user });
});

export default router;