/* ScriptZ-Engine editor: My games, scenes, objects, assets, image editor, events (conditions + actions), play, zip export. */
(() => {
const $ = s => document.querySelector(s), h = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const R = ZRuntime, C = R.C, A = R.A, uid = () => Math.random().toString(36).slice(2, 9), NS = 'http://www.w3.org/2000/svg';
const LS = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const prefs = Object.assign({ hue: 265, theme: 'dark', done: false }, LS('zs2:prefs') || {});
let G = null, scn = null, tab = 'scene', rtab = 'object', selDef = null, selInst = null, playing = false, cur = null, tmr;
const hex = (H, S, L) => { S /= 100; L /= 100; const a = S * Math.min(L, 1 - L), f = n => { const k = (n + H / 30) % 12; return Math.round(255 * (L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return '#' + [f(0), f(8), f(4)].map(x => x.toString(16).padStart(2, '0')).join(''); };
const toast = m => { const t = h('div', 'toast', m); document.body.append(t); setTimeout(() => t.remove(), 2600); };
const theme = () => { document.documentElement.style.setProperty('--h', prefs.hue); document.documentElement.dataset.theme = prefs.theme; };
const savePrefs = () => { try { localStorage.setItem('zs2:prefs', JSON.stringify(prefs)); } catch (e) {} };
const dl = (name, data, type) => { const a = h('a'); a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); };
const bloom = (n, a) => { let d = ''; for (let i = 0; i <= 120; i++) { const t = i / 120 * Math.PI * 2, r = 90 * (1 + a * Math.cos(n * t)); d += (i ? 'L' : 'M') + (110 + r * Math.cos(t)).toFixed(1) + ' ' + (110 + r * Math.sin(t)).toFixed(1); } return d + 'Z'; };
const svgShape = (n, a, fill) => { const s = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path'); s.setAttribute('viewBox', '0 0 220 220'); p.setAttribute('d', bloom(n, a)); if (fill) p.style.fill = fill; s.append(p); return s; };
const SHP = [[8, .07], [5, .16], [4, .2], [12, .05], [6, .1], [3, .12]];

/* ---- storage: IndexedDB (big assets), localStorage fallback ---- */
const Store = (() => {
  const has = typeof indexedDB !== 'undefined' && indexedDB; let db;
  const open = () => db || (db = new Promise((ok, no) => { const r = indexedDB.open('scriptz', 1); r.onupgradeneeded = () => r.result.createObjectStore('games', { keyPath: 'id' }); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }));
  const tx = (m, f) => open().then(d => new Promise((ok, no) => { const t = d.transaction('games', m), q = f(t.objectStore('games')); t.oncomplete = () => ok(q && q.result); t.onerror = () => no(t.error); }));
  const keys = () => Object.keys(localStorage).filter(k => k.startsWith('zs2:game:'));
  return has ? { all: () => tx('readonly', s => s.getAll()), put: g => tx('readwrite', s => s.put(g)), del: id => tx('readwrite', s => s.delete(id)) }
    : { all: () => Promise.resolve(keys().map(k => LS(k))), put: g => { try { localStorage.setItem('zs2:game:' + g.id, JSON.stringify(g)); return Promise.resolve(); } catch (e) { return Promise.reject(e); } }, del: id => Promise.resolve(localStorage.removeItem('zs2:game:' + id)) };
})();
const persist = () => { clearTimeout(tmr); tmr = setTimeout(save, 500); };
const save = () => { clearTimeout(tmr); if (!G) return Promise.resolve(); G.updated = Date.now(); return Store.put(G).catch(() => toast('Could not save — storage may be full')); };

/* ---- popup menu with search ---- */
function popup(anchor, groups, pick) {
  const m = $('#menu'); m.innerHTML = ''; m.hidden = false; const q = h('input'), body = h('div'); q.placeholder = 'Search…'; m.append(q, body);
  const close = () => { m.hidden = true; removeEventListener('pointerdown', away, true); }, away = e => { if (!m.contains(e.target)) close(); };
  const draw = () => { body.innerHTML = ''; const t = q.value.toLowerCase(); groups.forEach(([cat, items]) => { const f = items.filter(([l]) => l.toLowerCase().includes(t)); if (!f.length) return; body.append(h('h5', '', cat));
    f.forEach(([l, v]) => { const b = h('button', '', l); b.onclick = () => { close(); pick(v); }; body.append(b); }); }); };
  q.oninput = draw; draw(); const r = anchor.getBoundingClientRect(); m.style.left = Math.max(8, Math.min(r.left, innerWidth - 320)) + 'px'; m.style.top = Math.max(8, Math.min(r.bottom + 4, innerHeight - 330)) + 'px';
  setTimeout(() => addEventListener('pointerdown', away, true)); q.focus();
}

/* ---- home: My games ---- */
async function showHome() {
  if (cur) { cur.stop(); cur = null; } playing = false; if (G) await save(); G = null; $('#editor').hidden = true; $('#home').hidden = false;
  const list = (await Store.all()) || []; list.sort((a, b) => (b.updated || 0) - (a.updated || 0)); const box = $('#games'); box.innerHTML = '';
  const nw = h('div', 'gcard new'); nw.append(svgShape(8, .07), h('b', '', 'New game')); nw.onclick = newDialog; box.append(nw);
  list.forEach(g => {
    const hs = [...g.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7), sh = SHP[hs % 6], card = h('div', 'gcard'), cover = h('div', 'gcover');
    cover.append(svgShape(sh[0], sh[1], 'hsl(' + (hs * 47 % 360) + ' 65% 72%)')); cover.onclick = () => openGame(g); const body = h('div', 'gbody');
    body.append(h('b', '', g.name), h('small', '', g.scenes.length + ' scene' + (g.scenes.length > 1 ? 's' : '') + ' · ' + g.objects.length + ' objects · ' + new Date(g.updated || Date.now()).toLocaleDateString()));
    const row = h('div', 'grow'), b = (l, f) => { const x = h('button', 'btn', l); x.onclick = f; row.append(x); };
    b('Open', () => openGame(g)); b('Duplicate', async () => { const c = JSON.parse(JSON.stringify(g)); c.id = uid(); c.name += ' copy'; await Store.put(c); showHome(); });
    b('Rename', async () => { const n = prompt('Game name', g.name); if (n) { g.name = n; await Store.put(g); showHome(); } }); b('Export .zip', () => dl(g.name + '.zip', Zip.build(g)));
    b('Backup', () => dl(g.name + '.scriptz.json', JSON.stringify(g), 'application/json')); b('Delete', async () => { if (confirm('Delete “' + g.name + '”?')) { await Store.del(g.id); showHome(); } });
    body.append(row); card.append(cover, body); box.append(card);
  });
}
function newDialog() {
  const d = $('#dlg'); d.hidden = false; let tpl = 'platformer', name = 'My Game', size = [960, 540];
  const draw = () => { d.innerHTML = ''; const box = h('div', 'dlgbox'); d.append(box); box.append(h('h2', '', 'New game'));
    const i = h('input', 'in2'); i.value = name; i.oninput = () => name = i.value; box.append(i);
    const cs = h('div', 'cards'); Templates.forEach(t => { const c = h('button', 'card' + (t.id === tpl ? ' on' : '')); c.append(h('b', '', t.name), h('span', '', t.desc)); c.onclick = () => { tpl = t.id; draw(); }; cs.append(c); }); box.append(cs);
    if (tpl === 'blank') { box.append(h('p', 'hint', 'Canvas size')); const sz = h('div', 'cards'); [['Wide', 960, 540], ['Classic', 800, 600], ['Square', 640, 640], ['Portrait', 405, 720]].forEach(([n, w, hh]) => { const c = h('button', 'card' + (size[0] === w ? ' on' : '')); c.append(h('b', '', n), h('span', '', w + ' × ' + hh)); c.onclick = () => { size = [w, hh]; draw(); }; sz.append(c); }); box.append(sz); }
    const nav = h('div', 'onav'), cn = h('button', 'btn', 'Cancel'), ok = h('button', 'btn p big', 'Create'); cn.onclick = () => { d.hidden = true; };
    ok.onclick = async () => { const P = Templates.find(t => t.id === tpl).build(name.trim() || 'My Game', size[0], size[1]); P.updated = Date.now(); await Store.put(P); d.hidden = true; openGame(P); }; nav.append(cn, ok); box.append(nav); };
  draw();
}
function openGame(P) {
  G = P; G.vars = G.vars || {}; G.assets = G.assets || {}; scn = G.scenes[0].id; selDef = G.objects[0] ? G.objects[0].id : null; selInst = null; tab = 'scene'; rtab = 'object'; playing = false; $('#play').textContent = '▶ Play';
  $('#home').hidden = true; $('#editor').hidden = false; $('#gname').value = G.name; renderEditor();
}
const curScene = () => G.scenes.find(s => s.id === scn) || G.scenes[0], selDefObj = () => G.objects.find(o => o.id === selDef) || null;
function renderEditor() { renderScenes(); renderObjs(); renderAssets(); renderTabs(); renderRight(); refreshStage(); }

/* ---- left panel ---- */
function renderScenes() {
  const l = $('#scenes'); l.innerHTML = '';
  G.scenes.forEach(s => { const c = h('button', 'chip' + (s.id === scn ? ' on' : ''), s.name); c.onclick = () => { scn = s.id; selInst = null; renderScenes(); renderTabs(); renderRight(); refreshStage(); }; l.append(c); });
}
function thumb(d) {
  const t = h('i', 'th'), a = G.assets[d.asset];
  if (d.type === 'text') { t.textContent = 'T'; t.style.background = d.color; t.style.color = '#1d1b20'; t.style.borderRadius = '30%'; return t; }
  if (a && a.type !== 'video' && a.type !== 'audio') { t.style.backgroundImage = 'url("' + a.url + '")'; t.style.borderRadius = '30%'; return t; }
  t.style.background = d.color; const s = d.shape; t.style.borderRadius = s === 'circle' ? '50%' : s === 'squircle' ? '30%' : s === 'rect' ? '3px' : ''; if (R.SHAPES[s]) t.style.clipPath = 'polygon(' + R.poly(s) + ')'; return t;
}
function renderObjs() {
  const l = $('#objs'); l.innerHTML = '';
  G.objects.forEach(o => { const c = h('button', 'chip' + (o.id === selDef ? ' on' : '')); c.append(thumb(o), h('span', '', o.name)); c.title = 'Double-click to add to the scene';
    c.onclick = () => { selDef = o.id; selInst = null; rtab = 'object'; renderObjs(); renderTabs(); renderRight(); hl(); }; c.ondblclick = () => addInst(o); l.append(c); });
}
const uniq = b => { let n = 1; while (G.objects.some(o => o.name === b + n)) n++; return b + n; };
function newDef(type) {
  const d = { id: uid(), name: uniq(type === 'text' ? 'Text' : 'Object'), type, shape: 'squircle', color: type === 'text' ? '#1d1b20' : hex(prefs.hue + G.objects.length * 45, 70, 70), w: type === 'text' ? 260 : 64, h: type === 'text' ? 50 : 64, asset: '', text: type === 'text' ? 'Hello!' : '', fontSize: 32, visible: true, hud: false, vars: {},
    phys: { t: 'none', bounce: .5, fric: .2, grav: 1 }, plat: { on: false, speed: 260, jump: 560 }, top: { on: false, speed: 240 }, drag: false, edge: '' };
  G.objects.push(d); selDef = d.id; selInst = null; rtab = 'object'; persist(); renderObjs(); renderRight(); addInst(d);
}
function addInst(d) { const n = { id: uid(), obj: d.id, x: G.w / 2, y: G.h / 2 }; curScene().instances.push(n); selDef = d.id; selInst = n.id; persist(); renderObjs(); renderRight(); refreshStage(); }
function removeInst() { const s = curScene(); s.instances = s.instances.filter(x => x.id !== selInst); selInst = null; persist(); renderRight(); refreshStage(); }
function renderAssets() {
  const g = $('#assets'); g.innerHTML = '';
  Object.entries(G.assets).forEach(([id, a]) => {
    const d = selDefObj(), c = h('div', 'asset'); let t;
    if (a.type === 'audio') { t = h('div', 'snd', '♪'); t.title = 'Preview sound'; t.onclick = () => { const s = new Audio(a.url); s.play().catch(() => {}); }; }
    else { t = a.type === 'video' ? h('video') : h('img'); t.src = a.url; if (a.type === 'video') t.muted = true; t.draggable = false; t.title = 'Use on selected object';
      t.onclick = () => { if (!d || d.type !== 'sprite') return toast('Select a sprite object first'); d.asset = id; if (a.nw) d.h = Math.round(d.w * a.nh / a.nw); persist(); renderEditor(); }; }
    const r = h('div', 'ar'); r.append(h('span', '', ''));
    if (a.type === 'image' || a.type === 'gif') { const e = h('button', '', '✎'); e.title = 'Edit in image editor'; e.onclick = () => Paint.open(a.url, (u, w, hh) => { a.url = u; a.type = 'image'; a.nw = w; a.nh = hh; persist(); renderEditor(); }); r.append(e); }
    const x = h('button', '', '✕'); x.title = 'Delete'; x.onclick = () => { delete G.assets[id]; G.objects.forEach(o => { if (o.asset === id) o.asset = ''; }); persist(); renderEditor(); }; r.append(x); c.append(t, r); g.append(c);
  });
}
function addAsset(a) {
  const id = uid(); G.assets[id] = a; const fin = (w, hh) => { a.nw = w; a.nh = hh; persist(); renderEditor(); };
  if (a.type === 'video') { const v = document.createElement('video'); v.onloadedmetadata = () => fin(v.videoWidth, v.videoHeight); v.src = a.url; } else if (a.type === 'audio') fin(0, 0); else { const i = new Image(); i.onload = () => fin(i.naturalWidth, i.naturalHeight); i.src = a.url; }
  persist(); renderAssets();
}
function addFile(f) {
  const type = f.type.startsWith('video') ? 'video' : f.type.startsWith('audio') ? 'audio' : f.type === 'image/gif' ? 'gif' : f.type.startsWith('image') ? 'image' : null; if (!type) return toast('Unsupported file: ' + f.name);
  const r = new FileReader(); r.onload = () => addAsset({ name: f.name.replace(/\.\w+$/, ''), type, url: r.result }); r.readAsDataURL(f);
}

/* ---- center: tabs, stage ---- */
function renderTabs() {
  document.querySelectorAll('#ctabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab)); document.querySelectorAll('#rtabs button').forEach(b => b.classList.toggle('on', b.dataset.t === rtab));
  $('#sceneView').hidden = tab !== 'scene'; $('#eventsView').hidden = tab !== 'events'; if (tab === 'events') renderEvents(); else cur && cur.fit();
}
const hl = () => cur && cur.list && !playing && cur.list.forEach(i => i.el.classList.toggle('sel', i.sid === selInst));
function refreshStage() { if (playing) return; cur && cur.stop(); cur = R.run(G, $('#stage'), { edit: true, scene: scn }); hl(); }
$('#stage').addEventListener('pointerdown', e => {
  if (playing || !cur) return; const st = $('#stage'), r = st.getBoundingClientRect(), k = G.w / r.width, px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
  const o = [...cur.list].reverse().find(o => Math.abs(px - o.x) <= o.w / 2 && Math.abs(py - o.y) <= o.h / 2); if (!o) { selInst = null; hl(); renderRight(); return; }
  selInst = o.sid; selDef = o.def.id; rtab = 'object'; renderObjs(); renderTabs(); renderRight(); hl();
  const n = curScene().instances.find(x => x.id === o.sid), ox = px - o.x, oy = py - o.y;
  const mv = ev => { n.x = o.x = Math.round((ev.clientX - r.left) * k - ox); n.y = o.y = Math.round((ev.clientY - r.top) * k - oy); cur.draw(o); };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); renderRight(); persist(); }; addEventListener('pointermove', mv); addEventListener('pointerup', up);
});
addEventListener('keydown', e => { if (!G || $('#editor').hidden || playing || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; if ((e.key === 'Delete' || e.key === 'Backspace') && selInst && tab === 'scene') removeInst(); });

/* ---- right panel ---- */
function F(p, label, o, key, type, opt, after) {
  const l = h('label', type === 'checkbox' ? 'chk' : ''); let i;
  if (type === 'select') { i = h('select'); opt.forEach(v => { const [val, lab] = Array.isArray(v) ? v : [v, v]; i.append(new Option(lab, val)); }); i.value = o[key]; }
  else { i = h('input'); i.type = type; if (type === 'checkbox') i.checked = !!o[key]; else i.value = o[key]; }
  const set = () => { o[key] = type === 'number' ? (+i.value || 0) : type === 'checkbox' ? i.checked : i.value; persist(); (after || refreshStage)(); };
  i[type === 'select' || type === 'checkbox' ? 'onchange' : 'oninput'] = set; if (type === 'checkbox') l.append(i, label); else l.append(label, i); p.append(l); return i;
}
function varsEditor(b, obj) {
  const box = h('div'), draw = () => { box.innerHTML = '';
    Object.entries(obj).forEach(([k, v]) => { const r = h('div', 'vrow'), ki = h('input'), vi = h('input'), x = h('button', 'btn sm', '✕'); ki.value = k; vi.value = v;
      ki.onchange = () => { const nk = ki.value.trim().replace(/\W/g, '_'); if (nk && nk !== k && !(nk in obj)) { const es = Object.entries(obj); for (const kk in obj) delete obj[kk]; es.forEach(([a, c]) => { obj[a === k ? nk : a] = c; }); } persist(); draw(); };
      vi.oninput = () => { obj[k] = vi.value === '' || isNaN(+vi.value) ? vi.value : +vi.value; persist(); }; x.onclick = () => { delete obj[k]; persist(); draw(); }; r.append(ki, vi, x); box.append(r); });
    const add = h('button', 'btn sm', '+ Variable'); add.onclick = () => { let n = 1; while ('var' + n in obj) n++; obj['var' + n] = 0; persist(); draw(); }; box.append(add); }; draw(); b.append(box);
}
function eachItem(fn) { const walk = l => (l || []).forEach(e => { (e.conds || []).forEach(c => fn(c, C[c.t])); (e.acts || []).forEach(a => fn(a, A[a.t])); walk(e.sub); }); G.scenes.forEach(s => walk(s.events)); }
function rename(d, v) {
  const nw = v.trim().replace(/\W/g, '_'); if (!nw || /^\d/.test(nw) || G.objects.some(o => o !== d && o.name === nw)) return toast('Names must be unique and start with a letter'); const old = d.name; if (nw === old) return;
  eachItem((it, def) => { if (!def) return; (def.p || []).forEach((sp, i) => { if (sp.startsWith('obj')) { if (it.a[i] === old) it.a[i] = nw; } else if (typeof it.a[i] === 'string') it.a[i] = it.a[i].replace(new RegExp('\\b' + old + '\\.', 'g'), nw + '.').split('"' + old + '"').join('"' + nw + '"'); }); });
  d.name = nw; persist(); renderObjs(); if (tab === 'events') renderEvents();
}
function renderRight() {
  const b = $('#rbody'); b.innerHTML = ''; document.querySelectorAll('#rtabs button').forEach(x => x.classList.toggle('on', x.dataset.t === rtab));
  if (rtab === 'object') objPanel(b); else if (rtab === 'scene') scenePanel(b); else gamePanel(b);
}
function objPanel(b) {
  const d = selDefObj(); if (!d) { b.append(h('p', 'hint', 'Add an object to begin.')); return; }
  const n = selInst && curScene().instances.find(x => x.id === selInst);
  if (n) { b.append(h('h3', '', 'Placed in this scene')); const r = h('div', 'row'); F(r, 'X', n, 'x', 'number'); F(r, 'Y', n, 'y', 'number'); b.append(r); const rm = h('button', 'btn sm', 'Remove from scene'); rm.onclick = removeInst; b.append(rm); }
  else { const add = h('button', 'btn sm p', 'Add to scene'); add.onclick = () => addInst(d); b.append(add); }
  b.append(h('h3', '', 'Object (' + d.type + ')'));
  const l = h('label', '', 'Name'), ni = h('input'); ni.value = d.name; ni.onchange = () => { rename(d, ni.value); ni.value = d.name; }; l.append(ni); b.append(l);
  if (d.type === 'sprite') F(b, 'Shape', d, 'shape', 'select', ['squircle', 'circle', 'rect', 'cookie', 'flower', 'clover', 'sunny'], () => { renderObjs(); refreshStage(); });
  F(b, d.type === 'text' ? 'Text color' : 'Color', d, 'color', 'color', null, () => { renderObjs(); refreshStage(); });
  const r = h('div', 'row'); F(r, 'Width', d, 'w', 'number'); F(r, 'Height', d, 'h', 'number'); b.append(r);
  if (d.type === 'sprite') { const al = h('label', '', 'Image / video'), as = h('select'); as.append(new Option('(none — use color)', '')); Object.entries(G.assets).filter(([, a]) => a.type !== 'audio').forEach(([id, a]) => as.append(new Option(a.name, id))); as.value = d.asset;
    as.onchange = () => { d.asset = as.value; const a = G.assets[d.asset]; if (a && a.nw) d.h = Math.round(d.w * a.nh / a.nw); persist(); renderEditor(); }; al.append(as); b.append(al); }
  else { F(b, 'Text', d, 'text', 'text'); F(b, 'Font size', d, 'fontSize', 'number'); }
  F(b, 'Stay on screen (HUD)', d, 'hud', 'checkbox'); F(b, 'Visible at start', d, 'visible', 'checkbox');
  b.append(h('h3', '', 'Behaviors'));
  F(b, 'Physics', d.phys, 't', 'select', ['none', 'dynamic', 'static']); const pr = h('div', 'row'); F(pr, 'Bounce', d.phys, 'bounce', 'number'); F(pr, 'Friction', d.phys, 'fric', 'number'); F(pr, 'Gravity ×', d.phys, 'grav', 'number'); b.append(pr);
  F(b, 'Platformer character (arrows + space)', d.plat, 'on', 'checkbox'); const pl = h('div', 'row'); F(pl, 'Speed', d.plat, 'speed', 'number'); F(pl, 'Jump', d.plat, 'jump', 'number'); b.append(pl);
  F(b, 'Top-down movement (arrows / WASD)', d.top, 'on', 'checkbox'); F(b, 'Top-down speed', d.top, 'speed', 'number'); F(b, 'Draggable with mouse', d, 'drag', 'checkbox');
  F(b, 'At screen edge', d, 'edge', 'select', [['', 'default'], ['none', 'nothing'], ['bound', 'stop / bounce'], ['wrap', 'wrap around'], ['destroy', 'delete when outside']]);
  b.append(h('h3', '', 'Object variables')); varsEditor(b, d.vars);
  const del = h('button', 'btn danger', 'Delete object'); del.onclick = () => { if (!confirm('Delete “' + d.name + '” and all its instances?')) return; G.scenes.forEach(s => { s.instances = s.instances.filter(x => x.obj !== d.id); }); G.objects = G.objects.filter(o => o !== d); selDef = G.objects[0] ? G.objects[0].id : null; selInst = null; persist(); renderEditor(); }; b.append(del);
}
function scenePanel(b) {
  const s = curScene(); s.bg = s.bg || G.bg; b.append(h('h3', '', 'Scene')); F(b, 'Name', s, 'name', 'text', null, renderScenes); F(b, 'Background', s, 'bg', 'color');
  const dup = h('button', 'btn sm', 'Duplicate scene'); dup.onclick = () => { const c = JSON.parse(JSON.stringify(s)); c.id = uid(); c.name += ' copy'; c.instances.forEach(i => { i.id = uid(); }); G.scenes.push(c); scn = c.id; persist(); renderEditor(); }; b.append(dup);
  if (G.scenes.length > 1) { const del = h('button', 'btn danger', 'Delete scene'); del.onclick = () => { G.scenes = G.scenes.filter(x => x !== s); scn = G.scenes[0].id; selInst = null; persist(); renderEditor(); }; b.append(del); }
}
function gamePanel(b) {
  b.append(h('h3', '', 'Game')); F(b, 'Name', G, 'name', 'text', null, () => { $('#gname').value = G.name; }); const r = h('div', 'row'); F(r, 'Width', G, 'w', 'number'); F(r, 'Height', G, 'h', 'number'); b.append(r);
  F(b, 'Gravity', G, 'gravity', 'number', null, () => {}); F(b, 'Default background', G, 'bg', 'color'); b.append(h('h3', '', 'Global variables (start values)')); varsEditor(b, G.vars);
  b.append(h('p', 'hint', 'Use variables in expressions (score + 1) or in text as {score}.'));
}

/* ---- events: conditions + actions ---- */
const catGroups = defs => { const m = {}; for (const [k, d] of Object.entries(defs)) (m[d.c] = m[d.c] || []).push([d.l.replace(/%\d/g, '…'), k]); return Object.entries(m); };
function defaults(d) {
  return (d.p || []).map(sp => { const k = sp.indexOf(':'), ty = k < 0 ? sp : sp.slice(0, k), v = k < 0 ? '' : sp.slice(k + 1);
    if (ty === 'obj') return (selDefObj() || G.objects[0] || {}).name || ''; if (ty === 'scene') return curScene().id; if (ty === 'snd') return Object.keys(G.assets).find(i => G.assets[i].type === 'audio') || '';
    if (ty === 'img') return ''; if (ty === 'key') return v || 'space'; if (ty === 'sel') return v.split('|')[0]; return v; });
}
function par(sp, it, i) {
  const k = sp.indexOf(':'), ty = k < 0 ? sp : sp.slice(0, k), v = k < 0 ? '' : sp.slice(k + 1);
  if (ty === 'num' || ty === 'text' || ty === 'var') { const e = h('input', 'in'); e.value = it.a[i]; const fit = () => { e.style.width = Math.max(3, Math.min(34, e.value.length + 1)) + 'ch'; }; fit(); e.oninput = () => { it.a[i] = e.value; fit(); persist(); }; return e; }
  if (ty === 'col') { const e = h('input', 'in'); e.type = 'color'; e.value = it.a[i] || '#ff0000'; e.oninput = () => { it.a[i] = e.value; persist(); }; return e; }
  const e = h('select', 'in'); let o;
  if (ty === 'obj') o = G.objects.map(x => [x.name, x.name]); else if (ty === 'key') o = R.KEYS.map(x => [x, x]); else if (ty === 'scene') o = G.scenes.map(x => [x.id, x.name]);
  else if (ty === 'snd') o = Object.entries(G.assets).filter(([, a]) => a.type === 'audio').map(([id, a]) => [id, a.name]);
  else if (ty === 'img') o = [['', '(none)'], ...Object.entries(G.assets).filter(([, a]) => a.type === 'image' || a.type === 'gif').map(([id, a]) => [id, a.name])]; else o = v.split('|').map(x => [x, x]);
  if (!o.some(([val]) => val === it.a[i])) o.unshift([it.a[i], it.a[i] || '(choose)']); o.forEach(([val, l]) => e.append(new Option(l, val))); e.value = it.a[i]; e.onchange = () => { it.a[i] = e.value; persist(); }; return e;
}
function itemRow(list, idx, it, defs, isC) {
  const d = defs[it.t], row = h('div', 'it');
  if (!d) row.textContent = 'Unknown: ' + it.t;
  else { if (isC) { const nb = h('button', 'not' + (it.n ? ' on' : ''), 'not'); nb.title = 'Invert this condition'; nb.onclick = () => { it.n = !it.n; persist(); renderEvents(); }; row.append(nb); }
    d.l.split(/(%\d)/).forEach(p => { const m = p.match(/^%(\d)$/); if (m) row.append(par(d.p[+m[1]], it, +m[1])); else if (p.trim()) row.append(h('span', '', p.trim())); }); }
  const x = h('button', 'x', '✕'); x.onclick = () => { list.splice(idx, 1); persist(); renderEvents(); }; row.append(x); return row;
}
function evRow(arr, idx, e) {
  const wrap = h('div'), tools = () => { const t = h('div', 'etools'), b = (l, f, tt) => { const x = h('button', '', l); x.title = tt || ''; x.onclick = () => { f(); persist(); renderEvents(); }; t.append(x); };
    if (e.comment == null) b('+ Sub', () => { (e.sub = e.sub || []).push({ conds: [], acts: [] }); }, 'Add a sub-event that runs when this event’s conditions are true');
    b('↑', () => { if (idx > 0) { arr.splice(idx - 1, 0, arr.splice(idx, 1)[0]); } }); b('↓', () => { if (idx < arr.length - 1) { arr.splice(idx + 1, 0, arr.splice(idx, 1)[0]); } });
    if (e.comment == null) b(e.off ? 'Enable' : 'Disable', () => { e.off = !e.off; }); b('✕', () => { arr.splice(idx, 1); }); return t; };
  if (e.comment != null) { const r = h('div', 'ev cm'), t = h('textarea'); t.value = e.comment; t.oninput = () => { e.comment = t.value; persist(); }; r.append(h('div', 'no', '#'), t, tools()); wrap.append(r); return wrap; }
  const r = h('div', 'ev' + (e.off ? ' off' : '')), cc = h('div', 'col conds'), aa = h('div', 'col acts'); e.conds = e.conds || []; e.acts = e.acts || [];
  cc.append(h('h4', '', 'Conditions')); e.conds.forEach((c, i) => cc.append(itemRow(e.conds, i, c, C, true))); const ac = h('button', 'addb', '+ Condition');
  ac.onclick = () => popup(ac, catGroups(C), t => { e.conds.push({ t, a: defaults(C[t]) }); persist(); renderEvents(); }); cc.append(ac);
  aa.append(h('h4', '', 'Actions')); e.acts.forEach((c, i) => aa.append(itemRow(e.acts, i, c, A, false))); const ab = h('button', 'addb', '+ Action');
  ab.onclick = () => popup(ab, catGroups(A), t => { e.acts.push({ t, a: defaults(A[t]) }); persist(); renderEvents(); }); aa.append(ab);
  r.append(h('div', 'no', String(idx + 1)), cc, aa, tools()); wrap.append(r);
  if (e.sub && e.sub.length) { const s = h('div', 'subs'); e.sub.forEach((x, i) => s.append(evRow(e.sub, i, x))); wrap.append(s); } return wrap;
}
function renderEvents() {
  const box = $('#eventsView'); box.innerHTML = ''; const sc = curScene(); sc.events = sc.events || [];
  if (!sc.events.length) box.append(h('p', 'hint', 'Events decide what happens. When all the conditions of an event are true, its actions run — every frame. Add your first event below.'));
  sc.events.forEach((e, i) => box.append(evRow(sc.events, i, e)));
  const row = h('div', 'grow'), a = h('button', 'btn p', '+ Event'), c = h('button', 'btn', '+ Comment'); a.onclick = () => { sc.events.push({ conds: [], acts: [] }); persist(); renderEvents(); }; c.onclick = () => { sc.events.push({ comment: 'Note…' }); persist(); renderEvents(); }; row.append(a, c); box.append(row);
}

/* ---- OOBE: shapes spin and resize ---- */
function oobe(done) {
  const root = $('#oobe'); root.hidden = false; root.innerHTML = ''; let step = 0;
  [[8, .07, 's1', 70, 11, ''], [5, .16, 's2', 55, 9, 'reverse'], [4, .2, 's3', 26, 6, ''], [12, .05, 's4', 90, 13, 'reverse'], [6, .1, 's5', 34, 7, ''], [3, .12, 's6', 48, 8, 'reverse']].forEach(([n, a, c, d, e, dir]) => {
    const s = svgShape(n, a); s.setAttribute('class', 'os ' + c); s.style.cssText = '--d:' + d + 's;--e:' + e + 's;--dir:' + (dir || 'normal'); root.append(s); });
  const card = h('div', 'ocard'), dots = h('div', 'dots'), body = h('div'), nav = h('div', 'onav'), back = h('button', 'btn', 'Back'), next = h('button', 'btn p', 'Next'), STEPS = 4;
  for (let i = 0; i < STEPS; i++) dots.append(h('i')); nav.append(back, next); card.append(dots, body, nav); root.append(card);
  const views = [
    () => { const hero = h('div', 'hero2'); [[8, .07, 9, 5], [5, .16, 14, 7], [4, .2, 11, 6]].forEach(([n, a, d, e]) => { const s = svgShape(n, a); s.style.cssText = '--d:' + d + 's;--e:' + e + 's'; hero.append(s); });
      return [hero, h('h1', '', 'Hello'), h('p', '', 'Welcome to ScriptZ-Engine. Build games with objects, conditions and actions — with physics, sound, images, GIFs and video — then export them as a ready-to-publish zip.')]; },
    () => { const row = h('div', 'swatches'); [265, 340, 20, 150, 195, 50].forEach(hu => { const b = h('button', 'sw' + (hu === prefs.hue ? ' on' : '')); b.style.background = 'hsl(' + hu + ' 80% 72%)'; b.onclick = () => { prefs.hue = hu; theme(); row.querySelectorAll('.sw').forEach(x => x.classList.remove('on')); b.classList.add('on'); }; row.append(b); });
      const cs = h('div', 'cards'); ['Dark', 'Light'].forEach(t => { const c = h('button', 'card' + (prefs.theme === t.toLowerCase() ? ' on' : '')); c.append(h('b', '', t)); c.onclick = () => { prefs.theme = t.toLowerCase(); theme(); cs.querySelectorAll('.card').forEach(x => x.classList.remove('on')); c.classList.add('on'); }; cs.append(c); });
      return [h('h2', '', 'Pick your style'), h('p', '', 'Choose a colour and light or dark.'), row, h('p', ''), cs]; },
    () => { const cs = h('div', 'cards'); [['Objects', 'Shapes, text, images, GIFs and videos.'], ['Events', 'Conditions decide when, actions decide what.'], ['Export', 'One zip with HTML, CSS and JS.']].forEach(([t, s]) => { const c = h('div', 'card'); c.append(h('b', '', t), h('span', '', s)); cs.append(c); });
      return [h('h2', '', 'How it works'), h('p', '', 'Make objects, drop them in a scene, then write events like “when Player touches Coin → add 1 to score and play a sound”.'), cs]; },
    () => [h('h2', '', 'All set!'), h('p', '', 'Start from a template — Platformer or Clicker — or a blank game. Everything saves automatically in your browser.')]
  ];
  const go = n => { step = n; body.innerHTML = ''; body.append(...views[n]()); dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i === n)); back.style.visibility = n ? 'visible' : 'hidden'; next.textContent = n === 0 ? 'Get started' : n === STEPS - 1 ? 'Open My games' : 'Next'; };
  back.onclick = () => go(step - 1); next.onclick = () => { if (step < STEPS - 1) return go(step + 1); prefs.done = true; savePrefs(); root.hidden = true; root.innerHTML = ''; done(); }; go(0);
}

/* ---- wiring ---- */
document.querySelectorAll('.lg').forEach(p => p.setAttribute('d', bloom(8, .07)));
$('#hnew').onclick = newDialog; $('#hsetup').onclick = () => oobe(showHome); $('#himport').onclick = () => $('#ifile').click();
$('#ifile').onchange = async e => { try { const d = JSON.parse(await e.target.files[0].text()); if (!d.scenes || !d.objects) throw 0; d.id = uid(); d.updated = Date.now(); await Store.put(d); showHome(); } catch (x) { toast('That is not a ScriptZ game file'); } e.target.value = ''; };
$('#back').onclick = showHome; $('#gname').oninput = e => { G.name = e.target.value; persist(); };
$('#export').onclick = () => { try { dl(G.name + '.zip', Zip.build(G)); } catch (e) { toast('Export failed: ' + e.message); } }; $('#backup').onclick = () => dl(G.name + '.scriptz.json', JSON.stringify(G), 'application/json');
$('#addScene').onclick = () => { const s = { id: uid(), name: 'Scene ' + (G.scenes.length + 1), bg: '', instances: [], events: [] }; G.scenes.push(s); scn = s.id; selInst = null; rtab = 'scene'; persist(); renderEditor(); };
$('#addObj').onclick = () => popup($('#addObj'), [['New object', [['Sprite (shape / image / video)', 'sprite'], ['Text', 'text']]]], newDef);
$('#addAsset').onclick = () => $('#afile').click(); $('#afile').onchange = e => { [...e.target.files].forEach(addFile); e.target.value = ''; };
$('#draw').onclick = () => Paint.open(null, u => addAsset({ name: 'Drawing', type: 'image', url: u }));
$('#left').ondragover = e => e.preventDefault(); $('#left').ondrop = e => { e.preventDefault(); [...e.dataTransfer.files].forEach(addFile); };
document.querySelectorAll('#ctabs button').forEach(b => b.onclick = () => { if (playing) $('#play').click(); tab = b.dataset.t; renderTabs(); });
document.querySelectorAll('#rtabs button').forEach(b => b.onclick = () => { rtab = b.dataset.t; renderRight(); });
$('#play').onclick = () => { cur && cur.stop(); playing = !playing; if (playing && tab !== 'scene') { tab = 'scene'; renderTabs(); } $('#play').textContent = playing ? '■ Stop' : '▶ Play'; cur = R.run(G, $('#stage'), { edit: !playing, scene: scn }); hl(); };
theme(); if (!prefs.done) oobe(showHome); else showHome();
})();
