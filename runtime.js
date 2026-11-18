/* ScriptZ-Engine runtime: conditions, actions, physics, sound, camera. Shared by the editor preview and exported games. */
const ZRuntimeFactory = function () {
'use strict';
const KEYS = ['space', 'left', 'right', 'up', 'down', 'enter', 'shift', ...'abcdefghijklmnopqrstuvwxyz0123456789'];
const rad = Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), NF = o => Object.assign(Object.create(null), o);
const PREC = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 };
const BASEF = { random: (a = 1, b = 10) => Math.floor(a + Math.random() * (b - a + 1)), abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, sqrt: Math.sqrt,
  sin: a => Math.sin(a * rad), cos: a => Math.cos(a * rad), atan2: (y, x) => Math.atan2(y, x) / rad, dist: (a, b, c, d) => Math.hypot(c - a, d - b), lerp: (a, b, t) => a + (b - a) * t, sign: Math.sign };
const CMP = { '=': (a, b) => a == b, '!=': (a, b) => a != b, '<': (a, b) => a < b, '>': (a, b) => a > b, '<=': (a, b) => a <= b, '>=': (a, b) => a >= b };
const OPS = { '=': (a, b) => b, '+': (a, b) => (+a || 0) + (+b || 0), '-': (a, b) => (+a || 0) - (+b || 0), '*': (a, b) => (+a || 0) * (+b || 0), '/': (a, b) => (+a || 0) / (+b || 1) };
const ROUND = { circle: 1, cookie: 1, flower: 1, clover: 1, sunny: 1 }, SHAPES = { cookie: [8, .07], flower: [5, .16], clover: [4, .2], sunny: [12, .05] };
const PROPS = { x: 'x', y: 'y', width: 'w', height: 'h', angle: 'angle', vx: 'vx', vy: 'vy' };
const gp = (i, p) => p === 'opacity' ? i.alpha * 100 : p in PROPS ? i[PROPS[p]] : (i.vars[p] == null ? 0 : i.vars[p]);
const poly = s => { const [n, a] = SHAPES[s], r = []; for (let k = 0; k < 64; k++) { const t = k / 64 * Math.PI * 2, q = (1 + a * Math.cos(n * t)) / (1 + a); r.push((50 + 50 * q * Math.cos(t)).toFixed(1) + '% ' + (50 + 50 * q * Math.sin(t)).toFixed(1) + '%'); } return r.join(','); };
// safe expression evaluator (no eval)
function ev(src, look, F) {
  const t = String(src == null ? '' : src).match(/\d*\.?\d+|[A-Za-z_]\w*(?:\.\w+)*|"[^"]*"|==|!=|<=|>=|&&|\|\||[-+*\/%()<>!,]/g) || []; let i = 0;
  const prim = () => {
    const k = t[i++]; if (k === undefined) return 0;
    if (k === '(') { const v = exp(0); i++; return v; } if (k === '-') return -prim(); if (k === '!') return !prim();
    if (/^[\d.]/.test(k)) return +k; if (k[0] === '"') return k.slice(1, -1); if (k === 'true') return true; if (k === 'false') return false;
    if (t[i] === '(') { i++; const a = []; if (t[i] === ')') i++; else { a.push(exp(0)); while (t[i] === ',') { i++; a.push(exp(0)); } i++; } return (F[k] || (() => 0))(...a); }
    return look(k);
  };
  const exp = m => { let l = prim(); while (PREC[t[i]] >= m) { const o = t[i++], r = exp(PREC[o] + 1);
    l = o === '+' ? l + r : o === '-' ? l - r : o === '*' ? l * r : o === '/' ? l / r : o === '%' ? l % r : o === '<' ? l < r : o === '>' ? l > r : o === '<=' ? l <= r : o === '>=' ? l >= r : o === '==' ? l == r : o === '!=' ? l != r : o === '&&' ? l && r : l || r; } return l; };
  return exp(0);
}
/* ---- helpers for definitions ---- */
const each = (g, pk, n, fn) => { for (const i of (pk[n] || g.all(n)).slice()) { g.cur[n] = i; fn(i); } delete g.cur[n]; };
const N = (g, v) => +g.ev(v) || 0;
const pickC = (g, pk, n, test, neg) => { const L = (pk[n] || g.all(n)).filter(i => !!test(i) !== !!neg); pk[n] = L; return L.length > 0; };
const hit = (a, b) => !!manifold(a, b, 2);
// Param spec: 'type:default' — types: obj num text key scene snd img sel(opt|opt) col var. Labels use %n for params.
const C = {
  start: { c: 'Scene', l: 'At the start of the scene', f: (a, g) => g.first },
  every: { c: 'Time', l: 'Every %0 seconds', p: ['num:1'], f: (a, g, pk, cd) => { const s = g.st(cd); s.acc = (s.acc || 0) + 1 / 60; if (s.acc >= N(g, a[0])) { s.acc = 0; return true; } return false; } },
  timer: { c: 'Time', l: 'Timer %0 is at least %1 seconds', p: ['var:t1', 'num:2'], f: (a, g) => (g.timers[a[0]] == null ? (g.timers[a[0]] = 0) : g.timers[a[0]]) >= N(g, a[1]) },
  once: { c: 'Time', l: 'Trigger once', f: () => true },
  key: { c: 'Input', l: 'Key %0 is down', p: ['key:space'], f: (a, g) => g.keys.has(a[0]) },
  keyhit: { c: 'Input', l: 'Key %0 was just pressed', p: ['key:space'], f: (a, g) => g.khit.has(a[0]) },
  keyrel: { c: 'Input', l: 'Key %0 was just released', p: ['key:space'], f: (a, g) => g.krel.has(a[0]) },
  mdown: { c: 'Input', l: 'Mouse button is down', f: (a, g) => g.m.down },
  click: { c: 'Input', l: 'Mouse was just clicked', f: (a, g) => g.m.hit },
  clickobj: { c: 'Input', l: '%0 was clicked', p: ['obj'], pick: 1, f: (a, g, pk, cd, n) => pickC(g, pk, a[0], i => g.m.hit && g.under(i), n) },
  hover: { c: 'Input', l: 'Mouse is over %0', p: ['obj'], pick: 1, f: (a, g, pk, cd, n) => pickC(g, pk, a[0], i => g.under(i), n) },
  touching: { c: 'Objects', l: '%0 touches %1', p: ['obj', 'obj'], pick: 1, f: (a, g, pk, cd, n) => {
    const A = pk[a[0]] || g.all(a[0]), Bs = pk[a[1]] || g.all(a[1]), A2 = A.filter(x => Bs.some(y => y !== x && hit(x, y)) !== n);
    pk[a[0]] = A2; if (!n) pk[a[1]] = Bs.filter(y => A2.some(x => x !== y && hit(x, y))); return A2.length > 0; } },
  vis: { c: 'Objects', l: '%0 is visible', p: ['obj'], pick: 1, f: (a, g, pk, cd, n) => pickC(g, pk, a[0], i => i.vis, n) },
  ground: { c: 'Objects', l: '%0 is on the ground', p: ['obj'], pick: 1, f: (a, g, pk, cd, n) => pickC(g, pk, a[0], i => i.grounded, n) },
  count: { c: 'Objects', l: 'Number of %0 is %1 %2', p: ['obj', 'sel:=|!=|<|>|<=|>=', 'num:0'], f: (a, g) => CMP[a[1]](g.all(a[0]).length, N(g, a[2])) },
  ocmp: { c: 'Objects', l: '%1 of %0 is %2 %3', p: ['obj', 'sel:x|y|width|height|angle|vx|vy|opacity', 'sel:=|!=|<|>|<=|>=', 'num:0'], pick: 1, f: (a, g, pk, cd, n) => pickC(g, pk, a[0], i => { g.cur[a[0]] = i; const r = CMP[a[2]](gp(i, a[1]), g.ev(a[3])); delete g.cur[a[0]]; return r; }, n) },
  ovar: { c: 'Objects', l: 'Variable %1 of %0 is %2 %3', p: ['obj', 'var:health', 'sel:=|!=|<|>|<=|>=', 'num:0'], pick: 1, f: (a, g, pk, cd, n) => pickC(g, pk, a[0], i => { g.cur[a[0]] = i; const r = CMP[a[2]](gp(i, a[1]), g.ev(a[3])); delete g.cur[a[0]]; return r; }, n) },
  cmpvar: { c: 'Variables', l: 'Variable %0 is %1 %2', p: ['var:score', 'sel:=|!=|<|>|<=|>=', 'num:0'], f: (a, g) => CMP[a[1]](g.look(a[0]), g.ev(a[2])) },
  expr: { c: 'Variables', l: 'Expression %0 is true', p: ['num:score > 5 && lives == 0'], f: (a, g) => !!g.ev(a[0]) }
};
const A = {
  setpos: { c: 'Object', l: 'Set position of %0 to x %1, y %2', p: ['obj', 'num:200', 'num:200'], f: (a, g, pk) => each(g, pk, a[0], i => { i.x = N(g, a[1]); i.y = N(g, a[2]); }) },
  addpos: { c: 'Object', l: 'Move %0 by dx %1, dy %2', p: ['obj', 'num:5', 'num:0'], f: (a, g, pk) => each(g, pk, a[0], i => { i.x += N(g, a[1]); i.y += N(g, a[2]); }) },
  movedir: { c: 'Object', l: 'Move %0 by %1 px toward angle %2°', p: ['obj', 'num:5', 'num:0'], f: (a, g, pk) => each(g, pk, a[0], i => { const d = N(g, a[1]), r = N(g, a[2]) * rad; i.x += Math.cos(r) * d; i.y += Math.sin(r) * d; }) },
  setvel: { c: 'Object', l: 'Set velocity of %0 to vx %1, vy %2', p: ['obj', 'num:0', 'num:-400'], f: (a, g, pk) => each(g, pk, a[0], i => { i.vx = N(g, a[1]); i.vy = N(g, a[2]); }) },
  push: { c: 'Object', l: 'Push %0 by vx %1, vy %2', p: ['obj', 'num:0', 'num:-300'], f: (a, g, pk) => each(g, pk, a[0], i => { i.vx += N(g, a[1]); i.vy += N(g, a[2]); }) },
  setangle: { c: 'Object', l: 'Set angle of %0 to %1°', p: ['obj', 'num:0'], f: (a, g, pk) => each(g, pk, a[0], i => { i.angle = N(g, a[1]); }) },
  rotate: { c: 'Object', l: 'Rotate %0 by %1°', p: ['obj', 'num:5'], f: (a, g, pk) => each(g, pk, a[0], i => { i.angle += N(g, a[1]); }) },
  setsize: { c: 'Object', l: 'Set size of %0 to %1 × %2', p: ['obj', 'num:64', 'num:64'], f: (a, g, pk) => each(g, pk, a[0], i => { i.w = N(g, a[1]); i.h = N(g, a[2]); }) },
  scale: { c: 'Object', l: 'Scale %0 by %1', p: ['obj', 'num:1.2'], f: (a, g, pk) => each(g, pk, a[0], i => { const k = N(g, a[1]); i.w *= k; i.h *= k; }) },
  show: { c: 'Object', l: 'Show %0', p: ['obj'], f: (a, g, pk) => each(g, pk, a[0], i => { i.vis = true; }) },
  hide: { c: 'Object', l: 'Hide %0', p: ['obj'], f: (a, g, pk) => each(g, pk, a[0], i => { i.vis = false; }) },
  color: { c: 'Object', l: 'Set color of %0 to %1', p: ['obj', 'col:#ff6b6b'], f: (a, g, pk) => each(g, pk, a[0], i => { i.color = a[1]; }) },
  opacity: { c: 'Object', l: 'Set opacity of %0 to %1 %', p: ['obj', 'num:50'], f: (a, g, pk) => each(g, pk, a[0], i => { i.alpha = clamp(N(g, a[1]) / 100, 0, 1); }) },
  setimg: { c: 'Object', l: 'Set image of %0 to %1', p: ['obj', 'img'], f: (a, g, pk) => each(g, pk, a[0], i => { i.asset = a[1]; g.rebuild(i); }) },
  settext: { c: 'Object', l: 'Set text of %0 to %1', p: ['obj', 'text:Score: {score}'], f: (a, g, pk) => each(g, pk, a[0], i => { i.text = g.tpl(a[1]); }) },
  video: { c: 'Object', l: 'Video of %0: %1', p: ['obj', 'sel:play|pause'], f: (a, g, pk) => each(g, pk, a[0], i => { if (i.el.play) a[1] === 'play' ? i.el.play() : i.el.pause(); }) },
  create: { c: 'Object', l: 'Create %0 at x %1, y %2', p: ['obj', 'num:480', 'num:100'], f: (a, g, pk) => { const d = g.P.objects.find(o => o.name === a[0]); if (d) pk[a[0]] = [g.spawn(d, N(g, a[1]), N(g, a[2]))]; } },
  delete: { c: 'Object', l: 'Delete %0', p: ['obj'], f: (a, g, pk) => each(g, pk, a[0], i => { i.dead = true; }) },
  setovar: { c: 'Object', l: 'Variable %1 of %0: %2 %3', p: ['obj', 'var:health', 'sel:=|+|-|*|/', 'num:1'], f: (a, g, pk) => each(g, pk, a[0], i => { i.vars[a[1]] = OPS[a[2]](i.vars[a[1]], g.ev(a[3])); }) },
  setvar: { c: 'Variables', l: 'Variable %0: %1 %2', p: ['var:score', 'sel:=|+|-|*|/', 'num:1'], f: (a, g) => { g.vars[a[0]] = OPS[a[1]](g.vars[a[0]], g.ev(a[2])); } },
  save: { c: 'Variables', l: 'Save variable %0 in the browser', p: ['var:best'], f: (a, g) => { try { localStorage.setItem('zsg:' + g.P.id + ':' + a[0], JSON.stringify(g.vars[a[0]])); } catch (e) {} } },
  load: { c: 'Variables', l: 'Load variable %0 from the browser', p: ['var:best'], f: (a, g) => { try { const v = localStorage.getItem('zsg:' + g.P.id + ':' + a[0]); if (v != null) g.vars[a[0]] = JSON.parse(v); } catch (e) {} } },
  resettimer: { c: 'Variables', l: 'Reset timer %0', p: ['var:t1'], f: (a, g) => { g.timers[a[0]] = 0; } },
  goto: { c: 'Scene', l: 'Go to scene %0', p: ['scene'], f: (a, g) => { g.next = a[0]; } },
  restart: { c: 'Scene', l: 'Restart the scene', f: (a, g) => { g.next = g.scene.id; } },
  msg: { c: 'Scene', l: 'Show message %0 for %1 seconds', p: ['text:You win!', 'num:2'], f: (a, g) => g.msg(g.tpl(a[0]), N(g, a[1])) },
  sfx: { c: 'Sound', l: 'Play effect %0', p: ['sel:coin|jump|hit|pop|laser|explosion|powerup|lose'], f: (a, g) => g.sfx(a[0]) },
  play: { c: 'Sound', l: 'Play sound %0 at volume %1 %', p: ['snd', 'num:100'], f: (a, g) => g.play(a[0], N(g, a[1]) / 100, false, '') },
  music: { c: 'Sound', l: 'Play music %0 (loops) at volume %1 %', p: ['snd', 'num:60'], f: (a, g) => g.play(a[0], N(g, a[1]) / 100, true, 'music') },
  stopsnd: { c: 'Sound', l: 'Stop %0', p: ['sel:all|music'], f: (a, g) => g.stopSounds(a[0] === 'music' ? 'music' : '') },
  mute: { c: 'Sound', l: 'Sound: %0', p: ['sel:mute|unmute'], f: (a, g) => g.mute(a[0] === 'mute') },
  camfollow: { c: 'Camera', l: 'Camera follows %0', p: ['obj'], f: (a, g, pk) => { g.cam.f = (pk[a[0]] || g.all(a[0]))[0] || null; } },
  camstop: { c: 'Camera', l: 'Camera stops following', f: (a, g) => { g.cam.f = null; } },
  camzoom: { c: 'Camera', l: 'Set camera zoom to %0', p: ['num:1.5'], f: (a, g) => { g.cam.z = clamp(N(g, a[0]) || 1, .1, 10); } },
  camshake: { c: 'Camera', l: 'Shake camera %0 px for %1 s', p: ['num:12', 'num:.4'], f: (a, g) => { g.cam.sh = N(g, a[0]); g.cam.st = g.cam.sd = N(g, a[1]) || .01; } },
  campos: { c: 'Camera', l: 'Move camera to x %0, y %1', p: ['num:480', 'num:270'], f: (a, g) => { g.cam.f = null; g.cam.x = N(g, a[0]); g.cam.y = N(g, a[1]); } },
  gravity: { c: 'Physics', l: 'Set gravity to %0', p: ['num:900'], f: (a, g) => { g.gravity = N(g, a[0]); } }
};
const SFX = { coin: [[988, .08, 'square', .12, 0, 0], [1319, .25, 'square', .12, 0, .07]], jump: [[260, .18, 'square', .12, 380, 0]], hit: [[150, .15, 'sawtooth', .2, -100, 0]], pop: [[500, .08, 'sine', .2, 300, 0]],
  laser: [[900, .2, 'sawtooth', .1, -700, 0]], explosion: [[110, .5, 'sawtooth', .25, -90, 0], [70, .6, 'square', .2, -50, 0]], powerup: [[400, .1, 'square', .1, 0, 0], [600, .1, 'square', .1, 0, .08], [900, .2, 'square', .1, 0, .16]], lose: [[400, .2, 'triangle', .2, -200, 0], [250, .4, 'triangle', .2, -150, .18]] };

