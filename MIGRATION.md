# Migration Guide: v0.1.52 → v0.1.53

## Overview

Version 0.1.53 introduces **authentication and role-based access control**. All API routes now require login with a Raspberry Pi system account.

## Breaking Changes

- **All API routes now require authentication** (except `/api/auth/login`)
- Public access to health checks and file endpoints is no longer available
- You must login with a valid system user account to access the UI

## Migration Steps

### 1. Update Dependencies

After pulling the new version:

```bash
npm install
```

This will install new dependencies:
- `authenticate-pam` - PAM authentication
- `better-sqlite3` - SQLite database for roles and sessions
- `better-sqlite3-session-store` - Session persistence
- `express-session` - Session middleware
- `rate-limiter-flexible` - Rate limiting

### 2. Set Sudo User (Important!)

By default, the user `lukec309` is set as the sudo administrator. To use a different user:

```bash
# Set your sudo user before first run
export SUDO_USER=yourusername
node server/index.js
```

Or add to your systemd service file:

```ini
Environment=SUDO_USER=yourusername
```

### 3. Create User Accounts

If you don't have system users yet, create them:

```bash
# Create a new user on Raspberry Pi
sudo adduser johndoe

# Set a strong password
sudo passwd johndoe
```

### 4. Assign Roles

On first run:
1. Login as the sudo user (default: `lukec309`)
2. Navigate to **Users** section in the UI
3. Assign roles to other system users:
   - **Guest**: No access (default)
   - **Viewer**: Read-only access
   - **Admin**: Can modify files
   - **Sudo**: Full system access

Or via API:

```bash
curl -X POST http://localhost:3000/api/auth/users/johndoe/role \
  -H "Content-Type: application/json" \
  -H "Cookie: backpackpi.sid=YOUR_SESSION_COOKIE" \
  -d '{"role": "admin"}'
```

### 5. Configure Session Secret (Production)

For production deployments, set a secure session secret:

```bash
# Generate a random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set in environment
export SESSION_SECRET=your_generated_secret_here
```

Or add to `.env` file (create from `.env.example`).

### 6. Set Data Directory (Optional)

By default, SQLite databases are created in the current working directory. To organize data:

```bash
export DATA_DIR=/opt/backpackpi/data
mkdir -p /opt/backpackpi/data
```

This creates:
- `/opt/backpackpi/data/backpackpi.db` - User roles
- `/opt/backpackpi/data/sessions.db` - Session storage

## Testing the Migration

1. Start the server:
   ```bash
   npm run dev
   ```

2. Open browser to `http://localhost:3000/`

3. You should see a **login page**

4. Login with your system credentials

5. Verify you can access appropriate sections based on your role

## Troubleshooting

### "Authentication required" on all pages

- Ensure you've logged in with valid system credentials
- Check browser console for errors
- Verify session cookie is being set (check browser DevTools > Application > Cookies)

### "Invalid credentials" but password is correct

- PAM authentication may require the Node.js process to have appropriate permissions
- Try running with `sudo` if testing locally (not recommended for production)
- Verify the user exists: `id username`

### Can't access Users section

- Only sudo users can access user management
- Verify your user is set as sudo: check server logs on startup
- Default sudo user is `lukec309` unless changed via `SUDO_USER` env var

### Session doesn't persist

- Check that `sessions.db` is being created
- Verify file permissions on the database
- Check `DATA_DIR` environment variable

### Rate limited after failed logins

- Wait 15 minutes for the rate limit to reset
- Restart the server to clear in-memory rate limits (not recommended in production)

## Rollback

If you need to rollback to v0.1.52:

```bash
git checkout v0.1.52
npm install
npm run dev
```

Note: The databases created by v0.1.53 will be ignored by v0.1.52.

## Questions?

Open an issue on GitHub or check the updated README.md for detailed documentation.
