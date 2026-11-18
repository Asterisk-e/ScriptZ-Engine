/* Starter games for "New game". Each builds a complete project (objects, scenes, events). */
const Templates = (() => {
  const uid = () => Math.random().toString(36).slice(2, 9);
  const D = (name, o) => Object.assign({ id: uid(), name, type: 'sprite', shape: 'squircle', color: '#d0bcff', w: 64, h: 64, asset: '', text: '', fontSize: 32, visible: true, hud: false, vars: {},
    phys: { t: 'none', bounce: .5, fric: .2, grav: 1 }, plat: { on: false, speed: 260, jump: 560 }, top: { on: false, speed: 240 }, drag: false, edge: '' }, o);
  const I = (d, x, y) => ({ id: uid(), obj: d.id, x, y });
  const E = (conds, acts, sub) => ({ conds: conds.map(([t, ...a]) => ({ t, a })), acts: acts.map(([t, ...a]) => ({ t, a })), sub });
  const proj = (name, w, h, bg) => ({ id: uid(), name, w: w || 960, h: h || 540, bg: bg || '#f4eefc', gravity: 900, vars: {}, objects: [], assets: {}, scenes: [] });
  const scene = (P, name, inst, events) => { const s = { id: uid(), name, bg: '', instances: inst, events }; P.scenes.push(s); return s; };
  return [
    { id: 'blank', name: 'Blank', desc: 'An empty scene with one object.', build(name, w, h) {
      const P = proj(name, w, h), b = D('Box', { color: '#b69df8' }); P.objects.push(b); scene(P, 'Scene 1', [I(b, P.w / 2, P.h / 2)], []); return P; } },
    { id: 'platformer', name: 'Platformer', desc: 'Run, jump and collect coins. Arrow keys + space.', build(name, w, h) {
      const P = proj(name, 960, 540, '#e8f0ff'), pl = D('Player', { color: '#6750a4', w: 44, h: 44, phys: { t: 'dynamic', bounce: .05, fric: .1, grav: 1 }, plat: { on: true, speed: 270, jump: 560 } }),
        ground = D('Ground', { shape: 'rect', color: '#4a6572', w: 960, h: 40, phys: { t: 'static', bounce: 0, fric: .5, grav: 1 } }), plat = D('Platform', { shape: 'rect', color: '#7c9885', w: 200, h: 20, phys: { t: 'static', bounce: 0, fric: .5, grav: 1 } }),
        coin = D('Coin', { shape: 'sunny', color: '#f5b700', w: 30, h: 30 }), score = D('ScoreText', { type: 'text', hud: true, w: 300, h: 50, fontSize: 30, color: '#1d1b20' });
      P.objects.push(pl, ground, plat, coin, score);
      scene(P, 'Level 1', [I(pl, 80, 460), I(ground, 480, 520), I(plat, 300, 400), I(plat, 650, 310), I(plat, 880, 210), I(coin, 300, 360), I(coin, 650, 270), I(coin, 880, 170), I(score, 170, 36)], [
        E([['start']], [['setvar', 'score', '=', '0']]),
        E([['touching', 'Player', 'Coin']], [['delete', 'Coin'], ['setvar', 'score', '+', '1'], ['sfx', 'coin']]),
        E([], [['settext', 'ScoreText', 'Coins: {score} / 3']]),
        E([['cmpvar', 'score', '>=', '3'], ['once']], [['msg', 'You win! Press R to play again', '4'], ['sfx', 'powerup']]),
        E([['keyhit', 'space'], ['ground', 'Player']], [['sfx', 'jump']]),
        E([['keyhit', 'r']], [['restart']])
      ]); return P; } },
    { id: 'clicker', name: 'Clicker', desc: 'Click the cookie, buy helpers. Variables and timers.', build(name, w, h) {
      const P = proj(name, 960, 540, '#fff3e6'), ck = D('Cookie', { shape: 'cookie', color: '#f2a65a', w: 220, h: 220 }), sc = D('ScoreText', { type: 'text', hud: true, w: 500, h: 60, fontSize: 44, color: '#4a2c0a' }),
        up = D('Upgrade', { shape: 'squircle', color: '#6750a4', w: 300, h: 70 }), lb = D('UpgradeLabel', { type: 'text', hud: true, w: 300, h: 70, fontSize: 18, color: '#ffffff' });
      P.objects.push(ck, sc, up, lb);
      scene(P, 'Main', [I(ck, 480, 270), I(sc, 480, 60), I(up, 480, 460), I(lb, 480, 460)], [
        E([['start']], [['setvar', 'score', '=', '0'], ['setvar', 'perSec', '=', '0']]),
        E([['clickobj', 'Cookie']], [['setvar', 'score', '+', '1'], ['sfx', 'pop'], ['rotate', 'Cookie', '12']]),
        E([['every', '1']], [['setvar', 'score', '+', 'perSec']]),
        E([['clickobj', 'Upgrade'], ['expr', 'score >= 10']], [['setvar', 'score', '-', '10'], ['setvar', 'perSec', '+', '1'], ['sfx', 'powerup']]),
        E([], [['settext', 'ScoreText', 'Cookies: {score}'], ['settext', 'UpgradeLabel', 'Buy helper (10 cookies) — you have {perSec}']])
      ]); return P; } }
  ];
})();
