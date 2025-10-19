import { apiJSON } from '../api.js';
import { showToast } from '../components/toast.js';

export async function render(root) {
  root.innerHTML = `
    <div class="card" style="max-width: 420px; margin: 0 auto;">
      <h2>Login</h2>
      <form id="login-form" class="stack">
        <div class="stack">
          <label for="username">Username</label>
          <input 
            type="text" 
            id="username" 
            name="username" 
            required 
            autocomplete="username"
            style="padding: var(--space-3); border: 1px solid var(--c-border); border-radius: var(--radius-sm); background: var(--c-bg); color: var(--c-text); font-family: inherit; font-size: var(--font-size-2);"
          />
        </div>
        <div class="stack">
          <label for="password">Password</label>
          <input 
            type="password" 
            id="password" 
            name="password" 
            required 
            autocomplete="current-password"
            style="padding: var(--space-3); border: 1px solid var(--c-border); border-radius: var(--radius-sm); background: var(--c-bg); color: var(--c-text); font-family: inherit; font-size: var(--font-size-2);"
          />
        </div>
        <button type="submit" class="btn btn-primary" id="login-btn">
          Login
        </button>
        <p class="text-dim" style="font-size: var(--font-size-1); margin: 0;">
          Use your Raspberry Pi system account credentials.
        </p>
      </form>
    </div>
  `;

  const form = document.getElementById('login-form');
  const btn = document.getElementById('login-btn');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showToast('Please enter username and password', 'warn');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Logging in...';

    try {
      const result = await apiJSON('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      if (result.success) {
        showToast(`Welcome, ${result.username}!`, 'ok');
        // Store auth state and reload to redirect to dashboard
        window.location.reload();
      }
    } catch (err) {
      console.error('Login error:', err);
      const message = err.status === 401 
        ? 'Invalid username or password' 
        : err.status === 429 
          ? 'Too many login attempts. Please try again later.' 
          : 'Login failed. Please try again.';
      showToast(message, 'danger');
      passwordInput.value = '';
      passwordInput.focus();
    } finally {
      btn.disabled = false;
      btn.textContent = 'Login';
    }
  });

  // Focus username field
  usernameInput.focus();
}
