// CARTOON-VECTOR sprite set (ForestQuest look): rounded shapes, gradients, soft shadows.
// Same export shape & sizes as before so the engine keeps working.
(function () {
  let _s = 13579;
  const rnd = () => ((_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const ri = (n) => Math.floor(rnd() * n);
  function make(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); return [c, x]; }
  function rr(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
  function shadow(x, cx, cy, w) { x.fillStyle = 'rgba(0,0,0,.20)'; x.beginPath(); x.ellipse(cx, cy, w, w * 0.4, 0, 0, 7); x.fill(); }

  // ===== TILES (8 × 32) : 0 grass,1 wall,2 water,3 sand,4 tree,5 fence,6 brick,7 path =====
  function tilemap() {
    const T = 32, N = 8; const [c, x] = make(N * T, T);
    const at = (i, fn) => { x.save(); x.translate(i * T, 0); x.beginPath(); x.rect(0, 0, T, T); x.clip(); fn(); x.restore(); };
    at(0, () => { const g = x.createLinearGradient(0, 0, 0, T); g.addColorStop(0, '#56a466'); g.addColorStop(1, '#4f9a5e'); x.fillStyle = g; x.fillRect(0, 0, T, T); x.fillStyle = 'rgba(40,110,60,.4)'; for (let i = 0; i < 6; i++) { const px = ri(T), py = ri(T); x.fillRect(px, py, 2, 5); } });
    at(1, () => { x.fillStyle = '#8b9099'; x.fillRect(0, 0, T, T); x.fillStyle = '#787e88'; for (let r = 0; r < 4; r++) for (let cc = 0; cc < 2; cc++) { const off = (r % 2) * 8; rr(x, cc * 16 + off - 6, r * 8 + 1, 14, 6, 3); x.fill(); } x.fillStyle = 'rgba(0,0,0,.16)'; x.fillRect(0, T - 3, T, 3); });
    at(2, () => { const g = x.createLinearGradient(0, 0, 0, T); g.addColorStop(0, '#4a93cf'); g.addColorStop(1, '#3f7fc0'); x.fillStyle = g; x.fillRect(0, 0, T, T); x.fillStyle = 'rgba(255,255,255,.22)'; for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(ri(T), ri(T), 7, 2.4, 0, 0, 7); x.fill(); } });
    at(3, () => { x.fillStyle = '#e6d29a'; x.fillRect(0, 0, T, T); x.fillStyle = 'rgba(180,150,90,.5)'; for (let i = 0; i < 12; i++) x.fillRect(ri(T), ri(T), 2, 2); });
    at(4, () => { x.fillStyle = '#4f9a5e'; x.fillRect(0, 0, T, T); shadow(x, 16, 27, 9); x.fillStyle = '#7a4a25'; rr(x, 13, 16, 6, 13, 3); x.fill(); const g = x.createRadialGradient(12, 9, 3, 16, 12, 16); g.addColorStop(0, '#5fbf6a'); g.addColorStop(1, '#2f8a47'); x.fillStyle = g; x.beginPath(); x.arc(10, 12, 9, 0, 7); x.arc(22, 12, 9, 0, 7); x.arc(16, 6, 11, 0, 7); x.fill(); });
    at(5, () => { x.fillStyle = '#56a466'; x.fillRect(0, 0, T, T); x.fillStyle = '#9a6a39'; rr(x, 0, 11, T, 4, 2); x.fill(); rr(x, 0, 21, T, 4, 2); x.fill(); x.fillStyle = '#b3863f'; for (const px of [4, 16, 28]) { rr(x, px, 5, 5, 23, 2); x.fill(); } });
    at(6, () => { x.fillStyle = '#b0503f'; x.fillRect(0, 0, T, T); x.fillStyle = '#c25f4d'; for (let r = 0; r < 4; r++) { const off = (r % 2) * 8; for (let bx = -8; bx < T; bx += 16) { rr(x, bx + off + 1, r * 8 + 1, 14, 6, 2); x.fill(); } } x.fillStyle = 'rgba(245,230,210,.6)'; for (let r = 0; r <= 4; r++) x.fillRect(0, r * 8, T, 1); });
    at(7, () => { const g = x.createLinearGradient(0, 0, 0, T); g.addColorStop(0, '#d8c79a'); g.addColorStop(1, '#caa46a'); x.fillStyle = g; x.fillRect(0, 0, T, T); x.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 4; i++) { x.beginPath(); x.ellipse(ri(T), ri(T), 5, 2, 0, 0, 7); x.fill(); } });
    return c;
  }

  function eyes(x, lx, ly, rx, ry, r) { r = r || 1.8; x.fillStyle = '#241812'; x.beginPath(); x.arc(lx, ly, r, 0, 7); x.arc(rx, ry, r, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(lx + .6, ly - .6, r * .4, 0, 7); x.arc(rx + .6, ry - .6, r * .4, 0, 7); x.fill(); }

  // ===== PLAYER (24×32) — cartoon punk =====
  function player(step) {
    const [c, x] = make(24, 32); const l = step === 1 ? 2 : 0, r2 = step === 2 ? 2 : 0;
    shadow(x, 12, 30, 9);
    x.fillStyle = '#2f3a55'; rr(x, 7, 22, 4, 8 - l, 2); x.fill(); rr(x, 13, 22, 4, 8 - r2, 2); x.fill();
    const g = x.createLinearGradient(0, 12, 0, 25); g.addColorStop(0, '#5a86d8'); g.addColorStop(1, '#3f6fc4'); x.fillStyle = g; rr(x, 4, 12, 16, 13, 6); x.fill();
    x.fillStyle = '#e23b4e'; rr(x, 4, 12, 16, 3, 4); x.fill();
    x.fillStyle = '#3f6fc4'; rr(x, 2, 14, 4, 8, 3); x.fill(); rr(x, 18, 14, 4, 8, 3); x.fill();
    x.fillStyle = '#f2c39a'; x.beginPath(); x.arc(12, 8, 7, 0, 7); x.fill();
    eyes(x, 9.5, 8, 14.5, 8, 1.7);
    x.fillStyle = 'rgba(255,120,120,.35)'; x.beginPath(); x.arc(8, 10, 2, 0, 7); x.arc(16, 10, 2, 0, 7); x.fill();
    x.fillStyle = '#e23b4e'; x.beginPath(); x.moveTo(8, 3); x.quadraticCurveTo(12, -4, 16, 3); x.quadraticCurveTo(12, 1, 8, 3); x.fill();
    return c;
  }

  // ===== ZOMBIE (24×32) — goofy green =====
  function enemy(step) {
    const [c, x] = make(24, 32); const l = step === 1 ? 1 : 0, r2 = step === 2 ? 1 : 0;
    shadow(x, 12, 30, 9);
    x.fillStyle = '#3a4a2a'; rr(x, 7, 23, 4, 7 - l, 2); x.fill(); rr(x, 13, 23, 4, 7 - r2, 2); x.fill();
    x.fillStyle = '#6a8f3a'; rr(x, 5, 13, 14, 12, 6); x.fill();
    x.fillStyle = '#7faa4a'; rr(x, 2, 13 + l, 4, 9, 3); x.fill(); rr(x, 18, 13 + r2, 4, 9, 3); x.fill();
    const g = x.createRadialGradient(10, 5, 2, 12, 8, 9); g.addColorStop(0, '#9ed46a'); g.addColorStop(1, '#7faa4a'); x.fillStyle = g; x.beginPath(); x.arc(12, 8, 8, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(9, 7, 3, 0, 7); x.arc(15, 7, 3, 0, 7); x.fill();
    x.fillStyle = '#222'; x.beginPath(); x.arc(9.5, 7.5, 1.4, 0, 7); x.arc(14.5, 7.5, 1.4, 0, 7); x.fill();
    x.strokeStyle = '#2f4a1c'; x.lineWidth = 1.2; x.beginPath(); x.arc(12, 11, 2.4, 0.1, Math.PI - 0.1); x.stroke();
    return c;
  }

  // ===== BANDIT (24×32) — cap + red mask =====
  function bandit(step) {
    const [c, x] = make(24, 32); const l = step === 1 ? 1 : 0, r2 = step === 2 ? 1 : 0;
    shadow(x, 12, 30, 9);
    x.fillStyle = '#2a2a30'; rr(x, 8, 24, 3, 6 - l, 2); x.fill(); rr(x, 13, 24, 3, 6 - r2, 2); x.fill();
    x.fillStyle = '#3a3f47'; rr(x, 5, 13, 14, 12, 6); x.fill();
    x.fillStyle = '#b8322a'; rr(x, 5, 13, 14, 3, 4); x.fill();
    x.fillStyle = '#3a3f47'; rr(x, 2, 14 + l, 4, 8, 3); x.fill(); rr(x, 18, 14 + r2, 4, 8, 3); x.fill();
    x.fillStyle = '#e8b489'; x.beginPath(); x.arc(12, 8, 7, 0, 7); x.fill();
    x.fillStyle = '#b8322a'; rr(x, 5, 9, 14, 5, 2); x.fill();             // mask
    eyes(x, 9.5, 7, 14.5, 7, 1.5);
    x.fillStyle = '#15151a'; rr(x, 5, 2, 14, 4, 2); x.fill(); x.fillStyle = '#0e0e12'; rr(x, 13, 4, 7, 3, 2); x.fill();   // cap
    return c;
  }

  // ===== WOMAN (24×32) — to rescue =====
  function woman(step) {
    const [c, x] = make(24, 32); const l = step === 1 ? 2 : 0, r2 = step === 2 ? 2 : 0;
    shadow(x, 12, 30, 9);
    x.fillStyle = '#e8c9a0'; rr(x, 8, 24, 3, 6 - l, 2); x.fill(); rr(x, 13, 24, 3, 6 - r2, 2); x.fill();
    const g = x.createLinearGradient(0, 13, 0, 26); g.addColorStop(0, '#f06fa6'); g.addColorStop(1, '#e0518f'); x.fillStyle = g; x.beginPath(); x.moveTo(5, 14); x.lineTo(19, 14); x.lineTo(21, 26); x.lineTo(3, 26); x.closePath(); x.fill();
    x.fillStyle = '#e0518f'; rr(x, 2, 15, 4, 7, 3); x.fill(); rr(x, 18, 15, 4, 7, 3); x.fill();
    x.fillStyle = '#7a4a28'; x.beginPath(); x.arc(12, 8, 8, 0, 7); x.fill();               // hair
    x.fillStyle = '#f2c39a'; x.beginPath(); x.arc(12, 8, 6, 0, 7); x.fill();               // face
    x.fillStyle = '#7a4a28'; rr(x, 4, 2, 16, 5, 3); x.fill();                              // fringe
    eyes(x, 9.5, 8, 14.5, 8, 1.7);
    x.fillStyle = '#c0392b'; x.beginPath(); x.arc(12, 11, 1.4, 0, 7); x.fill();
    return c;
  }

  function coin() {
    const [c, x] = make(32, 32); x.translate(16, 16); shadow(x, 0, 9, 8);
    const g = x.createRadialGradient(-3, -3, 2, 0, 0, 9); g.addColorStop(0, '#ffe27a'); g.addColorStop(1, '#e0a72a'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 9, 0, 7); x.fill();
    x.strokeStyle = '#caa11a'; x.lineWidth = 1.5; x.beginPath(); x.arc(0, 0, 9, 0, 7); x.stroke();
    x.fillStyle = '#caa11a'; x.font = 'bold 13px Trebuchet MS'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('$', 0, 1);
    x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.arc(-3, -4, 2, 0, 7); x.fill();
    return c;
  }
  function ammo() {
    const [c, x] = make(20, 20); shadow(x, 10, 18, 8);
    const g = x.createLinearGradient(0, 4, 0, 18); g.addColorStop(0, '#5a6340'); g.addColorStop(1, '#3e4636'); x.fillStyle = g; rr(x, 2, 4, 16, 14, 3); x.fill();
    x.fillStyle = '#2f362a'; x.fillRect(2, 10, 16, 1.5);
    x.fillStyle = '#ffd23f'; rr(x, 7, 6, 2.4, 5, 1); x.fill(); rr(x, 10.6, 6, 2.4, 5, 1); x.fill();
    return c;
  }
  function key() {
    const [c, x] = make(24, 24); shadow(x, 11, 20, 7);
    x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(8, 12, 5, 0, 7); x.fill(); x.fillStyle = '#e6c233'; x.beginPath(); x.arc(8, 12, 2.3, 0, 7); x.fill();
    x.fillStyle = '#ffd23f'; rr(x, 12, 10.5, 9, 3, 1); x.fill(); x.fillRect(18, 13, 2, 3); x.fillRect(15, 13, 2, 2);
    x.fillStyle = '#fff7cc'; x.beginPath(); x.arc(6, 10, 1.4, 0, 7); x.fill();
    return c;
  }
  function lock() {
    const [c, x] = make(20, 22);
    x.strokeStyle = '#cdd'; x.lineWidth = 3; x.beginPath(); x.arc(10, 9, 4, Math.PI, 2 * Math.PI); x.stroke();
    const g = x.createLinearGradient(0, 9, 0, 20); g.addColorStop(0, '#ffe27a'); g.addColorStop(1, '#caa11a'); x.fillStyle = g; rr(x, 4, 9, 12, 11, 2); x.fill();
    x.fillStyle = '#7a5a10'; x.beginPath(); x.arc(10, 14, 1.6, 0, 7); x.fill(); x.fillRect(9.2, 14, 1.6, 4);
    return c;
  }
  function car() {
    const [c, x] = make(46, 28); shadow(x, 23, 25, 21);
    x.fillStyle = '#15151a'; for (const wx of [9, 32]) { x.beginPath(); x.arc(wx, 6, 4, 0, 7); x.arc(wx, 22, 4, 0, 7); x.fill(); }
    const g = x.createLinearGradient(0, 6, 0, 22); g.addColorStop(0, '#9a5a48'); g.addColorStop(1, '#6e4436'); x.fillStyle = g; rr(x, 4, 6, 38, 16, 6); x.fill();
    x.fillStyle = '#2f3e47'; rr(x, 14, 8, 18, 12, 4); x.fill();
    x.fillStyle = '#5a3327'; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(6 + ri(34), 8 + ri(12), 1.6, 0, 7); x.fill(); }
    return c;
  }

  // cottages — rounded, gradient roof. warm windows if `warm`.
  function building(wall, roof, w, h, warm, heart) {
    const [c, x] = make(w, h); const top = Math.round(h * 0.32);
    shadow(x, w / 2, h - 4, w * 0.42);
    const wg = x.createLinearGradient(0, top, 0, h); wg.addColorStop(0, wall[0]); wg.addColorStop(1, wall[1]); x.fillStyle = wg; rr(x, 8, top, w - 16, h - top - 4, 8); x.fill();
    const rg = x.createLinearGradient(0, 2, 0, top + 4); rg.addColorStop(0, roof[0]); rg.addColorStop(1, roof[1]); x.fillStyle = rg;
    x.beginPath(); x.moveTo(2, top + 4); x.quadraticCurveTo(w / 2, -6, w - 2, top + 4); x.closePath(); x.fill();
    const dw = Math.round(w * 0.18), dh = Math.round((h - top) * 0.5), dx = (w - dw) / 2, dy = h - dh - 4;
    x.fillStyle = '#6b4a2a'; rr(x, dx, dy, dw, dh, 4); x.fill(); x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(dx + dw - 4, dy + dh / 2, 1.4, 0, 7); x.fill();
    const ww = Math.round(w * 0.15), wy = top + Math.round((h - top) * 0.26);
    for (const wx of [Math.round(w * 0.2), Math.round(w * 0.65)]) { x.fillStyle = warm ? '#ffe9a8' : '#bfe9ff'; rr(x, wx, wy, ww, ww, 3); x.fill(); x.strokeStyle = '#6b4a2a'; x.lineWidth = 1.5; x.stroke(); }
    if (heart) { x.fillStyle = '#e23b5a'; const hx = w / 2, hy = top - 2; x.beginPath(); x.moveTo(hx, hy + 4); x.bezierCurveTo(hx - 6, hy - 4, hx - 11, hy + 2, hx, hy + 9); x.bezierCurveTo(hx + 11, hy + 2, hx + 6, hy - 4, hx, hy + 4); x.fill(); }
    return c;
  }

  function wicon(kind) {
    const [c, x] = make(28, 28); x.lineCap = 'round'; x.lineJoin = 'round';
    if (kind === 'pistol') { x.fillStyle = '#3a3d44'; rr(x, 4, 11, 16, 5, 2); x.fill(); rr(x, 5, 14, 5, 8, 2); x.fill(); x.fillStyle = '#ffd23f'; x.fillRect(19, 11, 3, 2); }
    else if (kind === 'bat') { x.strokeStyle = '#b9863f'; x.lineWidth = 5; x.beginPath(); x.moveTo(7, 22); x.lineTo(20, 7); x.stroke(); x.strokeStyle = '#8a6230'; x.lineWidth = 6; x.beginPath(); x.moveTo(19, 8); x.lineTo(22, 5); x.stroke(); }
    else if (kind === 'smg') { x.fillStyle = '#3f5566'; rr(x, 4, 10, 18, 4, 2); x.fill(); rr(x, 8, 13, 3, 7, 1); x.fill(); x.fillStyle = '#56b8ff'; x.fillRect(20, 10, 3, 2); }
    else if (kind === 'shotgun') { x.fillStyle = '#5a4632'; rr(x, 3, 13, 6, 4, 1); x.fill(); x.fillStyle = '#8a8d92'; rr(x, 9, 11, 15, 3, 1); x.fill(); rr(x, 9, 14, 15, 3, 1); x.fill(); }
    else if (kind === 'blaster') { x.fillStyle = '#6a36a0'; rr(x, 4, 11, 13, 6, 2); x.fill(); rr(x, 6, 16, 4, 5, 1); x.fill(); x.fillStyle = '#c46bff'; x.beginPath(); x.arc(20, 14, 4, 0, 7); x.fill(); }
    else if (kind === 'flame') { x.fillStyle = '#4a4d52'; rr(x, 4, 12, 9, 6, 2); x.fill(); x.fillStyle = '#ff5a1a'; x.beginPath(); x.moveTo(16, 15); x.bezierCurveTo(26, 8, 24, 20, 18, 19); x.bezierCurveTo(15, 18, 15, 16, 16, 15); x.fill(); x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(19, 15, 2.2, 0, 7); x.fill(); }
    return c;
  }

  window.SPRITES = {
    ammo: ammo(), tilemap: tilemap(),
    player: [player(0), player(1), player(2)], enemy: [enemy(0), enemy(1), enemy(2)],
    woman: [woman(0), woman(1), woman(2)], bandit: [bandit(0), bandit(1), bandit(2)],
    key: key(), lock: lock(), car: car(),
    wicon: ['pistol', 'bat', 'smg', 'shotgun', 'blaster', 'flame'].map(wicon),
    coin: coin(),
    home: building(['#ecd9ac', '#d8c089'], ['#5fc77a', '#3c8a57'], 96, 64, true, true),
    house1: building(['#ff9aa2', '#e87f88'], ['#d65a6a', '#b8485a'], 96, 96),
    house2: building(['#9ad0ff', '#7fb6e8'], ['#4f8fd6', '#3f76b8'], 96, 96),
    house3: building(['#ffe08a', '#e8c66e'], ['#e0a72a', '#c2891f'], 96, 96),
  };
})();
