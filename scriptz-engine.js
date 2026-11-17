/*! ScriptZ-Engine v1.0 — a MaterialUs web game engine (no dependencies)
 *
 * QUICK API
 *   const game = new ScriptZ.Game({ canvas:'#game', width:960, height:540, gravity:900 });
 *   game.scene('main', { create(s,data){}, update(s,dt){}, draw(s,ctx){}, hud(s,ctx){}, leave(s){} });
 *   game.start('main');
 *
 *   Scene   s.spawn({...}) s.add(e) s.find(name) s.findAll(tag) s.pick(x,y) s.burst(x,y,opts) s.camera s.world s.gravity
 *   Entity  x y w h vx vy rot alpha z shape('circle|squircle|rect|blob|cookie|text') color image text tags
 *           body('dynamic|static|kinematic|none') bounce friction drag gravityScale sensor bounded interactive grounded
 *           update(dt) onCollide(o,info) onOverlap(o) onClick() onDestroy()  | .on('collide',fn) .impulse(x,y) .destroy()
 *   Input   game.input.key('ArrowLeft') .pressed('Space') .released(code) .axisX() .axisY() .mouse{x,y,wx,wy,down,pressed}
 *   Camera  s.camera.follow(entity, 0.1) .shake(8,.3) .zoom
 *   Tween   game.tween(obj,{x:100},0.6,{ease:'backOut',delay,done})   Ease: linear quadOut quadInOut backOut bounceOut elastic
 *   Timers  game.after(sec,fn)  game.every(sec,fn)  (both return {cancel()})
 *   Audio   game.sound.play(name,{volume,loop,rate}) .beep(freq,dur,type,vol,slide) .sfx('coin|jump|hit|pop') .mute()
 *   Assets  game.load({images:{},audio:{},json:{}}).then(...)   game.assets.images.name
 *   UI      game.ui.hud(id,text) .toast(text) .button(label,fn) .dialog({title,text,actions:[{label,fn}]})
 *   Misc    game.pause() .resume() .timeScale .save(k,v) .loadData(k) .use(plugin) game.opts.debug
 */
(function (root) {
'use strict';
const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const Util = { clamp, lerp: (a, b, t) => a + (b - a) * t, rand: (a = 0, b = 1) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)), pick: a => a[Math.random() * a.length | 0], dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y) };
const Ease = { linear: t => t, quadOut: t => 1 - (1 - t) * (1 - t), quadInOut: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  backOut: t => { const c = 2.70158; return 1 + c * Math.pow(t - 1, 3) + (c - 1) * Math.pow(t - 1, 2); },
  bounceOut: t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375; return n * (t -= 2.625 / d) * t + .984375; },
  elastic: t => t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * TAU / 3) + 1 };
const el = (tag, cls, parent) => { const e = document.createElement(tag); e.className = cls; if (parent) parent.append(e); return e; };

class Emitter {
  constructor() { this._h = {}; }
  on(n, f) { (this._h[n] || (this._h[n] = [])).push(f); return this; }
  off(n, f) { this._h[n] = (this._h[n] || []).filter(x => x !== f); return this; }
  emit(n, ...a) { (this._h[n] || []).slice().forEach(f => f(...a)); return this; }
}

