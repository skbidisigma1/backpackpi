import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import filesRouter from './routes/files.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));

// Configurable root directory for file browser
const ROOT_DIR = process.env.FILE_ROOT || path.resolve(process.cwd());
app.set('FILE_ROOT', ROOT_DIR);

// CORS simple allow same-origin / local network (adjust if needed)
app.use((req,res,next)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// API routes
app.use('/api/files', filesRouter);

app.get('/api/health', (req,res)=>{ res.json({ ok:true, time: Date.now() }); });

// Version & route debug helpers
let PKG_VERSION = null;
try {
  const pkgRaw = fs.readFileSync(path.join(process.cwd(), 'package.json'),'utf8');
  PKG_VERSION = JSON.parse(pkgRaw).version || null;
} catch {}

app.get('/api/version', (req,res)=>{
  res.json({ version: PKG_VERSION, time: Date.now(), fileRoot: app.get('FILE_ROOT') });
});

app.get('/api/_debug/routes', (req,res)=>{
  const out = [];
  function collect(stack, prefix=''){
    stack.forEach(layer => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods);
        out.push({ path: prefix + layer.route.path, methods });
      } else if (layer.name === 'router' && layer.handle?.stack) {
        // Attempt to derive mount path fragment from regexp (best-effort)
        let mount = '';
        if (layer.regexp && layer.regexp.source){
          const m = layer.regexp.source.match(/\\\/api\\\/[^\\^]+/); // crude extract
          if (m) mount = m[0].replace(/\\\\/g,'/');
        }
        collect(layer.handle.stack, mount);
      }
    });
  }
  collect(app._router.stack);
  res.json(out);
});

// API 404 handler (before static) for clarity if wrong host
app.use('/api', (req,res,next)=>{
  if (req.path === '/' || req.path === '') return next();
  if (!res.headersSent) res.status(404).json({ error:'API route not found', path:req.originalUrl });
});

// Static frontend: prefer built dist if present, else raw frontend
const distDir = path.join(process.cwd(), 'dist');
app.use('/', express.static(fsExistsDir(distDir) ? distDir : path.join(process.cwd(), 'frontend')));

function fsExistsDir(p){
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

// Error handler fallback
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('ERR', err);
  res.status(err.status || 500).json({ error: err.publicMessage || 'Server error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Backpack Pi server listening on :${port}`);
  console.log('File root:', ROOT_DIR);
});
