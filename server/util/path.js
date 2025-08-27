import path from 'path';

export function safeJoin(root, rel){
  const cleaned = normalizePath(rel || '/');
  const resolved = path.resolve(root, '.' + cleaned); // '.' ensures relative join
  if (!resolved.startsWith(root)) {
    const err = new Error('Path escapes root'); err.status = 400; err.publicMessage = 'Invalid path'; throw err;
  }
  return resolved;
}

export function normalizePath(p){
  if (!p) return '/';
  let out = p.replace(/\\/g,'/');
  if (!out.startsWith('/')) out = '/' + out;
  out = out.replace(/\/+/g,'/');
  return out === '' ? '/' : out;
}
