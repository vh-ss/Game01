// OUTBREAK — dark survival-horror side-scrolling platformer.
// Run left→right, jump across gaps, shoot zombies, reach the green exit flag.

const VIEW_W = 760, VIEW_H = 600;
const TS = LEVEL.tileSize;
const COLS = LEVEL.cols, ROWS = LEVEL.rows;
const LW = LEVEL.width, LH = LEVEL.height;

// physics
const GRAV = 1500, MAX_FALL = 950;
const JUMP_V = -600, MOVE = 175, RUN = 300, ZWALK = 46, ZCHASE = 96;
const COYOTE = 0.10, JUMP_BUF = 0.12;   // forgiveness windows

// weapons (dmg/rate/mag/speed; shotgun = pellets+spread)
const WEAPONS = [
  { name: 'Пістолет',  dmg: 1, rate: 0.30, mag: 12, speed: 560, pellets: 1, spread: 0,    color: '#ffd23f' },
  { name: 'Автомат',   dmg: 1, rate: 0.08, mag: 30, speed: 640, pellets: 1, spread: 0.06, color: '#9fe0ff' },
  { name: 'Дробовик',  dmg: 2, rate: 0.75, mag: 6,  speed: 520, pellets: 6, spread: 0.40, color: '#ff9a4d' },
  { name: 'Гвинтівка', dmg: 6, rate: 0.55, mag: 8,  speed: 940, pellets: 1, spread: 0,    color: '#ff5af0' },
];
const ZHP = 4, LOOT_CHANCE = 0.3;
const SOLID = new Set([1, 2, 3, 5, 6, 7]);   // collidable tiles; 4 = spikes (hazard)

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const IMG = SPRITES;

// ---- tile grid ----
const tileIdx = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
for (const [x, y, idx] of LEVEL.tiles) {
  const c = x / TS, r = y / TS;
  if (r >= 0 && r < ROWS && c >= 0 && c < COLS) tileIdx[r][c] = idx;
}
const isSolid = (c, r) => c < 0 || c >= COLS || (r >= 0 && r < ROWS && SOLID.has(tileIdx[r][c]));
const tileAtPx = (px, py) => {
  const c = Math.floor(px / TS), r = Math.floor(py / TS);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return 0;
  return tileIdx[r][c];
};

// ---- entities ----
const player = { x: LEVEL.playerStart[0], y: LEVEL.playerStart[1], w: 18, h: 30, vx: 0, vy: 0, onGround: false, face: 1 };
let respawnPt = [player.x, player.y];
const zombies = LEVEL.zombies.map(([x, y]) => mkZombie(x, y));
function mkZombie(x, y) { return { x, y, w: 20, h: 30, vx: 0, vy: 0, onGround: false, dir: 1, hp: ZHP, flash: 0 }; }
let coins = LEVEL.coins.map(([x, y]) => ({ x, y, got: false }));
let ammoCrates = (LEVEL.ammo || []).map(([x, y]) => ({ x, y, w: 22, h: 16 }));
let medkits = (LEVEL.medkits || []).map(([x, y]) => ({ x, y, w: 20, h: 16 }));
const checkpoints = (LEVEL.checkpoints || []).map(([x, y]) => ({ x, y, hit: false }));
const finish = { x: LEVEL.finish[0], y: LEVEL.groundRow * TS - 60, w: 28, h: 62 };

// ---- state ----
let health = 100, lives = 3, score = 0, kills = 0, state = 'play', animClock = 0;
let curW = 0;
const owned = [true, false, false, false];
const wAmmo = WEAPONS.map(w => w.mag);
const bullets = [], loot = [], particles = [], decals = [];
let fireCD = 0, hurtFlash = 0, shakeT = 0, invuln = 0, hitCD = 0;
let toast = '', toastT = 0;
const cam = { x: 0, y: 0 };
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

let seed = 13579;
const sr = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

