import { Router } from 'express';
import fs from 'fs';
import os from 'os';
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

  // Try to use authenticate-pam if available (POSIX). Otherwise fallback to DEV_AUTH
  let pamAvailable = false;
  let authenticate = null;
  try {
    // Optional dependency - may not be present on Windows
    // eslint-disable-next-line import/no-extraneous-dependencies
    // dynamic require to avoid startup failure when module missing
    // (works in Node ESM via createRequire or eval require)
    authenticate = (await import('authenticate-pam')).authenticate;
    pamAvailable = true;
  } catch (e) {
    pamAvailable = false;
  }

  async function onAuthSuccess() {
    await resetLoginLimit(username);
    const role = getUserRole(username);
    req.session.username = username;
    req.session.cookie.maxAge = 14 * 24 * 60 * 60 * 1000; // 14 days
    console.log(`[auth] User logged in: ${username} (role: ${role})`);
    res.json({ success: true, username, role });
  }

  if (pamAvailable && os.platform() !== 'win32') {
    // Use PAM on POSIX systems
    authenticate({ username, password }, (err, success) => {
      if (err || !success) {
        console.warn(`[auth] Failed login attempt for user: ${username}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      onAuthSuccess();
    });
    return;
  }

  // Fallback dev auth: if DEV_AUTH=true, allow login if PASSWORD is set to match, or
  // accept any username that exists in /etc/passwd when running on POSIX. This
  // fallback is intentionally permissive for local dev and Windows where PAM is
  // unavailable. Set DEV_AUTH=false in production to require PAM.
  const devAuth = process.env.DEV_AUTH === 'true';
  if (devAuth) {
    // If DEV_AUTH true and DEV_AUTH_PASSWORD set, require that password matches
    const devPass = process.env.DEV_AUTH_PASSWORD;
    if (devPass) {
      if (password === devPass) return onAuthSuccess();
      console.warn(`[auth] DEV_AUTH failed for user: ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // If running on POSIX, accept any existing system username (no password check)
    try {
      if (fs.existsSync('/etc/passwd')) {
        const passwd = fs.readFileSync('/etc/passwd', 'utf8');
        const exists = passwd.split('\n').some(line => line.startsWith(username + ':'));
        if (exists) return onAuthSuccess();
      }
    } catch (e) {
      // ignore
    }

    // As last resort on non-POSIX (Windows), accept login if DEV_AUTH=true and no password set
    return onAuthSuccess();
  }

  // If no PAM and not in DEV_AUTH mode, disallow login on this platform
  console.error('[auth] PAM not available and DEV_AUTH not enabled - cannot authenticate on this platform');
  return res.status(503).json({ error: 'Authentication provider unavailable on this platform' });
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
