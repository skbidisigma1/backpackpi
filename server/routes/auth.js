import { Router } from 'express';
import { authenticate } from 'authenticate-pam';
import { getUserRole, setUserRole, listUsers, ROLES } from '../db/roles.js';
import { rateLimitLogin, resetLoginLimit, requireAuth, requireSudo } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticate against PAM with username/password
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Rate limiting check
  const rateLimit = await rateLimitLogin(username);
  if (!rateLimit.allowed) {
    return res.status(429).json({ 
      error: 'Too many failed login attempts', 
      retryAfter: rateLimit.retryAfter 
    });
  }

  // Authenticate via PAM
  authenticate({ username, password }, (err, success) => {
    if (err || !success) {
      console.warn(`[auth] Failed login attempt for user: ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Success: reset rate limit and create session
    resetLoginLimit(username);
    
    const role = getUserRole(username);
    req.session.username = username;
    req.session.cookie.maxAge = 14 * 24 * 60 * 60 * 1000; // 14 days

    console.log(`[auth] User logged in: ${username} (role: ${role})`);
    
    res.json({ 
      success: true, 
      username, 
      role 
    });
  });
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  const username = req.session?.username;
  req.session?.destroy((err) => {
    if (err) {
      console.error('[auth] Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    if (username) {
      console.log(`[auth] User logged out: ${username}`);
    }
    res.json({ success: true });
  });
});

/**
 * GET /api/auth/status
 * Check current authentication status
 */
router.get('/status', (req, res) => {
  if (!req.session?.username) {
    return res.json({ authenticated: false });
  }
  const role = getUserRole(req.session.username);
  res.json({ 
    authenticated: true, 
    username: req.session.username, 
    role 
  });
});

/**
 * GET /api/auth/users
 * List all users and their roles (sudo only)
 */
router.get('/users', requireSudo, (req, res) => {
  try {
    const users = listUsers();
    res.json({ users });
  } catch (err) {
    console.error('[auth] Error listing users:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

/**
 * POST /api/auth/users/:username/role
 * Update user role (sudo only)
 */
router.post('/users/:username/role', requireSudo, (req, res) => {
  const { username } = req.params;
  const { role } = req.body;

  if (!role || !Object.values(ROLES).includes(role)) {
    return res.status(400).json({ error: 'Invalid role', validRoles: Object.values(ROLES) });
  }

  // Prevent sudo from demoting themselves
  if (username === req.session.username && role !== ROLES.SUDO) {
    return res.status(400).json({ error: 'Cannot change your own sudo role' });
  }

  try {
    setUserRole(username, role);
    console.log(`[auth] Role updated: ${username} -> ${role} (by ${req.session.username})`);
    res.json({ success: true, username, role });
  } catch (err) {
    console.error('[auth] Error updating role:', err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

export default router;