// ---- input ----
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (state !== 'play' && e.code === 'KeyR') location.reload();
});
addEventListener('keyup', e => { keys[e.code] = false; });
const mouse = { x: 0, y: 0, down: false };
canvas.addEventListener('mousemove', e => { const r = canvas.getBoundingClientRect(); mouse.x = (e.clientX - r.left) * (canvas.width / r.width); mouse.y = (e.clientY - r.top) * (canvas.height / r.height); });
canvas.addEventListener('mousedown', () => { mouse.down = true; canvas.focus(); });
addEventListener('mouseup', () => { mouse.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.tabIndex = 0; canvas.style.outline = 'none'; canvas.focus();

let jumpHeld = false, jumpBuffer = 0, coyote = 0;

// ---- helpers ----
const aabb = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
function showToast(m) { toast = m; toastT = 2.0; }
function spawnBurst(cx, cy, color, n, sMax, size) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = 40 + Math.random() * sMax;
    particles.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life: 0.4 + Math.random() * 0.3, max: 0.7, color, size, grav: 240 }); }
}

// axis-resolved tile collision for any box entity (velocities in px/s)
function moveX(e, dt) {
  e.x += e.vx * dt;
  const top = Math.floor(e.y / TS), bot = Math.floor((e.y + e.h - 1) / TS);
  e.hitWall = 0;
  if (e.vx > 0) { const c = Math.floor((e.x + e.w - 1) / TS); for (let r = top; r <= bot; r++) if (isSolid(c, r)) { e.x = c * TS - e.w; e.vx = 0; e.hitWall = 1; return; } }
  else if (e.vx < 0) { const c = Math.floor(e.x / TS); for (let r = top; r <= bot; r++) if (isSolid(c, r)) { e.x = (c + 1) * TS; e.vx = 0; e.hitWall = -1; return; } }
}
function moveY(e, dt) {
  e.y += e.vy * dt;
  const left = Math.floor(e.x / TS), right = Math.floor((e.x + e.w - 1) / TS);
  if (e.vy > 0) { const r = Math.floor((e.y + e.h - 1) / TS); for (let c = left; c <= right; c++) if (isSolid(c, r)) { e.y = r * TS - e.h; e.vy = 0; return; } }
  else if (e.vy < 0) { const r = Math.floor(e.y / TS); for (let c = left; c <= right; c++) if (isSolid(c, r)) { e.y = (r + 1) * TS; e.vy = 0; return; } }
}
// reliable ground probe: solid tile within 1px under the feet (no per-frame jitter)
function grounded(e) {
  if (e.vy < 0) return false;                  // rising → not grounded
  const r = Math.floor((e.y + e.h + 1) / TS);
  const lC = Math.floor((e.x + 2) / TS), rC = Math.floor((e.x + e.w - 3) / TS);
  for (let c = lC; c <= rC; c++) if (isSolid(c, r)) { e.y = r * TS - e.h; e.vy = 0; return true; }
  return false;
}

function hurt(dmg, knockDir) {
  if (invuln > 0) return;
  health -= dmg; hurtFlash = Math.min(1, hurtFlash + 0.5); shakeT = 0.2; invuln = 0.8;
  player.vy = -260;
  if (health <= 0) {
    lives--; spawnBurst(player.x + 9, player.y + 15, '#8a1a1a', 20, 200, 3);
    if (lives <= 0) { state = 'gameover'; return; }
    health = 100; player.x = respawnPt[0]; player.y = respawnPt[1]; player.vx = player.vy = 0; invuln = 1.2;
  }
}

