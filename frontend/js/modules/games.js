export async function render(root){
  root.innerHTML = `
  <section class="stack">
    <h1 class="route-heading">Games</h1>
    <div class="card">
      <div class="card-header">Game Launcher (Stub)</div>
      <p class="text-dim">List of available games will load here. Selecting a game dynamically imports its module and mounts a canvas.</p>
      <div class="placeholder">No games registered yet.</div>
    </div>
  </section>`;
}
