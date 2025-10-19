# Backpack Pi (Frontend + Lightweight Backend)

Minimal, extensible headless UI + file management backend for a Raspberry Pi Zero 2 W.

## Features

- **PAM-based Authentication**: Uses Raspberry Pi system accounts for login
- **Role-based Access Control**: Guest, Viewer, Admin, and Sudo roles
- **File Management**: Browse, upload, download, edit files with permission controls
- **Offline-capable**: Service worker caching for core assets
- **Theme Support**: Light/dark mode toggle with localStorage persistence

## Authentication & Roles

The system uses **PAM (Pluggable Authentication Modules)** to authenticate against Raspberry Pi system user accounts. All API routes (except login) require authentication.

### Role Hierarchy

1. **Guest** (default): No access to any endpoints. Assigned to all new system users by default.
2. **Viewer**: Read-only access. Can view files, health checks, and version info.
3. **Admin**: Full user-facing access. Can create, modify, and delete files.
4. **Sudo**: Full system access. Can manage all users' roles and access all endpoints.

### Default Sudo User

The user `lukec309` is automatically set as sudo on first run. This can be changed via the `SUDO_USER` environment variable:

```bash
SUDO_USER=youruser node server/index.js
```

### Managing Roles

Sudo users can manage roles via the **Users** section in the UI, or via API:

```bash
# List all users
curl http://localhost:3000/api/auth/users -H "Cookie: backpackpi.sid=..."

# Update a user's role
curl -X POST http://localhost:3000/api/auth/users/USERNAME/role \
  -H "Content-Type: application/json" \
  -H "Cookie: backpackpi.sid=..." \
  -d '{"role": "admin"}'
```

### Session Management

- Sessions persist for **14 days** (stored in SQLite)
- Cookies are httpOnly and secure (if HTTPS enabled)
- Failed login attempts are rate-limited (5 attempts per 15 minutes)

## Structure

```text
frontend/
  index.html          # Shell + nav
  assets/
    styles.css        # Single central stylesheet (tokens, utilities, components)
    fonts/Miracode.woff2
  js/
    app.js            # Entry: theme, router init, SW registration
    store.js          # Tiny pub/sub store
    components/
      toast.js        # Toast notifications
    modules/
      dashboard.js
      files.js
      games.js
      proxy.js
  index.js            # Express server (static + file API)
  routes/
    files.js          # File operations (list, mkdir, rename, delete, download)
## Design Tokens
Defined in `assets/styles.css` root: typography scale, spacing, radii, color system (light + dark). Theme toggled via `data-theme` attribute on `<html>`.
- Runtime cache fill for other requests (network-first fallback).
- Increment `CACHE_NAME` in `sw.js` when changing asset set.

## Backend APIs

### Authentication (`/api/auth`)

- `POST /api/auth/login` – Login with system username/password `{ username, password }`
- `POST /api/auth/logout` – Logout current session
- `GET /api/auth/status` – Check authentication status
- `GET /api/auth/users` – List all users and roles (sudo only)
- `POST /api/auth/users/:username/role` – Update user role `{ role }` (sudo only)

### Files (`/api/files`)

All file endpoints require authentication. Viewer role can read, Admin role can write.

- `GET /api/files?path=/sub/path` – list directory (with `showHidden=1`) [Viewer+]
- `GET /api/files/download?path=/path/file` – stream download [Viewer+]
- `GET /api/files/content?path=/path/file` – read file content [Viewer+]
- `POST /api/files/mkdir` – create directory `{ path, name }` [Admin+]
- `POST /api/files/rename` – rename `{ path, newName }` [Admin+]
- `POST /api/files/write` – write file content `{ path, content }` [Admin+]
- `DELETE /api/files?path=/path/file` – remove file/dir (recursive) [Admin+]

### System

- `GET /api/health` – health probe [Viewer+]
- `GET /api/version` – get version info [Viewer+]

Planned / future:
- `POST /api/files/upload` – upload file(s)
- `GET /api/status` – system metrics
- WebSocket push updates

## Extending Routes
Add a new module file in `js/modules/` exporting `render(root)` and extend conditional import block in `app.js` (or refactor to a registry map).

## Development

### Environment Variables

- `FILE_ROOT` – Root directory for file browser (default: current working directory)
- `PORT` – Server port (default: 3000)
- `SUDO_USER` – Username to set as sudo on first run (default: lukec309)
- `SESSION_SECRET` – Secret for session encryption (default: auto-generated, set in production)
- `DATA_DIR` – Directory for SQLite databases (default: current working directory)
- `NODE_ENV` – Set to `production` for production mode
- `HTTPS` – Set to `true` if using HTTPS (enables secure cookies)

Run backend + serve frontend (preferred):

```bash
npm install
npm run dev           # or: node server/index.js
```

Open http://localhost:3000/ and login with a system user account.

Just rebuild frontend assets:

```bash