/* ---------------- Entity ---------------- */
const ROUND = { circle: 1, blob: 1, cookie: 1 };
let uid = 1;
class Entity extends Emitter {
  constructor(o = {}) {
    super();
    Object.assign(this, { id: uid++, name: 'entity', tags: [], x: 0, y: 0, w: 48, h: 48, rot: 0, alpha: 1, z: 0, visible: true,
      shape: 'squircle', color: '#d0bcff', textColor: '#1d1b20', image: null, text: '', font: '700 18px system-ui,sans-serif',
      vx: 0, vy: 0, body: 'dynamic', bounce: .5, friction: .2, drag: .1, gravityScale: 1, sensor: false, bounded: true,
      grounded: false, interactive: false, sq: 0, sqH: false, alive: true, scene: null, data: {} }, o);
    if (typeof this.tags === 'string') this.tags = this.tags.split(/\s+/);
    if (ROUND[this.shape] && o.h === undefined) this.h = this.w;
  }
  get round() { return !!ROUND[this.shape]; }
  has(t) { return this.tags.includes(t); }
  update(dt) {}
  impulse(x, y) { this.vx += x; this.vy += y; }
  fire(n, ...a) { this.emit(n, ...a); const h = this['on' + n[0].toUpperCase() + n.slice(1)]; if (h) h.apply(this, a); }
  destroy() { if (!this.alive) return; this.alive = false; this.fire('destroy'); }
  draw(ctx, t, assets) {
    ctx.save(); ctx.translate(this.x, this.y); if (this.rot) ctx.rotate(this.rot); ctx.globalAlpha *= this.alpha;
    if (this.sq) { const s = this.sq; this.sqH ? ctx.scale(1 - s, 1 + s * .6) : ctx.scale(1 + s * .6, 1 - s); }
    if (this.shape !== 'text') {
      const img = typeof this.image === 'string' ? assets.images[this.image] : this.image;
      if (img) ctx.drawImage(img, -this.w / 2, -this.h / 2, this.w, this.h);
      else { ctx.beginPath(); shapePath(ctx, this, t); ctx.fillStyle = this.color; ctx.fill(); }
    }
    if (this.text) { ctx.fillStyle = this.shape === 'text' ? this.color : this.textColor; ctx.font = this.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(this.text, 0, 0); }
    ctx.restore();
  }
}
function shapePath(ctx, e, t) {
  const r = e.w / 2, h = e.h / 2;
  switch (e.shape) {
    case 'circle': ctx.arc(0, 0, r, 0, TAU); break;
    case 'rect': ctx.roundRect(-r, -h, e.w, e.h, Math.min(8, r, h)); break;
    case 'blob': case 'cookie': {
      const cookie = e.shape === 'cookie', n = cookie ? 8 : 3, a = cookie ? .06 : .09, ph = cookie ? 0 : t * 2;
      for (let i = 0; i <= 72; i++) { const th = i / 72 * TAU, k = 1 + a * Math.cos(n * th + ph); ctx[i ? 'lineTo' : 'moveTo'](Math.cos(th) * r * k, Math.sin(th) * r * k); }
      ctx.closePath(); break; }
    default: ctx.roundRect(-r, -h, e.w, e.h, Math.min(e.w, e.h) * .38);
  }
}

/* ---------------- Camera ---------------- */
class Camera {
  constructor(g) { this.g = g; this.x = g.W / 2; this.y = g.H / 2; this.zoom = 1; this.target = null; this.lerp = .1; this.sh = 0; this.shT = 0; this.shD = 1; this.ox = 0; this.oy = 0; }
  follow(e, l = .1) { this.target = e; this.lerp = l; return this; }
  shake(i = 8, d = .3) { this.sh = i; this.shT = this.shD = d; }
  update(dt, w) {
    const g = this.g;
    if (this.target && this.target.alive) { const k = 1 - Math.pow(1 - this.lerp, dt * 60); this.x += (this.target.x - this.x) * k; this.y += (this.target.y - this.y) * k; }
    const hw = g.W / 2 / this.zoom, hh = g.H / 2 / this.zoom;
    this.x = w.w >= hw * 2 ? clamp(this.x, w.x + hw, w.x + w.w - hw) : w.x + w.w / 2;
    this.y = w.h >= hh * 2 ? clamp(this.y, w.y + hh, w.y + w.h - hh) : w.y + w.h / 2;
    if (this.shT > 0) { this.shT -= dt; const k = this.sh * Math.max(0, this.shT / this.shD); this.ox = (Math.random() * 2 - 1) * k; this.oy = (Math.random() * 2 - 1) * k; } else this.ox = this.oy = 0;
  }
  apply(ctx) { ctx.translate(this.g.W / 2 + this.ox, this.g.H / 2 + this.oy); ctx.scale(this.zoom, this.zoom); ctx.translate(-this.x, -this.y); }
  toWorld(sx, sy) { return { x: (sx - this.g.W / 2) / this.zoom + this.x, y: (sy - this.g.H / 2) / this.zoom + this.y }; }
}

