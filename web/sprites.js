// DARK SURVIVAL PLATFORMER sprite set — side view, grim palette.
(function () {
  let _s = 424242;
  const rnd = () => ((_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const ri = (n) => Math.floor(rnd() * n);
  const P = {
    ink: '#14140f',
    dirt: ['#4a3b28', '#3e3120', '#5a4730', '#352a1c'],
    grass: ['#46582f', '#3a4a26', '#536a38'],
    stone: ['#4f5155', '#3f4145', '#5a5c60'],
    wood: ['#5e4c33', '#4a3a26', '#6e5a3e'],
    brick: ['#5c3a32', '#4a2d27', '#6b463b'],
    metal: ['#8a8d92', '#6a6d72', '#a6a9ad'],
    blood: ['#6e1414', '#8a1a1a', '#4a0d0d'],
    skin: '#c9a98a',
    rot: ['#6f7553', '#828a63', '#5a6044'],
  };

  function make(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x];
  }
  function noise(x, w, h, n, cols, sw) {
    for (let i = 0; i < n; i++) { x.fillStyle = cols[ri(cols.length)]; x.fillRect(ri(w), ri(h), sw || 1, sw || 1); }
  }
  function shadow(x, cx, cy, rw, rh) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.ellipse(cx, cy, rw, rh, 0, 0, 7); x.fill(); }

  // ===== TILES (8 × 32) : 0 air,1 dirt,2 grass-top,3 stone,4 spikes,5 wood,6 brick,7 crate =====
  function tilemap() {
    const T = 32, N = 8; const [c, x] = make(N * T, T);
    const at = (i, fn) => { x.save(); x.translate(i * T, 0); x.beginPath(); x.rect(0, 0, T, T); x.clip(); fn(); x.restore(); };
    // 0 air — leave transparent
    // 1 dirt
    at(1, () => { x.fillStyle = P.dirt[0]; x.fillRect(0, 0, T, T); noise(x, T, T, 36, P.dirt, 2);
      x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(0, 0, T, 2); });
    // 2 grass-topped ground
    at(2, () => { x.fillStyle = P.dirt[0]; x.fillRect(0, 0, T, T); noise(x, T, T, 30, P.dirt, 2);
      x.fillStyle = P.grass[1]; x.fillRect(0, 0, T, 7);
      x.fillStyle = P.grass[0]; x.fillRect(0, 0, T, 4);
      x.fillStyle = P.grass[2]; for (let i = 0; i < 14; i++) x.fillRect(ri(T), ri(3), 1, 2);
      x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, 7, T, 1); });
    // 3 stone
    at(3, () => { x.fillStyle = P.stone[1]; x.fillRect(0, 0, T, T);
      for (let r = 0; r < 4; r++) for (let cc = 0; cc < 2; cc++) { const off = (r % 2) * 8; x.fillStyle = P.stone[ri(3)]; x.fillRect(cc * 16 + off - 6, r * 8 + 1, 14, 6); }
      x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, 0, T, 1); });
    // 4 spikes (transparent bg; metal triangles)
    at(4, () => { x.fillStyle = '#2a2c30'; x.fillRect(2, 26, T - 4, 6);
      for (let i = 0; i < 4; i++) { const bx = i * 8 + 2;
        x.fillStyle = P.metal[1]; x.beginPath(); x.moveTo(bx, 28); x.lineTo(bx + 4, 6); x.lineTo(bx + 8, 28); x.closePath(); x.fill();
        x.fillStyle = P.metal[0]; x.beginPath(); x.moveTo(bx + 4, 6); x.lineTo(bx + 8, 28); x.lineTo(bx + 5, 28); x.closePath(); x.fill(); } });
    // 5 wood platform
    at(5, () => { x.fillStyle = P.wood[1]; x.fillRect(0, 0, T, T);
      x.fillStyle = P.wood[0]; x.fillRect(0, 0, T, 16);
      x.fillStyle = P.wood[2]; x.fillRect(0, 0, T, 2);
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 15, T, 2); x.fillRect(10, 0, 1, T); x.fillRect(22, 0, 1, T); });
    // 6 brick
    at(6, () => { x.fillStyle = P.brick[1]; x.fillRect(0, 0, T, T);
      x.fillStyle = P.brick[0]; for (let r = 0; r < 4; r++) { const off = (r % 2) * 8; for (let bx = -8; bx < T; bx += 16) x.fillRect(bx + off + 1, r * 8 + 1, 14, 6); }
      x.fillStyle = '#2a241d'; for (let r = 0; r <= 4; r++) x.fillRect(0, r * 8, T, 1); });
    // 7 crate
    at(7, () => { x.fillStyle = P.wood[1]; x.fillRect(2, 2, T - 4, T - 4); x.fillStyle = P.wood[2]; x.fillRect(3, 3, T - 6, T - 6);
      x.strokeStyle = P.wood[0]; x.lineWidth = 2; x.strokeRect(3, 3, T - 6, T - 6); x.beginPath(); x.moveTo(3, 3); x.lineTo(T - 3, T - 3); x.moveTo(T - 3, 3); x.lineTo(3, T - 3); x.stroke(); });
    return c;
  }

  // ===== PLAYER 24×32 — side profile, hooded survivor, faces RIGHT (flipped in code) =====
  function player() {
    const [c, x] = make(24, 32);
    shadow(x, 11, 30, 8, 3);
    // back leg + front leg
    x.fillStyle = '#23252b'; x.fillRect(7, 22, 4, 8); x.fillRect(12, 22, 4, 8);
    x.fillStyle = P.ink; x.fillRect(6, 29, 6, 2); x.fillRect(11, 29, 7, 2);
    // coat (longer at back)
    x.fillStyle = '#2e3138'; x.fillRect(5, 12, 12, 13);
    x.fillStyle = '#3a3e47'; x.fillRect(5, 12, 12, 2);
    x.fillStyle = '#262931'; x.fillRect(5, 20, 12, 5);
    // forward arm (toward right)
    x.fillStyle = '#2e3138'; x.fillRect(13, 15, 8, 4);
    x.fillStyle = P.skin; x.fillRect(20, 15, 2, 3);
    // head + hood facing right
    x.fillStyle = '#34373f'; x.fillRect(8, 3, 11, 10);
    x.fillStyle = '#171a1f'; x.fillRect(14, 6, 5, 5);                 // shadowed face
    x.fillStyle = '#d8e8ff'; x.fillRect(17, 8, 1, 1);                 // eye
    x.fillStyle = '#3a3e47'; x.fillRect(8, 2, 9, 2);                  // hood crown
    x.fillStyle = P.skin; x.fillRect(18, 9, 1, 2);                    // chin
    return c;
  }

  // ===== ZOMBIE 24×32 — side profile, hunched, faces RIGHT =====
  function enemy() {
    const [c, x] = make(24, 32);
    shadow(x, 11, 30, 8, 3);
    x.fillStyle = '#2f3422'; x.fillRect(6, 22, 4, 8); x.fillRect(12, 23, 4, 7);
    x.fillStyle = '#4a503a'; x.fillRect(5, 13, 11, 11);
    x.fillStyle = P.blood[2]; x.fillRect(7, 16, 4, 5);
    // outstretched arm forward
    x.fillStyle = P.rot[0]; x.fillRect(14, 14, 9, 4); x.fillStyle = P.rot[2]; x.fillRect(21, 14, 2, 4);
    // hunched head, low + forward
    x.fillStyle = P.rot[0]; x.fillRect(11, 6, 9, 8);
    x.fillStyle = P.rot[2]; x.fillRect(11, 12, 9, 2);
    x.fillStyle = P.blood[0]; x.fillRect(11, 6, 3, 3);
    x.fillStyle = '#d83b2e'; x.fillRect(16, 9, 2, 2);                 // eye
    x.fillStyle = '#1a0f0a'; x.fillRect(14, 12, 5, 1);
    x.fillStyle = '#2a2418'; x.fillRect(11, 5, 8, 2);
    return c;
  }

  function coin() {
    const [c, x] = make(24, 24); x.translate(12, 12);
    shadow(x, 0, 8, 7, 2.5);
    x.fillStyle = '#8a6a14'; x.beginPath(); x.arc(0, 0, 8, 0, 7); x.fill();
    x.fillStyle = '#d4af37'; x.beginPath(); x.arc(0, 0, 6, 0, 7); x.fill();
    x.fillStyle = '#a8862a'; x.font = 'bold 11px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('$', 0, 1);
    x.fillStyle = 'rgba(255,240,200,0.6)'; x.fillRect(-3, -4, 2, 2);
    return c;
  }
  function ammo() {
    const [c, x] = make(22, 16);
    shadow(x, 11, 15, 9, 2);
    x.fillStyle = '#3e4636'; x.fillRect(1, 2, 20, 12);
    x.fillStyle = '#4a5340'; x.fillRect(2, 3, 18, 10);
    x.fillStyle = '#2f362a'; x.fillRect(1, 8, 20, 1);
    x.fillStyle = '#d4af37'; x.fillRect(7, 5, 2, 4); x.fillRect(11, 5, 2, 4);
    return c;
  }
  function medkit() {
    const [c, x] = make(20, 16);
    shadow(x, 10, 15, 8, 2);
    x.fillStyle = '#d8d2c4'; x.fillRect(1, 2, 18, 12);
    x.fillStyle = '#b7b0a0'; x.fillRect(1, 11, 18, 3);
    x.fillStyle = '#c0392b'; x.fillRect(8, 4, 4, 9); x.fillRect(5, 6, 10, 4);  // red cross
    return c;
  }
  function flag() {
    const [c, x] = make(28, 64);
    x.fillStyle = '#3a3f44'; x.fillRect(4, 4, 3, 58);              // pole
    x.fillStyle = '#6a7' ; x.fillStyle = '#3ad17a';
    x.beginPath(); x.moveTo(7, 6); x.lineTo(26, 13); x.lineTo(7, 20); x.closePath(); x.fill();
    x.fillStyle = 'rgba(58,209,122,0.3)'; x.beginPath(); x.moveTo(7, 6); x.lineTo(26, 13); x.lineTo(7, 20); x.closePath(); x.fill();
    x.fillStyle = '#1f6e44'; x.fillRect(7, 6, 2, 14);
    x.fillStyle = '#9affc4'; x.fillRect(4, 4, 3, 2);
    return c;
  }

  window.SPRITES = {
    tilemap: tilemap(), player: player(), enemy: enemy(), coin: coin(),
    ammo: ammo(), medkit: medkit(), flag: flag(),
  };
})();
