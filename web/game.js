// PUNK TOWN — bright top-down shooter. Collect 15 coins, dodge/blast goofy
// zombies, heal at home. Sunny, friendly atmosphere (no horror).

const VIEW_W = 760, VIEW_H = 600;
const TS = LEVEL.tileSize;
const COLS = LEVEL.width / TS, ROWS = LEVEL.height / TS;
const LW = LEVEL.width, LH = LEVEL.height;
const WINCOINS = 15;

const SPEED = 110, RUN_MULT = 1.8;
const STAM_MAX = 100, STAM_DRAIN = 32, STAM_REGEN = 10, STAM_REGEN_HOME = 50;
const ZSPEED = 48, ZCHASE = 80;
const ZHP = 4, LOOT_CHANCE = 0.3;
const MAX_ZOMBIES = 22, RESPAWN_EVERY = 3.0;
const WEAPONS = [
  { name: 'Пістолет',  dmg: 1, rate: 0.30, mag: 12, speed: 500, pellets: 1, spread: 0,    color: '#ffd23f' },
  { name: 'Автомат',   dmg: 1, rate: 0.08, mag: 30, speed: 560, pellets: 1, spread: 0.06, color: '#56b8ff' },
  { name: 'Дробовик',  dmg: 2, rate: 0.75, mag: 6,  speed: 460, pellets: 6, spread: 0.40, color: '#ff9a4d' },
  { name: 'Бластер',   dmg: 6, rate: 0.55, mag: 8,  speed: 820, pellets: 1, spread: 0,    color: '#c46bff' },
];
const WALKABLE = new Set([0, 3, 7]);   // grass, sand, path

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const IMG = SPRITES;

// ---- tiles ----
const tileIdx = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
const solid = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
for (const [x, y, idx] of LEVEL.tiles) { const c = x / TS, r = y / TS; if (r >= 0 && r < ROWS && c >= 0 && c < COLS) { tileIdx[r][c] = idx; solid[r][c] = !WALKABLE.has(idx); } }
function boxSolid(px, py, w, h) {
  const c0 = Math.floor(px / TS), c1 = Math.floor((px + w - 1) / TS), r0 = Math.floor(py / TS), r1 = Math.floor((py + h - 1) / TS);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (c < 0 || r < 0 || c >= COLS || r >= ROWS || solid[r][c]) return true;
  return false;
}
const tileAt = (px, py) => { const c = Math.floor(px / TS), r = Math.floor(py / TS); return (c < 0 || r < 0 || c >= COLS || r >= ROWS) ? -1 : tileIdx[r][c]; };

// ---- entities ----
const player = { x: LEVEL.playerStart[0], y: LEVEL.playerStart[1], w: 18, h: 22, walkT: 0, frame: 0 };
const zombies = LEVEL.zombies.map(([x, y]) => mkZombie(x, y));
function mkZombie(x, y) { return { x, y, w: 18, h: 22, vx: 0, vy: 0, t: 0, hp: ZHP, flash: 0, frame: 0 }; }
let coins = LEVEL.coins.map(([x, y]) => ({ x, y }));
const homes = LEVEL.homes.map(([x, y]) => ({ x, y }));
const houseImgs = [IMG.house1, IMG.house2, IMG.house3];
let hs = 9; const h3 = () => (hs = (hs * 1103515245 + 12345) & 0x7fffffff) % 3;
const houses = LEVEL.houses.map(([x, y]) => ({ x, y, img: houseImgs[h3()] }));

// reachability mask (only tiles the player can actually walk to)
const reach = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
for (const [c, r] of (LEVEL.reach || [])) if (r >= 0 && r < ROWS && c >= 0 && c < COLS) reach[r][c] = true;
const reachable = (c, r) => (LEVEL.reach ? !!reach[r] && reach[r][c] : !solid[r][c]);

