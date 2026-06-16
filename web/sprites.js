// BRIGHT TOP-DOWN sprite set — cheerful sunny daytime, cohesive palette.
(function () {
  let _s = 71717;
  const rnd = () => ((_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const ri = (n) => Math.floor(rnd() * n);
  const P = {
    grass: ['#6cbf4a', '#7fd45c', '#5aad3c', '#8ee06a'],
    hedge: ['#3f9a3c', '#357f33', '#4caf4a'],
    water: ['#3fa9f5', '#56b8ff', '#2f8fd8', '#bfe9ff'],
    sand:  ['#f0d98a', '#e6cb74', '#f7e6a6'],
    leaf:  ['#56b94f', '#43a23d', '#74d06a'],
    bark:  '#9a6a3a',
    wood:  ['#caa15a', '#b3863f', '#dcb877'],
    path:  ['#d9c79a', '#c9b585', '#e8d8af'],
    brick: ['#d98a6a', '#c2745a', '#e8a07e'],
    skin:  '#f2c39a',
    skinSh:'#dca87c',
  };
  function make(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
  function shadow(x, cx, cy, rw, rh) { x.fillStyle = 'rgba(0,0,0,0.16)'; x.beginPath(); x.ellipse(cx, cy, rw, rh, 0, 0, 7); x.fill(); }
  function noise(x, w, h, n, cols, sw) { for (let i = 0; i < n; i++) { x.fillStyle = cols[ri(cols.length)]; x.fillRect(ri(w), ri(h), sw || 1, sw || 1); } }

  function tilemap() {
    const T = 32, N = 8; const [c, x] = make(N * T, T);
    const at = (i, fn) => { x.save(); x.translate(i * T, 0); x.beginPath(); x.rect(0, 0, T, T); x.clip(); fn(); x.restore(); };
    // 0 grass
    at(0, () => { x.fillStyle = P.grass[0]; x.fillRect(0, 0, T, T); for (let i = 0; i < 60; i++) { x.fillStyle = P.grass[1 + ri(3)]; x.fillRect(ri(T), ri(T), 1, 1 + ri(2)); } });
    // 1 hedge (solid bush)
    at(1, () => { x.fillStyle = P.grass[2]; x.fillRect(0, 0, T, T); x.fillStyle = P.hedge[0]; x.fillRect(2, 2, T - 4, T - 4);
      for (let i = 0; i < 40; i++) { x.fillStyle = P.hedge[ri(3)]; x.beginPath(); x.arc(3 + ri(T - 6), 3 + ri(T - 6), 2, 0, 7); x.fill(); }
      x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(2, 2, T - 4, 2); });
    // 2 water
    at(2, () => { const gg = x.createLinearGradient(0, 0, 0, T); gg.addColorStop(0, P.water[2]); gg.addColorStop(1, P.water[0]); x.fillStyle = gg; x.fillRect(0, 0, T, T);
      x.fillStyle = P.water[1]; for (let i = 0; i < 8; i++) x.fillRect(ri(T), ri(T), 5, 1);
      x.fillStyle = P.water[3]; for (let i = 0; i < 5; i++) x.fillRect(ri(T), ri(T), 3, 1); });
    // 3 sand
    at(3, () => { x.fillStyle = P.sand[0]; x.fillRect(0, 0, T, T); noise(x, T, T, 40, P.sand, 2); });
    // 4 tree
    at(4, () => { x.fillStyle = P.grass[0]; x.fillRect(0, 0, T, T); for (let i = 0; i < 18; i++) { x.fillStyle = P.grass[1 + ri(2)]; x.fillRect(ri(T), ri(T), 1, 1); }
      shadow(x, 16, 28, 9, 3); x.fillStyle = P.bark; x.fillRect(14, 18, 4, 11);
      x.fillStyle = P.leaf[1]; x.beginPath(); x.arc(16, 13, 12, 0, 7); x.fill();
      x.fillStyle = P.leaf[0]; x.beginPath(); x.arc(16, 12, 10, 0, 7); x.fill();
      x.fillStyle = P.leaf[2]; x.beginPath(); x.arc(12, 10, 5, 0, 7); x.fill(); x.beginPath(); x.arc(21, 13, 4, 0, 7); x.fill(); });
    // 5 fence
    at(5, () => { x.fillStyle = P.grass[0]; x.fillRect(0, 0, T, T); for (let i = 0; i < 16; i++) { x.fillStyle = P.grass[1 + ri(2)]; x.fillRect(ri(T), ri(T), 1, 1); }
      x.fillStyle = P.wood[1]; x.fillRect(0, 10, T, 3); x.fillRect(0, 21, T, 3);
      x.fillStyle = P.wood[0]; for (const px of [4, 16, 28]) x.fillRect(px, 5, 5, 24);
      x.fillStyle = P.wood[2]; x.fillRect(0, 10, T, 1); x.fillRect(0, 21, T, 1); });
    // 6 brick path
    at(6, () => { x.fillStyle = P.brick[1]; x.fillRect(0, 0, T, T); x.fillStyle = P.brick[0];
      for (let r = 0; r < 4; r++) { const off = (r % 2) * 8; for (let bx = -8; bx < T; bx += 16) x.fillRect(bx + off + 1, r * 8 + 1, 14, 6); }
      x.fillStyle = '#f3e3cf'; for (let r = 0; r <= 4; r++) x.fillRect(0, r * 8, T, 1); });
    // 7 path (warm cobble)
    at(7, () => { x.fillStyle = P.path[1]; x.fillRect(0, 0, T, T);
      for (let r = 0; r < 4; r++) for (let cc = 0; cc < 4; cc++) { const off = (r % 2) * 4; x.fillStyle = P.path[ri(3)]; x.fillRect(cc * 8 + off - 2, r * 8 + 1, 7, 6); }
      x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(0, 0, T, 1); });
    return c;
  }

  // step: 0 idle, 1/2 walk cycle (legs alternate)
  function player(step) {
    const [c, x] = make(24, 32);
    const ll = step === 1 ? 2 : 0, rl = step === 2 ? 2 : 0;
    shadow(x, 12, 30, 8, 3);
    x.fillStyle = '#2f3a55'; x.fillRect(7, 22, 4, 8 - ll); x.fillRect(13, 22, 4, 8 - rl);
    x.fillStyle = '#1c2233'; x.fillRect(6, 29 - ll, 6, 2); x.fillRect(12, 29 - rl, 6, 2);
    x.fillStyle = '#3f6fc4'; x.fillRect(5, 13, 14, 11);                 // denim jacket
    x.fillStyle = '#5a86d8'; x.fillRect(6, 14, 12, 4);
    x.fillStyle = '#e23b4e'; x.fillRect(5, 13, 14, 2);
    x.fillStyle = '#2e539a'; x.fillRect(11, 14, 2, 10);
    x.fillStyle = '#3f6fc4'; x.fillRect(3, 14 + ll, 3, 8); x.fillRect(18, 14 + rl, 3, 8);   // arms swing
    x.fillStyle = P.skin; x.fillRect(3, 21 + ll, 3, 2); x.fillRect(18, 21 + rl, 3, 2);
    x.fillStyle = P.skin; x.fillRect(8, 5, 8, 8); x.fillStyle = P.skinSh; x.fillRect(8, 11, 8, 2);
    x.fillStyle = '#222'; x.fillRect(9, 8, 2, 2); x.fillRect(13, 8, 2, 2);
    x.fillStyle = '#e23b4e'; x.fillRect(11, 0, 2, 6); x.fillRect(9, 2, 2, 4); x.fillRect(13, 2, 2, 4); x.fillRect(7, 3, 2, 3); x.fillRect(15, 3, 2, 3);
    x.fillStyle = '#ff6b78'; x.fillRect(11, 0, 1, 6);
    return c;
  }

  // friendly cartoon zombie — round, goofy; arms/legs wobble per step
  function enemy(step) {
    const [c, x] = make(24, 32);
    const la = step === 1 ? 1 : 0, ra = step === 2 ? 1 : 0;
    shadow(x, 12, 30, 8, 3);
    x.fillStyle = '#6a8f3a'; x.fillRect(7, 22, 4, 8 - la); x.fillRect(13, 23, 4, 7 - ra);
    x.fillStyle = '#7fae4a'; x.fillRect(5, 12, 14, 12);
    x.fillStyle = '#6e9a3f'; x.fillRect(6, 18, 4, 4); x.fillRect(13, 16, 4, 4);
    x.fillStyle = '#8ec257'; x.fillRect(2, 13 + la, 3, 9); x.fillRect(19, 13 + ra, 3, 9);   // arms out, swinging
    x.fillStyle = '#8ec257'; x.fillRect(7, 4, 10, 9);
    x.fillStyle = '#7fae4a'; x.fillRect(7, 11, 10, 2);
    x.fillStyle = '#fff'; x.fillRect(9, 7, 3, 3); x.fillRect(13, 7, 3, 3);
    x.fillStyle = '#222'; x.fillRect(10, 8, 2, 2); x.fillRect(14, 8, 1, 2);
    x.fillStyle = '#3a5a22'; x.fillRect(9, 11, 6, 1);
    x.fillStyle = '#fff'; x.fillRect(10, 11, 1, 1); x.fillRect(13, 11, 1, 1);
    return c;
  }

  function coin() {
    const [c, x] = make(32, 32); x.translate(16, 16);
    shadow(x, 0, 9, 8, 3);
    x.fillStyle = '#e0a72a'; x.beginPath(); x.arc(0, 0, 9, 0, 7); x.fill();
    x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(0, 0, 7, 0, 7); x.fill();
    x.fillStyle = '#e0a72a'; x.font = 'bold 13px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('$', 0, 1);
    x.fillStyle = 'rgba(255,255,255,0.85)'; x.beginPath(); x.arc(-3, -3, 2, 0, 7); x.fill();
    return c;
  }
  function ammo() {
    const [c, x] = make(20, 20);
    shadow(x, 10, 18, 8, 2.5);
    x.fillStyle = P.wood[1]; x.fillRect(2, 4, 16, 14); x.fillStyle = P.wood[2]; x.fillRect(3, 5, 14, 12);
    x.fillStyle = P.wood[1]; x.fillRect(2, 9, 16, 1); x.fillRect(2, 13, 16, 1);
    x.fillStyle = '#ffd23f'; x.fillRect(7, 7, 2, 4); x.fillRect(10, 7, 2, 4);
    return c;
  }

  function building(wall, wallSh, roof, roofSh, w, h, warm) {
    const [c, x] = make(w, h); const top = Math.round(h * 0.30);
    shadow(x, w / 2, h - 4, w * 0.42, 3);
    x.fillStyle = wall; x.fillRect(8, top, w - 16, h - top - 4);
    x.fillStyle = wallSh; x.fillRect(8, h - 14, w - 16, 10);
    x.fillStyle = 'rgba(0,0,0,0.06)'; for (let yy = top + 6; yy < h - 4; yy += 8) x.fillRect(8, yy, w - 16, 1);
    x.fillStyle = roof; x.beginPath(); x.moveTo(2, top + 2); x.lineTo(w / 2, 2); x.lineTo(w - 2, top + 2); x.closePath(); x.fill();
    x.fillStyle = roofSh; x.beginPath(); x.moveTo(w / 2, 2); x.lineTo(w - 2, top + 2); x.lineTo(w / 2, top + 2); x.closePath(); x.fill();
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(8, top, w - 16, 2);
    const dw = Math.round(w * 0.17), dh = Math.round((h - top) * 0.5), dx = (w - dw) / 2, dy = h - dh - 4;
    x.fillStyle = '#7a4a24'; x.fillRect(dx, dy, dw, dh); x.fillStyle = '#8a5a2e'; x.fillRect(dx + 1, dy + 1, dw - 2, dh - 1);
    x.fillStyle = '#ffd23f'; x.fillRect(dx + dw - 4, dy + dh / 2, 2, 2);
    const ww = Math.round(w * 0.14), wy = top + Math.round((h - top) * 0.28);
    for (const wx of [Math.round(w * 0.2), Math.round(w * 0.66)]) {
      x.fillStyle = '#bfe9ff'; x.fillRect(wx, wy, ww, ww);
      if (warm) { x.fillStyle = '#ffe9a8'; x.fillRect(wx, wy, ww, ww); }
      x.fillStyle = 'rgba(120,80,40,0.6)'; x.fillRect(wx + ww / 2 - 1, wy, 1, ww); x.fillRect(wx, wy + ww / 2 - 1, ww, 1);
      x.strokeStyle = '#fff'; x.lineWidth = 1; x.strokeRect(wx + 0.5, wy + 0.5, ww - 1, ww - 1);
    }
    return c;
  }
  function home() {
    const c = building('#fff0cc', '#e9d9a8', '#5fc77a', '#49a862', 96, 64, true);
    const x = c.getContext('2d');
    x.fillStyle = '#e23b5a'; const hx = 48, hy = 22;
    x.beginPath(); x.moveTo(hx, hy + 4); x.bezierCurveTo(hx - 6, hy - 4, hx - 11, hy + 2, hx, hy + 9); x.bezierCurveTo(hx + 11, hy + 2, hx + 6, hy - 4, hx, hy + 4); x.fill();
    return c;
  }

  window.SPRITES = {
    ammo: ammo(), tilemap: tilemap(),
    player: [player(0), player(1), player(2)], enemy: [enemy(0), enemy(1), enemy(2)],
    coin: coin(), home: home(),
    house1: building('#ff9aa2', '#e87f88', '#d65a6a', '#b8485a', 96, 96),
    house2: building('#9ad0ff', '#7fb6e8', '#4f8fd6', '#3f76b8', 96, 96),
    house3: building('#ffe08a', '#e8c66e', '#e0a72a', '#c2891f', 96, 96),
  };
})();
