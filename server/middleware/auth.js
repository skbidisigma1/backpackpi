import { RateLimiterMemory } from 'rate-limiter-flexible';
import { getUserRole, checkPermission, ROLES } from '../db/roles.js';

// Rate limiter: 5 failed attempts per username per 15 minutes
const loginLimiter = new RateLimiterMemory({
  points: 5,
  duration: 15 * 60, // 15 minutes
  blockDuration: 15 * 60 // block for 15 minutes after exhausting points
});

/**
 * Rate limit login attempts by username
 */
export async function rateLimitLogin(username) {
  try {
    await loginLimiter.consume(username);
    return { allowed: true };
  } catch (rateLimiterRes) {
    const retryAfter = Math.ceil(rateLimiterRes.msBeforeNext / 1000);
    return { allowed: false, retryAfter };
  }
}

/**
 * Reset rate limit on successful login
 */
export async function resetLoginLimit(username) {
  try {
    await loginLimiter.delete(username);
  } catch {
    // ignore
  }
}

/**
 * Middleware: ensure user is authenticated
 */
export function requireAuth(req, res, next) {
  if (!req.session?.username) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // Attach user info to request
  req.user = {
    username: req.session.username,
    role: getUserRole(req.session.username)
  };
  next();
}

/**
 * Middleware factory: require specific role or higher
 */
export function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.session?.username) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const userRole = getUserRole(req.session.username);
    if (!checkPermission(req.session.username, requiredRole)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions', 
        required: requiredRole, 
        current: userRole 
      });
    }
    req.user = {
      username: req.session.username,
      role: userRole
    };
    next();
  };
}

/**
 * Convenience middleware exports
 */
export const requireGuest = requireRole(ROLES.GUEST);
export const requireViewer = requireRole(ROLES.VIEWER);
export const requireAdmin = requireRole(ROLES.ADMIN);
export const requireSudo = requireRole(ROLES.SUDO);
