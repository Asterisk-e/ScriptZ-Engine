/* ScriptZ-Engine image editor — Paint.open(dataURL|null, (newDataURL,w,h)=>{}) */
const Paint = (() => {
  const h = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const FX = {
    Grayscale: (r, g, b) => { const v = .3 * r + .59 * g + .11 * b; return [v, v, v]; }, Invert: (r, g, b) => [255 - r, 255 - g, 255 - b],
    Sepia: (r, g, b) => [.393 * r + .769 * g + .189 * b, .349 * r + .686 * g + .168 * b, .272 * r + .534 * g + .131 * b],
    Brighten: (r, g, b) => [r * 1.2 + 10, g * 1.2 + 10, b * 1.2 + 10], Darken: (r, g, b) => [r * .8, g * .8, b * .8]
  };
  const hex2rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  function open(url, save) {
    const m = h('div', 'modal'), box = h('div', 'pbox'), bar = h('div', 'pbar'), bar2 = h('div', 'pbar'), cv = h('canvas', 'pcv'), cx = cv.getContext('2d', { willReadFrequently: true });
    let tool = 'pen', color = '#6750a4', size = 8, fill = false, hist = [], red = [], snap, start, drawing = false;
    const commit = () => { hist.push(cx.getImageData(0, 0, cv.width, cv.height)); if (hist.length > 40) hist.shift(); red = []; };
    const put = d => { cv.width = d.width; cv.height = d.height; cx.putImageData(d, 0, 0); };
    const undo = () => { if (hist.length > 1) { red.push(hist.pop()); put(hist[hist.length - 1]); } };
    const redo = () => { if (red.length) { const d = red.pop(); hist.push(d); put(d); } };
    const xf = (w, hh, fn) => { const t = document.createElement('canvas'); t.width = w; t.height = hh; fn(t.getContext('2d'), cv); cv.width = w; cv.height = hh; cx.drawImage(t, 0, 0); commit(); };
    const flood = (x0, y0) => {
      const w = cv.width, hh = cv.height, d = cx.getImageData(0, 0, w, hh), p = d.data, i0 = (y0 * w + x0) * 4, tc = [p[i0], p[i0 + 1], p[i0 + 2], p[i0 + 3]], fc = hex2rgb(color), seen = new Uint8Array(w * hh), st = [[x0, y0]];
      while (st.length) { const [x, y] = st.pop(); if (x < 0 || y < 0 || x >= w || y >= hh || seen[y * w + x]) continue; seen[y * w + x] = 1; const i = (y * w + x) * 4;
        if (Math.abs(p[i] - tc[0]) + Math.abs(p[i + 1] - tc[1]) + Math.abs(p[i + 2] - tc[2]) + Math.abs(p[i + 3] - tc[3]) > 60) continue;
        p[i] = fc[0]; p[i + 1] = fc[1]; p[i + 2] = fc[2]; p[i + 3] = 255; st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
      cx.putImageData(d, 0, 0);
    };
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
    cv.onpointerdown = e => {
      const [x, y] = pos(e);
      if (tool === 'pick') { const d = cx.getImageData(x | 0, y | 0, 1, 1).data; color = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join(''); ci.value = color; return; }
      if (tool === 'fill') { flood(x | 0, y | 0); commit(); return; }
      if (tool === 'text') { const t = prompt('Text'); if (t) { cx.fillStyle = color; cx.font = 'bold ' + size * 4 + 'px system-ui'; cx.textBaseline = 'top'; cx.fillText(t, x, y); commit(); } return; }
      drawing = true; start = [x, y]; snap = cx.getImageData(0, 0, cv.width, cv.height); cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
      cx.lineCap = cx.lineJoin = 'round'; cx.lineWidth = size; cx.strokeStyle = cx.fillStyle = color; cx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
      if (tool === 'pen' || tool === 'eraser') { cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + .01, y); cx.stroke(); }
    };
    cv.onpointermove = e => {
      if (!drawing) return; const [x, y] = pos(e);
      if (tool === 'pen' || tool === 'eraser') { cx.lineTo(x, y); cx.stroke(); return; }
      cx.putImageData(snap, 0, 0); cx.beginPath(); const [sx, sy] = start;
      if (tool === 'line') { cx.moveTo(sx, sy); cx.lineTo(x, y); } else if (tool === 'rect') cx.rect(sx, sy, x - sx, y - sy); else cx.ellipse((sx + x) / 2, (sy + y) / 2, Math.abs(x - sx) / 2, Math.abs(y - sy) / 2, 0, 0, 7);
      if (fill && tool !== 'line') cx.fill(); else cx.stroke();
    };
    cv.onpointerup = () => { if (!drawing) return; drawing = false; cx.globalCompositeOperation = 'source-over'; commit(); };
    const btn = (label, fn, p, cls) => { const b = h('button', 'btn sm ' + (cls || ''), label); b.onclick = fn; (p || bar).append(b); return b; };
    const tools = {}; ['pen', 'eraser', 'fill', 'line', 'rect', 'oval', 'text', 'pick'].forEach(t => { tools[t] = btn(t[0].toUpperCase() + t.slice(1), () => { tool = t; for (const k in tools) tools[k].classList.toggle('p', k === t); }, bar, t === 'pen' ? 'p' : ''); });
    const ci = h('input'); ci.type = 'color'; ci.value = color; ci.oninput = () => color = ci.value; bar.append(ci);
    const sz = h('input'); sz.type = 'range'; sz.min = 1; sz.max = 60; sz.value = size; sz.oninput = () => size = +sz.value; bar.append(sz);
    const fl = h('label', 'chk'); const fi = h('input'); fi.type = 'checkbox'; fi.onchange = () => fill = fi.checked; fl.append(fi, ' Fill shapes'); bar.append(fl);
    btn('Undo', undo, bar2); btn('Redo', redo, bar2);
    btn('Flip ↔', () => xf(cv.width, cv.height, (t, c) => { t.scale(-1, 1); t.drawImage(c, -c.width, 0); }), bar2);
    btn('Flip ↕', () => xf(cv.width, cv.height, (t, c) => { t.scale(1, -1); t.drawImage(c, 0, -c.height); }), bar2);
    btn('Rotate', () => xf(cv.height, cv.width, (t, c) => { t.translate(c.height, 0); t.rotate(Math.PI / 2); t.drawImage(c, 0, 0); }), bar2);
    const fx = h('select'); fx.append(new Option('Filter…', '')); Object.keys(FX).forEach(k => fx.append(new Option(k, k)));
    fx.onchange = () => { const f = FX[fx.value]; if (f) { const d = cx.getImageData(0, 0, cv.width, cv.height), p = d.data; for (let i = 0; i < p.length; i += 4) { const r = f(p[i], p[i + 1], p[i + 2]); p[i] = r[0]; p[i + 1] = r[1]; p[i + 2] = r[2]; } cx.putImageData(d, 0, 0); commit(); } fx.value = ''; };
    bar2.append(fx);
    const rw = h('input'), rh = h('input'); rw.type = rh.type = 'number'; rw.className = rh.className = 'rs'; bar2.append(rw, h('span', '', '×'), rh);
    btn('Resize', () => { const w = +rw.value, hh = +rh.value; if (w > 0 && hh > 0 && w < 4096 && hh < 4096) xf(w, hh, (t, c) => t.drawImage(c, 0, 0, w, hh)); }, bar2);
    btn('Clear', () => { cx.clearRect(0, 0, cv.width, cv.height); commit(); }, bar2);
    const wrap = h('div', 'pwrap'); wrap.append(cv);
    const foot = h('div', 'pbar end'); const close = () => m.remove();
    btn('Cancel', close, foot); btn('Save to assets', () => { save(cv.toDataURL('image/png'), cv.width, cv.height); close(); }, foot, 'p');
    box.append(h('h3', '', 'Image editor'), bar, bar2, wrap, foot); m.append(box); document.body.append(m);
    const done = () => { rw.value = cv.width; rh.value = cv.height; commit(); };
    if (url) { const im = new Image(); im.onload = () => { cv.width = im.naturalWidth; cv.height = im.naturalHeight; cx.drawImage(im, 0, 0); done(); }; im.src = url; } else { cv.width = cv.height = 512; done(); }
  }
  return { open };
})();
