/* ScriptZ-Engine editor — everything happens in the page: objects, assets, image editor, blocks, play, export. */
(() => {
const $ = s => document.querySelector(s), h = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const Z = ZEngine, B = Z.B, uid = () => Math.random().toString(36).slice(2, 9);
const LS = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const prefs = Object.assign({ hue: 265, theme: 'dark', done: false, name: 'My Game', w: 960, h: 540 }, LS('zs:prefs') || {});
let P = LS('zs:project'), sel = null, cat = 'ev', cur = null, playing = false, tmr;
const CATS = { ev: 'Events', mo: 'Motion', lo: 'Looks', ct: 'Control', va: 'Variables' };
const hex = (H, S, L) => { S /= 100; L /= 100; const a = S * Math.min(L, 1 - L), f = n => { const k = (n + H / 30) % 12; return Math.round(255 * (L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return '#' + [f(0), f(8), f(4)].map(x => x.toString(16).padStart(2, '0')).join(''); };
const toast = m => { const t = h('div', 'toast', m); document.body.append(t); setTimeout(() => t.remove(), 2600); };
const savePrefs = () => { try { localStorage.setItem('zs:prefs', JSON.stringify(prefs)); } catch (e) {} };
const persist = () => { clearTimeout(tmr); tmr = setTimeout(() => { try { localStorage.setItem('zs:project', JSON.stringify(P)); } catch (e) { toast('Too big to autosave — use Save'); } }, 400); };
const theme = () => { document.documentElement.style.setProperty('--h', prefs.hue); document.documentElement.dataset.theme = prefs.theme; };
const so = () => P.objects.find(o => o.id === sel) || (sel = P.objects[0].id, P.objects[0]);
const mkObj = () => ({ id: uid(), name: 'Object ' + (P.objects.length + 1), x: P.w / 2, y: P.h / 2, w: 96, h: 96, rot: 0, visible: true, color: hex(prefs.hue + P.objects.length * 40, 70, 72), shape: 'squircle', asset: '', scripts: [] });
const dl = (name, text, type) => { const a = h('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };

/* ---- MaterialUs shapes (static SVG) ---- */
const NS = 'http://www.w3.org/2000/svg';
const bloom = (n, a) => { let d = ''; for (let i = 0; i <= 120; i++) { const t = i / 120 * Math.PI * 2, r = 90 * (1 + a * Math.cos(n * t)); d += (i ? 'L' : 'M') + (110 + r * Math.cos(t)).toFixed(1) + ' ' + (110 + r * Math.sin(t)).toFixed(1); } return d + 'Z'; };

/* ---- rendering ---- */
function renderAll() { renderObjs(); renderAssets(); renderProps(); renderPal(); renderWs(); refreshStage(); }
function select(id) { sel = id; renderObjs(); renderAssets(); renderProps(); renderWs(); hl(); }
const hl = () => cur && cur.objs && cur.objs.forEach(o => o.el.classList.toggle('sel', o.id === sel));
function refreshStage() { if (playing) return; cur && cur.stop(); cur = Z.run(P, $('#stage'), { edit: true }); hl(); }
function renderObjs() {
  const l = $('#objs'); l.innerHTML = ''; so();
  P.objects.forEach(o => { const c = h('button', 'chip' + (o.id === sel ? ' on' : '')), th = h('i', 'th'), a = P.assets[o.asset];
    if (a && a.type !== 'video') th.style.backgroundImage = 'url("' + a.url + '")'; else th.style.background = a ? 'var(--sf3)' : o.color;
    c.append(th, h('span', '', o.name)); c.onclick = () => select(o.id); l.append(c); });
}
function renderAssets() {
  const g = $('#assets'); g.innerHTML = '';
  Object.entries(P.assets).forEach(([id, a]) => {
    const c = h('div', 'asset' + (so().asset === id ? ' on' : '')), t = a.type === 'video' ? h('video') : h('img'); t.src = a.url; if (a.type === 'video') t.muted = true; t.draggable = false; t.title = 'Use on selected object';
    t.onclick = () => { const o = so(); o.asset = id; if (a.nw) o.h = Math.round(o.w * a.nh / a.nw); persist(); renderAll(); };
    const r = h('div', 'ar');
    if (a.type !== 'video') { const e = h('button', '', '✎'); e.title = 'Edit in image editor'; e.onclick = () => Paint.open(a.url, (u, w, hh) => { a.url = u; a.type = 'image'; a.nw = w; a.nh = hh; persist(); renderAll(); }); r.append(e); }
    const d = h('button', '', '✕'); d.title = 'Delete'; d.onclick = () => { delete P.assets[id]; P.objects.forEach(o => { if (o.asset === id) o.asset = ''; }); persist(); renderAll(); };
    r.append(d); c.append(t, r); g.append(c);
  });
}
function addAsset(a) {
  const id = uid(); P.assets[id] = a; const fin = (w, hh) => { a.nw = w; a.nh = hh; persist(); renderAll(); };
  if (a.type === 'video') { const v = document.createElement('video'); v.onloadedmetadata = () => fin(v.videoWidth, v.videoHeight); v.src = a.url; }
  else { const i = new Image(); i.onload = () => fin(i.naturalWidth, i.naturalHeight); i.src = a.url; }
  persist(); renderAll();
}
function addFile(f) {
  const type = f.type.startsWith('video') ? 'video' : f.type === 'image/gif' ? 'gif' : f.type.startsWith('image') ? 'image' : null; if (!type) return;
  const r = new FileReader(); r.onload = () => addAsset({ name: f.name.replace(/\.\w+$/, ''), type, url: r.result }); r.readAsDataURL(f);
}
function fld(parent, label, type, key, o, after) {
  const l = h('label', type === 'checkbox' ? 'chk' : '', type === 'checkbox' ? '' : label), i = h('input'); i.type = type;
  if (type === 'checkbox') { i.checked = !!o[key]; l.append(i, label); } else { i.value = o[key]; l.append(i); }
  i.oninput = () => { o[key] = type === 'number' ? +i.value : type === 'checkbox' ? i.checked : i.value; persist(); (after || refreshStage)(); };
  parent.append(l); return i;
}
function renderProps() {
  const p = $('#props'); p.innerHTML = ''; const o = so();
  p.append(h('h3', '', 'Selected object')); const r1 = h('div', 'row'); fld(r1, 'Name', 'text', 'name', o, () => { renderObjs(); renderWs(); renderPal(); });
  const sh = h('label', '', 'Shape'), ss = h('select'); ['squircle', 'circle', 'rect'].forEach(v => ss.append(new Option(v, v))); ss.value = o.shape; ss.onchange = () => { o.shape = ss.value; persist(); refreshStage(); }; sh.append(ss); r1.append(sh);
  ['x', 'y', 'w', 'h'].forEach(k => fld(r1, k === 'w' ? 'Width' : k === 'h' ? 'Height' : k.toUpperCase(), 'number', k, o)); fld(r1, 'Rotation', 'number', 'rot', o); fld(r1, 'Color', 'color', 'color', o, () => { renderObjs(); refreshStage(); });
  p.append(r1); fld(p, 'Visible at start', 'checkbox', 'visible', o);
  const al = h('label', '', 'Image / video'), as = h('select'); as.append(new Option('(none — use color)', '')); Object.entries(P.assets).forEach(([id, a]) => as.append(new Option(a.name, id))); as.value = o.asset;
  as.onchange = () => { o.asset = as.value; const a = P.assets[o.asset]; if (a && a.nw) o.h = Math.round(o.w * a.nh / a.nw); persist(); renderAll(); }; al.append(as); p.append(al);
  if (P.objects.length > 1) { const d = h('button', 'btn danger', 'Delete object'); d.onclick = () => { P.objects = P.objects.filter(x => x.id !== o.id); sel = null; persist(); renderAll(); }; p.append(d); }
  p.append(h('h3', '', 'Stage')); const r2 = h('div', 'row'); fld(r2, 'Width', 'number', 'w', P); fld(r2, 'Height', 'number', 'h', P); fld(r2, 'Background', 'color', 'bg', P); p.append(r2);
}

/* ---- block editor ---- */
const newBlock = t => { const d = B[t], b = { t, a: (d.a || []).map(s => { const [ty, ...r] = s.split(':'), v = r.join(':'); return ty === 'sel' ? v.split('|')[0] : ty === 'obj' ? ((P.objects.find(x => x.id !== sel) || P.objects[0]).name) : v; }) }; if (d.C) b.body = []; return b; };
const clean = () => { const o = so(); o.scripts = o.scripts.filter(s => s.blocks.length); };
function argEl(sp, b, i) {
  const [ty, ...r] = sp.split(':'), def = r.join(':');
  if (ty === 'num' || ty === 'text') { const e = h('input', 'in'); e.value = b.a[i]; const fit = () => e.style.width = Math.max(2, e.value.length + 1) + 'ch'; fit(); e.oninput = () => { b.a[i] = e.value; fit(); persist(); }; e.onpointerdown = ev => ev.stopPropagation(); return e; }
  const e = h('select', 'in'), opts = ty === 'key' ? Z.KEYS.map(k => [k, k]) : ty === 'obj' ? P.objects.map(o => [o.name, o.name]) : ty === 'asset' ? [['', '(none)'], ...Object.entries(P.assets).map(([id, a]) => [id, a.name])] : def.split('|').map(x => [x, x]);
  opts.forEach(([v, l]) => e.append(new Option(l, v))); e.value = b.a[i]; e.onchange = () => { b.a[i] = e.value; persist(); }; e.onpointerdown = ev => ev.stopPropagation(); return e;
}
function mkBlock(b, list, i) {
  const d = B[b.t], el = h('div', 'blk c-' + d.c + (d.hat ? ' hat' : '') + (d.C ? ' cb' : '')), hd = h('div', 'bh'); el._r = { list, i }; el._b = b; el.append(hd);
  d.l.split(/(%\d)/).forEach(p => { const m = p.match(/^%(\d)$/); if (m) hd.append(argEl(d.a[+m[1]], b, +m[1])); else if (p.trim()) hd.append(h('span', '', p.trim())); });
  if (list) hd.onpointerdown = ev => { const rect = el.getBoundingClientRect(), chunk = list.splice(i); clean(); renderWs(); grab(ev, chunk, rect); };
  if (d.C) { const bb = h('div', 'bb'); (b.body || (b.body = [])).forEach((c, j) => bb.append(mkBlock(c, b.body, j))); el.append(bb, h('div', 'bf')); }
  return el;
}
function renderPal() {
  $('#cats').querySelectorAll('button').forEach(b => b.classList.toggle('p', b.dataset.c === cat)); const p = $('#pal'); p.innerHTML = '';
  Object.keys(B).filter(t => B[t].c === cat).forEach(t => { const e = mkBlock(newBlock(t)); e.classList.add('pal'); e.onpointerdown = ev => grab(ev, [newBlock(t)], e.getBoundingClientRect()); p.append(e); });
}
function renderWs() {
  const ws = $('#ws'), o = so(); ws.innerHTML = '';
  o.scripts.forEach(s => { const e = h('div', 'scr'); e.style.left = s.x + 'px'; e.style.top = s.y + 'px'; s.blocks.forEach((b, i) => e.append(mkBlock(b, s.blocks, i))); ws.append(e); });
  if (!o.scripts.length) ws.append(h('p', 'hint', 'Drag blocks here to program “' + o.name + '”. Start with a yellow “when” block, then snap blocks underneath it.'));
}
function grab(ev, chunk, rect) {
  ev.preventDefault(); const dx = ev.clientX - rect.left, dy = ev.clientY - rect.top, hat = !!B[chunk[0].t].hat;
  const ghost = h('div', 'ghost'), line = h('div', 'snapline'); chunk.forEach(b => ghost.append(mkBlock(b))); document.body.append(ghost, line); line.style.display = 'none';
  const pts = [];
  if (!hat) $('#ws').querySelectorAll('.blk').forEach(el => { const q = el.getBoundingClientRect(); pts.push({ x: q.left, y: q.bottom, list: el._r.list, idx: el._r.i + 1 });
    if (el._b.body) { const hb = el.querySelector('.bh').getBoundingClientRect(); pts.push({ x: q.left + 16, y: hb.bottom, list: el._b.body, idx: 0 }); } });
  let snap = null;
  const mv = e => { const gx = e.clientX - dx, gy = e.clientY - dy; ghost.style.left = gx + 'px'; ghost.style.top = gy + 'px'; snap = null; let bd = 50;
    for (const p of pts) { const d = Math.hypot(p.x - gx, p.y - gy); if (d < bd) { bd = d; snap = p; } }
    line.style.display = snap ? 'block' : 'none'; if (snap) { line.style.left = snap.x + 'px'; line.style.top = snap.y - 2 + 'px'; } };
  const up = e => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up); ghost.remove(); line.remove();
    const over = document.elementFromPoint ? document.elementFromPoint(e.clientX, e.clientY) : null, ws = $('#ws'), q = ws.getBoundingClientRect();
    if (over && $('#pal').contains(over)) { /* dropped on palette = delete */ }
    else if (snap) snap.list.splice(snap.idx, 0, ...chunk);
    else if (e.clientX > q.left && e.clientX < q.right && e.clientY > q.top && e.clientY < q.bottom) so().scripts.push({ x: Math.max(6, e.clientX - dx - q.left + ws.scrollLeft), y: Math.max(6, e.clientY - dy - q.top + ws.scrollTop), blocks: chunk });
    renderWs(); persist();
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); mv(ev);
}

/* ---- OOBE (static MaterialUs shapes) ---- */
function oobe(done) {
  const root = $('#oobe'); root.hidden = false; root.innerHTML = '';
  const cfg = { name: P ? P.name : prefs.name, w: P ? P.w : prefs.w, h: P ? P.h : prefs.h }; let step = 0;
  [[8, .07, 's1'], [5, .16, 's2'], [4, .2, 's3'], [12, .05, 's4'], [6, .1, 's5'], [3, .12, 's6']].forEach(([n, a, c]) => {
    const s = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path'); s.setAttribute('viewBox', '0 0 220 220'); s.setAttribute('class', 'os ' + c); p.setAttribute('d', bloom(n, a)); s.append(p); root.append(s); });
  const card = h('div', 'ocard'), dots = h('div', 'dots'), body = h('div'), nav = h('div', 'onav'), back = h('button', 'btn', 'Back'), next = h('button', 'btn p', 'Next');
  const STEPS = 5; for (let i = 0; i < STEPS; i++) dots.append(h('i')); nav.append(back, next); card.append(dots, body, nav); root.append(card);
  const choices = (items, cur, pick) => { const g = h('div', 'cards'); items.forEach(([k, sub, v]) => { const c = h('button', 'card' + (k === cur ? ' on' : '')); c.append(h('b', '', k), h('span', '', sub)); c.onclick = () => { g.querySelectorAll('.card').forEach(x => x.classList.remove('on')); c.classList.add('on'); pick(k, v); }; g.append(c); }); return g; };
  const views = [
    () => [h('h1', '', 'Hello'), h('p', '', 'Welcome to ScriptZ-Engine. Make games right here in your browser — add images, GIFs and videos, draw in the built-in image editor, and program with blocks. No code files.')],
    () => { const i = h('input', 'in2'); i.value = cfg.name; i.maxLength = 30; i.oninput = () => cfg.name = i.value.trim() || 'My Game'; i.onkeydown = e => { if (e.key === 'Enter') next.click(); }; setTimeout(() => i.focus(), 50); return [h('h2', '', 'Name your game'), h('p', '', 'You can rename it any time.'), i]; },
    () => { const row = h('div', 'swatches'); [265, 340, 20, 150, 195, 50].forEach(hu => { const b = h('button', 'sw' + (hu === prefs.hue ? ' on' : '')); b.style.background = 'hsl(' + hu + ' 80% 72%)'; b.onclick = () => { prefs.hue = hu; theme(); row.querySelectorAll('.sw').forEach(x => x.classList.remove('on')); b.classList.add('on'); }; row.append(b); });
      return [h('h2', '', 'Pick your style'), h('p', '', 'Choose a colour and light or dark.'), row, h('p', ''), choices([['Dark', 'Easy on the eyes'], ['Light', 'Bright and clean']], prefs.theme === 'light' ? 'Light' : 'Dark', k => { prefs.theme = k.toLowerCase(); theme(); })]; },
    () => [h('h2', '', 'Choose a canvas'), h('p', '', 'The size of your game screen. You can change it later.'),
      choices([['Wide', '960 × 540', [960, 540]], ['Classic', '800 × 600', [800, 600]], ['Square', '640 × 640', [640, 640]], ['Portrait', '405 × 720', [405, 720]]], cfg.w === 960 ? 'Wide' : cfg.w === 800 ? 'Classic' : cfg.w === 640 ? 'Square' : cfg.w === 405 ? 'Portrait' : '', (k, v) => { cfg.w = v[0]; cfg.h = v[1]; })],
    () => [h('h2', '', 'All set!'), h('p', '', '“' + cfg.name + '” is ready — ' + cfg.w + ' × ' + cfg.h + '. Next: add an object, drag a “when” block into the code area and build from there.')]
  ];
  const go = n => { step = n; body.innerHTML = ''; body.append(...views[n]()); dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i === n)); back.style.visibility = n ? 'visible' : 'hidden'; next.textContent = n === 0 ? 'Get started' : n === STEPS - 1 ? 'Open editor' : 'Next'; };
  back.onclick = () => go(step - 1);
  next.onclick = () => { if (step < STEPS - 1) return go(step + 1);
    Object.assign(prefs, { done: true, name: cfg.name, w: cfg.w, h: cfg.h }); savePrefs();
    if (!P) { P = { name: cfg.name, w: cfg.w, h: cfg.h, bg: hex(prefs.hue, 30, 92), objects: [], assets: {} }; P.objects.push(mkObj()); } else { P.name = cfg.name; P.w = cfg.w; P.h = cfg.h; }
    persist(); root.hidden = true; root.innerHTML = ''; done(); };
  go(0);
}

/* ---- boot ---- */
function start() {
  theme(); sel = null; $('#pname').value = P.name; so();
  $('#cats').innerHTML = ''; Object.entries(CATS).forEach(([k, v]) => { const b = h('button', 'btn', v); b.dataset.c = k; b.onclick = () => { cat = k; renderPal(); }; $('#cats').append(b); });
  renderAll();
}
$('#logo').setAttribute('d', bloom(8, .07));
$('#pname').oninput = e => { P.name = e.target.value; persist(); };
$('#addObj').onclick = () => { const o = mkObj(); P.objects.push(o); persist(); sel = o.id; renderAll(); };
$('#addAsset').onclick = () => $('#afile').click();
$('#afile').onchange = e => { [...e.target.files].forEach(addFile); e.target.value = ''; };
$('#draw').onclick = () => Paint.open(null, (u, w, hh) => addAsset({ name: 'Drawing', type: 'image', url: u }));
const left = $('#left'); left.ondragover = e => e.preventDefault(); left.ondrop = e => { e.preventDefault(); [...e.dataTransfer.files].forEach(addFile); };
$('#play').onclick = () => { cur && cur.stop(); playing = !playing; $('#play').textContent = playing ? '■ Stop' : '▶ Play'; $('#play').classList.toggle('p', playing); cur = Z.run(P, $('#stage'), { edit: !playing }); hl(); };
$('#export').onclick = () => dl((P.name || 'game') + '.html', Z.exportHTML(P), 'text/html');
$('#savef').onclick = () => dl((P.name || 'game') + '.zscript.json', JSON.stringify(P), 'application/json');
$('#openf').onclick = () => $('#pfile').click();
$('#pfile').onchange = async e => { try { const d = JSON.parse(await e.target.files[0].text()); if (!d.objects || !d.objects.length) throw 0; P = d; P.assets = P.assets || {}; persist(); start(); } catch (x) { toast('That is not a ScriptZ project file'); } e.target.value = ''; };
$('#setup').onclick = () => { if (playing) $('#play').click(); oobe(start); };
$('#stage').addEventListener('pointerdown', e => {
  if (playing || !cur) return; const st = $('#stage'), r = st.getBoundingClientRect(), k = P.w / r.width, px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
  const o = [...cur.objs].reverse().find(o => Math.abs(px - o.x) <= o.w / 2 && Math.abs(py - o.y) <= o.h / 2); if (!o) return;
  select(o.id); const d = P.objects.find(x => x.id === o.id), ox = px - o.x, oy = py - o.y;
  const mv = ev => { d.x = o.x = Math.round((ev.clientX - r.left) * k - ox); d.y = o.y = Math.round((ev.clientY - r.top) * k - oy); cur.draw(o); };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); renderProps(); persist(); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
});
theme();
if (!prefs.done || !P || !P.objects || !P.objects.length) { P = P && P.objects && P.objects.length ? P : null; oobe(start); } else start();
})();
