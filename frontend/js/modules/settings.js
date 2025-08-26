export async function render(root){
  root.innerHTML = `
  <section class="stack">
    <h1 class="route-heading">Settings</h1>
    <div class="card">
      <div class="card-header">Appearance</div>
      <p>Use the theme toggle in the navigation to switch themes. Additional preferences will appear here.</p>
    </div>
    <div class="card">
      <div class="card-header">System</div>
      <p class="text-dim">Future: network config, updates, reboot, service control.</p>
      <div class="placeholder">No backend actions wired.</div>
    </div>
  </section>`;
}