/* ---- collision ---- */
function manifold(a, b, m) { // normal points a -> b
  m = m || 0; const ra = ROUND[a.def.shape], rb = ROUND[b.def.shape];
  if (ra && rb) { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .01, r = (a.w + b.w) / 2 + m; return d < r ? { nx: dx / d, ny: dy / d, p: r - d } : null; }
  if (!ra && !rb) { const dx = b.x - a.x, dy = b.y - a.y, ox = (a.w + b.w) / 2 - Math.abs(dx) + m, oy = (a.h + b.h) / 2 - Math.abs(dy) + m; if (ox <= 0 || oy <= 0) return null; return ox < oy ? { nx: Math.sign(dx) || 1, ny: 0, p: ox } : { nx: 0, ny: Math.sign(dy) || 1, p: oy }; }
  if (!ra) { const r = manifold(b, a, m); return r && { nx: -r.nx, ny: -r.ny, p: r.p }; }
  const cx = clamp(a.x, b.x - b.w / 2, b.x + b.w / 2), cy = clamp(a.y, b.y - b.h / 2, b.y + b.h / 2), R = a.w / 2 + m; let dx = a.x - cx, dy = a.y - cy, d = Math.hypot(dx, dy);
  if (!d) { dx = 0; dy = -1; d = 1; } return d < R ? { nx: -dx / d, ny: -dy / d, p: R - d } : null;
}

