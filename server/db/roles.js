import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store database in project root or use DATA_DIR env var
const dbPath = process.env.DATA_DIR 
  ? path.join(process.env.DATA_DIR, 'backpackpi.db')
  : path.join(process.cwd(), 'backpackpi.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS user_roles (
    username TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'guest',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_role ON user_roles(role);
`);

// Role hierarchy: guest < viewer < admin < sudo
const ROLES = {
  GUEST: 'guest',
  VIEWER: 'viewer',
  ADMIN: 'admin',
  SUDO: 'sudo'
};

const ROLE_HIERARCHY = ['guest', 'viewer', 'admin', 'sudo'];

function roleIndex(role) {
  return ROLE_HIERARCHY.indexOf(role);
}

function hasPermission(userRole, requiredRole) {
  return roleIndex(userRole) >= roleIndex(requiredRole);
}

/**
 * Get user role. Returns 'guest' if user not in database.
 */
export function getUserRole(username) {
  const row = db.prepare('SELECT role FROM user_roles WHERE username = ?').get(username);
  return row ? row.role : ROLES.GUEST;
}

/**
 * Set user role. Creates entry if doesn't exist.
 */
export function setUserRole(username, role) {
  if (!ROLE_HIERARCHY.includes(role)) {
    throw new Error(`Invalid role: ${role}`);
  }
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO user_roles (username, role, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      role = excluded.role,
      updated_at = excluded.updated_at
  `);
  stmt.run(username, role, now, now);
}

/**
 * Initialize sudo user if not exists
 */
export function ensureSudoUser(username) {
  const existing = getUserRole(username);
  if (existing !== ROLES.SUDO) {
    setUserRole(username, ROLES.SUDO);
    console.log(`[roles] Set ${username} as sudo user`);
  }
}

/**
 * List all users with roles
 */
export function listUsers() {
  return db.prepare('SELECT username, role, created_at, updated_at FROM user_roles ORDER BY username').all();
}

/**
 * Check if user has required permission level
 */
export function checkPermission(username, requiredRole) {
  const userRole = getUserRole(username);
  return hasPermission(userRole, requiredRole);
}

export { ROLES, hasPermission, db };
