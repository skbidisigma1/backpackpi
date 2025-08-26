export async function render(root){
  root.innerHTML = `
  <section class="stack">
    <h1 class="route-heading">Files</h1>
    <div class="card">
      <div class="card-header">Browser (Stub)</div>
      <p class="text-dim">This will list SD card files. Future features: navigate folders, upload, download, delete.</p>
      <div class="table-wrap" aria-label="Files Listing">
        <table class="table">
          <thead><tr><th>Name</th><th>Type</th><th>Size</th></tr></thead>
          <tbody>
            <tr><td>example.txt</td><td>file</td><td>1.2 KB</td></tr>
            <tr><td>bin</td><td>directory</td><td>—</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>`;
}
