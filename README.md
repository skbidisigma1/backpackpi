# Backpack Pi Frontend (Skeleton)

Minimal, extensible headless UI shell for a Raspberry Pi Zero 2 W.

## Structure
```
frontend/
  index.html          # Shell + nav
  assets/
    styles.css        # Single central stylesheet (tokens, utilities, components)
    fonts/Miracode.woff2
  js/
    app.js            # Entry: theme, router init, SW registration
    router.js         # Hash router
    store.js          # Tiny pub/sub store
    components/
      toast.js        # Toast notifications
    modules/
      dashboard.js
      files.js
      games.js
      proxy.js
      settings.js
  sw.js               # Service worker for shell/font caching
```

## Design Tokens
Defined in `assets/styles.css` root: typography scale, spacing, radii, color system (light + dark). Theme toggled via `data-theme` attribute on `<html>`.

## Service Worker / Caching
- Pre-caches shell assets + font.
- Runtime cache fill for other requests (network-first fallback).
- Increment `CACHE_NAME` in `sw.js` when changing asset set.

## Adding Backend APIs
Example endpoints (to implement separately):
- `GET /api/status` -> dashboard metrics (push updates via WebSocket later)
- `GET /api/files?path=` -> file listing
- `GET /api/games` -> list games

## Extending Routes
Add a new module file in `js/modules/` exporting `render(root)` and extend conditional import block in `app.js` (or refactor to a registry map).

## Development

Serve the `frontend/` directory with a static server so SW + modules function:

```bash
# Example (Python 3)
python -m http.server 8000 -d frontend
```

Navigate to: http://localhost:8000/

## Build / Release (CI)

Node-based build pipeline (esbuild + csso + html-minifier) produces a `dist/` folder:

```bash
npm install
npm run build
```

GitHub Actions workflow builds on every push to `main` and when a tag matching `v*` is pushed it will create a GitHub Release attaching the minified `dist` artifact. To publish a new release locally:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow then minifies assets and uploads them to the release automatically.

## Theming
Toggle uses localStorage `theme`. Add more theme variables by extending `:root` and `[data-theme=dark]` sections.

## Games Placeholder
`games.js` will dynamically import game modules. Each game should export `mount(container)` & `unmount()` for lifecycle cleanliness.

## Accessibility
Focus ring via `:focus-visible`. Main region gets focus after route change for screen readers.

## Next Steps
1. Implement mock status update loop (or WebSocket client).
2. Build actual file browser with backend.
3. Introduce registry-based routing (cleaner than if/else chain).
4. Convert additional font weights if needed.
5. Add offline fallback page in SW.
6. Add error boundary wrapper for dynamic imports.

## License
(Define project license here.)