function fire(dx, dy) {
  const w = WEAPONS[curW]; const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
  wAmmo[curW]--;
  const baseAng = Math.atan2(dy, dx);
  const mx = player.x + player.w / 2 + dx * 12, my = player.y + 12 + dy * 12;
  for (let p = 0; p < w.pellets; p++) {
    const a = baseAng + (w.pellets > 1 ? (Math.random() - 0.5) * w.spread * 2 : (Math.random() - 0.5) * w.spread);
    bullets.push({ x: mx, y: my, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, life: 1.0, dmg: w.dmg, color: w.color });
  }
  spawnBurst(mx, my, '#fff2a8', 3, 50, 2);
  shakeT = Math.max(shakeT, w.pellets > 1 ? 0.12 : 0.05);
}
function maybeDropLoot(z) { if (sr() > LOOT_CHANCE) return; const wi = 1 + Math.floor(sr() * 3); loot.push({ x: z.x, y: z.y + 12, w: 22, h: 18, weapon: wi }); }

// ================= UPDATE =================
function update(dt) {
  animClock += dt;
  if (state !== 'play') return;
  dt = Math.min(dt, 0.033);

  // ---- player input ----
  const dir = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  const running = keys.ShiftLeft || keys.ShiftRight;
  player.vx = dir * (running ? RUN : MOVE);
  if (dir) player.face = dir;

  // jump: buffer the press + coyote window for forgiving feel
  const wantJump = keys.Space || keys.ArrowUp || keys.KeyW;
  if (wantJump && !jumpHeld) jumpBuffer = JUMP_BUF;
  jumpHeld = wantJump;
  jumpBuffer = Math.max(0, jumpBuffer - dt);
  if (jumpBuffer > 0 && coyote > 0) { player.vy = JUMP_V; jumpBuffer = 0; coyote = 0; }
  if (!wantJump && player.vy < -190) player.vy = -190;   // variable height (short hop)

  player.vy += GRAV * dt; if (player.vy > MAX_FALL) player.vy = MAX_FALL;
  moveX(player, dt); moveY(player, dt);
  player.onGround = grounded(player);
  coyote = player.onGround ? COYOTE : Math.max(0, coyote - dt);

  // spikes / pit hazards
  const onSpikes = tileAtPx(player.x + player.w / 2, player.y + player.h - 2) === 4 ||
                   tileAtPx(player.x + 3, player.y + player.h - 2) === 4 ||
                   tileAtPx(player.x + player.w - 3, player.y + player.h - 2) === 4;
  if (onSpikes && invuln <= 0) {
    // blood: spray up from the wound + a lasting splat on the spikes
    const fx = player.x + player.w / 2, fy = player.y + player.h - 4;
    for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.0, s = 80 + Math.random() * 180;
      particles.push({ x: fx, y: fy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, max: 0.9, color: ['#8a1a1a', '#6e1414', '#a02020'][i % 3], size: 2 + (i % 2), grav: 520 }); }
    decals.push({ x: fx, y: player.y + player.h - 2, r: 8 + sr() * 5, rot: sr() * 6.28 });
    if (decals.length > 70) decals.shift();
    hurt(34, -player.face);
  }
  if (player.y > LH + 30) hurt(40, 0);

  // ---- shooting ----
  fireCD -= dt;
  for (let i = 0; i < WEAPONS.length; i++) if (keys['Digit' + (i + 1)] && owned[i]) curW = i;
  if (fireCD <= 0 && wAmmo[curW] > 0) {
    if (mouse.down) { fire(mouse.x + cam.x - (player.x + player.w / 2), mouse.y + cam.y - (player.y + 12)); fireCD = WEAPONS[curW].rate; }
    else if (keys.KeyF) { fire(player.face, 0); fireCD = WEAPONS[curW].rate; }
  }

  // ---- bullets ----
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0 || isSolid(Math.floor(b.x / TS), Math.floor(b.y / TS)) || b.x < 0 || b.x > LW;
    if (dead) { bullets.splice(i, 1); continue; }
    for (let j = zombies.length - 1; j >= 0; j--) {
      const z = zombies[j];
      if (b.x >= z.x && b.x <= z.x + z.w && b.y >= z.y && b.y <= z.y + z.h) {
        z.hp -= b.dmg; z.flash = 0.12; z.vx += Math.sign(b.vx) * 0.6;
        if (z.hp <= 0) {
          spawnBurst(z.x + 10, z.y + 15, '#7a1414', 18, 200, 3);
          decals.push({ x: z.x + 10, y: z.y + z.h - 2, r: 9 + sr() * 6, rot: sr() * 6.28 });
          if (decals.length > 70) decals.shift();
          maybeDropLoot(z); zombies.splice(j, 1); kills++; score += 25;
        } else spawnBurst(b.x, b.y, '#8a1a1a', 5, 90, 2);
        bullets.splice(i, 1); break;
      }
    }
  }

  // ---- zombies ----
  for (const z of zombies) {
    z.flash = Math.max(0, z.flash - dt);
    const px = player.x + player.w / 2, zx = z.x + z.w / 2;
    const chasing = Math.abs(px - zx) < 260 && Math.abs(player.y - z.y) < 70;
    if (chasing) z.dir = px < zx ? -1 : 1;
    let spd = chasing ? ZCHASE : ZWALK;
    z.vx = z.dir * spd;
    z.vy += GRAV * dt; if (z.vy > MAX_FALL) z.vy = MAX_FALL;
    moveX(z, dt);
    moveY(z, dt);
    z.onGround = grounded(z);
    if (z.hitWall) z.dir = -z.hitWall;             // turn at walls
    if (!chasing && z.onGround) {                   // turn at ledges
      const aheadC = z.dir > 0 ? Math.floor((z.x + z.w + 1) / TS) : Math.floor((z.x - 1) / TS);
      const footR = Math.floor((z.y + z.h + 1) / TS);
      if (!isSolid(aheadC, footR)) z.dir = -z.dir;
    }
    // contact damage
    if (aabb(player.x, player.y, player.w, player.h, z.x, z.y, z.w, z.h)) hurt(18, player.x < z.x ? -1 : 1);
  }
  // drop zombies that fell into a pit
  for (let j = zombies.length - 1; j >= 0; j--) if (zombies[j].y > LH + 60) zombies.splice(j, 1);

  // ---- pickups ----
  for (const co of coins) if (!co.got && aabb(player.x, player.y, player.w, player.h, co.x - 12, co.y - 12, 24, 24)) { co.got = true; score += 10; spawnBurst(co.x, co.y, '#ffd23f', 6, 70, 2); }
  ammoCrates = ammoCrates.filter(a => { if (wAmmo[curW] < WEAPONS[curW].mag && aabb(player.x, player.y, player.w, player.h, a.x, a.y, a.w, a.h)) { wAmmo[curW] = WEAPONS[curW].mag; spawnBurst(a.x + 11, a.y + 8, '#ffd23f', 8, 90, 2); showToast('+ набої'); return false; } return true; });
  medkits = medkits.filter(a => { if (health < 100 && aabb(player.x, player.y, player.w, player.h, a.x, a.y, a.w, a.h)) { health = Math.min(100, health + 50); spawnBurst(a.x + 10, a.y + 8, '#7dff9a', 10, 90, 2); showToast('+ аптечка'); return false; } return true; });
  for (let i = loot.length - 1; i >= 0; i--) { const a = loot[i]; if (aabb(player.x, player.y, player.w, player.h, a.x, a.y, a.w, a.h)) { owned[a.weapon] = true; wAmmo[a.weapon] = WEAPONS[a.weapon].mag; curW = a.weapon; spawnBurst(a.x + 11, a.y + 9, WEAPONS[a.weapon].color, 14, 130, 3); showToast('Нова зброя: ' + WEAPONS[a.weapon].name + '!'); loot.splice(i, 1); } }
  for (const cp of checkpoints) if (!cp.hit && aabb(player.x, player.y, player.w, player.h, cp.x, cp.y, 32, 64)) { cp.hit = true; respawnPt = [cp.x, cp.y]; showToast('Чекпойнт!'); }

  // ---- finish ----
  if (aabb(player.x, player.y, player.w, player.h, finish.x, finish.y, finish.w, finish.h)) state = 'win';

  // ---- timers/particles ----
  hurtFlash = Math.max(0, hurtFlash - dt * 1.5); shakeT = Math.max(0, shakeT - dt); invuln = Math.max(0, invuln - dt); toastT = Math.max(0, toastT - dt);
  for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.vy += (p.grav || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) particles.splice(i, 1); }

  // ---- camera ----
  cam.x = clamp(player.x + player.w / 2 - VIEW_W / 2, 0, LW - VIEW_W);
  cam.y = clamp(player.y + player.h / 2 - VIEW_H / 2, 0, LH - VIEW_H);
}

