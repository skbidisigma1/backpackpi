const state = {
  path: '/',
  entries: [],
  loading: false,
  showHidden: false,
  selection: new Set()
};

function fmtSize(bytes){
  if (bytes == null) return '—';
  const units = ['B','KB','MB','GB','TB'];
  let i=0, n=bytes;
  while (n>=1024 && i<units.length-1){ n/=1024; i++; }
  return (i===0? n : n.toFixed(1)) + ' ' + units[i];
}

async function fetchList(){
  state.loading = true; renderTable();
  const base = window.API_BASE || '';
  const url = `${base}/api/files?path=${encodeURIComponent(state.path)}${state.showHidden?'&showHidden=1':''}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('Content-Type') || '';
    if (!ct.includes('application/json')){
      const text = await res.text();
      console.error('Non-JSON response for', url, 'first 200 chars =>', text.slice(0,200));
  throw new Error('Unexpected non-JSON response. Ensure backend reachable at ' + (base||'(same origin)'));
    }
    const data = await res.json(); // safe now
    state.path = data.path;
    state.entries = data.entries.sort((a,b)=> (a.type===b.type? a.name.localeCompare(b.name): a.type==='dir'?-1:1));
    state.selection.clear();
  } catch (e){
    console.error(e);
    window.pushToast?.('File list error',{ variant:'danger'});
    maybeShowApiWarning(e);
  } finally {
    state.loading = false; renderTable(); renderBreadcrumb(); updateToolbar();
  }
}

function navTo(entry){
  if (entry.type==='dir'){
    state.path = (state.path==='/'? '' : state.path) + '/' + entry.name;
    fetchList();
  }
}

async function mkdir(){
  const name = prompt('New folder name');
  if (!name) return;
  const res = await fetch('/api/files/mkdir',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: state.path, name }) });
  if (res.ok) { fetchList(); } else window.pushToast?.('mkdir failed',{variant:'danger'});
}

async function rename(){
  if (state.selection.size!==1) return;
  const entry = state.entries.find(e=> state.selection.has(e.name));
  const newName = prompt('Rename to', entry.name); if (!newName || newName===entry.name) return;
  const rel = (state.path==='/'? '' : state.path) + '/' + entry.name;
  const res = await fetch('/api/files/rename',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: rel, newName }) });
  if (res.ok) fetchList(); else window.pushToast?.('rename failed',{variant:'danger'});
}

async function del(){
  if (!state.selection.size) return;
  if (!confirm(`Delete ${state.selection.size} item(s)?`)) return;
  for (const name of state.selection){
    const rel = (state.path==='/'? '' : state.path) + '/' + name;
    await fetch(`/api/files?path=${encodeURIComponent(rel)}`, { method:'DELETE' });
  }
  fetchList();
}

function toggleHidden(){ state.showHidden = !state.showHidden; fetchList(); }

function downloadSelected(){
  for (const name of state.selection){
    const entry = state.entries.find(e=>e.name===name);
    if (entry?.type==='file'){
      const rel = (state.path==='/'? '' : state.path) + '/' + entry.name;
      const a = document.createElement('a');
      a.href = `/api/files/download?path=${encodeURIComponent(rel)}`;
      a.download = entry.name;
      document.body.appendChild(a); a.click(); a.remove();
    }
  }
}

let rootEl; let tableBody; let breadcrumbEl; let toolbarEl;
let editorWrap; let editorTextarea; let editorPathSpan; let editorStatus;

function renderBreadcrumb(){
  if (!breadcrumbEl) return;
  const parts = state.path.split('/').filter(Boolean);
  const segs = ['<button data-bc="/">/</button>'];
  let accum='';
  parts.forEach(p=>{ accum += '/' + p; segs.push(`<button data-bc="${accum}">${p}</button>`); });
  breadcrumbEl.innerHTML = segs.join('<span class="text-dim">›</span>');
  breadcrumbEl.querySelectorAll('[data-bc]').forEach(btn => btn.addEventListener('click', e=>{ state.path = e.target.getAttribute('data-bc'); fetchList(); }));
}

function updateToolbar(){
  if (!toolbarEl) return;
  toolbarEl.querySelector('[data-act="rename"]').disabled = state.selection.size!==1;
  toolbarEl.querySelector('[data-act="delete"]').disabled = state.selection.size===0;
  toolbarEl.querySelector('[data-act="download"]').disabled = ![...state.selection].some(n=> state.entries.find(e=> e.name===n && e.type==='file'));
}

function renderTable(){
  if (!tableBody) return;
  if (state.loading){ tableBody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>'; return; }
  if (!state.entries.length){ tableBody.innerHTML = '<tr><td colspan="4" class="text-dim">(empty)</td></tr>'; return; }
  tableBody.innerHTML = state.entries.map(e=>{
    const selected = state.selection.has(e.name)? ' style="background:var(--c-accent-soft);"' : '';
    return `<tr data-name="${e.name}" data-type="${e.type}"${selected}><td>${e.type==='dir'?'📁':'📄'} ${e.name}</td><td>${e.type}</td><td>${fmtSize(e.size)}</td><td>${new Date(e.mtime*1000).toLocaleString()}</td></tr>`;
  }).join('');
  tableBody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', e=>{
      const name = tr.getAttribute('data-name');
      if (e.detail===2){ // double click -> navigate
        const entry = state.entries.find(en=>en.name===name);
        if (entry.type==='dir') { navTo(entry); return; }
        openFile(entry.name);
        return;
      }
      if (state.selection.has(name)) state.selection.delete(name); else state.selection.add(name);
      renderTable(); updateToolbar();
    });
  });
}

async function openFile(name){
  const rel = (state.path==='/'? '' : state.path) + '/' + name;
  const base = window.API_BASE || '';
  editorStatus.textContent = 'Loading...';
  editorWrap.style.display='block';
  editorTextarea.disabled = true;
  try {
    const res = await fetch(`${base}/api/files/content?path=${encodeURIComponent(rel)}`);
    if (!res.ok){ editorStatus.textContent = 'Error '+res.status; return; }
    const data = await res.json();
    if (data.binary){ editorStatus.textContent = 'Binary file (view not supported)'; editorTextarea.value=''; editorTextarea.disabled=true; }
    else {
      editorPathSpan.textContent = data.path;
      editorTextarea.value = data.content;
      editorTextarea.disabled = false;
      editorTextarea.dataset.path = data.path;
      editorStatus.textContent = `Size ${fmtSize(data.size)}`;
    }
  } catch (e){ editorStatus.textContent = 'Load failed'; }
}

async function saveFile(){
  const rel = editorTextarea.dataset.path; if (!rel) return;
  editorStatus.textContent = 'Saving...';
  const base = window.API_BASE || '';
  try {
    const res = await fetch(`${base}/api/files/write`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: rel, content: editorTextarea.value }) });
    if (!res.ok){ editorStatus.textContent = 'Save failed ('+res.status+')'; return; }
    const data = await res.json();
    editorStatus.textContent = 'Saved ('+fmtSize(data.size)+')';
    // Refresh listing to update mtime/size
    fetchList();
  } catch (e){ editorStatus.textContent = 'Save error'; }
}

export async function render(root){
  root.innerHTML = `
  <section class="stack">
    <h1 class="route-heading">Files</h1>
    <div class="card" style="display:none;" data-api-warning>
      <strong>Backend unreachable</strong>
      <p style="margin-top:var(--space-2); font-size:.9rem; line-height:1.4">The files API responded with HTML instead of JSON.<br>
      Verify the Node server is running and accessible at <code>${(window.API_BASE||'(same-origin)')||''}</code>.<br>
      If the backend uses a different host/port, inject <code>&lt;script&gt;window.API_BASE='http://host:port'&lt;/script&gt;</code> before <code>app.js</code>.</p>
    </div>
    <div class="card" id="file-browser">
      <div class="row" style="justify-content:space-between; align-items:center; gap:var(--space-4); flex-wrap:wrap;">
        <div class="cluster" data-breadcrumb></div>
        <div class="cluster" data-toolbar>
          <button class="btn" data-act="mkdir">New Folder</button>
          <button class="btn" data-act="rename" disabled>Rename</button>
            <button class="btn" data-act="delete" disabled>Delete</button>
          <button class="btn" data-act="download" disabled>Download</button>
          <button class="btn-ghost btn" data-act="hidden">Hidden: <span data-hidden-state>Off</span></button>
        </div>
      </div>
      <div class="table-wrap" aria-label="Files Listing" style="max-height:55vh;">
        <table class="table">
          <thead><tr><th style="width:50%">Name</th><th>Type</th><th>Size</th><th>Modified</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="stack" style="margin-top:var(--space-4);">
        <div class="card" data-editor style="display:none;">
          <div class="row" style="justify-content:space-between; align-items:center;">
            <strong data-editor-path></strong>
            <div class="cluster" style="gap:var(--space-2);">
              <span class="text-dim" data-editor-status></span>
              <button class="btn" data-editor-save>Save</button>
              <button class="btn-ghost btn" data-editor-close>Close</button>
            </div>
          </div>
          <textarea data-editor-text style="width:100%; min-height:200px; font-family:var(--font-mono, monospace); font-size:.85rem; line-height:1.4; background:var(--c-bg-alt); color:inherit; border:1px solid var(--c-border); border-radius:var(--radius-sm); padding:var(--space-3); resize:vertical;"></textarea>
        </div>
      </div>
    </div>
  </section>`;
  rootEl = root.querySelector('#file-browser');
  tableBody = root.querySelector('tbody');
  breadcrumbEl = root.querySelector('[data-breadcrumb]');
  toolbarEl = root.querySelector('[data-toolbar]');
  toolbarEl.addEventListener('click', e=>{
    const act = e.target.closest('[data-act]')?.getAttribute('data-act');
    if (!act) return;
    if (act==='mkdir') mkdir();
    else if (act==='rename') rename();
    else if (act==='delete') del();
    else if (act==='download') downloadSelected();
    else if (act==='hidden'){ toggleHidden(); toolbarEl.querySelector('[data-hidden-state]').textContent = state.showHidden? 'On':'Off'; }
  });
  // Persist last path
  const last = localStorage.getItem('files.lastPath'); if (last) state.path = last;
  fetchList().then(()=> localStorage.setItem('files.lastPath', state.path));

  editorWrap = root.querySelector('[data-editor]');
  editorTextarea = root.querySelector('[data-editor-text]');
  editorPathSpan = root.querySelector('[data-editor-path]');
  editorStatus = root.querySelector('[data-editor-status]');
  editorWrap.querySelector('[data-editor-save]').addEventListener('click', saveFile);
  editorWrap.querySelector('[data-editor-close]').addEventListener('click', ()=>{ editorWrap.style.display='none'; editorTextarea.value=''; editorTextarea.dataset.path=''; });
}

function maybeShowApiWarning(err){
  const warn = rootEl?.parentElement?.querySelector('[data-api-warning]');
  if (!warn) return;
  if (/Unexpected non-JSON/.test(err?.message||'')) warn.style.display='block';
}
