// ZOMBIE-APOCALYPSE sprite set — grim, desaturated, decayed; clean vector shapes.
// Ground tiles are drawn procedurally in game.js (paintTile); this file = entities/objects.
(function () {
  let _s = 99173;
  const rnd = () => ((_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const ri = (n) => Math.floor(rnd() * n);
  function make(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  function rr(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
  function shadow(x, cx, cy, w) { x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(cx, cy, w, w * 0.4, 0, 0, 7); x.fill(); }
  function eyes(x, lx, ly, rx, ry, r, col) { r = r || 1.7; x.fillStyle = col || '#1a1410'; x.beginPath(); x.arc(lx, ly, r, 0, 7); x.arc(rx, ry, r, 0, 7); x.fill(); }

  // ===== PLAYER (24×32) — punk survivor: red mohawk, worn jacket =====
  function player(step) {
    const [c, x] = make(24, 32); const l = step === 1 ? 2 : 0, r2 = step === 2 ? 2 : 0;
    shadow(x, 12, 30, 9);
    x.fillStyle = '#262b22'; rr(x, 7, 22, 4, 8 - l, 2); x.fill(); rr(x, 13, 22, 4, 8 - r2, 2); x.fill();      // boots/legs
    const g = x.createLinearGradient(0, 12, 0, 25); g.addColorStop(0, '#4a5340'); g.addColorStop(1, '#39402f'); x.fillStyle = g; rr(x, 4, 12, 16, 13, 5); x.fill();   // jacket
    x.fillStyle = '#2e3326'; rr(x, 11, 13, 2, 12, 1); x.fill();
    x.fillStyle = '#5a4030'; rr(x, 4, 12, 16, 2, 3); x.fill();                                                 // worn collar
    x.fillStyle = '#4a5340'; rr(x, 2, 14, 4, 8, 3); x.fill(); rr(x, 18, 14, 4, 8, 3); x.fill();
    x.fillStyle = '#caa688'; x.beginPath(); x.arc(12, 8, 7, 0, 7); x.fill();                                   // head
    x.fillStyle = '#b08f6e'; rr(x, 5, 9, 14, 0, 0); x.fillRect(6, 11, 12, 2);
    eyes(x, 9.5, 8, 14.5, 8, 1.6);
    x.fillStyle = '#b8322a'; x.beginPath(); x.moveTo(8, 3); x.quadraticCurveTo(12, -4, 16, 3); x.quadraticCurveTo(12, 1, 8, 3); x.fill();   // red mohawk
    return c;
  }

  // ===== ZOMBIE (24×32) — rotting, bloodied =====
  function enemy(step) {
    const [c, x] = make(24, 32); const l = step === 1 ? 1 : 0, r2 = step === 2 ? 1 : 0;
    shadow(x, 12, 30, 9);
    x.fillStyle = '#2f3422'; rr(x, 7, 23, 4, 7 - l, 2); x.fill(); rr(x, 13, 23, 4, 7 - r2, 2); x.fill();
    x.fillStyle = '#4a503a'; rr(x, 5, 13, 14, 12, 5); x.fill();                                                // ragged shirt
    x.fillStyle = '#8a1a1a'; rr(x, 8, 16, 5, 6, 2); x.fill();                                                  // blood
    x.fillStyle = '#6f7553'; rr(x, 2, 13 + l, 4, 9, 3); x.fill(); rr(x, 18, 13 + r2, 4, 9, 3); x.fill();        // arms out
    x.fillStyle = '#7a8358'; x.beginPath(); x.arc(12, 8, 7.5, 0, 7); x.fill();                                  // head
    x.fillStyle = '#5f6a45'; rr(x, 5, 11, 14, 2, 1); x.fill();
    x.fillStyle = '#8a1a1a'; x.beginPath(); x.arc(8, 5, 2.4, 0, 7); x.fill();                                   // head wound
    eyes(x, 9.5, 8, 14.5, 8, 1.6, '#d83b2e');
    x.strokeStyle = '#1a0f0a'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(9, 11.5); x.lineTo(15, 11.5); x.stroke();
    return c;
  }

  // ===== BANDIT (24×32) — raider: hood, gas-mask vibe =====
  function bandit(step) {
    const [c, x] = make(24, 32); const l = step === 1 ? 1 : 0, r2 = step === 2 ? 1 : 0;
    shadow(x, 12, 30, 9);
    x.fillStyle = '#23231f'; rr(x, 8, 24, 3, 6 - l, 2); x.fill(); rr(x, 13, 24, 3, 6 - r2, 2); x.fill();
    x.fillStyle = '#3a352c'; rr(x, 5, 13, 14, 12, 5); x.fill();
    x.fillStyle = '#7a2a22'; rr(x, 5, 13, 14, 2, 3); x.fill();                                                 // red band
    x.fillStyle = '#3a352c'; rr(x, 2, 14 + l, 4, 8, 3); x.fill(); rr(x, 18, 14 + r2, 4, 8, 3); x.fill();
    x.fillStyle = '#4a4636'; x.beginPath(); x.arc(12, 8, 7.5, 0, 7); x.fill();                                  // hood
    x.fillStyle = '#1e1d1a'; rr(x, 6, 6, 12, 8, 3); x.fill();                                                  // mask
    x.fillStyle = '#caa11a'; x.beginPath(); x.arc(9.5, 9, 1.4, 0, 7); x.arc(14.5, 9, 1.4, 0, 7); x.fill();      // mask lenses
    x.fillStyle = '#2a2620'; rr(x, 9, 11, 6, 3, 1); x.fill();                                                  // filter
    return c;
  }

  // ===== WOMAN (24×32) — survivor to rescue =====
  function woman(step) {
    const [c, x] = make(24, 32); const l = step === 1 ? 2 : 0, r2 = step === 2 ? 2 : 0;
    shadow(x, 12, 30, 9);
    x.fillStyle = '#3a3a40'; rr(x, 8, 24, 3, 6 - l, 2); x.fill(); rr(x, 13, 24, 3, 6 - r2, 2); x.fill();
    const g = x.createLinearGradient(0, 13, 0, 26); g.addColorStop(0, '#9a5a6a'); g.addColorStop(1, '#7a4452'); x.fillStyle = g; x.beginPath(); x.moveTo(5, 14); x.lineTo(19, 14); x.lineTo(21, 26); x.lineTo(3, 26); x.closePath(); x.fill();
    x.fillStyle = '#7a4452'; rr(x, 2, 15, 4, 7, 3); x.fill(); rr(x, 18, 15, 4, 7, 3); x.fill();
    x.fillStyle = '#5a3a24'; x.beginPath(); x.arc(12, 8, 8, 0, 7); x.fill();                                   // hair
    x.fillStyle = '#e0b48f'; x.beginPath(); x.arc(12, 8, 6, 0, 7); x.fill();
    x.fillStyle = '#5a3a24'; rr(x, 4, 2, 16, 5, 3); x.fill();
    eyes(x, 9.5, 8, 14.5, 8, 1.6);
    x.fillStyle = '#a04a4a'; x.beginPath(); x.arc(12, 11, 1.2, 0, 7); x.fill();
    return c;
  }

  function coin() {                                       // supply token
    const [c, x] = make(32, 32); x.translate(16, 16); shadow(x, 0, 9, 8);
    const g = x.createRadialGradient(-3, -3, 2, 0, 0, 9); g.addColorStop(0, '#ffe27a'); g.addColorStop(1, '#caa11a'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 9, 0, 7); x.fill();
    x.strokeStyle = '#8a6a14'; x.lineWidth = 1.5; x.beginPath(); x.arc(0, 0, 9, 0, 7); x.stroke();
    x.fillStyle = '#8a6a14'; x.font = 'bold 13px Trebuchet MS'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('$', 0, 1);
    x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(-3, -4, 2, 0, 7); x.fill();
    return c;
  }
  function ammo() {                                       // military ammo box
    const [c, x] = make(20, 20); shadow(x, 10, 18, 8);
    const g = x.createLinearGradient(0, 4, 0, 18); g.addColorStop(0, '#525a3a'); g.addColorStop(1, '#3a4029'); x.fillStyle = g; rr(x, 2, 4, 16, 14, 2); x.fill();
    x.fillStyle = '#2c3220'; x.fillRect(2, 10, 16, 1.5);
    x.fillStyle = '#caa11a'; x.font = 'bold 7px Trebuchet MS'; x.textAlign = 'center'; x.fillText('AMMO', 10, 9);
    x.fillStyle = '#d4af37'; rr(x, 7, 12, 2.4, 4, 1); x.fill(); rr(x, 10.6, 12, 2.4, 4, 1); x.fill();
    return c;
  }
  function key() {
    const [c, x] = make(24, 24); shadow(x, 11, 20, 7);
    x.fillStyle = '#caa45a'; x.beginPath(); x.arc(8, 12, 5, 0, 7); x.fill(); x.fillStyle = '#9a7a3a'; x.beginPath(); x.arc(8, 12, 2.3, 0, 7); x.fill();
    x.fillStyle = '#caa45a'; rr(x, 12, 10.5, 9, 3, 1); x.fill(); x.fillRect(18, 13, 2, 3); x.fillRect(15, 13, 2, 2);
    x.fillStyle = 'rgba(255,240,200,.5)'; x.beginPath(); x.arc(6, 10, 1.3, 0, 7); x.fill();
    return c;
  }
  function lock() {
    const [c, x] = make(20, 22);
    x.strokeStyle = '#9aa'; x.lineWidth = 3; x.beginPath(); x.arc(10, 9, 4, Math.PI, 2 * Math.PI); x.stroke();
    const g = x.createLinearGradient(0, 9, 0, 20); g.addColorStop(0, '#b9bcc0'); g.addColorStop(1, '#7c8086'); x.fillStyle = g; rr(x, 4, 9, 12, 11, 2); x.fill();
    x.fillStyle = '#3a3d42'; x.beginPath(); x.arc(10, 14, 1.6, 0, 7); x.fill(); x.fillRect(9.2, 14, 1.6, 4);
    return c;
  }
  function car() {                                        // burnt-out wreck
    const [c, x] = make(46, 28); shadow(x, 23, 25, 21);
    x.fillStyle = '#15151a'; for (const wx of [9, 32]) { x.beginPath(); x.arc(wx, 6, 4, 0, 7); x.arc(wx, 22, 4, 0, 7); x.fill(); }
    const g = x.createLinearGradient(0, 6, 0, 22); g.addColorStop(0, '#5a4a40'); g.addColorStop(1, '#3a302a'); x.fillStyle = g; rr(x, 4, 6, 38, 16, 5); x.fill();
    x.fillStyle = '#242228'; rr(x, 14, 8, 18, 12, 3); x.fill();                                                // smashed cabin
    x.fillStyle = '#2a2420'; for (let i = 0; i < 7; i++) { x.beginPath(); x.arc(6 + ri(34), 8 + ri(12), 1.7, 0, 7); x.fill(); }   // rust/burn
    return c;
  }

  // derelict building; warm window if `warm`, faded heart if `heart`
  function building(wall, roof, w, h, warm, heart) {
    const [c, x] = make(w, h); const top = Math.round(h * 0.32);
    shadow(x, w / 2, h - 4, w * 0.42);
    const wg = x.createLinearGradient(0, top, 0, h); wg.addColorStop(0, wall[0]); wg.addColorStop(1, wall[1]); x.fillStyle = wg; rr(x, 8, top, w - 16, h - top - 4, 4); x.fill();
    x.fillStyle = 'rgba(0,0,0,.22)'; for (let i = 0; i < 5; i++) x.fillRect(10 + ri(w - 24), top + 4 + ri(h - top - 12), ri(6) + 2, ri(7) + 3);   // grime
    const rg = x.createLinearGradient(0, 2, 0, top + 4); rg.addColorStop(0, roof[0]); rg.addColorStop(1, roof[1]); x.fillStyle = rg;
    x.beginPath(); x.moveTo(2, top + 4); x.lineTo(w / 2, 2); x.lineTo(w - 2, top + 4); x.closePath(); x.fill();
    const dw = Math.round(w * 0.18), dh = Math.round((h - top) * 0.5), dx = (w - dw) / 2, dy = h - dh - 4;
    x.fillStyle = '#241a10'; rr(x, dx, dy, dw, dh, 2); x.fill();
    const ww = Math.round(w * 0.15), wy = top + Math.round((h - top) * 0.26);
    for (const wx of [Math.round(w * 0.2), Math.round(w * 0.65)]) {
      if (warm) { x.fillStyle = '#ffcf6a'; rr(x, wx, wy, ww, ww, 2); x.fill(); }
      else { x.fillStyle = '#15140f'; rr(x, wx, wy, ww, ww, 2); x.fill(); x.fillStyle = '#5a4730'; x.fillRect(wx - 1, wy + ww / 2 - 1, ww + 2, 2); }   // boarded
    }
    if (heart) { x.fillStyle = '#9a3030'; const hx = w / 2, hy = top - 2; x.beginPath(); x.moveTo(hx, hy + 4); x.bezierCurveTo(hx - 6, hy - 4, hx - 11, hy + 2, hx, hy + 9); x.bezierCurveTo(hx + 11, hy + 2, hx + 6, hy - 4, hx, hy + 4); x.fill(); }
    return c;
  }

  function wicon(kind) {
    const [c, x] = make(28, 28); x.lineCap = 'round'; x.lineJoin = 'round';
    if (kind === 'pistol') { x.fillStyle = '#2f3238'; rr(x, 4, 11, 16, 5, 2); x.fill(); rr(x, 5, 14, 5, 8, 2); x.fill(); x.fillStyle = '#caa11a'; x.fillRect(19, 11, 3, 2); }
    else if (kind === 'bat') { x.strokeStyle = '#7a5a38'; x.lineWidth = 5; x.beginPath(); x.moveTo(7, 22); x.lineTo(20, 7); x.stroke(); x.strokeStyle = '#5a4028'; x.lineWidth = 6; x.beginPath(); x.moveTo(19, 8); x.lineTo(22, 5); x.stroke(); x.fillStyle = '#9aa'; x.fillRect(16, 9, 2, 2); }
    else if (kind === 'smg') { x.fillStyle = '#34424c'; rr(x, 4, 10, 18, 4, 2); x.fill(); rr(x, 8, 13, 3, 7, 1); x.fill(); x.fillStyle = '#56b8ff'; x.fillRect(20, 10, 3, 2); }
    else if (kind === 'shotgun') { x.fillStyle = '#4a3a28'; rr(x, 3, 13, 6, 4, 1); x.fill(); x.fillStyle = '#787c82'; rr(x, 9, 11, 15, 3, 1); x.fill(); rr(x, 9, 14, 15, 3, 1); x.fill(); }
    else if (kind === 'blaster') { x.fillStyle = '#4a2a70'; rr(x, 4, 11, 13, 6, 2); x.fill(); rr(x, 6, 16, 4, 5, 1); x.fill(); x.fillStyle = '#c46bff'; x.beginPath(); x.arc(20, 14, 4, 0, 7); x.fill(); }
    else if (kind === 'flame') { x.fillStyle = '#3a3d42'; rr(x, 4, 12, 9, 6, 2); x.fill(); x.fillStyle = '#ff5a1a'; x.beginPath(); x.moveTo(16, 15); x.bezierCurveTo(26, 8, 24, 20, 18, 19); x.bezierCurveTo(15, 18, 15, 16, 16, 15); x.fill(); x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(19, 15, 2.2, 0, 7); x.fill(); }
    return c;
  }

  window.SPRITES = {
    ammo: ammo(),
    player: [player(0), player(1), player(2)], enemy: [enemy(0), enemy(1), enemy(2)],
    woman: [woman(0), woman(1), woman(2)], bandit: [bandit(0), bandit(1), bandit(2)],
    key: key(), lock: lock(), car: car(),
    wicon: ['pistol', 'bat', 'smg', 'shotgun', 'blaster', 'flame'].map(wicon),
    coin: coin(),
    home: building(['#6a5f4a', '#4e4636'], ['#5a6347', '#3e4630'], 96, 64, true, true),
    house1: building(['#5a5048', '#3e3833'], ['#4a342c', '#33251f'], 96, 96),
    house2: building(['#4e5256', '#383b3f'], ['#33363a', '#23262a'], 96, 96),
    house3: building(['#5e564a', '#403a30'], ['#463a2c', '#2e2620'], 96, 96),
  };
})();
