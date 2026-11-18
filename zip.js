/* ScriptZ-Engine export: builds a real .zip (index.html, style.css, engine.js, game.js, assets/) with no libraries. */
const Zip = (() => {
  const T = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = b => { let c = -1; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const enc = new TextEncoder();
  function make(files) { // files: [{name, data: Uint8Array}]
    const parts = [], cen = []; let off = 0;
    for (const f of files) {
      const nm = enc.encode(f.name), c = crc(f.data), sz = f.data.length;
      const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(12, 0x21, true);
      lh.setUint32(14, c, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true); lh.setUint16(26, nm.length, true);
      parts.push(new Uint8Array(lh.buffer), nm, f.data);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(14, 0x21, true);
      ch.setUint32(16, c, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
      cen.push(new Uint8Array(ch.buffer), nm); off += 30 + nm.length + sz;
    }
    const cs = cen.reduce((a, x) => a + x.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...cen, new Uint8Array(e.buffer)], { type: 'application/zip' });
  }
  const MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'weba', 'audio/mp4': 'm4a', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/ogg': 'ogv' };
  function bytes(url) {
    const i = url.indexOf(','), head = url.slice(5, i), body = url.slice(i + 1), mime = head.split(';')[0];
    if (/;base64/.test(head)) { const bin = atob(body), u = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k); return { mime, data: u }; }
    return { mime, data: enc.encode(decodeURIComponent(body)) };
  }
  function build(P) {
    const files = [], game = JSON.parse(JSON.stringify(P)), text = (name, s) => files.push({ name, data: enc.encode(s) }), esc = s => String(s).replace(/[<&>"]/g, c => '&#' + c.charCodeAt(0) + ';');
    for (const [id, a] of Object.entries(game.assets || {})) {
      if (!/^data:/.test(a.url)) continue; const b = bytes(a.url), name = 'assets/' + id + '.' + (MIME[b.mime] || 'bin'); files.push({ name, data: b.data }); a.url = name;
    }
    text('index.html', '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + esc(P.name) + '</title>\n<link rel="stylesheet" href="style.css">\n</head>\n<body>\n<div id="game"></div>\n<script src="engine.js"><\/script>\n<script src="game.js"><\/script>\n</body>\n</html>\n');
    text('style.css', 'html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:system-ui,sans-serif}\n#game{position:fixed;inset:0;touch-action:none;user-select:none}\n');
    text('engine.js', '/* ScriptZ-Engine runtime */\nconst ZRuntime = (' + ZRuntimeFactory.toString() + ')();\n');
    text('game.js', '/* Your game data (scenes, objects, events). */\nconst GAME = ' + JSON.stringify(game, null, 1) + ';\nZRuntime.start(GAME, document.getElementById("game"));\n');
    text('README.txt', P.name + '\n\nMade with ScriptZ-Engine.\n\nPLAY: open index.html in any modern browser.\nPUBLISH: upload this whole folder to any web host (GitHub Pages, Netlify, itch.io HTML5, your own server).\n\nFILES\n  index.html  the page\n  style.css   page styling\n  engine.js   the game runtime\n  game.js     your game (scenes, objects, events)\n  assets/     your images, sounds and videos\n');
    return make(files);
  }
  return { make, build };
})();
