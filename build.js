import { readFile, writeFile, mkdir, cp, rm, stat } from 'fs/promises';
import { minify as htmlMinify } from 'html-minifier-terser';
import esbuild from 'esbuild';
import * as csso from 'csso';
import path from 'path';

const root = path.resolve('./');
const dist = path.join(root, 'dist');

async function ensureDir(p){ await mkdir(p, { recursive: true }); }

async function buildCSS(){
  const cssPath = path.join(root, 'frontend/assets/styles.css');
  const css = await readFile(cssPath, 'utf8');
  const out = csso.minify(css).css;
  await ensureDir(path.join(dist, 'assets'));
  await ensureDir(path.join(dist, 'assets/fonts'));
  await writeFile(path.join(dist, 'assets/styles.css'), out, 'utf8');
}

async function buildJS(){
  await ensureDir(path.join(dist, 'js'));
  await esbuild.build({
    entryPoints: ['frontend/js/app.js'],
    bundle: true,
    format: 'esm',
    minify: true,
    sourcemap: false,
    target: 'es2020',
    outfile: path.join(dist, 'js/app.js')
  });
  await esbuild.build({ entryPoints: ['frontend/sw.js'], minify: true, bundle: false, outfile: path.join(dist, 'sw.js'), format:'esm' });
}

async function buildHTML(){
  const htmlPath = path.join(root, 'frontend/index.html');
  let html = await readFile(htmlPath, 'utf8');
  html = html.replace('./assets/styles.css', './assets/styles.css');
  html = html.replace('./js/app.js', './js/app.js');
  const minified = await htmlMinify(html, { collapseWhitespace:true, removeComments:true, minifyCSS:false, minifyJS:false });
  await writeFile(path.join(dist, 'index.html'), minified, 'utf8');
}

async function copyStatic(){
  const srcDir = path.join('frontend','assets','fonts');
  const destDir = path.join(dist,'assets','fonts');
  // Ensure destination exists; if it already exists, just copy files inside.
  await ensureDir(destDir);
  await cp(srcDir, destDir, { recursive: true, force: true });
}

async function run(){
  // Clean dist if it exists to guarantee fresh build
  try { await stat(dist); await rm(dist, { recursive: true, force: true }); } catch {/* ignore */}
  await ensureDir(dist);
  await Promise.all([
    buildCSS(),
    buildJS(),
    buildHTML(),
    copyStatic()
  ]);
  console.log('Build complete.');
}
run().catch(e => { console.error(e); process.exit(1); });
