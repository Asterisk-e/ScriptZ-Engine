/* ScriptZ-Engine core — block definitions + runtime + standalone exporter. No sound, no physics. */
const ZEngineFactory = function () {
const KEYS = ['space', 'left', 'right', 'up', 'down', ...'abcdefghijklmnopqrstuvwxyz0123456789'];
const PREC = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 };
const NF = o => Object.assign(Object.create(null), o);
const F = NF({ random: (a = 1, b = 10) => Math.floor(a + Math.random() * (b - a + 1)), abs: Math.abs, round: Math.round, floor: Math.floor, min: Math.min, max: Math.max, sqrt: Math.sqrt });
// tiny safe expression evaluator (no eval): numbers, "text", variables, + - * / %, comparisons, && ||, random() abs() round()...
function ev(src, sc) {
  const t = String(src == null ? '' : src).match(/\d+\.?\d*|[A-Za-z_]\w*|"[^"]*"|==|!=|<=|>=|&&|\|\||[-+*\/%()<>!,]/g) || []; let i = 0;
  const prim = () => {
    const k = t[i++]; if (k === undefined) return 0;
    if (k === '(') { const v = exp(0); i++; return v; }
    if (k === '-') return -prim(); if (k === '!') return !prim();
    if (/^\d/.test(k)) return +k; if (k[0] === '"') return k.slice(1, -1);
    if (t[i] === '(') { i++; const a = []; if (t[i] === ')') i++; else { a.push(exp(0)); while (t[i] === ',') { i++; a.push(exp(0)); } i++; } return (F[k] || (() => 0))(...a); }
    return k in sc ? sc[k] : 0;
  };
  const exp = m => { let l = prim(); while (PREC[t[i]] >= m) { const o = t[i++], r = exp(PREC[o] + 1);
    l = o === '+' ? l + r : o === '-' ? l - r : o === '*' ? l * r : o === '/' ? l / r : o === '%' ? l % r : o === '<' ? l < r : o === '>' ? l > r : o === '<=' ? l <= r : o === '>=' ? l >= r : o === '==' ? l == r : o === '!=' ? l != r : o === '&&' ? l && r : l || r; } return l; };
  return exp(0);
}
const num = (g, b, o, i) => +g.E(b, i, o) || 0;
// c=category, l=label (%n = argument n), a=args ['type:default'], hat=event block, C=holds blocks inside
const B = {
  start: { c: 'ev', l: 'when game starts', hat: 1 },
  key: { c: 'ev', l: 'when key %0 pressed', a: ['key:space'], hat: 1 },
  click: { c: 'ev', l: 'when this is clicked', hat: 1 },
  recv: { c: 'ev', l: 'when I receive %0', a: ['text:go'], hat: 1 },
  movex: { c: 'mo', l: 'change x by %0', a: ['num:10'], run: (b, o, g) => { o.x += num(g, b, o, 0); } },
  movey: { c: 'mo', l: 'change y by %0', a: ['num:10'], run: (b, o, g) => { o.y += num(g, b, o, 0); } },
  goto: { c: 'mo', l: 'go to x %0 y %1', a: ['num:200', 'num:200'], run: (b, o, g) => { o.x = num(g, b, o, 0); o.y = num(g, b, o, 1); } },
  gomouse: { c: 'mo', l: 'go to mouse', run: (b, o, g) => { o.x = g.mouse.x; o.y = g.mouse.y; } },
  turn: { c: 'mo', l: 'turn %0 degrees', a: ['num:15'], run: (b, o, g) => { o.rot += num(g, b, o, 0); } },
  show: { c: 'lo', l: 'show', run: (b, o) => { o.visible = true; } },
  hide: { c: 'lo', l: 'hide', run: (b, o) => { o.visible = false; } },
  size: { c: 'lo', l: 'set size to %0 %', a: ['num:100'], run: (b, o, g) => { const s = num(g, b, o, 0) / 100; o.w = o.bw * s; o.h = o.bh * s; } },
  say: { c: 'lo', l: 'say %0', a: ['text:Hello!'], run: (b, o, g) => { o.say = String(b.a[0]).replace(/\{(\w+)\}/g, (m, k) => g.vars[k] == null ? '' : g.vars[k]); } },
  img: { c: 'lo', l: 'switch image to %0', a: ['asset:'], run: (b, o, g) => g.setAsset(o, b.a[0]) },
  vid: { c: 'lo', l: '%0 video', a: ['sel:play|pause'], run: (b, o) => { if (o.el.play) b.a[0] === 'play' ? o.el.play() : o.el.pause(); } },
  wait: { c: 'ct', l: 'wait %0 seconds', a: ['num:1'], run: function* (b, o, g) { const end = performance.now() + num(g, b, o, 0) * 1000; while (performance.now() < end) yield; } },
  repeat: { c: 'ct', l: 'repeat %0 times', a: ['num:10'], C: 1, run: function* (b, o, g) { const n = num(g, b, o, 0); for (let i = 0; i < n; i++) { yield* g.exec(b.body || [], o); yield; } } },
  forever: { c: 'ct', l: 'forever', C: 1, run: function* (b, o, g) { for (;;) { yield* g.exec(b.body || [], o); yield; } } },
  if: { c: 'ct', l: 'if %0 then', a: ['num:x > 400'], C: 1, run: function* (b, o, g) { if (g.E(b, 0, o)) yield* g.exec(b.body || [], o); } },
  ifkey: { c: 'ct', l: 'if key %0 is down', a: ['key:space'], C: 1, run: function* (b, o, g) { if (g.keys.has(b.a[0])) yield* g.exec(b.body || [], o); } },
  iftouch: { c: 'ct', l: 'if touching %0', a: ['obj:'], C: 1, run: function* (b, o, g) { const t = g.objs.find(x => x !== o && x.name === b.a[0] && x.visible !== false); if (t && g.hit(o, t)) yield* g.exec(b.body || [], o); } },
  bcast: { c: 'ct', l: 'broadcast %0', a: ['text:go'], run: (b, o, g) => g.bcast(b.a[0]) },
  stop: { c: 'ct', l: 'stop game', run: (b, o, g) => g.stop() },
  set: { c: 'va', l: 'set %0 to %1', a: ['text:score', 'num:0'], run: (b, o, g) => { g.vars[b.a[0]] = g.E(b, 1, o); } },
  chg: { c: 'va', l: 'change %0 by %1', a: ['text:score', 'num:1'], run: (b, o, g) => { g.vars[b.a[0]] = (+g.vars[b.a[0]] || 0) + num(g, b, o, 1); } }
};