If you strictly want static only (no API) you can still do:
```bash
python -m http.server 8000 -d dist
```
But the Files view will not work without the backend.

## Build / Release (CI)

The GitHub Actions workflow now packages BOTH:
  - `dist/` (minified frontend)
  - `server/` + `package.json` + `package-lock.json` + `run.sh`

On tag push (`v*`) it creates release archives:
  - `backpackpi-vX.Y.Z.tar.gz` / `.zip` (full deployable bundle)
  - `SHA256SUMS`

Tag & push to release:
```bash
git tag v0.1.45
git push origin v0.1.45
```

Locally build only:
```bash
npm run build
```

## Theming
Toggle uses localStorage `theme`. Add more theme variables by extending `:root` and `[data-theme=dark]` sections.

## Games Placeholder
`games.js` will dynamically import game modules. Each game should export `mount(container)` & `unmount()` for lifecycle cleanliness.

## Accessibility
Focus ring via `:focus-visible`. Main region gets focus after route change for screen readers.

## Deployment on Pi

1. Download latest release (tar or zip) to target directory, e.g. `/opt/backpackpi`:

```bash
mkdir -p /opt/backpackpi && cd /opt/backpackpi
curl -LO https://github.com/skbidisigma1/backpackpi/releases/download/v0.1.45/backpackpi-v0.1.45.tar.gz
tar -xzf backpackpi-v0.1.45.tar.gz
```

2. (First run) Install production deps & start:

```bash
./run.sh
```

3. Access UI at: `http://<pi-ip>:3000/`

4. Override root directory for file browser:

```bash
FILE_ROOT=/home/pi PORT=3000 ./run.sh
```

### One-Step Systemd Install (automatic)

From within the extracted release directory (as root):

Note on Windows / local development
----------------------------------

The PAM binding (`authenticate-pam`) is an optional dependency and may fail to build on Windows. To allow development on Windows or environments without PAM, the project supports a development fallback:

- Set `DEV_AUTH=true` to enable the fallback authentication mode.
- Optionally set `DEV_AUTH_PASSWORD` to require a shared password during development.

Disable `DEV_AUTH` in production. On Raspberry Pi (Linux), PAM will be used by default.


```bash
sudo ./scripts/install-service.sh
```

This will:
1. Copy the bundle to `/opt/backpackpi/app`
2. Create `/etc/systemd/system/backpackpi-backend.service`
3. Enable & start the service

Check status:

```bash
systemctl status backpackpi-backend --no-pager
journalctl -u backpackpi-backend -f
```

### Systemd Unit (optional)
Create `/etc/systemd/system/backpackpi.service`:
```ini
[Unit]
Description=Backpack Pi
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/backpackpi
Environment=FILE_ROOT=/opt/backpackpi
ExecStart=/usr/bin/env bash /opt/backpackpi/run.sh
Restart=on-failure
User=pi
Group=pi

[Install]
WantedBy=multi-user.target
```
Enable:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now backpackpi
```

## Next Steps

1. ✅ **Authentication** – PAM-based auth with role-based access control (Guest/Viewer/Admin/Sudo)
2. Upload endpoint (multi-part) + progress bar
3. Status metrics (CPU, RAM, disk) endpoint  
4. Registry-based module loading map
5. Offline fallback page in SW
6. Error boundary wrapper for dynamic imports
7. Additional hardening: CSRF tokens, rate limiting per-user
8. Audit logging for admin/sudo actions

## License
(Define project license here.)
