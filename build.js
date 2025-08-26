import { readFile, writeFile, mkdir, cp } from 'fs/promises';
import { minify as htmlMinify } from 'html-minifier-terser';
import esbuild from 'esbuild';
import csso from 'csso';
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
  // Copy sw.js (minify separately)
  await esbuild.build({ entryPoints: ['frontend/sw.js'], minify: true, bundle: false, outfile: path.join(dist, 'sw.js'), format:'esm' });
}

async function buildHTML(){
  const htmlPath = path.join(root, 'frontend/index.html');
  let html = await readFile(htmlPath, 'utf8');
  // Adjust asset paths for dist root usage
  html = html.replace('./assets/styles.css', './assets/styles.css');
  html = html.replace('./js/app.js', './js/app.js');
  // Minify
  const minified = await htmlMinify(html, { collapseWhitespace:true, removeComments:true, minifyCSS:false, minifyJS:false });
  await writeFile(path.join(dist, 'index.html'), minified, 'utf8');
}

async function copyStatic(){
  // Copy font
  await cp('frontend/assets/fonts', path.join(dist, 'assets/fonts'), { recursive: true });
}

async function run(){
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
