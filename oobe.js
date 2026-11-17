/* ScriptZ-Engine OOBE — first-run setup with live MaterialUs shapes (built on the engine itself) */
(function () {
'use strict';
const KEY = 'scriptz:project';
const DEF = { name: 'My Game', hue: 265, res: '16:9', w: 960, h: 540, feel: 'Balanced', gravity: 900 };
const RES = { '16:9': [960, 540], '4:3': [800, 600], '1:1': [640, 640], '9:16': [405, 720] };
const FEEL = { Floaty: 300, Balanced: 900, Heavy: 1800 };
const HUES = [265, 340, 20, 150, 195, 50];
const SHAPES = ['blob', 'cookie', 'squircle', 'circle'];
const pal = h => ['hsl(' + h + ' 85% 78%)', 'hsl(' + (h + 35) + ' 75% 72%)', 'hsl(' + (h - 40) + ' 80% 74%)', 'hsl(' + h + ' 45% 62%)'];
const h = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };

function register(game) {
  const U = ScriptZ.Util, cfg = Object.assign({}, DEF, load() || {});
  let step = 0, drag = null, scene, panel, body, dots, back, next;
  document.documentElement.style.setProperty('--sz-h', cfg.hue);

  function toy(x, y, size) {
    const shape = U.pick(SHAPES);
    return scene.spawn(Object.assign({ tags: 'toy', shape, x, y, w: size, color: U.pick(pal(cfg.hue)), bounce: .78, friction: .3, vx: U.rand(-140, 140) },
      shape === 'squircle' ? { h: size * U.rand(.8, 1.1) } : {}));
  }
  function recolor() {
    document.documentElement.style.setProperty('--sz-h', cfg.hue);
    scene.findAll('toy').forEach(e => e.color = U.pick(pal(cfg.hue)));
    scene.findAll('decor').forEach(e => e.color = pal(cfg.hue)[0]);
  }
  function kick() { scene.findAll('toy').forEach(e => e.impulse(U.rand(-120, 120), -U.rand(250, 520))); scene.camera.shake(4, .25); game.sound.sfx('pop'); }
  function cards(items, cur, pick) {
    const g = h('div', 'cards');
    items.forEach(([k, sub]) => {
      const c = h('button', 'card' + (k === cur ? ' on' : '')); c.append(h('b', '', k), h('span', '', sub));
      c.onclick = () => { g.querySelectorAll('.card').forEach(x => x.classList.remove('on')); c.classList.add('on'); pick(k); };
      g.append(c);
    });
    return g;
  }
  const steps = [
    () => [h('h1', '', 'Hello'), h('p', '', 'Welcome to ScriptZ-Engine. Let\u2019s get you set up in under a minute. Psst \u2014 you can grab and throw the shapes, or tap empty space for more.')],
    () => { const i = h('input'); i.value = cfg.name; i.maxLength = 24; i.placeholder = DEF.name; i.oninput = () => cfg.name = i.value.trim() || DEF.name;
      i.onkeydown = e => { if (e.key === 'Enter') next.click(); }; setTimeout(() => i.focus(), 400);
      return [h('h2', '', 'Name your project'), h('p', '', 'You can change this any time.'), i]; },
    () => { const row = h('div', 'swatches');
      HUES.forEach(hu => { const b = h('button', 'swatch' + (hu === cfg.hue ? ' on' : '')); b.style.background = 'hsl(' + hu + ' 85% 78%)';
        b.onclick = () => { cfg.hue = hu; row.querySelectorAll('.swatch').forEach(x => x.classList.remove('on')); b.classList.add('on'); recolor(); kick(); }; row.append(b); });
      return [h('h2', '', 'Pick your color'), h('p', '', 'The whole engine re-themes instantly.'), row]; },
    () => [h('h2', '', 'Choose a canvas'), h('p', '', 'The size of your game window.'),
      cards(Object.entries(RES).map(([k, v]) => [k, v[0] + ' \u00d7 ' + v[1]]), cfg.res, k => { cfg.res = k; cfg.w = RES[k][0]; cfg.h = RES[k][1]; game.sound.sfx('pop'); })],
    () => [h('h2', '', 'How should it feel?'), h('p', '', 'Default gravity \u2014 watch the shapes react.'),
      cards(Object.keys(FEEL).map(k => [k, 'gravity ' + FEEL[k]]), cfg.feel, k => { cfg.feel = k; cfg.gravity = FEEL[k]; scene.gravity = cfg.gravity; kick(); })],
    () => { const s = h('div', 'sum'); [cfg.res, cfg.w + '\u00d7' + cfg.h, cfg.feel].forEach(t => s.append(h('span', '', t)));
      return [h('h2', '', 'All set, ' + cfg.name + '!'), h('p', '', 'Your project is ready to build.'), s]; }
  ];
  const labels = ['Get started', 'Next', 'Next', 'Next', 'Next', 'Launch'];
  function go(n, fwd) {
    step = n; body.innerHTML = ''; body.append(...steps[n]());
    body.style.animation = 'none'; void body.offsetWidth; body.style.animation = '';
    dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i === n));
    back.style.visibility = n ? 'visible' : 'hidden'; next.textContent = labels[n]; if (fwd) kick();
  }
  function launch() {
    next.disabled = true; game.save('project', cfg); game.sound.sfx('coin');
    scene.burst(game.W * .25, game.H * .5, { count: 70, color: pal(cfg.hue), speed: 520, size: 9, gravity: 500, life: 1 });
    panel.classList.add('out'); scene.camera.shake(10, .5);
    game.after(1.1, () => { history.replaceState(null, '', location.pathname + location.search); location.reload(); });
  }

  game.scene('oobe', {
    create(s) {
      scene = s;
      [[110, 110, 520, 'cookie'], [860, 470, 560, 'blob'], [830, 50, 300, 'cookie']].forEach(([x, y, w, shape], i) =>
        s.spawn({ tags: 'decor', shape, x, y, w, body: 'none', z: -5, alpha: .16, color: pal(cfg.hue)[0], update(dt) { this.rot += dt * (i % 2 ? -.12 : .1); } }));
      for (let i = 0; i < 16; i++) game.after(i * .1, () => toy(U.rand(60, 900), U.rand(60, 160), U.rand(46, 110)));
      panel = h('div', 'oobe'); dots = h('div', 'dots'); steps.forEach(() => dots.append(h('i')));
      body = h('div', 'oobe-body'); const nav = h('div', 'oobe-nav');
      back = h('button', 'sz-btn tonal', 'Back'); next = h('button', 'sz-btn', 'Next'); nav.append(back, next);
      back.onclick = () => go(step - 1, true); next.onclick = () => step < steps.length - 1 ? go(step + 1, true) : launch();
      panel.append(dots, body, nav); game.ui.root.append(panel); go(0, false);
    },
    update(s) {
      const m = game.input.mouse;
      if (m.pressed) { m.pressed = false; drag = s.pick(m.wx, m.wy, e => e.has('toy'));
        if (drag) game.sound.sfx('pop'); else if (s.findAll('toy').length < 40) { toy(m.wx, m.wy, U.rand(46, 110)); game.sound.sfx('pop'); } }
      if (!m.down) drag = null;
      if (drag) { drag.vx = U.clamp((m.wx - drag.x) * 18, -1600, 1600); drag.vy = U.clamp((m.wy - drag.y) * 18, -1600, 1600); }
    },
    leave() { panel && panel.remove(); }
  });
}
window.ScriptZOOBE = { load, register, defaults: DEF };
})();
