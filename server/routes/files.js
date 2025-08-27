import { Router } from 'express';
import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import mime from 'mime-types';
import { safeJoin, normalizePath } from '../util/path.js';

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

export default router;
