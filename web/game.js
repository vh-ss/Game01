// PUNK TOWN — bright top-down shooter. Collect 15 coins, dodge/blast goofy
// zombies, heal at home. Sunny, friendly atmosphere (no horror).

const LEVEL = genWorld();   // fresh procedural town every run/restart
const VIEW_W = 760, VIEW_H = 600;
const TS = LEVEL.tileSize;
const COLS = LEVEL.width / TS, ROWS = LEVEL.height / TS;
const LW = LEVEL.width, LH = LEVEL.height;
const WINCOINS = 15;

const SPEED = 110, RUN_MULT = 1.8;
const STAM_MAX = 100, STAM_DRAIN = 32, STAM_REGEN = 10, STAM_REGEN_HOME = 50;
const ZSPEED = 48, ZCHASE = 80;
const ZHP = 4, LOOT_CHANCE = 0.3;
const MAX_ZOMBIES = 44, RESPAWN_EVERY = 2.2;
// some zombies are armed (different guns); each fires single shots — max 1 bullet in flight
const ARMED_CHANCE = 0.3;
const ZWEAPONS = [
  { name: 'Револьвер', dmg: 8, speed: 250, cd: 2.2, color: '#ff9a4d' },
  { name: 'Обріз', dmg: 14, speed: 210, cd: 3.2, color: '#ff5a4a' },
  { name: 'Гвинтівка', dmg: 6, speed: 370, cd: 1.7, color: '#8fd0ff' },
];
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
function mkZombie(x, y) {
  const armed = Math.random() < ARMED_CHANCE;
  return { x, y, w: 18, h: 22, vx: 0, vy: 0, t: 0, hp: ZHP, flash: 0, frame: 0,
    armed, zw: armed ? Math.floor(Math.random() * ZWEAPONS.length) : 0,
    shootCD: 0.6 + Math.random() * 2, hasBullet: false, aimx: 1, aimy: 0 };
}
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

// ---- campaign: find key → free woman from locked house → escort her home; always also kill the boss ----
const BOSS_NAMES = ['Гнилий Король', 'Зомбі-Велетень', 'Лорд Гнилля', 'Старий Грець'];
const ri = n => Math.floor(Math.random() * n);
let boss = null, bossDead = false;
let keyItem = null, lockedHouse = null, woman = null;
let hasKey = false, womanFreed = false, womanRescued = false, womanDead = false, failReason = '';
const quests = [];
const usedSpots = [];
function questSpot(minFromPlayer) {
  const cells = reachCells.slice();
  for (let i = cells.length - 1; i > 0; i--) { const j = ri(i + 1);[cells[i], cells[j]] = [cells[j], cells[i]]; }
  for (const [c, r] of cells) { const wx = c * TS, wy = r * TS; if (Math.hypot(wx - player.x, wy - player.y) < minFromPlayer) continue; if (usedSpots.every(s => Math.hypot(s[0] - wx, s[1] - wy) > 260)) { usedSpots.push([wx, wy]); return [wx, wy]; } }
  return [player.x + 300, player.y];
}
(function buildCampaign() {
  const ks = questSpot(640); keyItem = { x: ks[0] + 6, y: ks[1] + 6, got: false };
  quests.push({ type: 'key', label: 'Знайти ключ від будинку' });
  const hsp = questSpot(900); lockedHouse = { x: hsp[0], y: hsp[1] };
  woman = { x: hsp[0] + 38, y: hsp[1] + 60, w: 18, h: 22, hp: 40, maxhp: 40, flash: 0, invuln: 0, frame: 0, walkT: 0, active: false };
  quests.push({ type: 'rescue', label: 'Визволити жінку і привести ДОДОМУ' });
  const bs = questSpot(700); boss = mkZombie(bs[0], bs[1]); boss.isBoss = true; boss.hp = 24; boss.maxhp = 24; boss.w = 30; boss.h = 34; boss.name = BOSS_NAMES[ri(BOSS_NAMES.length)]; boss.armed = true; boss.zw = 1; zombies.push(boss);
  quests.push({ type: 'boss', label: 'Здолати боса: ' + boss.name });
  // one random side objective for variety
  if (Math.random() < 0.5) quests.push({ type: 'coins', target: Math.min(coins.length, 10 + ri(8)), label: 'Зібрати монети' });
  else quests.push({ type: 'kills', target: 12 + ri(12), label: 'Знищити зомбі' });
})();
function checkQuests() {
  let all = true;
  for (const q of quests) {
    if (q.type === 'key') { q.done = hasKey; q.prog = hasKey ? '✓' : '🔑'; }
    else if (q.type === 'rescue') { q.done = womanRescued; q.prog = womanRescued ? '✓' : (womanFreed ? 'веди ДОДОМУ' : (hasKey ? 'відчини будинок' : 'потрібен ключ')); }
    else if (q.type === 'boss') { q.done = bossDead; q.prog = q.done ? '✓' : (boss && boss.hp > 0 ? Math.ceil(boss.hp) + 'hp' : ''); }
    else if (q.type === 'coins') { q.done = totalCoins >= q.target; q.prog = Math.min(totalCoins, q.target) + '/' + q.target; }
    else if (q.type === 'kills') { q.done = kills >= q.target; q.prog = Math.min(kills, q.target) + '/' + q.target; }
    if (!q.done) all = false;
  }
  if (all && state === 'play') { state = 'win'; AUDIO.stopMusic(); AUDIO.sfx.win(); }
}
let curW = 0; const owned = [true, false, false, false]; const wAmmo = WEAPONS.map(w => w.mag);
const bullets = [], eBullets = [], loot = [], particles = [];
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

