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
  const url = `/api/files?path=${encodeURIComponent(state.path)}${state.showHidden?'&showHidden=1':''}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('Content-Type') || '';
    if (!ct.includes('application/json')){
      const text = await res.text();
      console.error('Non-JSON response for', url, 'first 200 chars =>', text.slice(0,200));
      throw new Error('Unexpected non-JSON response (are you hitting the backend server?)');
    }
    const data = await res.json(); // safe now
    state.path = data.path;
    state.entries = data.entries.sort((a,b)=> (a.type===b.type? a.name.localeCompare(b.name): a.type==='dir'?-1:1));
    state.selection.clear();
  } catch (e){
    console.error(e);
    window.pushToast?.('File list error',{ variant:'danger'});
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
        const entry = state.entries.find(en=>en.name===name); navTo(entry); return;
      }
      if (state.selection.has(name)) state.selection.delete(name); else state.selection.add(name);
      renderTable(); updateToolbar();
    });
  });
}

export async function render(root){
  root.innerHTML = `
  <section class="stack">
    <h1 class="route-heading">Files</h1>
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
}