/* ---------------- Scene ---------------- */
class Scene extends Emitter {
  constructor(game, def) {
    super(); this.game = game; this.def = def || {}; this.entities = []; this.particles = []; this.time = 0;
    this.camera = new Camera(game); this.world = { x: 0, y: 0, w: game.W, h: game.H }; this.gravity = game.opts.gravity;
  }
  add(e) { e.scene = this; this.entities.push(e); return e; }
  spawn(o) { return this.add(new Entity(o)); }
  find(n) { return this.entities.find(e => e.alive && e.name === n); }
  findAll(t) { return this.entities.filter(e => e.alive && e.has(t)); }
  pick(x, y, filter) {
    return this.entities.filter(e => e.alive && (!filter || filter(e)) && Math.abs(x - e.x) <= e.w / 2 && Math.abs(y - e.y) <= e.h / 2).sort((a, b) => b.z - a.z)[0] || null;
  }
  burst(x, y, o = {}) {
    const n = o.count || 16, cols = [].concat(o.color || '#d0bcff');
    for (let i = 0; i < n; i++) {
      const a = (o.angle || 0) + (Math.random() - .5) * (o.spread || TAU), sp = (o.speed || 220) * (.4 + Math.random() * .6), life = (o.life || .6) * (.6 + Math.random() * .4);
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, size: (o.size || 6) * (.5 + Math.random()), color: Util.pick(cols), g: o.gravity ?? 400 });
    }
  }
}