function startGame() { state = 'play'; AUDIO.start(); AUDIO.startMusic(); tryFullscreen(); }
const isMobile = () => matchMedia('(pointer:coarse)').matches || innerWidth < 820;
function fitCanvas() {
  if (!isMobile()) { canvas.style.width = ''; canvas.style.height = ''; return; }
  const ar = VIEW_W / VIEW_H; const w = innerWidth, h = innerHeight;
  let cw, ch; if (w / h > ar) { ch = h; cw = h * ar; } else { cw = w; ch = w / ar; }
  canvas.style.width = Math.round(cw) + 'px'; canvas.style.height = Math.round(ch) + 'px';
}
function tryFullscreen() {
  if (!isMobile()) return;
  const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req) { try { req.call(el); } catch (e) {} }
  setTimeout(fitCanvas, 300);
}
addEventListener('resize', fitCanvas);
addEventListener('orientationchange', () => setTimeout(fitCanvas, 250));
fitCanvas();

// ---- touch controls (mobile): left = move stick, right = aim/fire stick ----
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const STICK_R = 52;
const tMove = { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false, mx: 0, my: 0 };
const tFire = { id: null, active: false };
const fireBtn = { x: VIEW_W - 86, y: VIEW_H - 86, r: 54 };   // big round fire button (bottom-right)
const btnPause = { x: VIEW_W - 50, y: 46, w: 40, h: 32, label: '⏸' };
const btnWeapon = { x: VIEW_W / 2 - 28, y: VIEW_H - 54, w: 56, h: 46 };
const inBtn = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
const inFire = (x, y) => Math.hypot(x - fireBtn.x, y - fireBtn.y) <= fireBtn.r + 12;
function autoAim() {
  const px = player.x + player.w / 2, py = player.y + player.h / 2; let best = null, bd = 520 * 520;
  for (const z of zombies) { const dx = z.x + z.w / 2 - px, dy = z.y + z.h / 2 - py, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [dx, dy]; } }
  if (best) { const m = Math.hypot(best[0], best[1]) || 1; return { x: best[0] / m, y: best[1] / m }; }
  return { x: face.x, y: face.y };
}
function canvasXY(t) { const r = canvas.getBoundingClientRect(); return [(t.clientX - r.left) * (canvas.width / r.width), (t.clientY - r.top) * (canvas.height / r.height)]; }
function cycleWeapon() { for (let k = 1; k <= WEAPONS.length; k++) { const ni = (curW + k) % WEAPONS.length; if (owned[ni]) { curW = ni; break; } } }

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const [x, y] = canvasXY(t);
    if (state === 'menu') { startGame(); return; }
    if (state === 'win' || state === 'gameover') { location.reload(); return; }
    if (inBtn(btnPause, x, y)) { if (state === 'play') { state = 'paused'; AUDIO.stopMusic(); } else if (state === 'paused') { state = 'play'; AUDIO.startMusic(); } continue; }
    if (state !== 'play') continue;
    if (inBtn(btnWeapon, x, y)) { cycleWeapon(); continue; }
    if (inFire(x, y) && tFire.id === null) { tFire.id = t.identifier; tFire.active = true; }
    else if (x < canvas.width / 2 && tMove.id === null) { tMove.id = t.identifier; tMove.ox = tMove.x = x; tMove.oy = tMove.y = y; tMove.active = true; tMove.mx = tMove.my = 0; }
  }
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const [x, y] = canvasXY(t);
    if (t.identifier === tMove.id) { const dx = x - tMove.ox, dy = y - tMove.oy, m = Math.hypot(dx, dy) || 1, cl = Math.min(m, STICK_R); tMove.mx = dx / m * (cl / STICK_R); tMove.my = dy / m * (cl / STICK_R); tMove.x = tMove.ox + dx / m * cl; tMove.y = tMove.oy + dy / m * cl; }
  }
}, { passive: false });
function endTouch(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === tMove.id) { tMove.id = null; tMove.active = false; tMove.mx = tMove.my = 0; }
    else if (t.identifier === tFire.id) { tFire.id = null; tFire.active = false; }
  }
}
canvas.addEventListener('touchend', endTouch, { passive: false });
canvas.addEventListener('touchcancel', endTouch, { passive: false });
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

  // movement (keyboard or touch joystick — analog-friendly)
  let ix = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  let iy = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
  if (tMove.active) { ix = tMove.mx; iy = tMove.my; }
  const mag = Math.hypot(ix, iy);
  const moving = mag > 0.06;
  if (moving) { face.x = ix / mag; face.y = iy / mag; }
  const running = (keys.ShiftLeft || keys.ShiftRight || (tMove.active && mag > 0.92)) && stamina > 0 && moving;
  const onSand = tileAt(player.x + player.w / 2, player.y + player.h / 2) === 3;
  const sp = SPEED * (running ? RUN_MULT : 1) * (onSand ? 0.5 : 1) * dt;
  let mvx = ix, mvy = iy; if (mag > 1) { mvx = ix / mag; mvy = iy / mag; }
  tryMove(player, mvx * sp, mvy * sp);
  if (moving) { player.walkT += dt * (running ? 1.5 : 1); player.frame = 1 + (Math.floor(player.walkT * 9) % 2); } else { player.frame = 0; }

  // dust on sand
  dustT -= dt;
  if (onSand && moving && dustT <= 0) { particles.push({ x: player.x + player.w / 2 + (Math.random() * 10 - 5), y: player.y + player.h, vx: Math.random() * 20 - 10, vy: -10 - Math.random() * 15, life: 0.4, max: 0.4, color: '#f0d98a', size: 2, grav: 60 }); dustT = running ? 0.06 : 0.12; }

  // shooting
  fireCD -= dt;
  for (let i = 0; i < WEAPONS.length; i++) if (keys['Digit' + (i + 1)] && owned[i]) curW = i;
  let aim = null;
  if (tFire.active) { aim = autoAim(); face.x = aim.x; face.y = aim.y; }   // gun auto-aims while the fire button is held
  if (fireCD <= 0 && wAmmo[curW] > 0) {
    if (mouse.down) { fire(mouse.x + cam.x - (player.x + player.w / 2), mouse.y + cam.y - (player.y + player.h / 2)); fireCD = WEAPONS[curW].rate; }
    else if (tFire.active) { fire(aim.x, aim.y); fireCD = WEAPONS[curW].rate; }
    else if (keys.KeyF) { fire(face.x, face.y); fireCD = WEAPONS[curW].rate; }
  }

  // bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || boxSolid(b.x - 1, b.y - 1, 2, 2) || b.x < 0 || b.x > LW || b.y < 0 || b.y > LH) { bullets.splice(i, 1); continue; }
    for (let j = zombies.length - 1; j >= 0; j--) { const z = zombies[j]; if (b.x >= z.x && b.x <= z.x + z.w && b.y >= z.y && b.y <= z.y + z.h) {
      z.hp -= b.dmg; z.flash = 0.12; z.x += Math.sign(b.vx) * 1.2;
      if (z.hp <= 0) {
        if (z.isBoss) { bossDead = true; shakeT = 0.4; spawnBurst(z.x + 15, z.y + 17, '#ff5a4a', 30, 240, 4); spawnBurst(z.x + 15, z.y + 17, '#ffd23f', 16, 180, 3); showToast('Боса повалено!'); }
        else spawnBurst(z.x + 9, z.y + 11, '#8ec257', 16, 170, 3);
        spawnBurst(z.x + 9, z.y + 11, '#ffffff', 6, 120, 2); dropLoot(z); zombies.splice(j, 1); kills++; AUDIO.sfx.zombie();
      }
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
    // armed zombies fire single shots at the player (max 1 bullet each in flight)
    if (z.armed) {
      z.shootCD -= dt; const m = d || 1; z.aimx = (px - zx) / m; z.aimy = (py - zy) / m;
      const w = ZWEAPONS[z.zw];
      if (!z.hasBullet && z.shootCD <= 0 && d < 340) {
        eBullets.push({ x: zx, y: zy, vx: z.aimx * w.speed, vy: z.aimy * w.speed, life: 1.8, dmg: w.dmg, color: w.color, owner: z });
        z.hasBullet = true; z.shootCD = w.cd; AUDIO.sfx.eshoot(z.zw);
      }
    }
    if (aabb(player.x, player.y, player.w, player.h, z.x, z.y, z.w, z.h)) hurt(16);
  }

  // enemy bullets
  for (let i = eBullets.length - 1; i >= 0; i--) {
    const b = eBullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0 || boxSolid(b.x - 1, b.y - 1, 2, 2) || b.x < 0 || b.x > LW || b.y < 0 || b.y > LH;
    if (!dead && invuln <= 0 && aabb(player.x, player.y, player.w, player.h, b.x - 2, b.y - 2, 4, 4)) { hurt(b.dmg); dead = true; }
    if (dead) { if (b.owner) b.owner.hasBullet = false; eBullets.splice(i, 1); }
  }

  // home heal
  let onHome = false;
  for (const hm of homes) if (aabb(player.x, player.y, player.w, player.h, hm.x - 16, hm.y - 40, 96 + 32, 112)) {
    onHome = true; if (health < 100) { health = Math.min(100, health + 60 * dt); } for (let i = 0; i < WEAPONS.length; i++) if (owned[i]) wAmmo[i] = WEAPONS[i].mag;
    healT -= dt; if (healT <= 0 && health < 100) { particles.push({ x: player.x + 9 + (Math.random() * 20 - 10), y: player.y + player.h, vx: Math.random() * 14 - 7, vy: -28, life: 0.6, max: 0.6, color: '#7dff9a', size: 3, grav: -10 }); healT = 0.14; }
  }
  stamina = clamp(stamina + (running ? -STAM_DRAIN : (onHome ? STAM_REGEN_HOME : STAM_REGEN)) * dt, 0, STAM_MAX);

  // pickups
  coins = coins.filter(co => { if (aabb(player.x, player.y, player.w, player.h, co.x - 10, co.y - 10, 28, 28)) { totalCoins++; spawnBurst(co.x, co.y, '#ffd23f', 8, 80, 2); AUDIO.sfx.coin(); return false; } return true; });
  // key pickup
  if (keyItem && !keyItem.got && aabb(player.x, player.y, player.w, player.h, keyItem.x - 6, keyItem.y - 6, 28, 28)) { keyItem.got = true; hasKey = true; AUDIO.sfx.pickup(); spawnBurst(keyItem.x + 6, keyItem.y + 6, '#ffd23f', 16, 140, 3); showToast('Знайдено ключ! Іди до будинку 🏚'); }
  // unlock the house with the key
  if (hasKey && !womanFreed && lockedHouse && aabb(player.x, player.y, player.w, player.h, lockedHouse.x - 10, lockedHouse.y, 116, 110)) {
    womanFreed = true; woman.active = true; AUDIO.sfx.pickup(); spawnBurst(lockedHouse.x + 48, lockedHouse.y + 60, '#ffd23f', 20, 160, 3); showToast('Жінку звільнено! Веди її ДОДОМУ 🏠');
  }
  // woman: follow, take damage, escort, or die
  if (woman && woman.active && !womanRescued && !womanDead) {
    woman.invuln = Math.max(0, woman.invuln - dt); woman.flash = Math.max(0, woman.flash - dt);
    const wcx = woman.x + woman.w / 2, wcy = woman.y + woman.h / 2, pcx2 = player.x + player.w / 2, pcy2 = player.y + player.h / 2;
    const dd = Math.hypot(pcx2 - wcx, pcy2 - wcy);
    if (dd > 42) { const sp = 125 * dt; tryMove(woman, (pcx2 - wcx) / dd * sp, (pcy2 - wcy) / dd * sp); woman.walkT += dt; woman.frame = 1 + (Math.floor(woman.walkT * 8) % 2); } else woman.frame = 0;
    for (const z of zombies) if (woman.invuln <= 0 && aabb(woman.x, woman.y, woman.w, woman.h, z.x, z.y, z.w, z.h)) { woman.hp -= 14; woman.invuln = 0.6; woman.flash = 0.14; spawnBurst(wcx, wcy, '#e0518f', 6, 90, 2); break; }
    if (woman.hp <= 0) { womanDead = true; state = 'gameover'; failReason = 'Жінку вбили — місію провалено'; AUDIO.stopMusic(); AUDIO.sfx.lose(); }
    for (const hm of homes) if (aabb(woman.x, woman.y, woman.w, woman.h, hm.x - 16, hm.y - 40, 128, 112)) { womanRescued = true; woman.active = false; spawnBurst(woman.x + 9, woman.y + 11, '#7dff9a', 16, 130, 3); showToast('Жінка вдома! Врятовано ✓'); AUDIO.sfx.win(); }
  }
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

  checkQuests();

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

  // locked house (where the woman is held) — house + padlock until freed
  if (lockedHouse) {
    spr(IMG.house1, lockedHouse.x, lockedHouse.y);
    if (!womanFreed) {
      const lx = Math.round(lockedHouse.x + 48 - cam.x), ly = Math.round(lockedHouse.y + 50 - cam.y);
      const pulse = 0.5 + 0.5 * Math.sin(animClock * 4);
      ctx.save(); ctx.globalAlpha = 0.3 + 0.3 * pulse; ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(lx, ly, 18, 0, 7); ctx.fill(); ctx.globalAlpha = 1; ctx.restore();
      ctx.drawImage(IMG.lock, lx - 10, ly - 11);
    }
  }
  // the key
  if (keyItem && !keyItem.got) {
    const pulse = 0.5 + 0.5 * Math.sin(animClock * 5);
    const kx = Math.round(keyItem.x - cam.x), ky = Math.round(keyItem.y - cam.y + Math.sin(animClock * 3) * 2);
    ctx.save(); ctx.globalAlpha = 0.35 + 0.35 * pulse; ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(kx + 8, ky + 8, 15, 0, 7); ctx.fill(); ctx.globalAlpha = 1; ctx.restore();
    ctx.drawImage(IMG.key, kx - 4, ky - 4);
  }
  // the woman
  if (woman && woman.active && !womanRescued) {
    spr(IMG.woman[woman.frame], woman.x - 3, woman.y - 8);
    if (woman.flash > 0) { ctx.globalAlpha = woman.flash / 0.14 * 0.7; ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(woman.x - 3 - cam.x), Math.round(woman.y - 8 - cam.y), 24, 32); ctx.globalAlpha = 1; }
    const hx = Math.round(woman.x - cam.x), hy = Math.round(woman.y - 12 - cam.y);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(hx - 1, hy, woman.w + 2, 4); ctx.fillStyle = '#e0518f'; ctx.fillRect(hx, hy + 1, woman.w * Math.max(0, woman.hp) / woman.maxhp, 2);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Calibri'; ctx.textAlign = 'center'; ctx.fillText('♀', woman.x + 9 - cam.x, hy - 4); ctx.textAlign = 'left';
  }

  for (const z of zombies) {
    if (z.isBoss) {
      const sx = Math.round(z.x - 6 - cam.x), sy = Math.round(z.y - 14 - cam.y);
      const aura = 0.3 + 0.25 * (0.5 + 0.5 * Math.sin(animClock * 4));
      ctx.save(); ctx.globalAlpha = aura; ctx.fillStyle = '#ff4a3a'; ctx.beginPath(); ctx.arc(sx + 18, sy + 26, 22, 0, 7); ctx.fill(); ctx.restore();
      ctx.drawImage(IMG.enemy[z.frame], sx, sy, 36, 48);
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(sx + 8, sy + 2); ctx.lineTo(sx + 12, sy - 6); ctx.lineTo(sx + 18, sy + 1); ctx.lineTo(sx + 24, sy - 6); ctx.lineTo(sx + 28, sy + 2); ctx.closePath(); ctx.fill();  // crown
      if (z.flash > 0) { ctx.globalAlpha = z.flash / 0.12 * 0.7; ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy, 36, 48); ctx.globalAlpha = 1; }
      const bw = 44, bxx = Math.round(z.x + 15 - cam.x - bw / 2), byy = sy - 8;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(bxx, byy, bw, 5); ctx.fillStyle = '#ff4a3a'; ctx.fillRect(bxx, byy, bw * Math.max(0, z.hp) / z.maxhp, 5);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Calibri'; ctx.textAlign = 'center'; ctx.fillText('☠ ' + z.name, Math.round(z.x + 15 - cam.x), byy - 6); ctx.textAlign = 'left';
    } else {
      spr(IMG.enemy[z.frame], z.x - 3, z.y - 8);
      if (z.flash > 0) { ctx.globalAlpha = z.flash / 0.12 * 0.7; ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(z.x - 3 - cam.x), Math.round(z.y - 8 - cam.y), 24, 32); ctx.globalAlpha = 1; }
      if (z.hp < ZHP) { const hx = Math.round(z.x - cam.x), hy = Math.round(z.y - 12 - cam.y); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(hx, hy, z.w, 3); ctx.fillStyle = '#6fd14a'; ctx.fillRect(hx, hy, z.w * z.hp / ZHP, 3); }
    }
    // armed zombies: little gun aimed at you + a coloured danger dot
    if (z.armed) {
      const gx = Math.round(z.x + z.w / 2 - cam.x), gy = Math.round(z.y + z.h / 2 - cam.y);
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(Math.atan2(z.aimy, z.aimx));
      ctx.fillStyle = '#222'; ctx.fillRect(1, -2, 4, 4); ctx.fillStyle = ZWEAPONS[z.zw].color; ctx.fillRect(5, -1.5, 9, 3); ctx.restore();
      ctx.fillStyle = ZWEAPONS[z.zw].color; ctx.beginPath(); ctx.arc(z.x + z.w / 2 - cam.x, z.y - (z.isBoss ? 26 : 14) - cam.y, 2.5, 0, 7); ctx.fill();
    }
  }

  if (!(invuln > 0 && Math.floor(invuln * 20) % 2 === 0)) spr(IMG.player[player.frame], player.x - 3, player.y - 8);
  // gun
  { const pcx = player.x + player.w / 2 - cam.x, pcy = player.y + player.h / 2 - cam.y; let ang = Math.atan2(face.y, face.x); if (mouse.moved) ang = Math.atan2((mouse.y + cam.y) - (player.y + player.h / 2), (mouse.x + cam.x) - (player.x + player.w / 2)); ctx.save(); ctx.translate(Math.round(pcx), Math.round(pcy)); ctx.rotate(ang); ctx.fillStyle = '#333'; ctx.fillRect(4, -2, 12, 4); ctx.fillStyle = '#555'; ctx.fillRect(2, -3, 5, 6); ctx.restore(); }

  for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x - cam.x - p.size / 2), Math.round(p.y - cam.y - p.size / 2), p.size, p.size); }
  ctx.globalAlpha = 1;

  cam.x = bx; cam.y = by;
  drawAtmosphere(); drawBullets();
  if (hurtFlash > 0) { ctx.fillStyle = 'rgba(255,40,40,' + (0.35 * hurtFlash).toFixed(3) + ')'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  // objective arrow guides the current step of the campaign
  if (!hasKey && keyItem) drawPointer(keyItem.x + 8, keyItem.y, 'КЛЮЧ', '#ffd23f');
  else if (hasKey && !womanFreed && lockedHouse) drawPointer(lockedHouse.x + 48, lockedHouse.y + 30, 'БУДИНОК', '#9fe0ff');
  else if (womanFreed && !womanRescued) drawPointer(homes[0].x + 48, homes[0].y, 'ДОДОМУ', '#3fbf60');
  if (boss && !bossDead) drawPointer(boss.x + 15, boss.y, 'БОС', '#ff5a4a');
  drawHUD(); drawQuests();
  if (IS_TOUCH && (state === 'play' || state === 'paused')) drawTouchUI();
  if (state === 'paused') drawPause();
  else if (state !== 'play') drawOverlay();
}