// ammo crates on random reachable, open tiles (never inside enclosed/unreachable spots)
let aSeed = 777; const ar = () => (aSeed = (aSeed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
let ammoCrates = [];
{ let tries = 0; while (ammoCrates.length < 10 && tries++ < 3000) { const c = 1 + Math.floor(ar() * (COLS - 2)), r = 1 + Math.floor(ar() * (ROWS - 2)); const wx = c * TS, wy = r * TS; if (Math.abs(wx - player.x) < 100 && Math.abs(wy - player.y) < 100) continue; if (reachable(c, r) && ammoCrates.every(a => Math.abs(a.x - wx) > 140 || Math.abs(a.y - wy) > 140)) ammoCrates.push({ x: wx + 6, y: wy + 6, w: 20, h: 20 }); } }

let health = 100, lives = 3, totalCoins = 0, kills = 0, state = 'menu', stamina = STAM_MAX, animClock = 0, respawnT = RESPAWN_EVERY;
const reachCells = (LEVEL.reach || []).filter(([c, r]) => r >= 0 && r < ROWS && c >= 0 && c < COLS && !solid[r][c]);
let curW = 0; const owned = [true, false, false, false]; const wAmmo = WEAPONS.map(w => w.mag);
const bullets = [], loot = [], particles = [];
let fireCD = 0, hurtFlash = 0, shakeT = 0, invuln = 0, hitCD = 0, healT = 0, dustT = 0;
let toast = '', toastT = 0; const face = { x: 1, y: 0 };
const cam = { x: 0, y: 0 };
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
let seed = 555; const sr = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

// ---- input ----
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (state === 'menu' && (e.code === 'Space' || e.code === 'Enter')) startGame();
  else if ((state === 'win' || state === 'gameover') && e.code === 'KeyR') location.reload();
  else if (e.code === 'Escape' && state === 'play') { state = 'paused'; AUDIO.stopMusic(); }
  else if (e.code === 'Escape' && state === 'paused') { state = 'play'; AUDIO.startMusic(); }
  if (e.code === 'KeyM') { const on = AUDIO.toggleMusic(); showToast(on ? '♪ музика увімкнена' : '♪ музика вимкнена'); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
const mouse = { x: VIEW_W / 2, y: VIEW_H / 2, down: false, moved: false };
canvas.addEventListener('mousemove', e => { const r = canvas.getBoundingClientRect(); mouse.x = (e.clientX - r.left) * (canvas.width / r.width); mouse.y = (e.clientY - r.top) * (canvas.height / r.height); mouse.moved = true; });
canvas.addEventListener('mousedown', () => { canvas.focus(); if (state === 'menu') { startGame(); return; } if (state === 'play') mouse.down = true; });

function startGame() { state = 'play'; AUDIO.start(); AUDIO.startMusic(); }
addEventListener('mouseup', () => { mouse.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.tabIndex = 0; canvas.style.outline = 'none'; canvas.focus();

const aabb = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
function showToast(m) { toast = m; toastT = 2.0; }
function spawnBurst(cx, cy, color, n, sMax, size, grav) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = 40 + Math.random() * sMax; particles.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.3, max: 0.7, color, size, grav: grav || 0 }); } }

function tryMove(e, dx, dy) {
  e.x += dx; if (boxSolid(e.x, e.y, e.w, e.h)) e.x -= dx;
  e.y += dy; if (boxSolid(e.x, e.y, e.w, e.h)) e.y -= dy;
  e.x = clamp(e.x, 0, LW - e.w); e.y = clamp(e.y, 0, LH - e.h);
}
function hurt(dmg) {
  if (invuln > 0) return;
  health -= dmg; hurtFlash = Math.min(1, hurtFlash + 0.35); shakeT = 0.16; invuln = 0.7; AUDIO.sfx.hurt();
  if (health <= 0) { lives--; if (lives <= 0) { state = 'gameover'; AUDIO.stopMusic(); AUDIO.sfx.lose(); return; } health = 100; player.x = LEVEL.playerStart[0]; player.y = LEVEL.playerStart[1]; invuln = 1.2; }
}
function fire(dx, dy) {
  const w = WEAPONS[curW]; const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m; face.x = dx; face.y = dy; wAmmo[curW]--;
  const base = Math.atan2(dy, dx), mx = player.x + player.w / 2 + dx * 12, my = player.y + player.h / 2 + dy * 12;
  for (let p = 0; p < w.pellets; p++) { const a = base + (w.pellets > 1 ? (Math.random() - 0.5) * w.spread * 2 : (Math.random() - 0.5) * w.spread); bullets.push({ x: mx, y: my, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, life: 1.0, dmg: w.dmg, color: w.color }); }
  spawnBurst(mx, my, '#fff2a8', 3, 50, 2); shakeT = Math.max(shakeT, w.pellets > 1 ? 0.1 : 0.04);
  AUDIO.sfx.shoot(curW);
}
function dropLoot(z) { if (sr() > LOOT_CHANCE) return; loot.push({ x: z.x, y: z.y, w: 22, h: 18, weapon: 1 + Math.floor(sr() * 3) }); }
function pickDir(z) { const a = Math.random() * 6.283; z.vx = Math.cos(a) * ZSPEED; z.vy = Math.sin(a) * ZSPEED; z.t = 0.6 + Math.random() * 1.2; }
function respawnZombie() {
  if (zombies.length >= MAX_ZOMBIES || !reachCells.length) return;
  for (let i = 0; i < 12; i++) {
    const [c, r] = reachCells[Math.floor(sr() * reachCells.length)]; const wx = c * TS, wy = r * TS;
    const onScreen = wx > cam.x - 40 && wx < cam.x + VIEW_W + 40 && wy > cam.y - 40 && wy < cam.y + VIEW_H + 40;
    if (!onScreen && Math.hypot(wx - player.x, wy - player.y) > 220) { zombies.push(mkZombie(wx, wy)); return; }
  }
}

// ================= UPDATE =================
function update(dt) {
  animClock += dt;
  if (state !== 'play') return;
  dt = Math.min(dt, 0.033);

  // movement
  let ix = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  let iy = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
  const moving = ix || iy;
  if (ix && iy) { const k = 0.7071; ix *= k; iy *= k; }
  if (moving) { face.x = ix || face.x; face.y = iy || face.y; if (ix || iy) { const m = Math.hypot(ix, iy) || 1; face.x = ix / m; face.y = iy / m; } }
  const running = (keys.ShiftLeft || keys.ShiftRight) && stamina > 0 && moving;
  const onSand = tileAt(player.x + player.w / 2, player.y + player.h / 2) === 3;
  const sp = SPEED * (running ? RUN_MULT : 1) * (onSand ? 0.5 : 1) * dt;
  tryMove(player, ix * sp, iy * sp);
  if (moving) { player.walkT += dt * (running ? 1.5 : 1); player.frame = 1 + (Math.floor(player.walkT * 9) % 2); } else { player.frame = 0; }

  // dust on sand
  dustT -= dt;
  if (onSand && moving && dustT <= 0) { particles.push({ x: player.x + player.w / 2 + (Math.random() * 10 - 5), y: player.y + player.h, vx: Math.random() * 20 - 10, vy: -10 - Math.random() * 15, life: 0.4, max: 0.4, color: '#f0d98a', size: 2, grav: 60 }); dustT = running ? 0.06 : 0.12; }

  // shooting
  fireCD -= dt;
  for (let i = 0; i < WEAPONS.length; i++) if (keys['Digit' + (i + 1)] && owned[i]) curW = i;
  if (fireCD <= 0 && wAmmo[curW] > 0) {
    if (mouse.down) { fire(mouse.x + cam.x - (player.x + player.w / 2), mouse.y + cam.y - (player.y + player.h / 2)); fireCD = WEAPONS[curW].rate; }
    else if (keys.KeyF) { fire(face.x, face.y); fireCD = WEAPONS[curW].rate; }
  }

  // bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || boxSolid(b.x - 1, b.y - 1, 2, 2) || b.x < 0 || b.x > LW || b.y < 0 || b.y > LH) { bullets.splice(i, 1); continue; }
    for (let j = zombies.length - 1; j >= 0; j--) { const z = zombies[j]; if (b.x >= z.x && b.x <= z.x + z.w && b.y >= z.y && b.y <= z.y + z.h) {
      z.hp -= b.dmg; z.flash = 0.12; z.x += Math.sign(b.vx) * 1.2;
      if (z.hp <= 0) { spawnBurst(z.x + 9, z.y + 11, '#8ec257', 16, 170, 3); spawnBurst(z.x + 9, z.y + 11, '#ffffff', 6, 120, 2); dropLoot(z); zombies.splice(j, 1); kills++; AUDIO.sfx.zombie(); }
      else spawnBurst(b.x, b.y, '#8ec257', 5, 80, 2);
      bullets.splice(i, 1); break;
    } }
  }

  // zombie respawn (keeps the town populated)
  respawnT -= dt; if (respawnT <= 0) { respawnT = RESPAWN_EVERY; respawnZombie(); }

  // zombies (roam + chase)
  for (const z of zombies) {
    z.flash = Math.max(0, z.flash - dt);
    z.frame = 1 + (Math.floor(animClock * 8 + z.x * 0.05) % 2);
    const zx = z.x + z.w / 2, zy = z.y + z.h / 2, px = player.x + player.w / 2, py = player.y + player.h / 2;
    const d = Math.hypot(px - zx, py - zy);
    if (d < 220) { const m = d || 1; z.vx = (px - zx) / m * ZCHASE; z.vy = (py - zy) / m * ZCHASE; }
    else { z.t -= dt; if (z.t <= 0) pickDir(z); }
    tryMove(z, z.vx * dt, z.vy * dt);
    if (aabb(player.x, player.y, player.w, player.h, z.x, z.y, z.w, z.h)) hurt(16);
  }

  // home heal
  let onHome = false;
  for (const hm of homes) if (aabb(player.x, player.y, player.w, player.h, hm.x - 16, hm.y - 40, 96 + 32, 112)) {
    onHome = true; if (health < 100) { health = Math.min(100, health + 60 * dt); } for (let i = 0; i < WEAPONS.length; i++) if (owned[i]) wAmmo[i] = WEAPONS[i].mag;
    healT -= dt; if (healT <= 0 && health < 100) { particles.push({ x: player.x + 9 + (Math.random() * 20 - 10), y: player.y + player.h, vx: Math.random() * 14 - 7, vy: -28, life: 0.6, max: 0.6, color: '#7dff9a', size: 3, grav: -10 }); healT = 0.14; }
  }
  stamina = clamp(stamina + (running ? -STAM_DRAIN : (onHome ? STAM_REGEN_HOME : STAM_REGEN)) * dt, 0, STAM_MAX);

  // pickups
  coins = coins.filter(co => { if (aabb(player.x, player.y, player.w, player.h, co.x - 10, co.y - 10, 28, 28)) { totalCoins++; spawnBurst(co.x, co.y, '#ffd23f', 8, 80, 2); AUDIO.sfx.coin(); if (totalCoins >= WINCOINS) { state = 'win'; AUDIO.stopMusic(); AUDIO.sfx.win(); } return false; } return true; });
  ammoCrates = ammoCrates.filter(a => { if (wAmmo[curW] < WEAPONS[curW].mag && aabb(player.x, player.y, player.w, player.h, a.x, a.y, a.w, a.h)) { wAmmo[curW] = WEAPONS[curW].mag; spawnBurst(a.x + 10, a.y + 8, '#ffd23f', 8, 90, 2); AUDIO.sfx.pickup(); showToast('+ набої'); return false; } return true; });
  for (let i = loot.length - 1; i >= 0; i--) { const a = loot[i]; if (aabb(player.x, player.y, player.w, player.h, a.x, a.y, a.w, a.h)) {
    const onlyPistol = owned[0] && !owned[1] && !owned[2] && !owned[3];   // still on the starter pistol?
    owned[a.weapon] = true; wAmmo[a.weapon] = WEAPONS[a.weapon].mag;
    if (onlyPistol) curW = a.weapon;                                       // auto-equip only the first real weapon
    spawnBurst(a.x + 11, a.y + 9, WEAPONS[a.weapon].color, 14, 130, 3); AUDIO.sfx.pickup();
    showToast('Нова зброя: ' + WEAPONS[a.weapon].name + (onlyPistol ? '!' : ' (натисни ' + (a.weapon + 1) + ')'));
    loot.splice(i, 1);
  } }

  // timers + particles
  hurtFlash = Math.max(0, hurtFlash - dt * 1.5); shakeT = Math.max(0, shakeT - dt); invuln = Math.max(0, invuln - dt); toastT = Math.max(0, toastT - dt);
  for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.vy += (p.grav || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) particles.splice(i, 1); }

  cam.x = clamp(player.x + player.w / 2 - VIEW_W / 2, 0, LW - VIEW_W);
  cam.y = clamp(player.y + player.h / 2 - VIEW_H / 2, 0, LH - VIEW_H);
}

