import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import filesRouter from './routes/files.js';
import { readFileSync } from 'fs';

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
app.get('/api/version', (req,res)=>{
  let version = 'unknown';
  try {
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(),'package.json'),'utf8'));
    version = pkg.version || version;
  } catch {}
  res.json({ version });
});

// API 404 handler (before static) for clarity if wrong host
app.use('/api', (req,res,next)=>{
  if (req.path === '/' || req.path === '') return next();
  if (!res.headersSent) {
    console.warn('[api-404]', req.method, req.originalUrl);
    res.status(404).json({ error:'API route not found', path:req.originalUrl });
  }
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
  try {
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(),'package.json'),'utf8'));
    console.log('Version:', pkg.version || 'unknown');
  } catch {}
});