/* ---------------- Physics ---------------- */
function manifold(a, b) { // normal points a -> b
  if (a.round && b.round) { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .01, r = (a.w + b.w) / 2; return d < r ? { nx: dx / d, ny: dy / d, p: r - d } : null; }
  if (!a.round && !b.round) {
    const dx = b.x - a.x, dy = b.y - a.y, ox = (a.w + b.w) / 2 - Math.abs(dx), oy = (a.h + b.h) / 2 - Math.abs(dy);
    if (ox <= 0 || oy <= 0) return null;
    return ox < oy ? { nx: Math.sign(dx) || 1, ny: 0, p: ox } : { nx: 0, ny: Math.sign(dy) || 1, p: oy };
  }
  if (!a.round) { const m = manifold(b, a); return m && { nx: -m.nx, ny: -m.ny, p: m.p }; }
  const cx = clamp(a.x, b.x - b.w / 2, b.x + b.w / 2), cy = clamp(a.y, b.y - b.h / 2, b.y + b.h / 2), r = a.w / 2;
  let dx = a.x - cx, dy = a.y - cy, d = Math.hypot(dx, dy);
  if (!d) { dx = 0; dy = -1; d = 1; }
  return d < r ? { nx: -dx / d, ny: -dy / d, p: r - d } : null;
}
function contact(a, b, first) {
  const m = manifold(a, b); if (!m) return;
  if (a.sensor || b.sensor) { if (first) { a.fire('overlap', b); b.fire('overlap', a); } return; }
  const ia = a.body === 'dynamic' ? 1 : 0, ib = b.body === 'dynamic' ? 1 : 0, s = ia + ib; if (!s) return;
  a.x -= m.nx * m.p * ia / s; a.y -= m.ny * m.p * ia / s; b.x += m.nx * m.p * ib / s; b.y += m.ny * m.p * ib / s;
  if (m.ny > .5) a.grounded = true; if (m.ny < -.5) b.grounded = true;
  const rv = (b.vx - a.vx) * m.nx + (b.vy - a.vy) * m.ny;
  if (rv >= 0) return;
  const j = -(1 + Math.min(a.bounce, b.bounce)) * rv / s;
  a.vx -= j * ia * m.nx; a.vy -= j * ia * m.ny; b.vx += j * ib * m.nx; b.vy += j * ib * m.ny;
  const tx = -m.ny, ty = m.nx, jt = -((b.vx - a.vx) * tx + (b.vy - a.vy) * ty) * Math.min(1, (a.friction + b.friction) / 2) / s;
  a.vx -= jt * ia * tx; a.vy -= jt * ia * ty; b.vx += jt * ib * tx; b.vy += jt * ib * ty;
  if (first && -rv > 30) {
    const q = Math.min(.35, -rv / 900), H = Math.abs(m.nx) > Math.abs(m.ny);
    a.sq = Math.max(a.sq, q); b.sq = Math.max(b.sq, q); a.sqH = b.sqH = H;
    a.fire('collide', b, { nx: m.nx, ny: m.ny, speed: -rv }); b.fire('collide', a, { nx: -m.nx, ny: -m.ny, speed: -rv });
  }
}
function physics(sc, dt) {
  const W = sc.world, bodies = [];
  for (const e of sc.entities) {
    if (!e.alive || e.body === 'none') continue;
    e.grounded = false; e.sq *= Math.pow(.02, dt);
    if (e.body === 'dynamic') { e.vy += sc.gravity * e.gravityScale * dt; e.vx *= Math.max(0, 1 - e.drag * dt); }
    if (e.body !== 'static') { e.x += e.vx * dt; e.y += e.vy * dt; }
    if (e.bounded && e.body === 'dynamic') {
      const hw = e.w / 2, hh = e.h / 2, hit = (s, H) => { e.sq = Math.max(e.sq, Math.min(.3, s / 900)); e.sqH = H; };
      if (e.x < W.x + hw) { hit(Math.abs(e.vx), true); e.x = W.x + hw; e.vx = Math.abs(e.vx) * e.bounce; }
      if (e.x > W.x + W.w - hw) { hit(Math.abs(e.vx), true); e.x = W.x + W.w - hw; e.vx = -Math.abs(e.vx) * e.bounce; }
      if (e.y < W.y + hh) { e.y = W.y + hh; e.vy = Math.abs(e.vy) * e.bounce; }
      if (e.y > W.y + W.h - hh) { hit(Math.abs(e.vy), false); e.y = W.y + W.h - hh; e.vy = -Math.abs(e.vy) * e.bounce; e.grounded = true; if (Math.abs(e.vy) < 30) e.vy = 0; }
    }
    bodies.push(e);
  }
  bodies.sort((a, b) => a.x - a.w / 2 - (b.x - b.w / 2)); // sweep-and-prune on x
  const pairs = [];
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i], right = a.x + a.w / 2;
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j]; if (b.x - b.w / 2 > right) break;
      if (a.body !== 'dynamic' && b.body !== 'dynamic') continue;
      if (Math.abs(a.y - b.y) > (a.h + b.h) / 2) continue;
      pairs.push([a, b]);
    }
  }
  for (let it = 0; it < 3; it++) for (const [a, b] of pairs) contact(a, b, it === 0);
}

