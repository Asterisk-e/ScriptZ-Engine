// ---- YOUR GAME. First run shows the OOBE setup; after that, 'main' runs. ----
const saved = ScriptZOOBE.load();
const setup = !saved || location.hash === '#setup';
const cfg = Object.assign({}, ScriptZOOBE.defaults, saved || {});
document.documentElement.style.setProperty('--sz-h', cfg.hue);

const game = new ScriptZ.Game(setup
  ? { canvas: '#game', width: 960, height: 540, gravity: cfg.gravity }
  : { canvas: '#game', width: cfg.w, height: cfg.h, gravity: cfg.gravity });

game.scene('main', {
  create(scene) {
    game.ui.hud('name', cfg.name);
    game.ui.hud('ver', 'ScriptZ-Engine v' + ScriptZ.version);
    game.ui.button('Run setup again', () => { location.hash = '#setup'; location.reload(); }, { tonal: true });
    // scene.spawn({ shape: 'blob', x: 200, y: 100, w: 80, bounce: .8 });
  },
  update(scene, dt) {},
  hud(scene, ctx) {
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.font = '600 20px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('Empty scene \u2014 write your game in game.js', game.W / 2, game.H / 2);
  }
});

if (setup) { ScriptZOOBE.register(game); game.start('oobe'); } else game.start('main');