// ================= RENDER =================
function spr(img, x, y) { ctx.drawImage(img, Math.round(x - cam.x), Math.round(y - cam.y)); }
function draw() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (state === 'menu') { drawMenu(); return; }
  const bx = cam.x, by = cam.y;
  if (shakeT > 0) { const m = 5 * (shakeT / 0.16); cam.x += (Math.random() * 2 - 1) * m; cam.y += (Math.random() * 2 - 1) * m; }

  const c0 = Math.max(0, Math.floor(cam.x / TS)), c1 = Math.min(COLS - 1, Math.floor((cam.x + VIEW_W) / TS));
  const r0 = Math.max(0, Math.floor(cam.y / TS)), r1 = Math.min(ROWS - 1, Math.floor((cam.y + VIEW_H) / TS));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) ctx.drawImage(IMG.tilemap, tileIdx[r][c] * TS, 0, TS, TS, Math.round(c * TS - cam.x), Math.round(r * TS - cam.y), TS, TS);

  for (const h of houses) spr(h.img, h.x, h.y);
  for (const hm of homes) spr(IMG.home, hm.x, hm.y - 32);
  for (const co of coins) spr(IMG.coin, co.x - 10, co.y - 10 + Math.sin(animClock * 3 + co.x) * 2);
  for (const a of ammoCrates) spr(IMG.ammo, a.x, a.y + Math.sin(animClock * 3 + a.x) * 1.5);
  for (const a of loot) { const lx = Math.round(a.x - cam.x), ly = Math.round(a.y - cam.y + Math.sin(animClock * 4 + a.x) * 2); ctx.fillStyle = WEAPONS[a.weapon].color; ctx.globalAlpha = .35; ctx.fillRect(lx - 3, ly - 3, a.w + 6, a.h + 6); ctx.globalAlpha = 1; ctx.fillStyle = '#8a5a2e'; ctx.fillRect(lx, ly, a.w, a.h); ctx.fillStyle = WEAPONS[a.weapon].color; ctx.fillRect(lx + 3, ly + 6, a.w - 6, 4); }

  for (const z of zombies) { spr(IMG.enemy[z.frame], z.x - 3, z.y - 8); if (z.flash > 0) { ctx.globalAlpha = z.flash / 0.12 * 0.7; ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(z.x - 3 - cam.x), Math.round(z.y - 8 - cam.y), 24, 32); ctx.globalAlpha = 1; } if (z.hp < ZHP) { const hx = Math.round(z.x - cam.x), hy = Math.round(z.y - 12 - cam.y); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(hx, hy, z.w, 3); ctx.fillStyle = '#6fd14a'; ctx.fillRect(hx, hy, z.w * z.hp / ZHP, 3); } }

  if (!(invuln > 0 && Math.floor(invuln * 20) % 2 === 0)) spr(IMG.player[player.frame], player.x - 3, player.y - 8);
  // gun
  { const pcx = player.x + player.w / 2 - cam.x, pcy = player.y + player.h / 2 - cam.y; let ang = Math.atan2(face.y, face.x); if (mouse.moved) ang = Math.atan2((mouse.y + cam.y) - (player.y + player.h / 2), (mouse.x + cam.x) - (player.x + player.w / 2)); ctx.save(); ctx.translate(Math.round(pcx), Math.round(pcy)); ctx.rotate(ang); ctx.fillStyle = '#333'; ctx.fillRect(4, -2, 12, 4); ctx.fillStyle = '#555'; ctx.fillRect(2, -3, 5, 6); ctx.restore(); }

  for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x - cam.x - p.size / 2), Math.round(p.y - cam.y - p.size / 2), p.size, p.size); }
  ctx.globalAlpha = 1;

  cam.x = bx; cam.y = by;
  drawAtmosphere(); drawBullets();
  if (hurtFlash > 0) { ctx.fillStyle = 'rgba(255,40,40,' + (0.35 * hurtFlash).toFixed(3) + ')'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  drawHomeIndicator(); drawHUD();
  if (state === 'paused') drawPause();
  else if (state !== 'play') drawOverlay();
}