/* ---------------- Input ---------------- */
class Input {
  constructor(game) {
    this.g = game; this.down = new Set(); this.hit = new Set(); this.up = new Set();
    this.mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false, pressed: false, released: false };
    const typing = e => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName), block = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
    addEventListener('keydown', e => { if (typing(e)) return; if (game.opts.preventKeys && block.has(e.code)) e.preventDefault(); if (!e.repeat) { this.down.add(e.code); this.hit.add(e.code); } });
    addEventListener('keyup', e => { this.down.delete(e.code); this.up.add(e.code); });
    addEventListener('blur', () => this.down.clear());
    const c = game.canvas, pos = e => { const r = c.getBoundingClientRect(); this.mouse.x = (e.clientX - r.left) * game.W / r.width; this.mouse.y = (e.clientY - r.top) * game.H / r.height; };
    c.addEventListener('pointerdown', e => {
      pos(e); Object.assign(this.mouse, { down: true, pressed: true }); game.sound.ctx();
      const s = game.current; if (!s) return; const w = s.camera.toWorld(this.mouse.x, this.mouse.y), t = s.pick(w.x, w.y, x => x.interactive); if (t) t.fire('click', w);
    });
    addEventListener('pointermove', pos);
    addEventListener('pointerup', () => { this.mouse.down = false; this.mouse.released = true; });
  }
  key(c) { return this.down.has(c); }
  pressed(c) { return this.hit.has(c); }
  released(c) { return this.up.has(c); }
  axisX() { return (this.key('ArrowRight') || this.key('KeyD') ? 1 : 0) - (this.key('ArrowLeft') || this.key('KeyA') ? 1 : 0); }
  axisY() { return (this.key('ArrowDown') || this.key('KeyS') ? 1 : 0) - (this.key('ArrowUp') || this.key('KeyW') ? 1 : 0); }
  endFrame() { this.hit.clear(); this.up.clear(); this.mouse.pressed = this.mouse.released = false; }
}

/* ---------------- Sound ---------------- */
class Sound {
  constructor() { this.buf = {}; this.muted = false; this.volume = .8; }
  ctx() {
    if (!this.c) { const A = root.AudioContext || root.webkitAudioContext; if (!A) return null; this.c = new A(); this.m = this.c.createGain(); this.m.connect(this.c.destination); this.m.gain.value = this.muted ? 0 : this.volume; }
    if (this.c.state === 'suspended') this.c.resume(); return this.c;
  }
  async load(n, u) { const c = this.ctx(); if (!c) return; this.buf[n] = await c.decodeAudioData(await (await fetch(u)).arrayBuffer()); }
  play(n, o = {}) {
    const c = this.ctx(), b = this.buf[n]; if (!c || !b) return null;
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = b; s.loop = !!o.loop; s.playbackRate.value = o.rate || 1; g.gain.value = o.volume ?? 1;
    s.connect(g); g.connect(this.m); s.start(); return s;
  }
  beep(f = 440, d = .12, type = 'sine', v = .2, slide = 0) {
    const c = this.ctx(); if (!c) return; const o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, f + slide), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g); g.connect(this.m); o.start(); o.stop(t + d);
  }
  sfx(n) {
    ({ jump: () => this.beep(300, .16, 'square', .12, 500), hit: () => this.beep(140, .14, 'sawtooth', .18, -80), pop: () => this.beep(600, .07, 'sine', .2, 300),
      coin: () => { this.beep(880, .08, 'square', .1); setTimeout(() => this.beep(1320, .16, 'square', .1), 70); } })[n]?.();
  }
  mute(m = !this.muted) { this.muted = m; if (this.m) this.m.gain.value = m ? 0 : this.volume; }
}

/* ---------------- UI (MaterialUs DOM overlay) ---------------- */
class UI {
  constructor(game, stage) {
    this.g = game; this.root = el('div', 'sz-ui', stage); this.hudEl = el('div', 'sz-hud', this.root);
    this.dock = el('div', 'sz-dock', this.root); this.toasts = el('div', 'sz-toasts', this.root); this.huds = {};
  }
  hud(id, text) { const h = this.huds[id] || (this.huds[id] = el('div', 'sz-chip', this.hudEl)); h.textContent = text; return h; }
  removeHud(id) { if (this.huds[id]) { this.huds[id].remove(); delete this.huds[id]; } }
  toast(text, ms = 2200) { const t = el('div', 'sz-toast', this.toasts); t.textContent = text; setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms); }
  button(label, fn, o = {}) { const b = el('button', 'sz-btn' + (o.tonal ? ' tonal' : ''), this.dock); b.textContent = label; b.onclick = fn; return b; }
  dialog({ title = '', text = '', actions = [{ label: 'OK' }], pause = true } = {}) {
    const was = this.g.paused; if (pause) this.g.pause();
    const sc = el('div', 'sz-scrim', this.root), d = el('div', 'sz-dialog', sc);
    el('h3', '', d).textContent = title; el('p', '', d).textContent = text; const row = el('div', 'sz-row', d);
    const close = () => { sc.classList.add('out'); setTimeout(() => sc.remove(), 250); if (pause && !was) this.g.resume(); };
    actions.forEach(a => { const b = el('button', 'sz-btn', row); b.textContent = a.label; b.onclick = () => { close(); a.fn && a.fn(); }; });
    return close;
  }
}