function run(P, stage, opt) {
  opt = opt || {}; const W = P.w, H = P.h; let alive = true, raf = 0, uid = 1;
  const g = { P, vars: NF(Object.assign({}, P.vars)), list: [], keys: new Set(), khit: new Set(), krel: new Set(), m: { x: 0, y: 0, sx: 0, sy: 0, down: false, hit: false }, cur: {}, pk: {}, timers: {}, gravity: P.gravity == null ? 900 : P.gravity, next: null, first: true, time: 0, states: new WeakMap() };
  const snd = { vol: 1, muted: false, live: [], pend: [] }, F = NF(BASEF); F.count = n => g.all(n).length;
  stage.innerHTML = ''; Object.assign(stage.style, { position: 'absolute', left: '50%', top: '50%', width: W + 'px', height: H + 'px', overflow: 'hidden', transformOrigin: 'center' });
  const world = document.createElement('div'); world.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0'; stage.append(world);
  const fit = () => { const p = stage.parentElement, s = Math.min(p.clientWidth / W, p.clientHeight / H) || 1; stage.style.transform = 'translate(-50%,-50%) scale(' + s + ')'; };
  g.all = n => g.list.filter(i => i.name === n && !i.dead); g.st = o => { let s = g.states.get(o); if (!s) g.states.set(o, s = {}); return s; };
  g.look = k => {
    if (k.includes('.')) { const [o, p] = k.split('.'), i = g.cur[o] || (g.pk[o] && g.pk[o][0]) || g.all(o)[0]; return i ? gp(i, p) : 0; }
    if (k in g.vars) return g.vars[k];
    switch (k) { case 'mouseX': return g.m.x; case 'mouseY': return g.m.y; case 'W': return W; case 'H': return H; case 'time': return g.time; case 'camX': return g.cam.x; case 'camY': return g.cam.y; } return 0;
  };
  g.ev = s => ev(s, g.look, F); g.tpl = s => String(s).replace(/\{([^}]+)\}/g, (m, e) => { const v = g.ev(e); return typeof v === 'number' ? Math.round(v * 100) / 100 : v; });
  g.under = i => { const x = i.def.hud ? g.m.sx : g.m.x, y = i.def.hud ? g.m.sy : g.m.y; return i.vis && Math.abs(x - i.x) <= i.w / 2 && Math.abs(y - i.y) <= i.h / 2; };
  /* sound */
  g.play = (id, vol, loop, ch) => { const a = P.assets[id]; if (!a) return; const s = new Audio(a.url); s.volume = clamp(vol * snd.vol, 0, 1); s.loop = !!loop; s.ch = ch; s.muted = snd.muted; snd.live.push(s); s.onended = () => { snd.live = snd.live.filter(x => x !== s); };
    const go = () => s.play().catch(() => snd.pend.push(go)); go(); };
  g.stopSounds = ch => { snd.live = snd.live.filter(s => { if (!ch || s.ch === ch) { s.pause(); return false; } return true; }); };
  g.mute = m => { snd.muted = m; snd.live.forEach(s => { s.muted = m; }); };
  g.sfx = n => { if (snd.muted) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const c = snd.c || (snd.c = new AC()); if (c.state === 'suspended') c.resume();
    (SFX[n] || []).forEach(([f, d, ty, v, sl, dl]) => { const o = c.createOscillator(), gn = c.createGain(), t = c.currentTime + dl; o.type = ty; o.frequency.setValueAtTime(f, t); if (sl) o.frequency.linearRampToValueAtTime(Math.max(20, f + sl), t + d);
      gn.gain.setValueAtTime(v * snd.vol, t); gn.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(gn); gn.connect(c.destination); o.start(t); o.stop(t + d); }); };
  g.msg = (t, s) => { const d = document.createElement('div'); d.textContent = t; d.style.cssText = 'position:absolute;left:50%;top:16%;transform:translateX(-50%);background:#000b;color:#fff;padding:14px 30px;border-radius:30px;font:700 26px system-ui,sans-serif;z-index:9;text-align:center'; stage.append(d); setTimeout(() => d.remove(), (s || 2) * 1000); };
  /* instances */
  const build = i => {
    const d = i.def, a = P.assets[i.asset]; let e;
    if (d.type === 'text') { e = document.createElement('div'); e.style.cssText = 'display:flex;align-items:center;justify-content:center;text-align:center;white-space:pre-wrap;font:700 ' + (d.fontSize || 32) + 'px system-ui,sans-serif'; }
    else if (a && a.type === 'video') { e = document.createElement('video'); e.src = a.url; e.muted = true; e.loop = true; e.playsInline = true; e.autoplay = true; }
    else if (a && a.type !== 'audio') { e = document.createElement('img'); e.src = a.url; }
    else { e = document.createElement('div'); const s = d.shape; if (s === 'circle') e.style.borderRadius = '50%'; else if (s === 'squircle') e.style.borderRadius = '28%'; else if (s === 'rect') e.style.borderRadius = '4px'; else if (SHAPES[s]) e.style.clipPath = 'polygon(' + poly(s) + ')'; }
    e.draggable = false; e.style.position = 'absolute'; e.style.left = e.style.top = '0'; e.style.userSelect = 'none'; e.style.objectFit = 'fill'; i._c = null; i._t = null; return e;
  };
  g.rebuild = i => { const o = i.el; i.el = build(i); o.replaceWith(i.el); };
  g.spawn = (d, x, y, extra) => { const i = Object.assign({ id: uid++, def: d, name: d.name, x, y, w: d.w, h: d.h, angle: 0, vx: 0, vy: 0, vis: d.visible !== false, alpha: 1, color: d.color, text: d.text || '', asset: d.asset || '', vars: Object.assign({}, d.vars), grounded: false, dead: false }, extra);
    i.el = build(i); (d.hud ? stage : world).append(i.el); g.list.push(i); return i; };
  const draw = i => {
    const s = i.el.style; s.display = i.vis ? (i.def.type === 'text' ? 'flex' : 'block') : 'none'; s.width = i.w + 'px'; s.height = i.h + 'px'; s.opacity = i.alpha; s.transform = 'translate(' + (i.x - i.w / 2) + 'px,' + (i.y - i.h / 2) + 'px) rotate(' + i.angle + 'deg)';
    if (i.def.type === 'text') { if (i._t !== i.text) { i.el.textContent = i._t = i.text; } if (i._c !== i.color) { s.color = i._c = i.color; } if (i.def.hud) s.zIndex = 5; }
    else if (i.el.tagName === 'DIV' && i._c !== i.color) { s.background = i._c = i.color; }
    if (i.def.hud) s.zIndex = 5;
  };
  const load = sid => {
    const sc = P.scenes.find(s => s.id === sid) || P.scenes[0]; g.scene = sc; g.list.forEach(i => i.el.remove()); g.list = []; g.first = true; g.time = 0; g.states = new WeakMap(); g.timers = {};
    g.cam = { x: W / 2, y: H / 2, z: 1, f: null, sh: 0, st: 0, sd: .01 }; stage.style.background = sc.bg || P.bg || '#fff';
    (sc.instances || []).forEach(n => { const d = P.objects.find(o => o.id === n.obj); if (d) g.spawn(d, n.x, n.y, { sid: n.id }); });
  };
  const stop = () => { alive = false; cancelAnimationFrame(raf); g.stopSounds(''); removeEventListener('resize', fit); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('pointermove', pm); removeEventListener('pointerup', pu); stage.innerHTML = ''; };
  const ret = { stop, fit, g, draw, get list() { return g.list; }, load };
  fit(); addEventListener('resize', fit); load(opt.scene);
  if (opt.edit) { g.list.forEach(draw); return ret; }
  /* input */
  const kn = e => e.key === ' ' ? 'space' : e.key.replace('Arrow', '').toLowerCase(), typing = e => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
  const unlock = () => snd.pend.splice(0).forEach(f => f());
  const kd = e => { if (typing(e)) return; const k = kn(e); if (/^(space|up|down|left|right)$/.test(k)) e.preventDefault(); unlock(); if (e.repeat) return; g.keys.add(k); g.khit.add(k); };
  const ku = e => { const k = kn(e); g.keys.delete(k); g.krel.add(k); };
  const pos = e => { const r = stage.getBoundingClientRect(), c = g.cam; g.m.sx = (e.clientX - r.left) * W / r.width; g.m.sy = (e.clientY - r.top) * H / r.height; g.m.x = (g.m.sx - (W / 2 - c.x * c.z)) / c.z; g.m.y = (g.m.sy - (H / 2 - c.y * c.z)) / c.z; };
  const pm = e => { pos(e); if (g.drag) { g.drag.i.x = g.m.x - g.drag.ox; g.drag.i.y = g.m.y - g.drag.oy; } }, pu = () => { g.m.down = false; g.drag = null; };
  addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('pointermove', pm); addEventListener('pointerup', pu);
  stage.addEventListener('pointerdown', e => { unlock(); pos(e); g.m.down = g.m.hit = true;
    const t = [...g.list].reverse().find(i => i.def.drag && g.under(i)); if (t) g.drag = { i: t, ox: g.m.x - t.x, oy: g.m.y - t.y }; });
  /* events */
  const runEvents = (list, pk0) => {
    for (const e of list) {
      if (e.off || e.comment != null) continue; const pk = Object.assign({}, pk0); g.pk = pk; let ok = true; const once = [];
      for (const cd of e.conds || []) { const d = C[cd.t]; if (!d) { ok = false; break; } if (cd.t === 'once') { once.push(cd); continue; }
        let r; try { r = d.f(cd.a, g, pk, cd, !!cd.n); } catch (x) { r = false; } if (!d.pick && cd.n) r = !r; if (!r) { ok = false; break; } }
      if (!ok) { once.forEach(cd => { g.st(cd).on = false; }); continue; }
      if (once.length) { const s = g.st(once[0]); if (s.on) continue; s.on = true; }
      for (const ac of e.acts || []) { const d = A[ac.t]; if (d) try { d.f(ac.a, g, pk); } catch (x) { console.error(x); } }
      if (e.sub) runEvents(e.sub, pk);
    }
  };
  const ax = () => (g.keys.has('right') || g.keys.has('d') ? 1 : 0) - (g.keys.has('left') || g.keys.has('a') ? 1 : 0), ay = () => (g.keys.has('down') || g.keys.has('s') ? 1 : 0) - (g.keys.has('up') || g.keys.has('w') ? 1 : 0);
  const physics = dt => {
    const bod = [];
    for (const i of g.list) {
      const d = i.def, ph = d.phys || { t: 'none' }, pl = d.plat && d.plat.on ? d.plat : null, tp = d.top && d.top.on ? d.top : null;
      i.body = pl ? 'dynamic' : ph.t; i.bn = ph.bounce == null ? .5 : ph.bounce; i.fr = ph.fric == null ? .2 : ph.fric; const was = i.grounded; i.grounded = false;
      if (g.drag && g.drag.i === i) { i.vx = i.vy = 0; continue; }
      if (pl) { i.vx = ax() * pl.speed; if ((g.keys.has('up') || g.keys.has('w') || g.keys.has('space')) && was) i.vy = -pl.jump; }
      if (tp) { i.vx = ax() * tp.speed; i.vy = ay() * tp.speed; }
      if (i.body === 'dynamic') i.vy += g.gravity * (ph.grav == null ? 1 : ph.grav) * dt;
      if (i.body !== 'static') { i.x += i.vx * dt; i.y += i.vy * dt; }
      const e = d.edge || (i.body === 'dynamic' ? 'bound' : 'none');
      if (e === 'bound' && i.body !== 'static') { const hw = i.w / 2, hh = i.h / 2, dyn = i.body === 'dynamic';
        if (i.x < hw) { i.x = hw; if (dyn) i.vx = Math.abs(i.vx) * i.bn; } if (i.x > W - hw) { i.x = W - hw; if (dyn) i.vx = -Math.abs(i.vx) * i.bn; }
        if (i.y < hh) { i.y = hh; if (dyn) i.vy = Math.abs(i.vy) * i.bn; } if (i.y > H - hh) { i.y = H - hh; if (dyn) { i.vy = -Math.abs(i.vy) * (Math.abs(i.vy) < 60 ? 0 : i.bn); i.grounded = true; } } }
      else if (e === 'wrap') { if (i.x < -i.w / 2) i.x = W + i.w / 2; else if (i.x > W + i.w / 2) i.x = -i.w / 2; if (i.y < -i.h / 2) i.y = H + i.h / 2; else if (i.y > H + i.h / 2) i.y = -i.h / 2; }
      else if (e === 'destroy' && (i.x < -i.w || i.x > W + i.w || i.y < -i.h || i.y > H + i.h)) i.dead = true;
      if (i.body !== 'none' && !i.dead) bod.push(i);
    }
    for (let it = 0; it < 3; it++) for (let p = 0; p < bod.length; p++) for (let q = p + 1; q < bod.length; q++) {
      const a = bod[p], b = bod[q]; if (a.body !== 'dynamic' && b.body !== 'dynamic') continue; if (Math.abs(a.x - b.x) > (a.w + b.w) / 2 || Math.abs(a.y - b.y) > (a.h + b.h) / 2) continue;
      const m = manifold(a, b); if (!m) continue; const ia = a.body === 'dynamic' ? 1 : 0, ib = b.body === 'dynamic' ? 1 : 0, s = ia + ib;
      a.x -= m.nx * m.p * ia / s; a.y -= m.ny * m.p * ia / s; b.x += m.nx * m.p * ib / s; b.y += m.ny * m.p * ib / s; if (m.ny > .5) a.grounded = true; if (m.ny < -.5) b.grounded = true;
      const rv = (b.vx - a.vx) * m.nx + (b.vy - a.vy) * m.ny; if (rv >= 0) continue;
      const e = -rv < 25 ? 0 : Math.min(a.bn, b.bn), j = -(1 + e) * rv / s; a.vx -= j * ia * m.nx; a.vy -= j * ia * m.ny; b.vx += j * ib * m.nx; b.vy += j * ib * m.ny;
      const tx = -m.ny, ty = m.nx, jt = -((b.vx - a.vx) * tx + (b.vy - a.vy) * ty) * Math.min(1, (a.fr + b.fr) / 2) / s; a.vx -= jt * ia * tx; a.vy -= jt * ia * ty; b.vx += jt * ib * tx; b.vy += jt * ib * ty;
    }
  };
  const camera = dt => { const c = g.cam; if (c.f && !c.f.dead) { c.x += (c.f.x - c.x) * Math.min(1, dt * 6); c.y += (c.f.y - c.y) * Math.min(1, dt * 6); }
    let sx = 0, sy = 0; if (c.st > 0) { c.st -= dt; const k = c.sh * Math.max(0, c.st / c.sd); sx = (Math.random() * 2 - 1) * k; sy = (Math.random() * 2 - 1) * k; }
    world.style.transform = 'translate(' + (W / 2 - c.x * c.z + sx) + 'px,' + (H / 2 - c.y * c.z + sy) + 'px) scale(' + c.z + ')'; };
  const step = dt => {
    g.time += dt; for (const k in g.timers) g.timers[k] += dt; runEvents(g.scene.events || [], {}); physics(dt); camera(dt);
    g.list = g.list.filter(i => { if (i.dead) { i.el.remove(); return false; } return true; });
    g.first = false; g.khit.clear(); g.krel.clear(); g.m.hit = false; if (g.next) { const n = g.next; g.next = null; load(n); }
  };
  let last = performance.now(), acc = 0;
  const frame = now => { if (!alive) return; raf = requestAnimationFrame(frame); acc += Math.min(.1, (now - last) / 1000); last = now; let n = 0; while (acc >= 1 / 60 && n++ < 5) { step(1 / 60); acc -= 1 / 60; } g.list.forEach(draw); };
  g.list.forEach(draw); raf = requestAnimationFrame(frame); return ret;
}
function start(P, container) { const st = document.createElement('div'); container.append(st); return run(P, st, {}); }
return { C, A, KEYS, ev, run, start, SHAPES, ROUND, poly };
};
const ZRuntime = ZRuntimeFactory();