function drawMenu() {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H); g.addColorStop(0, '#aee6ff'); g.addColorStop(1, '#cdeeb0');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // floating coins decoration
  for (let i = 0; i < 6; i++) { const cx = 120 + i * 100, cy = 120 + Math.sin(animClock * 2 + i) * 14; ctx.drawImage(IMG.coin, cx - 16, cy - 16); }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 66px Calibri,sans-serif'; ctx.fillText('☀ PUNK TOWN', VIEW_W / 2 + 2, VIEW_H / 2 - 58);
  ctx.fillStyle = '#3f8f3a'; ctx.fillText('☀ PUNK TOWN', VIEW_W / 2, VIEW_H / 2 - 60);
  ctx.fillStyle = '#4a5a38'; ctx.font = '20px Calibri,sans-serif';
  ctx.fillText('Збери 15 монет ★, відстрілюй зомбі, лікуйся вдома', VIEW_W / 2, VIEW_H / 2 - 14);
  const blink = 0.5 + 0.5 * Math.sin(animClock * 4);
  ctx.globalAlpha = 0.5 + 0.5 * blink; ctx.fillStyle = '#e8932a'; ctx.font = 'bold 28px Calibri,sans-serif';
  ctx.fillText('Натисни ПРОБІЛ або клікни, щоб почати', VIEW_W / 2, VIEW_H / 2 + 36); ctx.globalAlpha = 1;
  ctx.fillStyle = '#5a6a48'; ctx.font = '15px Calibri,sans-serif';
  ctx.fillText('WASD/стрілки — рух · Shift — біг · миша/F — стрілянина · 1-4 — зброя · Esc — пауза · M — музика', VIEW_W / 2, VIEW_H - 40);
  ctx.textAlign = 'left';
}