/* ---------------- Game ---------------- */
class Game extends Emitter {
  constructor(o = {}) {
    super();
    this.opts = Object.assign({ width: 960, height: 540, gravity: 900, background: '#141218', step: 1 / 60, pixelRatio: Math.min(root.devicePixelRatio || 1, 2), debug: false, preventKeys: true, pauseOnBlur: true }, o);
    this.W = this.opts.width; this.H = this.opts.height;
    let c = typeof o.canvas === 'string' ? document.querySelector(o.canvas) : o.canvas;
    if (!c) { c = document.createElement('canvas'); (typeof o.parent === 'string' ? document.querySelector(o.parent) : o.parent || document.body).append(c); }
    const st = el('div', 'sz-stage'); st.style.setProperty('--sz-ar', this.W / this.H); c.parentNode.insertBefore(st, c); st.append(c);
    c.width = this.W * this.opts.pixelRatio; c.height = this.H * this.opts.pixelRatio;
    this.canvas = c; this.ctx = c.getContext('2d'); this.stage = st;
    this.scenes = {}; this.current = null; this.assets = { images: {}, audio: {}, json: {} };
    this.time = 0; this.timeScale = 1; this.paused = false; this.running = false; this.fps = 60; this._acc = 0; this._timers = []; this._tweens = [];
    this.sound = new Sound(); this.input = new Input(this); this.ui = new UI(this, st);
    document.addEventListener('visibilitychange', () => { if (!this.opts.pauseOnBlur) return; if (document.hidden) { this._auto = !this.paused; this.pause(); } else if (this._auto) { this._auto = false; this.resume(); } });
    this._loop = this._loop.bind(this);
  }
  scene(name, def) { this.scenes[name] = def; return this; }
  start(name, data) {
    const def = this.scenes[name]; if (!def) throw new Error('ScriptZ: unknown scene "' + name + '"');
    if (this.current && this.current.def.leave) this.current.def.leave(this.current);
    this._timers = []; this._tweens = [];
    this.current = new Scene(this, def); if (def.create) def.create(this.current, data);
    if (!this.running) { this.running = true; this._last = performance.now(); requestAnimationFrame(this._loop); }
    return this.current;
  }
  pause() { this.paused = true; } resume() { this.paused = false; }
  after(sec, fn) { const t = { t: sec, fn, every: 0, dead: false, cancel() { this.dead = true; } }; this._timers.push(t); return t; }
  every(sec, fn) { const t = this.after(sec, fn); t.every = sec; return t; }
  tween(target, props, dur = .5, o = {}) {
    const from = {}; for (const k in props) from[k] = target[k];
    const tw = { target, props, from, dur, t: -(o.delay || 0), dead: false, done: o.done, update: o.update, cancel() { this.dead = true; },
      ease: typeof o.ease === 'function' ? o.ease : Ease[o.ease || 'backOut'] };
    this._tweens.push(tw); return tw;
  }
  load(m = {}) {
    const A = this.assets, count = k => Object.keys(m[k] || {}).length, total = count('images') + count('audio') + count('json'); let n = 0;
    const track = p => p.then(() => this.emit('progress', ++n / total)), jobs = [];
    for (const [k, u] of Object.entries(m.images || {})) jobs.push(track(new Promise((ok, no) => { const i = new Image(); i.onload = () => { A.images[k] = i; ok(); }; i.onerror = () => no(new Error('ScriptZ: failed to load ' + u)); i.src = u; })));
    for (const [k, u] of Object.entries(m.audio || {})) jobs.push(track(this.sound.load(k, u)));
    for (const [k, u] of Object.entries(m.json || {})) jobs.push(track(fetch(u).then(r => r.json()).then(v => { A.json[k] = v; })));
    return Promise.all(jobs);
  }
  save(k, v) { try { localStorage.setItem('scriptz:' + k, JSON.stringify(v)); } catch (e) {} }
  loadData(k, d = null) { try { const v = localStorage.getItem('scriptz:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  use(plugin) { plugin(this, root.ScriptZ); return this; }
  _loop(now) {
    requestAnimationFrame(this._loop);
    let dt = Math.min(.25, (now - this._last) / 1000); this._last = now; this.fps += (1 / (dt || 1 / 60) - this.fps) * .05;
    let ticked = false;
    if (!this.paused) { this._acc += dt * this.timeScale; while (this._acc >= this.opts.step) { this._tick(this.opts.step); this._acc -= this.opts.step; ticked = true; } }
    if (ticked || this.paused) this.input.endFrame();
    this._render(now / 1000);
  }
  _tick(dt) {
    this.time += dt;
    for (const t of this._timers.slice()) { if (t.dead) continue; t.t -= dt; if (t.t <= 0) { t.fn(); if (t.every) t.t += t.every; else t.dead = true; } }
    this._timers = this._timers.filter(t => !t.dead);
    for (const w of this._tweens.slice()) {
      if (w.dead) continue; w.t += dt; if (w.t < 0) continue;
      const k = clamp(w.t / w.dur, 0, 1), e = w.ease(k); for (const p in w.props) w.target[p] = w.from[p] + (w.props[p] - w.from[p]) * e;
      if (w.update) w.update(k); if (k >= 1) { w.dead = true; if (w.done) w.done(); }
    }
    this._tweens = this._tweens.filter(w => !w.dead);
    const s = this.current; if (!s) return; s.time += dt;
    const m = this.input.mouse, w = s.camera.toWorld(m.x, m.y); m.wx = w.x; m.wy = w.y;
    if (s.def.update) s.def.update(s, dt);
    for (const e of s.entities.slice()) if (e.alive) e.update(dt);
    physics(s, dt);
    for (const p of s.particles) { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    s.particles = s.particles.filter(p => p.life > 0); s.entities = s.entities.filter(e => e.alive); s.camera.update(dt, s.world);
  }
  _render(t) {
    const ctx = this.ctx, s = this.current, d = this.opts.pixelRatio;
    ctx.setTransform(d, 0, 0, d, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = this.opts.background; ctx.fillRect(0, 0, this.W, this.H);
    if (!s) return;
    ctx.save(); s.camera.apply(ctx);
    for (const e of s.entities.filter(e => e.alive && e.visible).sort((a, b) => a.z - b.z)) e.draw(ctx, t, this.assets);
    for (const p of s.particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (.4 + .6 * p.life / p.max), 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1; if (s.def.draw) s.def.draw(s, ctx);
    if (this.opts.debug) { ctx.strokeStyle = '#ffb4ab'; ctx.lineWidth = 1; for (const e of s.entities) ctx.strokeRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h); }
    ctx.restore();
    if (s.def.hud) s.def.hud(s, ctx);
    if (this.opts.debug) { ctx.fillStyle = '#d0bcff'; ctx.font = '12px monospace'; ctx.textAlign = 'left'; ctx.fillText(Math.round(this.fps) + ' fps · ' + s.entities.length + ' entities', 12, this.H - 12); }
  }
}

root.ScriptZ = { version: '1.0.0', Game, Scene, Entity, Camera, Emitter, Ease, Util };
})(typeof window !== 'undefined' ? window : globalThis);
