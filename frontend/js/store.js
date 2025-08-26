// Tiny pub/sub store
class Store {
  constructor(){ this.listeners = {}; this.state = {}; }
  set(key, value){
    const old = this.state[key];
    if (old === value) return;
    this.state[key] = value;
    (this.listeners[key]||[]).forEach(fn => fn(value, old));
  }
  get(key){ return this.state[key]; }
  subscribe(key, fn){ (this.listeners[key]||(this.listeners[key]=[])).push(fn); return () => { this.listeners[key] = this.listeners[key].filter(f=>f!==fn); }; }
}
export const store = new Store();