// ================= RENDER =================
function draw() {
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, '#10131a'); sky.addColorStop(0.6, '#15140f'); sky.addColorStop(1, '#0a0a08');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawParallax();

  const bx = cam.x, by = cam.y;
  if (shakeT > 0) { const m = 6 * (shakeT / 0.2); cam.x += (Math.random() * 2 - 1) * m; cam.y += (Math.random() * 2 - 1) * m; }

  // tiles
  const c0 = Math.max(0, Math.floor(cam.x / TS)), c1 = Math.min(COLS - 1, Math.floor((cam.x + VIEW_W) / TS));
  const r0 = Math.max(0, Math.floor(cam.y / TS)), r1 = Math.min(ROWS - 1, Math.floor((cam.y + VIEW_H) / TS));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const t = tileIdx[r][c]; if (t) ctx.drawImage(IMG.tilemap, t * TS, 0, TS, TS, Math.round(c * TS - cam.x), Math.round(r * TS - cam.y), TS, TS); }

  for (const d of decals) { const dx = d.x - cam.x, dy = d.y - cam.y; if (dx < -30 || dx > VIEW_W + 30) continue; ctx.save(); ctx.translate(dx, dy); ctx.rotate(d.rot); ctx.fillStyle = 'rgba(74,13,13,0.85)'; ctx.beginPath(); ctx.ellipse(0, 0, d.r, d.r * 0.6, 0, 0, 7); ctx.fill(); ctx.restore(); }

  // finish flag
  spr(IMG.flag, finish.x, finish.y);
  for (const cp of checkpoints) { ctx.fillStyle = cp.hit ? '#3ad17a' : '#5a5c60'; ctx.fillRect(Math.round(cp.x + 14 - cam.x), Math.round(cp.y - cam.y), 3, 64); }

  for (const co of coins) if (!co.got) spr(IMG.coin, co.x - 12, co.y - 12 + Math.sin(animClock * 4 + co.x) * 2);
  for (const a of ammoCrates) spr(IMG.ammo, a.x, a.y);
  for (const a of medkits) spr(IMG.medkit, a.x, a.y);
  for (const a of loot) { const lx = Math.round(a.x - cam.x), ly = Math.round(a.y - cam.y + Math.sin(animClock * 4 + a.x) * 2); ctx.fillStyle = WEAPONS[a.weapon].color; ctx.globalAlpha = .35; ctx.fillRect(lx - 3, ly - 3, a.w + 6, a.h + 6); ctx.globalAlpha = 1; ctx.fillStyle = '#3a2c1a'; ctx.fillRect(lx, ly, a.w, a.h); ctx.fillStyle = WEAPONS[a.weapon].color; ctx.fillRect(lx + 3, ly + 6, a.w - 6, 4); }

  for (const z of zombies) { drawFlipped(IMG.enemy, z.x, z.y, z.dir); if (z.flash > 0) { ctx.globalAlpha = z.flash / 0.12 * 0.7; ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(z.x - cam.x), Math.round(z.y - cam.y), z.w, z.h); ctx.globalAlpha = 1; } if (z.hp < ZHP) { const hx = Math.round(z.x - cam.x), hy = Math.round(z.y - cam.y) - 6; ctx.fillStyle = '#000'; ctx.fillRect(hx, hy, z.w, 3); ctx.fillStyle = '#d83b2e'; ctx.fillRect(hx, hy, z.w * z.hp / ZHP, 3); } }

  // player (blink while invuln)
  if (!(invuln > 0 && Math.floor(invuln * 20) % 2 === 0)) drawFlipped(IMG.player, player.x, player.y, player.face);
  // gun
  { const pcx = player.x + player.w / 2 - cam.x, pcy = player.y + 12 - cam.y; let ang = Math.atan2((mouse.y + cam.y) - (player.y + 12), (mouse.x + cam.x) - (player.x + player.w / 2)); if (!mouse.down && !lastMouseAim) ang = player.face > 0 ? 0 : Math.PI; ctx.save(); ctx.translate(Math.round(pcx), Math.round(pcy)); ctx.rotate(ang); ctx.fillStyle = '#1c1c20'; ctx.fillRect(2, -2, 13, 4); ctx.fillStyle = '#33343a'; ctx.fillRect(0, -3, 5, 6); ctx.restore(); }

  // particles
  for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x - cam.x - p.size / 2), Math.round(p.y - cam.y - p.size / 2), p.size, p.size); }
  ctx.globalAlpha = 1;

  cam.x = bx; cam.y = by;
  drawAtmosphere();
  drawBullets();
  if (hurtFlash > 0) { const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H / 3, VIEW_W / 2, VIEW_H / 2, VIEW_W / 1.3); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, 'rgba(255,0,0,' + (0.55 * hurtFlash).toFixed(3) + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  drawHUD();
  if (state !== 'play') drawOverlay();
}
let lastMouseAim = false;
canvas.addEventListener('mousemove', () => { lastMouseAim = true; });

