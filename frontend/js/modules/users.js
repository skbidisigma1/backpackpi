import { apiJSON } from '../api.js';
import { showToast } from '../components/toast.js';

export async function render(root) {
  root.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2 class="route-heading">User Management</h2>
        <button class="btn btn-ghost" id="refresh-btn">🔄 Refresh</button>
      </div>
      <p class="text-dim">Manage user roles and permissions (sudo only).</p>
      <div id="users-list" class="stack">
        <div class="placeholder">Loading users...</div>
      </div>
    </div>
  `;

  const usersList = document.getElementById('users-list');
  const refreshBtn = document.getElementById('refresh-btn');

  async function loadUsers() {
    try {
      const data = await apiJSON('/auth/users');
      renderUsers(data.users);
    } catch (err) {
      console.error('Failed to load users:', err);
      usersList.innerHTML = `<div class="card"><p class="text-dim">Failed to load users. ${err.status === 403 ? 'Insufficient permissions.' : ''}</p></div>`;
    }
  }

  function renderUsers(users) {
    if (!users || users.length === 0) {
      usersList.innerHTML = '<p class="text-dim">No users found.</p>';
      return;
    }

    const roles = ['guest', 'viewer', 'admin', 'sudo'];
    const roleColors = {
      guest: 'var(--c-text-faint)',
      viewer: 'var(--c-info)',
      admin: 'var(--c-warn)',
      sudo: 'var(--c-danger)'
    };

    usersList.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Current Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(user => `
              <tr data-username="${user.username}">
                <td><strong>${user.username}</strong></td>
                <td>
                  <span class="badge" style="background: ${roleColors[user.role] || 'var(--c-accent-soft)'}; color: #fff;">
                    ${user.role}
                  </span>
                </td>
                <td>
                  <div class="row">
                    <select 
                      class="role-select" 
                      data-username="${user.username}" 
                      data-current-role="${user.role}"
                      style="padding: var(--space-2) var(--space-3); border: 1px solid var(--c-border); border-radius: var(--radius-sm); background: var(--c-bg); color: var(--c-text); font-family: inherit; font-size: var(--font-size-1);"
                    >
                      ${roles.map(role => `
                        <option value="${role}" ${role === user.role ? 'selected' : ''}>${role}</option>
                      `).join('')}
                    </select>
                    <button 
                      class="btn btn-primary update-role-btn" 
                      data-username="${user.username}"
                      style="font-size: var(--font-size-1); padding: var(--space-2) var(--space-4);"
                    >
                      Update
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Attach event listeners to update buttons
    document.querySelectorAll('.update-role-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const username = e.target.dataset.username;
        const select = document.querySelector(`.role-select[data-username="${username}"]`);
        const newRole = select.value;
        const currentRole = select.dataset.currentRole;

        if (newRole === currentRole) {
          showToast('No change in role', 'warn');
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Updating...';

        try {
          await apiJSON(`/auth/users/${username}/role`, {
            method: 'POST',
            body: JSON.stringify({ role: newRole })
          });
          showToast(`Role updated: ${username} → ${newRole}`, 'ok');
          select.dataset.currentRole = newRole;
          loadUsers(); // Refresh list
        } catch (err) {
          console.error('Failed to update role:', err);
          const message = err.status === 400 
            ? 'Cannot change your own sudo role' 
            : 'Failed to update role';
          showToast(message, 'danger');
          select.value = currentRole; // Revert
        } finally {
          btn.disabled = false;
          btn.textContent = 'Update';
        }
      });
    });
  }

  refreshBtn.addEventListener('click', loadUsers);

  // Initial load
  loadUsers();
}