function drawPause() {
  ctx.fillStyle = 'rgba(20,30,15,0.55)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 56px Calibri,sans-serif';
  ctx.fillText('ПАУЗА', VIEW_W / 2, VIEW_H / 2 - 10);
  ctx.font = '22px Calibri,sans-serif'; ctx.fillText('Esc — продовжити', VIEW_W / 2, VIEW_H / 2 + 34);
  ctx.textAlign = 'left';
}

function drawBullets() { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const b of bullets) { const bx = b.x - cam.x, by = b.y - cam.y; const gg = ctx.createRadialGradient(bx, by, 0, bx, by, 9); gg.addColorStop(0, b.color); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = .45; ctx.fillStyle = gg; ctx.fillRect(bx - 9, by - 9, 18, 18); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 2, 0, 7); ctx.fill(); } ctx.restore(); }

function drawAtmosphere() {
  // warm sunlight wash from the top (screen blend keeps it bright)
  ctx.save(); ctx.globalCompositeOperation = 'soft-light';
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H); g.addColorStop(0, 'rgba(255,240,200,0.5)'); g.addColorStop(1, 'rgba(255,250,230,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H); ctx.restore();
  // floating pollen motes drifting gently
  ctx.fillStyle = 'rgba(255,255,235,0.55)';
  for (let i = 0; i < 22; i++) { const t = animClock * (6 + (i % 4) * 2); const x = ((i * 137 + t) % (VIEW_W + 40)) - 20; const y = ((i * 251 + Math.sin(animClock * 0.6 + i) * 18) % VIEW_H + VIEW_H) % VIEW_H; ctx.globalAlpha = 0.3 + 0.3 * Math.sin(animClock * 2 + i); ctx.fillRect(x, y, 2, 2); }
  ctx.globalAlpha = 1;
  // very soft, light vignette for framing (not dark/scary)
  const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H / 2, VIEW_W / 2, VIEW_H / 2, VIEW_W / 1.05); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,30,10,0.22)'); ctx.fillStyle = v; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function drawHomeIndicator() {
  if (!homes.length) return; const hm = homes[0]; const hx = hm.x + 48, hy = hm.y; const sx = hx - cam.x, sy = hy - cam.y;
  const pulse = 0.5 + 0.5 * Math.sin(animClock * 4); ctx.save(); ctx.textAlign = 'center';
  if (sx >= 10 && sx <= VIEW_W - 10 && sy >= 50 && sy <= VIEW_H - 10) {
    ctx.strokeStyle = 'rgba(95,224,122,' + (0.55 + 0.4 * pulse) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy - 46, 12 + pulse * 5, 0, 7); ctx.stroke();
    ctx.fillStyle = '#3fbf60'; ctx.beginPath(); ctx.moveTo(sx - 7, sy - 34); ctx.lineTo(sx + 7, sy - 34); ctx.lineTo(sx, sy - 26); ctx.closePath(); ctx.fill();
    ctx.font = 'bold 14px Calibri,sans-serif'; ctx.fillText('ДІМ', sx, sy - 62);
  } else {
    const ccx = VIEW_W / 2, ccy = (VIEW_H + 50) / 2; const ang = Math.atan2(hy - (cam.y + VIEW_H / 2), hx - (cam.x + VIEW_W / 2)); const dx = Math.cos(ang), dy = Math.sin(ang);
    const halfW = VIEW_W / 2 - 34, halfH = (VIEW_H - 50) / 2 - 34; const scale = Math.min(halfW / (Math.abs(dx) || 1e-6), halfH / (Math.abs(dy) || 1e-6));
    const ex = ccx + dx * scale, ey = ccy + dy * scale; const dist = Math.round(Math.hypot(hx - (player.x + 9), hy - (player.y + 11)));
    ctx.translate(ex, ey); ctx.rotate(ang); ctx.fillStyle = '#3fbf60'; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-6, -9); ctx.lineTo(-6, 9); ctx.closePath(); ctx.fill(); ctx.rotate(-ang);
    ctx.fillStyle = '#bff5cc'; ctx.font = 'bold 11px Calibri,sans-serif'; ctx.fillText('ДІМ ' + dist, 0, -16);
  }
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = 'rgba(255,252,240,0.86)'; ctx.fillRect(0, 0, VIEW_W, 40);
  ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(0, 39, VIEW_W, 2);
  // health + stamina — identical size bars
  ctx.lineWidth = 2; ctx.strokeStyle = '#7a5';
  ctx.strokeRect(14, 7, 190, 11);
  ctx.fillStyle = health > 60 ? '#4caf50' : health > 30 ? '#ffa726' : '#ef5350'; ctx.fillRect(15, 8, health / 100 * 188, 9);
  ctx.strokeStyle = '#7a5'; ctx.strokeRect(14, 22, 190, 11);
  ctx.fillStyle = stamina > 25 ? '#42a5f5' : '#ab47bc'; ctx.fillRect(15, 23, stamina / 100 * 188, 9);
  ctx.textBaseline = 'middle'; ctx.fillStyle = '#5a4a32'; ctx.font = 'bold 18px Calibri,sans-serif';
  ctx.fillText('♥' + lives, 214, 16);
  const w = WEAPONS[curW]; ctx.font = 'bold 14px Calibri,sans-serif'; ctx.fillStyle = '#7a5a2a'; ctx.fillText(w.name, 260, 12);
  ctx.fillStyle = wAmmo[curW] > 0 ? '#c79a1a' : '#d33'; ctx.fillText('⦿' + wAmmo[curW] + '/' + w.mag, 260, 28);
  // coins: coin icon + count
  ctx.drawImage(IMG.coin, VIEW_W - 108, 0, 22, 22);
  ctx.textAlign = 'left'; ctx.font = 'bold 20px Calibri,sans-serif'; ctx.fillStyle = '#c79a1a'; ctx.fillText(totalCoins + '/' + WINCOINS, VIEW_W - 84, 12);
  ctx.textAlign = 'right'; ctx.font = 'bold 14px Calibri,sans-serif'; ctx.fillStyle = '#6a8f3a'; ctx.fillText('☠ ' + kills, VIEW_W - 14, 30); ctx.textAlign = 'left';
  ctx.font = '10px Calibri,sans-serif';
  for (let i = 0; i < 4; i++) { const sx = 430 + i * 60; ctx.globalAlpha = owned[i] ? 1 : .3; ctx.fillStyle = i === curW ? WEAPONS[i].color : 'rgba(0,0,0,.1)'; ctx.fillRect(sx, 26, 56, 12); ctx.fillStyle = i === curW ? '#fff' : '#777'; ctx.textAlign = 'center'; ctx.fillText((i + 1) + ' ' + WEAPONS[i].name, sx + 28, 32); ctx.globalAlpha = 1; }
  ctx.textAlign = 'left';
  if (toastT > 0) { ctx.globalAlpha = Math.min(1, toastT); ctx.font = 'bold 22px Calibri,sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(toast, VIEW_W / 2 + 1, 71); ctx.fillStyle = '#e8932a'; ctx.fillText(toast, VIEW_W / 2, 70); ctx.textAlign = 'left'; ctx.globalAlpha = 1; }
}

function drawOverlay() {
  ctx.fillStyle = state === 'win' ? 'rgba(40,80,40,0.55)' : 'rgba(60,30,30,0.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center'; ctx.fillStyle = state === 'win' ? '#aef5b0' : '#ff9a9a'; ctx.font = 'bold 60px Calibri,sans-serif';
  ctx.fillText(state === 'win' ? 'ПЕРЕМОГА!' : 'ГРУ ЗАВЕРШЕНО', VIEW_W / 2, VIEW_H / 2 - 16);
  ctx.fillStyle = '#fff'; ctx.font = '22px Calibri,sans-serif';
  ctx.fillText((state === 'win' ? 'Зібрано всі монети! Вбито: ' + kills : 'Спробуй ще') + '   —   R: спочатку', VIEW_W / 2, VIEW_H / 2 + 34);
  ctx.textAlign = 'left';
}

let last = 0;
function frame(t) { const dt = Math.min((t - last) / 1000, 0.05); last = t; update(dt); draw(); requestAnimationFrame(frame); }
requestAnimationFrame(t => { last = t; frame(t); });