function spr(img, x, y) { ctx.drawImage(img, Math.round(x - cam.x), Math.round(y - cam.y)); }
function drawFlipped(img, x, y, face) {
  const sx = Math.round(x - cam.x), sy = Math.round(y - cam.y);
  if (face < 0) { ctx.save(); ctx.translate(sx + img.width, sy); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore(); }
  else ctx.drawImage(img, sx, sy);
}

function drawParallax() {
  // distant ruined skyline silhouettes, two layers
  const layers = [{ s: 0.25, col: '#0d0f13', base: 360, h: 150 }, { s: 0.45, col: '#0b0c0f', base: 420, h: 200 }];
  for (const L of layers) {
    ctx.fillStyle = L.col;
    const off = (cam.x * L.s) % 160;
    for (let i = -1; i < VIEW_W / 160 + 2; i++) {
      const bx = i * 160 - off; const bh = L.h + ((i * 977) % 90) - 40;
      ctx.fillRect(bx + 10, L.base - bh, 60, bh + 200);
      ctx.fillRect(bx + 90, L.base - bh * 0.7, 50, bh + 200);
    }
  }
}

function drawBullets() {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const b of bullets) { const bx = b.x - cam.x, by = b.y - cam.y; const gg = ctx.createRadialGradient(bx, by, 0, bx, by, 11); gg.addColorStop(0, b.color || '#ffb428'); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = .5; ctx.fillStyle = gg; ctx.fillRect(bx - 11, by - 11, 22, 22); ctx.globalAlpha = .9; ctx.strokeStyle = b.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx - b.vx * .03, by - b.vy * .03); ctx.lineTo(bx, by); ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 2, 0, 7); ctx.fill(); }
  ctx.restore();
}

