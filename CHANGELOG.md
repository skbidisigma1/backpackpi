# Changelog

All notable changes to Backpack Pi will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.53] - 2025-10-18

### Added

- **PAM-based Authentication**: Users must login with Raspberry Pi system accounts
- **Role-Based Access Control**: Four roles (Guest, Viewer, Admin, Sudo) with hierarchical permissions
  - Guest: No access to API endpoints (default for new users)
  - Viewer: Read-only access (files, health, version)
  - Admin: Full user-facing access (can modify files)
  - Sudo: Full system access (can manage user roles)
- **Session Management**: 14-day persistent sessions stored in SQLite
- **Rate Limiting**: Failed login attempts limited to 5 per 15 minutes per user
- **User Management UI**: Sudo users can manage roles via new Users section
- **Auth API Endpoints**:
  - `POST /api/auth/login` - Login with username/password
  - `POST /api/auth/logout` - Logout current session
  - `GET /api/auth/status` - Check authentication status
  - `GET /api/auth/users` - List all users and roles (sudo only)
  - `POST /api/auth/users/:username/role` - Update user role (sudo only)
- **Login Module**: Clean login form UI with proper error handling
- **Auth State Management**: Frontend checks auth on load and redirects to login when needed
- **Environment Variables**: Added `.env.example` for easy configuration

### Changed

- All API routes now require authentication (except `/api/auth/login`)
- File routes now enforce role-based permissions:
  - Read operations require Viewer role or higher
  - Write operations require Admin role or higher
- Health and version endpoints now require Viewer role
- Frontend navigation includes Users section and logout button
- Updated README with comprehensive authentication documentation

### Security

- httpOnly session cookies
- Secure cookie flag when HTTPS is enabled
- PAM authentication against system users
- Path traversal protection in file operations
- Rate limiting on failed login attempts
- Role hierarchy enforcement

## [0.1.52] - Previous release

(Previous changes not documented)
