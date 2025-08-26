export async function render(root){
  root.innerHTML = `
    <section class="stack">
      <h1 class="route-heading">Dashboard</h1>
      <div class="card-grid">
        ${['CPU','Memory','Uptime','Storage','Temp','Net'].map(label => `
          <div class="stat" data-stat="${label.toLowerCase()}">
            <div class="stat-label">${label}</div>
            <div class="stat-value">--</div>
          </div>`).join('')}
      </div>
      <div class="card">
        <div class="card-header">System Overview</div>
        <p class="text-dim">Live system metrics will appear here once backend API & WebSocket are implemented.</p>
      </div>
    </section>
  `;
}
