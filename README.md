# Backpack Pi (Frontend + Lightweight Backend)

Minimal, extensible headless UI + file management backend for a Raspberry Pi Zero 2 W.

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
Currently implemented:
- `GET /api/files?path=/sub/path` – list directory (with `showHidden=1`)
- `POST /api/files/mkdir` – create directory `{ path, name }`
- `POST /api/files/rename` – rename `{ path, newName }`
- `DELETE /api/files?path=/path/file` – remove file/dir (recursive)
- `GET /api/files/download?path=/path/file` – stream download
- `GET /api/health` – simple health probe

Planned / future:
- `POST /api/files/upload` – upload file(s)
- `GET /api/status` – system metrics
- WebSocket push updates

## Extending Routes
Add a new module file in `js/modules/` exporting `render(root)` and extend conditional import block in `app.js` (or refactor to a registry map).

## Development

Run backend + serve frontend (preferred):
```bash
npm install
npm run dev           # or: node server/index.js
open http://localhost:3000/
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
1. Upload endpoint (multi-part) + progress bar.
2. Status metrics (CPU, RAM) endpoint.
3. Registry-based module loading map.
4. Offline fallback page in SW.
5. Error boundary wrapper for dynamic imports.
6. Auth / session hardening.

## License
(Define project license here.)
