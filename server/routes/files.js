import { Router } from 'express';
import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import mime from 'mime-types';
import { safeJoin, normalizePath } from '../util/path.js';

const MAX_EDIT_SIZE = 512 * 1024; // 512 KB safety limit for inline editor

function isProbablyBinary(buf){
  const len = Math.min(buf.length, 4096);
  let nonPrintable = 0;
  for (let i=0;i<len;i++){
    const c = buf[i];
    if (c === 0) return true;
    // Allow tab(9) LF(10) CR(13) and common whitespace
    if (c < 32 && c !== 9 && c !==10 && c !==13) nonPrintable++;
  }
  return (nonPrintable / len) > 0.2; // heuristic threshold
}

const router = Router();

function getRoot(req){ return req.app.get('FILE_ROOT'); }

router.get('/', async (req,res,next)=>{
  try {
    const rel = (req.query.path || '/');
    const showHidden = req.query.showHidden === '1';
    const root = getRoot(req);
    const abs = safeJoin(root, rel);
    const entries = await fs.readdir(abs, { withFileTypes: true });
    const result = [];
    for (const ent of entries) {
      if (!showHidden && ent.name.startsWith('.')) continue;
      const full = path.join(abs, ent.name);
      let stat; try { stat = await fs.lstat(full); } catch { continue; }
      const isDir = stat.isDirectory();
      result.push({
        name: ent.name,
        type: isDir ? 'dir' : 'file',
        size: isDir ? null : stat.size,
        mtime: Math.floor(stat.mtimeMs/1000),
        isLink: stat.isSymbolicLink?.() || false,
        mime: !isDir ? (mime.lookup(ent.name) || null) : null
      });
    }
    // Basic disk stats (optional): use statvfs via fs.statfs when available; fallback approximate
    let stats = null;
    try {
      const st = fssync.statSync(abs);
      stats = { node: st.ino || null };
    } catch { /* ignore */ }
    res.json({ path: normalizePath(rel), parent: normalizePath(path.dirname(rel)), entries: result });
  } catch (e) { next(e); }
});

router.get('/download', async (req,res,next)=>{
  try {
    const rel = req.query.path; if (!rel) return res.status(400).json({ error:'Missing path' });
    const abs = safeJoin(getRoot(req), rel);
    const stat = await fs.stat(abs);
    if (stat.isDirectory()) return res.status(400).json({ error:'Cannot download directory' });
    res.setHeader('Content-Type', mime.lookup(abs) || 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(abs)}"`);
    fssync.createReadStream(abs).pipe(res);
  } catch (e){ next(e); }
});

router.post('/mkdir', async (req,res,next)=>{
  try {
    const { path: rel, name } = req.body || {};
    if (!name || /[\0\n\r/]/.test(name)) return res.status(400).json({ error:'Invalid name'});
    const absParent = safeJoin(getRoot(req), rel || '/');
    const newAbs = path.join(absParent, name);
    await fs.mkdir(newAbs, { recursive:false });
    res.json({ ok:true });
  } catch (e){ next(e); }
});

router.post('/rename', async (req,res,next)=>{
  try {
    const { path: rel, newName } = req.body || {};
    if (!rel || !newName) return res.status(400).json({ error:'Missing params' });
    if (/[\0\n\r/]/.test(newName)) return res.status(400).json({ error:'Invalid name'});
    const abs = safeJoin(getRoot(req), rel);
    const dest = path.join(path.dirname(abs), newName);
    await fs.rename(abs, dest);
    res.json({ ok:true });
  } catch (e){ next(e); }
});

router.delete('/', async (req,res,next)=>{
  try {
    const rel = req.query.path; if (!rel) return res.status(400).json({ error:'Missing path'});
    const abs = safeJoin(getRoot(req), rel);
    const stat = await fs.lstat(abs);
    if (stat.isDirectory()) await fs.rm(abs, { recursive:true, force:true }); else await fs.unlink(abs);
    res.json({ ok:true });
  } catch (e){ next(e); }
});

// Fetch file content (text only)
router.get('/content', async (req,res,next)=>{
  try {
    const rel = req.query.path; if (!rel) return res.status(400).json({ error:'Missing path'});
    const abs = safeJoin(getRoot(req), rel);
    const stat = await fs.stat(abs);
    if (stat.isDirectory()) return res.status(400).json({ error:'Is directory'});
    if (stat.size > MAX_EDIT_SIZE) return res.status(413).json({ error:'File too large', size: stat.size, limit: MAX_EDIT_SIZE });
    const buf = await fs.readFile(abs);
    if (isProbablyBinary(buf)) return res.json({ binary:true, size: stat.size, path: normalizePath(rel) });
    const content = buf.toString('utf8');
    res.json({ binary:false, path: normalizePath(rel), size: stat.size, mtime: Math.floor(stat.mtimeMs/1000), content });
  } catch (e){ next(e); }
});

// Overwrite file content
router.post('/write', async (req,res,next)=>{
  try {
    const { path: rel, content } = req.body || {};
    if (!rel || typeof content !== 'string') return res.status(400).json({ error:'Missing params'});
    const abs = safeJoin(getRoot(req), rel);
    const stat = await fs.stat(abs).catch(()=> null);
    if (!stat) return res.status(404).json({ error:'Not found'});
    if (stat.isDirectory()) return res.status(400).json({ error:'Is directory'});
    if (Buffer.byteLength(content,'utf8') > MAX_EDIT_SIZE) return res.status(413).json({ error:'Content too large', limit: MAX_EDIT_SIZE });
    await fs.writeFile(abs, content, 'utf8');
    const newStat = await fs.stat(abs);
    res.json({ ok:true, size:newStat.size, mtime: Math.floor(newStat.mtimeMs/1000) });
  } catch (e){ next(e); }
});

export default router;
