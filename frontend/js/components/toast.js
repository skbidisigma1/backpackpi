const root = document.getElementById('toast-root');
export function pushToast(msg, opts={}){
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast fade-in ' + (opts.variant||'');
  el.setAttribute('role','status');
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(()=> { el.style.opacity='0'; el.addEventListener('transitionend', ()=> el.remove(), { once:true }); }, opts.ttl || 4000);
}
window.pushToast = pushToast; 
export const showToast = pushToast;