function drawTouchUI() {
  ctx.save();
  // movement stick (left) — shown where the thumb is pressing
  if (tMove.active) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(tMove.ox, tMove.oy, STICK_R, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(tMove.x, tMove.y, 24, 0, 7); ctx.fill();
  }
  // move-stick hint when idle
  if (!tMove.active) { ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(90, VIEW_H - 90, STICK_R, 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '12px Calibri'; ctx.textAlign = 'center'; ctx.fillText('РУХ', 90, VIEW_H - 90); }
  // FIRE button (right) — pressed state highlights
  ctx.beginPath(); ctx.arc(fireBtn.x, fireBtn.y, fireBtn.r, 0, 7);
  ctx.fillStyle = tFire.active ? 'rgba(255,90,60,0.55)' : 'rgba(255,90,60,0.28)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,140,110,0.8)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Calibri'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('ВОГОНЬ', fireBtn.x, fireBtn.y); ctx.textBaseline = 'alphabetic';
  // weapon button
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(btnWeapon.x, btnWeapon.y, btnWeapon.w, btnWeapon.h, 8); ctx.fill();
  ctx.strokeStyle = WEAPONS[curW].color; ctx.lineWidth = 2; rr(btnWeapon.x, btnWeapon.y, btnWeapon.w, btnWeapon.h, 8); ctx.stroke();
  ctx.fillStyle = WEAPONS[curW].color; ctx.font = 'bold 13px Calibri'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('зброя', btnWeapon.x + btnWeapon.w / 2, btnWeapon.y + 14); ctx.fillStyle = '#fff'; ctx.fillText((curW + 1) + '/4 ▸', btnWeapon.x + btnWeapon.w / 2, btnWeapon.y + 32);
  // pause button
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(btnPause.x, btnPause.y, btnPause.w, btnPause.h, 6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Calibri'; ctx.fillText(state === 'paused' ? '▶' : '⏸', btnPause.x + btnPause.w / 2, btnPause.y + btnPause.h / 2 + 1);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.restore();
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

function drawPointer(wx, wy, label, color) {
  const sx = wx - cam.x, sy = wy - cam.y; const pulse = 0.5 + 0.5 * Math.sin(animClock * 4);
  ctx.save(); ctx.textAlign = 'center';
  if (sx >= 12 && sx <= VIEW_W - 12 && sy >= 52 && sy <= VIEW_H - 12) {
    ctx.strokeStyle = color; ctx.globalAlpha = 0.5 + 0.4 * pulse; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy - 34, 11 + pulse * 4, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(sx - 6, sy - 23); ctx.lineTo(sx + 6, sy - 23); ctx.lineTo(sx, sy - 15); ctx.closePath(); ctx.fill();
    ctx.font = 'bold 12px Calibri,sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(label, sx + 1, sy - 47); ctx.fillStyle = color; ctx.fillText(label, sx, sy - 48);
  } else {
    const ccx = VIEW_W / 2, ccy = (VIEW_H + 50) / 2; const ang = Math.atan2(wy - (cam.y + VIEW_H / 2), wx - (cam.x + VIEW_W / 2)); const dx = Math.cos(ang), dy = Math.sin(ang);
    const halfW = VIEW_W / 2 - 30, halfH = (VIEW_H - 50) / 2 - 30; const scale = Math.min(halfW / (Math.abs(dx) || 1e-6), halfH / (Math.abs(dy) || 1e-6));
    const ex = ccx + dx * scale, ey = ccy + dy * scale;
    ctx.translate(ex, ey); ctx.rotate(ang); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); ctx.rotate(-ang);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Calibri,sans-serif'; ctx.fillText(label, 0, -13);
  }
  ctx.restore();
}

function drawQuests() {
  if (!quests.length) return;
  const x = 10, y0 = 46, lh = 18, W2 = 320, hQ = 10 + (quests.length + 1) * lh;
  ctx.fillStyle = 'rgba(255,252,240,0.82)'; ctx.fillRect(x, y0, W2, hQ);
  ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(x, y0 + hQ, W2, 2);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.font = 'bold 13px Calibri,sans-serif'; ctx.fillStyle = '#7a5a2a'; ctx.fillText('ЗАВДАННЯ', x + 8, y0 + 13);
  ctx.font = '12px Calibri,sans-serif';
  quests.forEach((q, i) => { const yy = y0 + 13 + (i + 1) * lh; ctx.fillStyle = q.done ? '#4caf50' : '#4a4030'; ctx.fillText((q.done ? '✓ ' : '▢ ') + q.label + (q.prog && !q.done && q.prog !== '?' ? '  ' + q.prog : ''), x + 8, yy); });
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
  ctx.fillText('Знайди ключ, визволь жінку, приведи ДОДОМУ цілою та здолай боса', VIEW_W / 2, VIEW_H / 2 - 14);
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

function drawBullets() {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const b of bullets) { const bx = b.x - cam.x, by = b.y - cam.y; const gg = ctx.createRadialGradient(bx, by, 0, bx, by, 9); gg.addColorStop(0, b.color); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = .45; ctx.fillStyle = gg; ctx.fillRect(bx - 9, by - 9, 18, 18); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 2, 0, 7); ctx.fill(); }
  for (const b of eBullets) { const bx = b.x - cam.x, by = b.y - cam.y; const gg = ctx.createRadialGradient(bx, by, 0, bx, by, 10); gg.addColorStop(0, b.color); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = .5; ctx.fillStyle = gg; ctx.fillRect(bx - 10, by - 10, 20, 20); ctx.globalAlpha = .9; ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx - b.vx * 0.025, by - b.vy * 0.025); ctx.lineTo(bx, by); ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 1.6, 0, 7); ctx.fill(); }
  ctx.restore();
}

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
  ctx.textAlign = 'left'; ctx.font = 'bold 20px Calibri,sans-serif'; ctx.fillStyle = '#c79a1a'; ctx.fillText('' + totalCoins, VIEW_W - 84, 12);
  ctx.textAlign = 'right'; ctx.font = 'bold 14px Calibri,sans-serif'; ctx.fillStyle = '#6a8f3a'; ctx.fillText('☠ ' + kills, VIEW_W - 14, 30); ctx.textAlign = 'left';
  ctx.font = '10px Calibri,sans-serif';
  for (let i = 0; i < 4; i++) { const sx = 430 + i * 60; ctx.globalAlpha = owned[i] ? 1 : .3; ctx.fillStyle = i === curW ? WEAPONS[i].color : 'rgba(0,0,0,.1)'; ctx.fillRect(sx, 26, 56, 12); ctx.fillStyle = i === curW ? '#fff' : '#777'; ctx.textAlign = 'center'; ctx.fillText((i + 1) + ' ' + WEAPONS[i].name, sx + 28, 32); ctx.globalAlpha = 1; }
  ctx.textAlign = 'left';
  if (toastT > 0) { ctx.globalAlpha = Math.min(1, toastT); ctx.font = 'bold 22px Calibri,sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(toast, VIEW_W / 2 + 1, 71); ctx.fillStyle = '#e8932a'; ctx.fillText(toast, VIEW_W / 2, 70); ctx.textAlign = 'left'; ctx.globalAlpha = 1; }
}

function drawOverlay() {
  ctx.fillStyle = state === 'win' ? 'rgba(40,80,40,0.55)' : 'rgba(60,30,30,0.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center'; ctx.fillStyle = state === 'win' ? '#aef5b0' : '#ff9a9a'; ctx.font = 'bold 60px Calibri,sans-serif';
  ctx.fillText(state === 'win' ? 'ПЕРЕМОГА!' : (womanDead ? 'МІСІЮ ПРОВАЛЕНО' : 'ГРУ ЗАВЕРШЕНО'), VIEW_W / 2, VIEW_H / 2 - 16);
  ctx.fillStyle = '#fff'; ctx.font = '22px Calibri,sans-serif';
  const sub = state === 'win' ? 'Усі завдання виконано! Вбито: ' + kills : (failReason || 'Спробуй ще — нова мапа чекає');
  ctx.fillText(sub + '   —   R: нова гра', VIEW_W / 2, VIEW_H / 2 + 34);
  ctx.textAlign = 'left';
}

let last = 0;
function frame(t) { const dt = Math.min((t - last) / 1000, 0.05); last = t; update(dt); draw(); requestAnimationFrame(frame); }
requestAnimationFrame(t => { last = t; frame(t); });