function drawAtmosphere() {
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#6a6f64'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); ctx.restore();
  // drifting fog
  for (let i = 0; i < 4; i++) { const t = animClock * (10 + i * 4) + i * 200; const fx = (t % (VIEW_W + 360)) - 180; const fy = 120 + i * 130 + Math.sin(animClock * .5 + i) * 30; const fr = 150 + i * 25; const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr); fg.addColorStop(0, 'rgba(150,160,165,0.05)'); fg.addColorStop(1, 'rgba(150,160,165,0)'); ctx.fillStyle = fg; ctx.fillRect(fx - fr, fy - fr, fr * 2, fr * 2); }
  // vignette
  const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H / 2.2, VIEW_W / 2, VIEW_H / 2, VIEW_W / 1.05); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.72)'); ctx.fillStyle = v; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function drawHUD() {
  ctx.fillStyle = 'rgba(12,12,10,0.82)'; ctx.fillRect(0, 0, VIEW_W, 40);
  // health
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(14, 9, 200, 16);
  ctx.fillStyle = health > 60 ? '#3aa83a' : health > 30 ? '#c8941a' : '#c0271a'; ctx.fillRect(14, 10, health * 2, 14);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#c9c2b4'; ctx.font = 'bold 15px "Courier New",monospace';
  ctx.fillText('♥' + lives, 222, 17);
  const w = WEAPONS[curW];
  ctx.fillStyle = w.color; ctx.fillText(w.name, 280, 12);
  ctx.fillStyle = wAmmo[curW] > 0 ? '#ffd23f' : '#ff5a5a'; ctx.fillText('⦿ ' + wAmmo[curW] + '/' + w.mag, 280, 28);
  // progress to finish
  const prog = clamp((player.x - LEVEL.playerStart[0]) / (finish.x - LEVEL.playerStart[0]), 0, 1);
  ctx.fillStyle = '#2a2a28'; ctx.fillRect(440, 14, 220, 6); ctx.fillStyle = '#3ad17a'; ctx.fillRect(440, 14, 220 * prog, 6);
  ctx.fillStyle = '#6a6358'; ctx.font = '11px "Courier New",monospace'; ctx.fillText('ВИХІД ▶', 440, 30);
  ctx.textAlign = 'right'; ctx.fillStyle = '#c9c2b4'; ctx.font = 'bold 15px "Courier New",monospace';
  ctx.fillText('☠' + kills + '   ' + score, VIEW_W - 14, 17); ctx.textAlign = 'left';
  // slots
  ctx.font = '10px "Courier New",monospace';
  for (let i = 0; i < 4; i++) { const sx = VIEW_W - 250 + i * 60; ctx.globalAlpha = owned[i] ? 1 : .3; ctx.fillStyle = i === curW ? WEAPONS[i].color : 'rgba(255,255,255,.12)'; ctx.fillRect(sx, 26, 56, 12); ctx.fillStyle = i === curW ? '#111' : '#ccc'; ctx.textAlign = 'center'; ctx.fillText((i + 1) + ' ' + WEAPONS[i].name, sx + 28, 32); ctx.globalAlpha = 1; }
  ctx.textAlign = 'left';
  if (toastT > 0) { ctx.globalAlpha = Math.min(1, toastT); ctx.font = 'bold 22px "Courier New",monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(toast, VIEW_W / 2 + 1, 71); ctx.fillStyle = '#ffe66a'; ctx.fillText(toast, VIEW_W / 2, 70); ctx.textAlign = 'left'; ctx.globalAlpha = 1; }
}

function drawOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = state === 'win' ? '#3ad17a' : '#9a2b2b';
  ctx.font = 'bold 60px "Courier New",monospace'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 20;
  ctx.fillText(state === 'win' ? 'ВИЖИВ!' : 'ТЕБЕ З’ЇЛИ', VIEW_W / 2, VIEW_H / 2 - 20);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#c9c2b4'; ctx.font = '20px "Courier New",monospace';
  ctx.fillText((state === 'win' ? 'Очки: ' + score + '  ·  Вбито: ' + kills : 'Життів не лишилось') + '   —   R: спочатку', VIEW_W / 2, VIEW_H / 2 + 36);
  ctx.textAlign = 'left';
}

// ---- loop ----
let last = 0;
function frame(t) { const dt = Math.min((t - last) / 1000, 0.05); last = t; update(dt); draw(); requestAnimationFrame(frame); }
requestAnimationFrame(t => { last = t; frame(t); });