function run(P, stage, opt) {
  opt = opt || {}; const W = P.w, H = P.h; let alive = true, raf = 0;
  const g = { vars: NF({}), keys: new Set(), mouse: { x: 0, y: 0, down: false }, objs: [], threads: [] };
  stage.innerHTML = '';
  Object.assign(stage.style, { position: 'absolute', left: '50%', top: '50%', width: W + 'px', height: H + 'px', overflow: 'hidden', background: P.bg, transformOrigin: 'center' });
  const fit = () => { const p = stage.parentElement, s = Math.min(p.clientWidth / W, p.clientHeight / H) || 1; stage.style.transform = 'translate(-50%,-50%) scale(' + s + ')'; };
  g.exec = function* (list, o) { for (const b of list) { const d = B[b.t], r = d && d.run && d.run(b, o, g); if (r && r.next) yield* r; } };
  g.E = (b, i, o) => ev(b.a[i], NF(Object.assign({}, g.vars, { x: o.x, y: o.y, w: o.w, h: o.h, rot: o.rot, mouseX: g.mouse.x, mouseY: g.mouse.y, W, H })));
  g.hit = (a, b) => Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
  const build = o => {
    const a = P.assets[o.asset]; let e;
    if (a && a.type === 'video') { e = document.createElement('video'); e.src = a.url; e.muted = true; e.loop = true; e.playsInline = true; e.autoplay = true; }
    else if (a) { e = document.createElement('img'); e.src = a.url; }
    else { e = document.createElement('div'); e.style.background = o.color; e.style.borderRadius = o.shape === 'circle' ? '50%' : o.shape === 'squircle' ? '28%' : '6px'; }
    e.draggable = false; e.style.cssText += ';position:absolute;left:0;top:0;user-select:none;object-fit:fill'; return e;
  };
  const bubble = () => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;left:0;top:0;background:#fff;color:#1d1b20;padding:6px 14px;border-radius:16px;font:600 16px system-ui,sans-serif;max-width:260px;pointer-events:none;display:none'; return d; };
  g.setAsset = (o, id) => { o.asset = id; const old = o.el; o.el = build(o); old.replaceWith(o.el); };
  const draw = o => {
    const s = o.el.style; s.display = o.visible === false ? 'none' : 'block'; s.width = o.w + 'px'; s.height = o.h + 'px';
    s.transform = 'translate(' + (o.x - o.w / 2) + 'px,' + (o.y - o.h / 2) + 'px) rotate(' + o.rot + 'deg)';
    o.bub.style.display = o.say && o.visible !== false ? 'block' : 'none'; o.bub.textContent = o.say;
    o.bub.style.transform = 'translate(' + o.x + 'px,' + (o.y - o.h / 2 - 8) + 'px) translate(-50%,-100%)';
  };
  P.objects.forEach(d => { const o = Object.assign({}, d, { bw: d.w, bh: d.h, say: '' }); o.el = build(o); o.bub = bubble(); stage.append(o.el, o.bub); g.objs.push(o); });
  const stop = () => { alive = false; cancelAnimationFrame(raf); removeEventListener('resize', fit); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('pointermove', pm); removeEventListener('pointerup', pu); stage.innerHTML = ''; };
  g.stop = stop;
  const ret = { stop, fit, objs: g.objs, draw, g };
  fit(); addEventListener('resize', fit);
  if (opt.edit) { g.objs.forEach(draw); return ret; }
  const spawn = (o, s) => { g.threads = g.threads.filter(t => t.s !== s); g.threads.push({ s, it: g.exec(s.blocks.slice(1), o) }); };
  const fire = (type, test) => g.objs.forEach(o => (o.scripts || []).forEach(s => { const f = s.blocks[0]; if (f && f.t === type && (!test || test(f, o))) spawn(o, s); }));
  g.bcast = m => fire('recv', f => f.a[0] === m);
  const kn = e => e.key === ' ' ? 'space' : e.key.replace('Arrow', '').toLowerCase();
  const typing = e => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
  const kd = e => { if (typing(e)) return; const k = kn(e); if (/^(space|up|down|left|right)$/.test(k)) e.preventDefault(); if (e.repeat) return; g.keys.add(k); fire('key', f => f.a[0] === k); };
  const ku = e => g.keys.delete(kn(e));
  const pos = e => { const r = stage.getBoundingClientRect(); g.mouse.x = (e.clientX - r.left) * W / r.width; g.mouse.y = (e.clientY - r.top) * H / r.height; };
  const pm = e => pos(e), pu = () => { g.mouse.down = false; };
  addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('pointermove', pm); addEventListener('pointerup', pu);
  stage.addEventListener('pointerdown', e => { pos(e); g.mouse.down = true; const hit = [...g.objs].reverse().find(o => o.visible !== false && Math.abs(g.mouse.x - o.x) <= o.w / 2 && Math.abs(g.mouse.y - o.y) <= o.h / 2); if (hit) fire('click', (f, o) => o === hit); });
  fire('start');
  const tick = () => { if (!alive) return; raf = requestAnimationFrame(tick);
    for (const t of g.threads.slice()) { let r; try { r = t.it.next(); } catch (err) { console.error(err); r = { done: true }; } if (r.done) g.threads = g.threads.filter(x => x !== t); }
    g.objs.forEach(draw); };
  tick(); return ret;
}
function exportHTML(P) {
  const esc = s => String(s).replace(/[<&>"]/g, c => '&#' + c.charCodeAt(0) + ';'), j = JSON.stringify(P).replace(/</g, '\\u003c');
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(P.name) +
    '</title><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#w{position:fixed;inset:0}</style></head><body><div id="w"><div id="s"></div></div><script>const P=' + j +
    ';(' + ZEngineFactory.toString() + ')().run(P,document.getElementById("s"));<\/script></body></html>';
}
return { B, KEYS, ev, run, exportHTML };
};
const ZEngine = ZEngineFactory();
