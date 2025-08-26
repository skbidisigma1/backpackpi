export async function render(root){
  root.innerHTML = `
  <section class="stack">
    <h1 class="route-heading">Proxy</h1>
    <div class="card">
      <div class="card-header">Web Proxy Control (Stub)</div>
      <p class="text-dim">Enable/disable proxy service, view connections, configure rules here.</p>
      <div class="row">
        <button class="btn-primary btn" disabled>Start Proxy</button>
        <button class="btn btn-ghost" disabled>Stop Proxy</button>
      </div>
      <div class="placeholder">No backend connection.</div>
    </div>
  </section>`;
}
