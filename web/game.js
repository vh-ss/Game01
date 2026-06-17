// PUNK TOWN — bright top-down shooter. Collect 15 coins, dodge/blast goofy
// zombies, heal at home. Sunny, friendly atmosphere (no horror).

const LEVEL = genWorld();   // fresh procedural town every run/restart
let VIEW_W = window.innerWidth, VIEW_H = window.innerHeight, DPR = Math.min(window.devicePixelRatio || 1, 2);
const TS = LEVEL.tileSize;
const COLS = LEVEL.width / TS, ROWS = LEVEL.height / TS;
const LW = LEVEL.width, LH = LEVEL.height;
const WINCOINS = 15;

const SPEED = 110, RUN_MULT = 1.8;
const STAM_MAX = 100, STAM_DRAIN = 32, STAM_REGEN = 10, STAM_REGEN_HOME = 50;
const ZSPEED = 48, ZCHASE = 80;
const ZHP = 4, LOOT_CHANCE = 0.3;
const MAX_ZOMBIES = 50, RESPAWN_EVERY = 2.2;
// some zombies are armed (different guns); each fires single shots — max 1 bullet in flight
const ARMED_CHANCE = 0.3;
const ZWEAPONS = [
  { name: 'Револьвер', dmg: 8, speed: 250, cd: 2.2, color: '#ff9a4d' },
  { name: 'Обріз', dmg: 14, speed: 210, cd: 3.2, color: '#ff5a4a' },
  { name: 'Гвинтівка', dmg: 6, speed: 370, cd: 1.7, color: '#8fd0ff' },
];
const WEAPONS = [
  { name: 'Пістолет', type: 'gun',   dmg: 1, rate: 0.30, mag: 12, speed: 500, pellets: 1, spread: 0,    color: '#ffd23f' },
  { name: 'Бита',     type: 'melee', dmg: 3, rate: 0.34, mag: Infinity, range: 42,          color: '#b9863f' },
  { name: 'Автомат',  type: 'gun',   dmg: 1, rate: 0.08, mag: 30, speed: 560, pellets: 1, spread: 0.06, color: '#56b8ff' },
  { name: 'Дробовик', type: 'gun',   dmg: 2, rate: 0.75, mag: 6,  speed: 460, pellets: 6, spread: 0.40, color: '#ff9a4d' },
  { name: 'Бластер',  type: 'gun',   dmg: 6, rate: 0.55, mag: 8,  speed: 820, pellets: 1, spread: 0,    color: '#c46bff' },
  { name: 'Вогнемет', type: 'flame', dmg: 1, rate: 0.04, mag: 140, range: 112, spread: 0.5, color: '#ff7a1a' },
];
const LOOT_WEAPONS = [2, 3, 4, 5];   // which weapons drop from zombies (not the two starters)
const WALKABLE = new Set([0, 3, 7]);   // grass, sand, path

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const IMG = SPRITES;
function resize() {
  VIEW_W = window.innerWidth; VIEW_H = window.innerHeight;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(VIEW_W * DPR); canvas.height = Math.floor(VIEW_H * DPR);
  canvas.style.width = VIEW_W + 'px'; canvas.style.height = VIEW_H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = true;   // smooth (no pixel look)
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

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
  // type: normal / runner (fast, weak) / tank (slow, tough, big) / exploder (bursts on death)
  const r = Math.random();
  let ztype = 'normal', hp = ZHP, w = 18, h = 22, sm = 1, armable = true;
  if (r < 0.18) { ztype = 'runner'; hp = 2; w = 16; h = 20; sm = 1.8; armable = false; }
  else if (r < 0.30) { ztype = 'tank'; hp = 14; w = 26; h = 30; sm = 0.6; armable = false; }
  else if (r < 0.42) { ztype = 'exploder'; hp = 3; w = 18; h = 22; sm = 1.1; armable = false; }
  const armed = armable && Math.random() < ARMED_CHANCE;
  return { x, y, w, h, vx: 0, vy: 0, t: 0, hp, maxhp: hp, flash: 0, frame: 0, ztype, sm,
    armed, zw: armed ? Math.floor(Math.random() * ZWEAPONS.length) : 0,
    shootCD: 0.6 + Math.random() * 2, hasBullet: false, aimx: 1, aimy: 0 };
}
function mkCrim(x, y) {
  const armed = Math.random() < 0.35;
  return { x, y, w: 18, h: 22, vx: 0, vy: 0, t: 0, hp: 5, flash: 0, frame: 0, crim: true, carrying: 0, stealCD: 0, fleeT: 0, stolenWeapon: null,
    armed, zw: armed ? Math.floor(Math.random() * ZWEAPONS.length) : 0, shootCD: 0.8 + Math.random() * 1.5, hasBullet: false, aimx: 1, aimy: 0 };
}
function coinVal() { const r = Math.random(); return r < 0.5 ? 1 : r < 0.8 ? 2 : r < 0.94 ? 3 : 5; }   // varying coin worth
let coins = LEVEL.coins.map(([x, y]) => ({ x, y, v: coinVal() }));
const homes = LEVEL.homes.map(([x, y]) => ({ x, y }));
const houseImgs = [IMG.house1, IMG.house2, IMG.house3];
let hs = 9; const h3 = () => (hs = (hs * 1103515245 + 12345) & 0x7fffffff) % 3;
const houses = LEVEL.houses.map(([x, y]) => ({ x, y, img: houseImgs[h3()], fire: 0, burnT: 0 }));

// reachability mask (only tiles the player can actually walk to)
const reach = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
for (const [c, r] of (LEVEL.reach || [])) if (r >= 0 && r < ROWS && c >= 0 && c < COLS) reach[r][c] = true;
const reachable = (c, r) => (LEVEL.reach ? !!reach[r] && reach[r][c] : !solid[r][c]);

// ammo crates on random reachable, open tiles (never inside enclosed/unreachable spots)
let aSeed = 777; const ar = () => (aSeed = (aSeed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
let ammoCrates = [];
{ let tries = 0; while (ammoCrates.length < 14 && tries++ < 4000) { const c = 1 + Math.floor(ar() * (COLS - 2)), r = 1 + Math.floor(ar() * (ROWS - 2)); const wx = c * TS, wy = r * TS; if (Math.abs(wx - player.x) < 100 && Math.abs(wy - player.y) < 100) continue; if (reachable(c, r) && ammoCrates.every(a => Math.abs(a.x - wx) > 140 || Math.abs(a.y - wy) > 140)) ammoCrates.push({ x: wx + 6, y: wy + 6, w: 20, h: 20 }); } }
// stock ~half the houses with ammo by their door (only where reachable)
for (const h of houses) {
  const c = Math.floor((h.x + 48) / TS), r = Math.floor((h.y + 84) / TS);
  if (r >= 0 && r < ROWS && c >= 0 && c < COLS && reachable(c, r) && ar() < 0.5) ammoCrates.push({ x: c * TS + 6, y: r * TS + 6, w: 20, h: 20 });
}
// wrecked cars (decoration) + extra coins stashed in houses & by cars
const cars = (LEVEL.cars || []).map(([x, y]) => ({ x, y, fire: 0, burnT: 0 }));
for (const h of houses) { const c = Math.floor((h.x + 48) / TS), r = Math.floor((h.y + 84) / TS); if (r >= 0 && r < ROWS && c >= 0 && c < COLS && reachable(c, r) && ar() < 0.55) coins.push({ x: c * TS + 16, y: r * TS + 16, v: coinVal() + 1 }); }
for (const cr of cars) { if (ar() < 0.6) coins.push({ x: cr.x + 22, y: cr.y + 12, v: coinVal() + 1 }); }

let health = 100, lives = 3, totalCoins = 0, kills = 0, state = 'title', stamina = STAM_MAX, animClock = 0, respawnT = RESPAWN_EVERY;
let combo = 0, comboT = 0, score = 0, coinsTotal = 0; let best = 0; try { best = +(localStorage.getItem('punktown_best') || 0); } catch (e) {}
let dmgMul = 1, spdMul = 1, maxHealth = 100, dmgLvl = 0, spdLvl = 0, hpLvl = 0, nearHome = false;
const SHOP = [
  { label: '❤ Аптечка — повне HP', cost: () => 4, buy: () => { health = maxHealth; } },
  { label: '🔫 Повний боєзапас', cost: () => 6, buy: () => { for (let i = 0; i < WEAPONS.length; i++) if (owned[i]) { wAmmo[i] = WEAPONS[i].mag; if (WEAPONS[i].mag !== Infinity) reserve[i] = MAX_MAGS; } } },
  { label: '💪 Шкода +25%', cost: () => 12 + dmgLvl * 12, buy: () => { dmgMul += 0.25; dmgLvl++; } },
  { label: '⚡ Швидкість +12%', cost: () => 10 + spdLvl * 10, buy: () => { spdMul += 0.12; spdLvl++; } },
  { label: '🛡 Броня +25 HP', cost: () => 14 + hpLvl * 14, buy: () => { maxHealth += 25; health += 25; hpLvl++; } },
  { label: '🔓 Випадкова зброя', cost: () => 20, buy: () => { const lk = [2, 3, 4, 5].filter(i => !owned[i]); if (lk.length) { const wi = lk[Math.floor(Math.random() * lk.length)]; owned[wi] = true; wAmmo[wi] = WEAPONS[wi].mag; } } },
];
function shopRowRect(i) { const w = 380, x = VIEW_W / 2 - w / 2, y = VIEW_H / 2 - 130 + 70 + i * 42; return { x, y, w, h: 36 }; }
function buyItem(i) { const it = SHOP[i]; if (!it) return; const c = it.cost(); if (totalCoins >= c) { totalCoins -= c; it.buy(); AUDIO.sfx.pickup(); showToast('Куплено: ' + it.label); } else { AUDIO.sfx.hurt(); showToast('Замало монет (' + c + ')'); } }
let endShown = false;
const $title = document.getElementById('titleScreen'), $end = document.getElementById('endScreen');
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
  quests.push({ type: 'key', label: 'Знайти ключ' });
  const hsp = questSpot(900); lockedHouse = { x: hsp[0], y: hsp[1], fire: 0, burnT: 0 };
  woman = { x: hsp[0] + 38, y: hsp[1] + 60, w: 18, h: 22, hp: 40, maxhp: 40, flash: 0, invuln: 0, frame: 0, walkT: 0, active: false, weapon: null, ammo: 0, fireCD: 0, aimx: 1, aimy: 0 };
  quests.push({ type: 'rescue', label: 'Врятувати жінку' });
  const bs = questSpot(700); boss = mkZombie(bs[0], bs[1]); boss.isBoss = true; boss.hp = 24; boss.maxhp = 24; boss.w = 30; boss.h = 34; boss.name = BOSS_NAMES[ri(BOSS_NAMES.length)]; boss.armed = true; boss.zw = 1; zombies.push(boss);
  quests.push({ type: 'boss', label: 'Здолати боса' });
  // one random side objective for variety
  if (Math.random() < 0.5) quests.push({ type: 'coins', target: 25 + ri(20), label: 'Монети' });
  else quests.push({ type: 'kills', target: 12 + ri(12), label: 'Зомбі' });
})();
// gangs of coin-stealing bandits, scattered across the town
for (let gi = 0; gi < 7; gi++) { const s = questSpot(380); const n = 3 + ri(4); for (let k = 0; k < n; k++) zombies.push(mkCrim(s[0] + ri(80) - 40, s[1] + ri(80) - 40)); }

// bushes (decor) — some hide an ambush gang that springs out when you get close
const bushes = [];
{
  const cells = reachCells.slice();
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  let ambushes = 0;
  for (const [c, r] of cells) {
    if (tileIdx[r][c] !== 0) continue;                                   // bushes only on grass
    const wx = c * TS + 16, wy = r * TS + 16;
    if (Math.hypot(wx - player.x, wy - player.y) < 220) continue;
    if (bushes.some(b => Math.abs(b.x - wx) < 64 && Math.abs(b.y - wy) < 64)) continue;
    const ambush = ambushes < 14;
    const bush = { x: wx, y: wy, ambush, triggered: false, members: [] };
    if (ambush) { const n = 2 + Math.floor(Math.random() * 4); for (let k = 0; k < n; k++) { const z = mkCrim(wx + Math.random() * 26 - 13, wy + Math.random() * 26 - 13); z.hidden = true; zombies.push(z); bush.members.push(z); } ambushes++; }
    bushes.push(bush);
    if (bushes.length >= 70) break;
  }
}
function checkQuests() {
  let all = true;
  for (const q of quests) {
    if (q.type === 'key') { q.done = hasKey; q.prog = hasKey ? '✓' : '🔑'; }
    else if (q.type === 'rescue') { q.done = womanRescued; q.prog = womanRescued ? '✓' : (womanFreed ? 'веди ДОДОМУ' : (hasKey ? 'відчини будинок' : 'потрібен ключ')); }
    else if (q.type === 'boss') { q.done = bossDead; q.prog = q.done ? '✓' : (boss && boss.hp > 0 ? Math.ceil(boss.hp) + 'hp' : ''); }
    else if (q.type === 'coins') { q.done = coinsTotal >= q.target; q.prog = Math.min(coinsTotal, q.target) + '/' + q.target; }
    else if (q.type === 'kills') { q.done = kills >= q.target; q.prog = Math.min(kills, q.target) + '/' + q.target; }
    if (!q.done) all = false;
  }
  if (all && state === 'play') { state = 'win'; AUDIO.stopMusic(); AUDIO.sfx.win(); }
}
let curW = 0; const owned = WEAPONS.map((w, i) => i < 2); const wAmmo = WEAPONS.map(w => w.mag);   // start with pistol + bat
const MAX_MAGS = 3; const reserve = WEAPONS.map((w, i) => i === 0 ? 1 : 0);   // spare magazines per weapon (0..3)
const bullets = [], eBullets = [], loot = [], particles = [];
let fireCD = 0, hurtFlash = 0, shakeT = 0, invuln = 0, hitCD = 0, healT = 0, dustT = 0, shareCD = 0;
let toast = '', toastT = 0, speech = '', speechT = 0; const face = { x: 1, y: 0 };
function say(t) { speech = t; speechT = 4.5; }
let questsCollapsed = false; const questPanel = { x: 10, y: 66, w: 210, h: 26 };
const inQuestPanel = (x, y) => x >= questPanel.x && x <= questPanel.x + questPanel.w && y >= questPanel.y && y <= questPanel.y + questPanel.h;
const cam = { x: 0, y: 0 };
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
let seed = 555; const sr = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

// ---- input ----
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (state === 'title' && (e.code === 'Space' || e.code === 'Enter')) startGame();
  else if ((state === 'win' || state === 'gameover') && e.code === 'KeyR') location.reload();
  else if (e.code === 'KeyB' && state === 'play' && nearHome) { state = 'shop'; }
  else if ((e.code === 'KeyB' || e.code === 'Escape') && state === 'shop') { state = 'play'; }
  else if (e.code === 'Escape' && state === 'play') { state = 'paused'; AUDIO.stopMusic(); }
  else if (e.code === 'Escape' && state === 'paused') { state = 'play'; AUDIO.startMusic(); }
  else if (state === 'shop' && /^Digit[1-6]$/.test(e.code)) buyItem(+e.code.slice(5) - 1);
  if (e.code === 'KeyM') { const on = AUDIO.toggleMusic(); showToast(on ? '♪ музика увімкнена' : '♪ музика вимкнена'); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
const mouse = { x: VIEW_W / 2, y: VIEW_H / 2, down: false, moved: false };
canvas.addEventListener('mousemove', e => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.moved = true; });
canvas.addEventListener('mousedown', () => { canvas.focus(); if (state === 'title') { startGame(); return; } if (state === 'shop') { for (let i = 0; i < SHOP.length; i++) { const r = shopRowRect(i); if (mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h) { buyItem(i); return; } } return; } if (state !== 'play') return; if (inQuestPanel(mouse.x, mouse.y)) { questsCollapsed = !questsCollapsed; return; } const wi = weaponSlotAt(mouse.x, mouse.y); if (wi >= 0) { if (owned[wi]) curW = wi; return; } mouse.down = true; });

function startGame() { if (state !== 'title') return; state = 'play'; if ($title) $title.classList.add('hidden'); AUDIO.start(); tryFullscreen(); }
function showEndScreen() {
  if (!$end) return;
  if (score > best) { best = score; try { localStorage.setItem('punktown_best', best); } catch (e) {} }
  const t = document.getElementById('endTitle'), p = document.getElementById('endText');
  const stat = ' · Очки: ' + score + ' · Рекорд: ' + best + ' · Вбито: ' + kills;
  if (state === 'win') { t.textContent = '🎉 ПЕРЕМОГА!'; t.className = 'win'; p.textContent = 'Жінку врятовано, боса повалено!' + stat; }
  else { t.textContent = '☠ КІНЕЦЬ ГРИ'; t.className = 'lose'; p.textContent = (failReason || 'Тебе здолали.') + stat; }
  $end.classList.remove('hidden');
}
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('againBtn').addEventListener('click', () => location.reload());
const isMobile = () => matchMedia('(pointer:coarse)').matches || innerWidth < 820;
function tryFullscreen() {
  if (!isMobile()) return;
  const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req) { try { req.call(el); } catch (e) {} }
  setTimeout(resize, 300);
}

// ---- touch controls (mobile): left = move stick, right = aim/fire stick ----
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const STICK_R = 52;
const tMove = { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false, mx: 0, my: 0 };
const tFire = { id: null, active: false };
const fireBtn = { r: 54, get x() { return VIEW_W - 86; }, get y() { return VIEW_H - 86; } };   // big round fire button (bottom-right)
const btnPause = { y: 48, w: 40, h: 32, get x() { return VIEW_W - 50; } };
const btnShop = { x: 10, y: 100, w: 120, h: 34 };   // appears near home on mobile
const inBtn = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
const inFire = (x, y) => Math.hypot(x - fireBtn.x, y - fireBtn.y) <= fireBtn.r + 12;
// weapon selector bar (bottom-centre) — tap/click an icon to equip
const WSLOT = 38, WGAP = 4, WBARW = WEAPONS.length * (WSLOT + WGAP) - WGAP;
const weaponSlotRect = i => ({ x: (VIEW_W - WBARW) / 2 + i * (WSLOT + WGAP), y: VIEW_H - WSLOT - 6, w: WSLOT, h: WSLOT });
function weaponSlotAt(px, py) { for (let i = 0; i < WEAPONS.length; i++) { const r = weaponSlotRect(i); if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i; } return -1; }
function autoAim() {
  const px = player.x + player.w / 2, py = player.y + player.h / 2; let best = null, bd = 520 * 520;
  for (const z of zombies) { if (z.hidden) continue; const dx = z.x + z.w / 2 - px, dy = z.y + z.h / 2 - py, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [dx, dy]; } }
  if (best) { const m = Math.hypot(best[0], best[1]) || 1; return { x: best[0] / m, y: best[1] / m }; }
  return { x: face.x, y: face.y };
}
function canvasXY(t) { const r = canvas.getBoundingClientRect(); return [t.clientX - r.left, t.clientY - r.top]; }
function cycleWeapon() { for (let k = 1; k <= WEAPONS.length; k++) { const ni = (curW + k) % WEAPONS.length; if (owned[ni]) { curW = ni; break; } } }

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const [x, y] = canvasXY(t);
    if (state === 'title') { startGame(); return; }
    if (state === 'win' || state === 'gameover') { location.reload(); return; }
    if (state === 'shop') { let hit = false; for (let i = 0; i < SHOP.length; i++) { const r = shopRowRect(i); if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { buyItem(i); hit = true; break; } } if (!hit) state = 'play'; continue; }
    if (inBtn(btnPause, x, y)) { if (state === 'play') { state = 'paused'; AUDIO.stopMusic(); } else if (state === 'paused') { state = 'play'; AUDIO.startMusic(); } continue; }
    if (state !== 'play') continue;
    if (nearHome && inBtn(btnShop, x, y)) { state = 'shop'; continue; }
    if (inQuestPanel(x, y)) { questsCollapsed = !questsCollapsed; continue; }
    { const wi = weaponSlotAt(x, y); if (wi >= 0) { if (owned[wi]) curW = wi; continue; } }
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
  if (health <= 0) { lives--; if (lives <= 0) { state = 'gameover'; AUDIO.stopMusic(); AUDIO.sfx.lose(); return; } health = maxHealth; player.x = LEVEL.playerStart[0]; player.y = LEVEL.playerStart[1]; invuln = 1.2; }
}
let swingFx = 0, swingAng = 0;
function deathFx(z) {
  if (z.dead) return; z.dead = true;
  if (z.isBoss) { bossDead = true; shakeT = Math.max(shakeT, 0.4); spawnBurst(z.x + 15, z.y + 17, '#8ec257', 26, 220, 4); showToast('Боса повалено!'); }
  else if (z.crim) {
    spawnBurst(z.x + 9, z.y + 11, '#c0392b', 14, 160, 3);
    for (let k = 0; k < (z.carrying || 0); k++) coins.push({ x: z.x + Math.random() * 22 - 11, y: z.y + Math.random() * 22 - 11, v: 1 });   // drop stolen coins
    if (z.stolenWeapon != null) loot.push({ x: z.x, y: z.y, w: 22, h: 18, weapon: z.stolenWeapon });   // drop stolen weapon
    if (z.carrying > 0 || z.stolenWeapon != null) showToast('Здобич повернуто! 💰');
  }
  else if (z.ztype === 'exploder') {                    // blows up on death — chains & hurts player
    spawnBurst(z.x + 9, z.y + 11, '#ff7a1a', 26, 240, 4); spawnBurst(z.x + 9, z.y + 11, '#ffd23f', 12, 180, 3); shakeT = Math.max(shakeT, 0.28);
    const ex = z.x + z.w / 2, ey = z.y + z.h / 2, R = 72;
    if (Math.hypot(player.x + 9 - ex, player.y + 11 - ey) < R) hurt(26);
    for (const o of zombies) { if (o !== z && !o.dead && !o.hidden && Math.hypot(o.x + o.w / 2 - ex, o.y + o.h / 2 - ey) < R) damageZombie(o, 6, 0, 0); }
  }
  else spawnBurst(z.x + 9, z.y + 11, '#8ec257', 16, 170, 3);
  spawnBurst(z.x + 9, z.y + 11, '#ffffff', 6, 120, 2); dropLoot(z); kills++; AUDIO.sfx.zombie();
  // coin drops (vary by type)
  let drops = 0;
  if (z.isBoss) drops = 10; else if (z.ztype === 'tank') drops = 3; else if (!z.crim && Math.random() < 0.45) drops = 1;
  for (let k = 0; k < drops; k++) coins.push({ x: z.x + z.w / 2 + Math.random() * 30 - 15, y: z.y + z.h / 2 + Math.random() * 30 - 15, v: coinVal() + (z.isBoss ? 2 : z.ztype === 'tank' ? 1 : 0) });
  // combo & score
  combo++; comboT = 2.6; score += Math.round((z.isBoss ? 200 : z.ztype === 'tank' ? 30 : 12) * (1 + Math.min(combo, 25) * 0.12));
}
function damageZombie(z, dmg, kx, ky) { z.hp -= dmg; z.flash = 0.12; z.x += (kx || 0) * 1.4; z.y += (ky || 0) * 1.4; if (z.hp <= 0) deathFx(z); }
function fire(dx, dy) {
  const w = WEAPONS[curW]; const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m; face.x = dx; face.y = dy;
  const dmg = Math.max(1, Math.round(w.dmg * dmgMul));
  const px = player.x + player.w / 2, py = player.y + player.h / 2;
  if (w.type === 'melee') {              // bat — short-range swing, no ammo
    swingFx = 0.16; swingAng = Math.atan2(dy, dx); shakeT = Math.max(shakeT, 0.05);
    for (const z of zombies) { if (z.dead || z.hidden) continue; const zx = z.x + z.w / 2 - px, zy = z.y + z.h / 2 - py, d = Math.hypot(zx, zy); if (d <= w.range + 12 && (zx * dx + zy * dy) / (d || 1) > 0.1) damageZombie(z, dmg, dx, dy); }
    AUDIO.sfx.melee(); return;
  }
  if (w.type === 'flame') {              // flamethrower — short cone, burns fuel
    wAmmo[curW]--;
    for (let i = 0; i < 3; i++) { const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * w.spread, s = 150 + Math.random() * 130; particles.push({ x: px + dx * 10, y: py + dy * 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3 + Math.random() * 0.25, max: 0.55, color: ['#ff7a1a', '#ffd23f', '#ff4a1a'][i % 3], size: 4 + Math.random() * 3, grav: 0 }); }
    for (const z of zombies) { if (z.dead || z.hidden) continue; const zx = z.x + z.w / 2 - px, zy = z.y + z.h / 2 - py, d = Math.hypot(zx, zy); if (d <= w.range && (zx * dx + zy * dy) / (d || 1) > 0.5) damageZombie(z, dmg, dx * 0.4, dy * 0.4); }
    // ignite cars & buildings caught in the flame cone
    const ignite = (o, ocx, ocy) => { if (!o || o.fire) return; const ox = ocx - px, oy = ocy - py, d = Math.hypot(ox, oy); if (d <= w.range + 30 && (ox * dx + oy * dy) / (d || 1) > 0.35) { o.fire = 1; o.burnT = 60 + Math.random() * 60; showToast('🔥 Підпалено!'); } };
    for (const cr of cars) ignite(cr, cr.x + 23, cr.y + 14);
    for (const hh of houses) ignite(hh, hh.x + 48, hh.y + 50);
    ignite(lockedHouse, lockedHouse.x + 48, lockedHouse.y + 50);
    AUDIO.sfx.flame(); return;
  }
  // guns
  wAmmo[curW]--;
  const base = Math.atan2(dy, dx), mx = px + dx * 12, my = py + dy * 12;
  for (let p = 0; p < w.pellets; p++) { const a = base + (w.pellets > 1 ? (Math.random() - 0.5) * w.spread * 2 : (Math.random() - 0.5) * w.spread); bullets.push({ x: mx, y: my, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, life: 1.0, dmg: dmg, color: w.color }); }
  spawnBurst(mx, my, '#fff2a8', 3, 50, 2); shakeT = Math.max(shakeT, w.pellets > 1 ? 0.1 : 0.04);
  AUDIO.sfx.shoot(curW);
}
function womanFire(wx, wy, dx, dy) {
  const w = WEAPONS[woman.weapon];
  if (w.type === 'flame') {
    for (let i = 0; i < 3; i++) { const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * w.spread, s = 150 + Math.random() * 120; particles.push({ x: wx + dx * 8, y: wy + dy * 8, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3 + Math.random() * 0.2, max: 0.5, color: ['#ff7a1a', '#ffd23f', '#ff4a1a'][i % 3], size: 4, grav: 0 }); }
    for (const z of zombies) { if (z.dead || z.hidden) continue; const zx = z.x + z.w / 2 - wx, zy = z.y + z.h / 2 - wy, d = Math.hypot(zx, zy); if (d <= w.range && (zx * dx + zy * dy) / (d || 1) > 0.5) damageZombie(z, w.dmg, dx * 0.3, dy * 0.3); }
    return;
  }
  const base = Math.atan2(dy, dx);
  for (let p = 0; p < w.pellets; p++) { const a = base + (w.pellets > 1 ? (Math.random() - 0.5) * w.spread * 2 : (Math.random() - 0.5) * w.spread); bullets.push({ x: wx, y: wy, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, life: 1.0, dmg: w.dmg, color: w.color }); }
}
function dropLoot(z) { if (sr() > LOOT_CHANCE) return; loot.push({ x: z.x, y: z.y, w: 22, h: 18, weapon: LOOT_WEAPONS[Math.floor(sr() * LOOT_WEAPONS.length)] }); }
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
  const sp = SPEED * spdMul * (running ? RUN_MULT : 1) * (onSand ? 0.5 : 1) * dt;
  let mvx = ix, mvy = iy; if (mag > 1) { mvx = ix / mag; mvy = iy / mag; }
  tryMove(player, mvx * sp, mvy * sp);
  if (moving) { player.walkT += dt * (running ? 1.5 : 1); player.frame = 1 + (Math.floor(player.walkT * 9) % 2); } else { player.frame = 0; }

  // dust on sand
  dustT -= dt;
  if (onSand && moving && dustT <= 0) { particles.push({ x: player.x + player.w / 2 + (Math.random() * 10 - 5), y: player.y + player.h, vx: Math.random() * 20 - 10, vy: -10 - Math.random() * 15, life: 0.4, max: 0.4, color: '#f0d98a', size: 2, grav: 60 }); dustT = running ? 0.06 : 0.12; }

  // shooting
  fireCD -= dt;
  for (let i = 0; i < WEAPONS.length; i++) if (keys['Digit' + (i + 1)] && owned[i]) curW = i;
  // auto-reload the current weapon from a spare magazine when empty
  if (WEAPONS[curW].mag !== Infinity && wAmmo[curW] <= 0 && reserve[curW] > 0) { wAmmo[curW] = WEAPONS[curW].mag; reserve[curW]--; AUDIO.sfx.pickup(); }
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
    for (let j = zombies.length - 1; j >= 0; j--) { const z = zombies[j]; if (!z.dead && !z.hidden && b.x >= z.x && b.x <= z.x + z.w && b.y >= z.y && b.y <= z.y + z.h) {
      damageZombie(z, b.dmg, Math.sign(b.vx), Math.sign(b.vy));
      if (!z.dead) spawnBurst(b.x, b.y, '#8ec257', 5, 80, 2);
      bullets.splice(i, 1); break;
    } }
  }
  for (let i = zombies.length - 1; i >= 0; i--) if (zombies[i].dead) zombies.splice(i, 1);   // remove the slain

  // zombie respawn (keeps the town populated)
  respawnT -= dt; if (respawnT <= 0) { respawnT = RESPAWN_EVERY; respawnZombie(); }

  // ambush bushes — spring the hidden gang when the player gets close
  for (const b of bushes) {
    if (b.ambush && !b.triggered && Math.hypot(player.x + 9 - b.x, player.y + 11 - b.y) < 135) {
      b.triggered = true; for (const m of b.members) m.hidden = false;
      spawnBurst(b.x, b.y, '#46522c', 20, 170, 3); spawnBurst(b.x, b.y, '#6a8f3a', 10, 120, 2);
      shakeT = Math.max(shakeT, 0.14); showToast('Засідка! 🌿'); AUDIO.sfx.melee();
    }
  }

  // zombies + bandits (roam + chase)
  for (const z of zombies) {
    if (z.hidden) continue;                                  // bandits lying in ambush
    z.flash = Math.max(0, z.flash - dt);
    if (z.crim) { z.stealCD = Math.max(0, z.stealCD - dt); z.fleeT = Math.max(0, z.fleeT - dt); }
    z.frame = 1 + (Math.floor(animClock * 8 + z.x * 0.05) % 2);
    const zx = z.x + z.w / 2, zy = z.y + z.h / 2, px = player.x + player.w / 2, py = player.y + player.h / 2;
    const d = Math.hypot(px - zx, py - zy);
    const chaseR = z.crim ? 300 : 220, spd = (z.crim ? ZCHASE * 1.15 : ZCHASE) * (z.sm || 1);   // type speed
    if (z.crim && z.fleeT > 0) { const m = d || 1; z.vx = (zx - px) / m * spd * 1.3; z.vy = (zy - py) / m * spd * 1.3; }  // run away after a theft
    else if (d < chaseR) { const m = d || 1; z.vx = (px - zx) / m * spd; z.vy = (py - zy) / m * spd; }
    else { z.t -= dt; if (z.t <= 0) pickDir(z); }
    tryMove(z, z.vx * dt, z.vy * dt);
    // boss: plasma-cannon fan blast
    if (z.isBoss) {
      z.shootCD -= dt; const m = d || 1; z.aimx = (px - zx) / m; z.aimy = (py - zy) / m;
      if (z.shootCD <= 0 && d < 460) {
        const a0 = Math.atan2(z.aimy, z.aimx);
        for (let p = -2; p <= 2; p++) { const a = a0 + p * 0.17; eBullets.push({ x: zx, y: zy, vx: Math.cos(a) * 360, vy: Math.sin(a) * 360, life: 2.2, dmg: 13, color: '#c46bff', big: true, owner: null }); }
        z.shootCD = 1.5; shakeT = Math.max(shakeT, 0.12); AUDIO.sfx.eshoot(1);
      }
    }
    // armed zombies/bandits fire single shots (max 1 bullet each in flight)
    else if (z.armed) {
      z.shootCD -= dt; const m = d || 1; z.aimx = (px - zx) / m; z.aimy = (py - zy) / m;
      const w = ZWEAPONS[z.zw];
      if (!z.hasBullet && z.shootCD <= 0 && d < 340) {
        eBullets.push({ x: zx, y: zy, vx: z.aimx * w.speed, vy: z.aimy * w.speed, life: 1.8, dmg: w.dmg, color: w.color, owner: z });
        z.hasBullet = true; z.shootCD = w.cd; AUDIO.sfx.eshoot(z.zw);
      }
    }
    if (aabb(player.x, player.y, player.w, player.h, z.x, z.y, z.w, z.h)) {
      if (z.crim) {
        if (z.stealCD <= 0 && z.fleeT <= 0) {
          let stole = false;
          const stealable = [2, 3, 4, 5].filter(i => owned[i]);   // only non-starter guns can be grabbed
          if (z.stolenWeapon == null && stealable.length && Math.random() < 0.3) {
            const wi = stealable[Math.floor(Math.random() * stealable.length)];
            owned[wi] = false; z.stolenWeapon = wi; if (curW === wi) curW = 1; showToast('Бандит вкрав зброю: ' + WEAPONS[wi].name + '!'); stole = true;
          } else if (totalCoins > 0) { totalCoins--; z.carrying++; showToast('Бандит вкрав монету! 💰'); stole = true; }
          hurt(8); z.stealCD = 1.0; if (stole) z.fleeT = 4.0;       // flee after a successful theft
        }
      } else hurt(z.ztype === 'tank' ? 26 : 16);
    }
  }

  // enemy bullets
  for (let i = eBullets.length - 1; i >= 0; i--) {
    const b = eBullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0 || boxSolid(b.x - 1, b.y - 1, 2, 2) || b.x < 0 || b.x > LW || b.y < 0 || b.y > LH;
    if (!dead && invuln <= 0 && aabb(player.x, player.y, player.w, player.h, b.x - 2, b.y - 2, 4, 4)) { hurt(b.dmg); dead = true; }
    if (dead) { if (b.owner) b.owner.hasBullet = false; eBullets.splice(i, 1); }
  }

  // home heal
  let onHome = false; nearHome = false;
  for (const hm of homes) if (aabb(player.x, player.y, player.w, player.h, hm.x - 16, hm.y - 40, 96 + 32, 112)) {
    onHome = true; nearHome = true; if (health < maxHealth) { health = Math.min(maxHealth, health + 60 * dt); } for (let i = 0; i < WEAPONS.length; i++) if (owned[i]) { wAmmo[i] = WEAPONS[i].mag; if (WEAPONS[i].mag !== Infinity) reserve[i] = MAX_MAGS; }
    healT -= dt; if (healT <= 0 && health < 100) { particles.push({ x: player.x + 9 + (Math.random() * 20 - 10), y: player.y + player.h, vx: Math.random() * 14 - 7, vy: -28, life: 0.6, max: 0.6, color: '#7dff9a', size: 3, grav: -10 }); healT = 0.14; }
  }
  stamina = clamp(stamina + (running ? -STAM_DRAIN : (onHome ? STAM_REGEN_HOME : STAM_REGEN)) * dt, 0, STAM_MAX);

  // pickups
  coins = coins.filter(co => { if (aabb(player.x, player.y, player.w, player.h, co.x - 10, co.y - 10, 28, 28)) { const v = co.v || 1; totalCoins += v; coinsTotal += v; score += v * 5; spawnBurst(co.x, co.y, '#ffd23f', 6 + v * 2, 80, 2); AUDIO.sfx.coin(); return false; } return true; });
  // key pickup
  if (keyItem && !keyItem.got && aabb(player.x, player.y, player.w, player.h, keyItem.x - 6, keyItem.y - 6, 28, 28)) { keyItem.got = true; hasKey = true; AUDIO.sfx.pickup(); spawnBurst(keyItem.x + 6, keyItem.y + 6, '#ffd23f', 16, 140, 3); showToast('Знайдено ключ! Іди до будинку 🏚'); }
  // unlock the house with the key
  if (hasKey && !womanFreed && lockedHouse && aabb(player.x, player.y, player.w, player.h, lockedHouse.x - 10, lockedHouse.y, 116, 110)) {
    womanFreed = true; woman.active = true; AUDIO.sfx.pickup(); spawnBurst(lockedHouse.x + 48, lockedHouse.y + 60, '#ffd23f', 20, 160, 3); say('Дякую, що відчинив! Прикрий мене — і веди ДОДОМУ, будь ласка.');
  }
  // woman: follow, take damage, escort, or die
  if (woman && woman.active && !womanRescued && !womanDead) {
    woman.invuln = Math.max(0, woman.invuln - dt); woman.flash = Math.max(0, woman.flash - dt);
    const wcx = woman.x + woman.w / 2, wcy = woman.y + woman.h / 2, pcx2 = player.x + player.w / 2, pcy2 = player.y + player.h / 2;
    // pick a target: nearest weapon if unarmed, nearest ammo crate if out of ammo, else the player
    let tx = pcx2, ty = pcy2, stop = 42;
    if (woman.weapon == null && loot.length) {
      let bl = null, bd = 300 * 300;
      for (const a of loot) { const dx = a.x + 11 - wcx, dy = a.y + 9 - wcy, q = dx * dx + dy * dy; if (q < bd) { bd = q; bl = a; } }
      if (bl) { tx = bl.x + 11; ty = bl.y + 9; stop = 6; }
    } else if (woman.weapon != null && woman.ammo <= 0 && ammoCrates.length) {
      let ba = null, bd = 360 * 360;
      for (const a of ammoCrates) { const dx = a.x + 10 - wcx, dy = a.y + 10 - wcy, q = dx * dx + dy * dy; if (q < bd) { bd = q; ba = a; } }
      if (ba) { tx = ba.x + 10; ty = ba.y + 10; stop = 6; }
    }
    const dt2 = Math.hypot(tx - wcx, ty - wcy);
    if (dt2 > stop) { const sp = 125 * dt; tryMove(woman, (tx - wcx) / dt2 * sp, (ty - wcy) / dt2 * sp); woman.walkT += dt; woman.frame = 1 + (Math.floor(woman.walkT * 8) % 2); } else woman.frame = 0;
    // she shoots back if she has a weapon and ammo
    if (woman.weapon != null && woman.ammo > 0) {
      woman.fireCD -= dt;
      let best = null, bd = 320 * 320;
      for (const z of zombies) { if (z.dead || z.hidden) continue; const dx = z.x + z.w / 2 - wcx, dy = z.y + z.h / 2 - wcy, q = dx * dx + dy * dy; if (q < bd) { bd = q; best = [dx, dy]; } }
      if (best) { const m = Math.hypot(best[0], best[1]) || 1; woman.aimx = best[0] / m; woman.aimy = best[1] / m; if (woman.fireCD <= 0) { womanFire(wcx, wcy, woman.aimx, woman.aimy); woman.fireCD = WEAPONS[woman.weapon].rate; woman.ammo--; } }
    }
    // share ammo when standing close together (whoever is empty gets a hand)
    shareCD = Math.max(0, shareCD - dt);
    const near = Math.hypot(pcx2 - wcx, pcy2 - wcy) < 56, pFinite = WEAPONS[curW].mag !== Infinity;
    if (near && shareCD <= 0 && pFinite) {
      if (woman.weapon != null && woman.ammo <= 0 && wAmmo[curW] > 6) {                       // you → her
        const give = Math.min(Math.floor(wAmmo[curW] / 2), 20); wAmmo[curW] -= give; woman.ammo = Math.min(WEAPONS[woman.weapon].mag * 3, woman.ammo + give); shareCD = 1.2; showToast('Ти поділився набоями 🤝');
      } else if (wAmmo[curW] <= 0 && woman.weapon != null && woman.ammo > 6) {                 // her → you
        const give = Math.min(Math.floor(woman.ammo / 2), 20); woman.ammo -= give; wAmmo[curW] = Math.min(WEAPONS[curW].mag, wAmmo[curW] + give); shareCD = 1.2; showToast('Жінка поділилась набоями 🤝');
      }
    }
    for (const z of zombies) if (!z.hidden && woman.invuln <= 0 && aabb(woman.x, woman.y, woman.w, woman.h, z.x, z.y, z.w, z.h)) { woman.hp -= 14; woman.invuln = 0.6; woman.flash = 0.14; spawnBurst(wcx, wcy, '#e0518f', 6, 90, 2); break; }
    if (woman.hp <= 0) { womanDead = true; state = 'gameover'; failReason = 'Жінку вбили — місію провалено'; AUDIO.stopMusic(); AUDIO.sfx.lose(); }
    for (const hm of homes) if (aabb(woman.x, woman.y, woman.w, woman.h, hm.x - 16, hm.y - 40, 128, 112)) { womanRescued = true; woman.active = false; spawnBurst(woman.x + 9, woman.y + 11, '#7dff9a', 16, 130, 3); say('Я вдома! Дякую, що врятував мене! 💚'); AUDIO.sfx.win(); }
  }
  ammoCrates = ammoCrates.filter(a => {
    if (WEAPONS[curW].mag !== Infinity && reserve[curW] < MAX_MAGS && aabb(player.x, player.y, player.w, player.h, a.x, a.y, a.w, a.h)) { reserve[curW] = Math.min(MAX_MAGS, reserve[curW] + 1); spawnBurst(a.x + 10, a.y + 8, '#ffd23f', 8, 90, 2); AUDIO.sfx.pickup(); showToast('+ магазин (' + WEAPONS[curW].name + ')'); return false; }
    if (woman && woman.active && !womanRescued && woman.weapon != null && woman.ammo < WEAPONS[woman.weapon].mag * 3 && aabb(woman.x, woman.y, woman.w, woman.h, a.x, a.y, a.w, a.h)) { woman.ammo = WEAPONS[woman.weapon].mag * 3; spawnBurst(a.x + 10, a.y + 8, '#ffd23f', 8, 90, 2); AUDIO.sfx.pickup(); showToast('Жінка поповнила набої'); return false; }
    return true;
  });
  for (let i = loot.length - 1; i >= 0; i--) { const a = loot[i]; if (aabb(player.x, player.y, player.w, player.h, a.x, a.y, a.w, a.h)) {
    const justStarters = owned.filter(Boolean).length <= 2;               // still only the starter weapons?
    owned[a.weapon] = true; wAmmo[a.weapon] = WEAPONS[a.weapon].mag;
    if (justStarters) curW = a.weapon;                                     // auto-equip the first looted gun
    spawnBurst(a.x + 11, a.y + 9, WEAPONS[a.weapon].color, 14, 130, 3); AUDIO.sfx.pickup();
    showToast('Нова зброя: ' + WEAPONS[a.weapon].name + (justStarters ? '!' : ' (натисни ' + (a.weapon + 1) + ')'));
    loot.splice(i, 1); continue;
  }
  // the escorted woman can grab a weapon too and fight with it
  if (woman && woman.active && !womanRescued && aabb(woman.x, woman.y, woman.w, woman.h, a.x, a.y, a.w, a.h)) {
    woman.weapon = a.weapon; woman.fireCD = 0.3; woman.ammo = WEAPONS[a.weapon].mag * 3; spawnBurst(a.x + 11, a.y + 9, WEAPONS[a.weapon].color, 12, 120, 3); AUDIO.sfx.pickup();
    showToast('Жінка озброїлась: ' + WEAPONS[a.weapon].name + '!'); loot.splice(i, 1);
  } }

  // timers + particles
  hurtFlash = Math.max(0, hurtFlash - dt * 1.5); shakeT = Math.max(0, shakeT - dt); invuln = Math.max(0, invuln - dt); toastT = Math.max(0, toastT - dt); swingFx = Math.max(0, swingFx - dt); speechT = Math.max(0, speechT - dt);
  comboT = Math.max(0, comboT - dt); if (comboT <= 0) combo = 0;
  for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.vy += (p.grav || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) particles.splice(i, 1); }
  updateBurn(dt);

  checkQuests();

  cam.x = clamp(player.x + player.w / 2 - VIEW_W / 2, 0, LW - VIEW_W);
  cam.y = clamp(player.y + player.h / 2 - VIEW_H / 2, 0, LH - VIEW_H);
}

// ================= RENDER =================
function spr(img, x, y) { ctx.drawImage(img, Math.round(x - cam.x), Math.round(y - cam.y)); }
function updateBurn(dt) {
  const burn = (o, cx, topY) => {
    if (!o) return;
    if (o.fire === 1) {
      o.burnT -= dt; if (o.burnT <= 0) { o.fire = 2; return; }
      if (Math.random() < 0.6) particles.push({ x: cx + Math.random() * 22 - 11, y: topY + Math.random() * 10, vx: Math.random() * 18 - 9, vy: -42 - Math.random() * 40, life: 0.4 + Math.random() * 0.3, max: 0.7, color: ['#ff7a1a', '#ffd23f', '#ff4a1a'][Math.floor(Math.random() * 3)], size: 4 + Math.random() * 3, grav: -20 });
      if (Math.random() < 0.5) particles.push({ x: cx + Math.random() * 26 - 13, y: topY - 6, vx: Math.random() * 12 - 6, vy: -26 - Math.random() * 18, life: 1.2 + Math.random() * 0.8, max: 2.0, color: 'rgba(55,55,55,0.5)', size: 6 + Math.random() * 5, grav: -8 });
    } else if (o.fire === 2 && Math.random() < 0.012) {
      particles.push({ x: cx + Math.random() * 16 - 8, y: topY - 4, vx: Math.random() * 8 - 4, vy: -18, life: 1.6, max: 1.6, color: 'rgba(80,80,80,0.32)', size: 5, grav: -6 });
    }
  };
  for (const cr of cars) burn(cr, cr.x + 23, cr.y + 4);
  for (const hh of houses) burn(hh, hh.x + 48, hh.y + 22);
  burn(lockedHouse, lockedHouse && lockedHouse.x + 48, lockedHouse && lockedHouse.y + 22);
}
function burnLook(o, sx, sy, w, h) {
  if (!o) return;
  if (o.fire === 2) { ctx.fillStyle = 'rgba(16,12,9,0.74)'; ctx.fillRect(sx, sy + h * 0.25, w, h * 0.75); }   // charred
  else if (o.fire === 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const fl = 0.5 + 0.5 * Math.sin(animClock * 12 + sx); ctx.fillStyle = 'rgba(255,120,30,' + (0.22 + 0.2 * fl).toFixed(2) + ')'; ctx.fillRect(sx, sy + h * 0.3, w, h * 0.7); ctx.restore(); }
}
function drawBush(b) {
  const x = b.x - cam.x, y = b.y - cam.y;
  if (x < -40 || x > VIEW_W + 40 || y < -40 || y > VIEW_H + 40) return;
  const sway = (b.ambush && !b.triggered) ? Math.sin(animClock * 3 + b.x) * 1.5 : 0;   // subtle rustle hint
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x, y + 11, 17, 5, 0, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(x - 4, y - 6, 3, x, y, 19); g.addColorStop(0, '#4a6a36'); g.addColorStop(1, '#2c4520'); ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x - 11 + sway, y, 11, 0, 7); ctx.arc(x + 11 - sway, y, 11, 0, 7); ctx.arc(x, y - 8, 13, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(130,160,95,.4)'; ctx.beginPath(); ctx.arc(x - 6, y - 7, 3, 0, 7); ctx.arc(x + 6, y - 4, 3, 0, 7); ctx.fill();
}

// crisp procedural apocalypse ground — drawn fresh each tile (no blurry scaled sprites)
function thash(c, r) { let h = (c * 374761393 + r * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }
function paintTile(t, x, y, c, r) {
  const h = thash(c, r), h2 = thash(c * 3 + 1, r * 2 + 7), T = TS;
  if (t === 0) {                                   // dead grass
    ctx.fillStyle = h < .34 ? '#6b7243' : h < .67 ? '#646c3e' : '#737b4c'; ctx.fillRect(x, y, T + 1, T + 1);
    ctx.fillStyle = 'rgba(48,54,28,.5)'; ctx.fillRect(x + 6 + (h * 16 | 0), y + 8, 2, 6); ctx.fillRect(x + 20 - (h2 * 10 | 0), y + 20, 2, 5);
    if (h2 > .8) { ctx.fillStyle = 'rgba(140,128,80,.4)'; ctx.fillRect(x + 4, y + 22, 12, 6); }
  } else if (t === 7) {                            // cracked asphalt road
    ctx.fillStyle = h < .5 ? '#4c5056' : '#454950'; ctx.fillRect(x, y, T + 1, T + 1);
    ctx.strokeStyle = 'rgba(18,20,22,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + h * T, y); ctx.lineTo(x + h2 * T, y + T); ctx.stroke();
    if ((c & 1) === 0) { ctx.fillStyle = 'rgba(150,140,70,.35)'; ctx.fillRect(x + T / 2 - 2, y + 6, 4, 8); }
  } else if (t === 3) {                            // mud
    ctx.fillStyle = h < .5 ? '#665538' : '#5a4a30'; ctx.fillRect(x, y, T + 1, T + 1);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(x + 8 + h * 14, y + 16, 7, 3, 0, 0, 7); ctx.fill();
  } else if (t === 2) {                            // murky water
    ctx.fillStyle = '#2c3a36'; ctx.fillRect(x, y, T + 1, T + 1);
    ctx.fillStyle = 'rgba(80,110,90,.35)'; ctx.beginPath(); ctx.ellipse(x + 14, y + 12 + h * 8, 8, 2.5, 0, 0, 7); ctx.fill();
  } else if (t === 4) {                            // dead tree (on grass)
    ctx.fillStyle = '#646c3e'; ctx.fillRect(x, y, T + 1, T + 1);
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x + 16, y + 27, 9, 3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#4a3a28'; ctx.fillRect(x + 14, y + 12, 4, 16);
    ctx.strokeStyle = '#3a2e1e'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(x + 16, y + 16); ctx.lineTo(x + 8, y + 6); ctx.moveTo(x + 16, y + 14); ctx.lineTo(x + 24, y + 5); ctx.moveTo(x + 16, y + 12); ctx.lineTo(x + 17, y + 2); ctx.stroke();
    if (h > .5) { ctx.fillStyle = '#46522c'; ctx.fillRect(x + 7 + (h2 * 14 | 0), y + 4, 3, 3); }
  } else if (t === 5) {                            // broken fence (on grass)
    ctx.fillStyle = '#646c3e'; ctx.fillRect(x, y, T + 1, T + 1);
    ctx.fillStyle = '#5a4730'; ctx.fillRect(x, y + 12, T, 3); ctx.fillRect(x, y + 22, T, 3);
    ctx.fillStyle = '#4a3a26'; for (const px of [4, 16, 27]) ctx.fillRect(x + px, y + 5 + (px === 16 ? 2 : 0), 4, 22);
  } else if (t === 6) {                            // brick ruin
    ctx.fillStyle = '#683630'; ctx.fillRect(x, y, T + 1, T + 1);
    ctx.fillStyle = '#7a4035'; for (let rr2 = 0; rr2 < 4; rr2++) { const off = (rr2 % 2) * 8; for (let bx = -8; bx < T; bx += 16) ctx.fillRect(x + bx + off + 1, y + rr2 * 8 + 1, 14, 6); }
    ctx.fillStyle = 'rgba(40,30,26,.6)'; for (let rr2 = 0; rr2 <= 4; rr2++) ctx.fillRect(x, y + rr2 * 8, T, 1);
    if (h > .6) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x + (h2 * 3 | 0) * 8, y + (h * 3 | 0) * 8 + 1, 14, 6); }
  } else {                                         // concrete wall (1)
    ctx.fillStyle = '#5f6368'; ctx.fillRect(x, y, T + 1, T + 1);
    ctx.fillStyle = '#6c7075'; for (let rr2 = 0; rr2 < 4; rr2++) { const off = (rr2 % 2) * 8; ctx.fillRect(x + off - 6, y + rr2 * 8 + 1, 14, 6); ctx.fillRect(x + off + 10, y + rr2 * 8 + 1, 14, 6); }
    ctx.fillStyle = 'rgba(20,22,24,.4)'; ctx.fillRect(x, y, T, 1); ctx.fillRect(x, y + T - 2, T, 2);
  }
}
function draw() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (state === 'title') { ctx.fillStyle = '#16341f'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); return; }   // HTML title overlay covers this
  const bx = cam.x, by = cam.y;
  if (shakeT > 0) { const m = 5 * (shakeT / 0.16); cam.x += (Math.random() * 2 - 1) * m; cam.y += (Math.random() * 2 - 1) * m; }

  const c0 = Math.max(0, Math.floor(cam.x / TS)), c1 = Math.min(COLS - 1, Math.floor((cam.x + VIEW_W) / TS));
  const r0 = Math.max(0, Math.floor(cam.y / TS)), r1 = Math.min(ROWS - 1, Math.floor((cam.y + VIEW_H) / TS));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) paintTile(tileIdx[r][c], Math.floor(c * TS - cam.x), Math.floor(r * TS - cam.y), c, r);

  for (const cr of cars) { spr(IMG.car, cr.x, cr.y); if (cr.fire) burnLook(cr, Math.round(cr.x - cam.x), Math.round(cr.y - cam.y), 46, 28); }
  for (const b of bushes) drawBush(b);
  for (const h of houses) { spr(h.img, h.x, h.y); if (h.fire) burnLook(h, Math.round(h.x - cam.x), Math.round(h.y - cam.y), 96, 96); }
  for (const hm of homes) spr(IMG.home, hm.x, hm.y - 32);
  for (const co of coins) {
    const v = co.v || 1, s = v >= 5 ? 30 : v >= 3 ? 26 : 22, bob = Math.sin(animClock * 3 + co.x) * 2;
    const cx = co.x + 6 - cam.x, cy = co.y + 6 + bob - cam.y;
    ctx.drawImage(IMG.coin, Math.round(cx - s / 2), Math.round(cy - s / 2), s, s);
    if (v > 1) { ctx.fillStyle = '#1a1a10'; ctx.font = 'bold 11px Trebuchet MS,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('×' + v, cx + 1, cy - s / 2 - 1); ctx.fillStyle = '#ffe08a'; ctx.fillText('×' + v, cx, cy - s / 2 - 2); ctx.textAlign = 'left'; }
  }
  for (const a of ammoCrates) spr(IMG.ammo, a.x, a.y + Math.sin(animClock * 3 + a.x) * 1.5);
  for (const a of loot) { const lx = Math.round(a.x - cam.x), ly = Math.round(a.y - cam.y + Math.sin(animClock * 4 + a.x) * 2); ctx.fillStyle = WEAPONS[a.weapon].color; ctx.globalAlpha = .35; ctx.fillRect(lx - 3, ly - 3, a.w + 6, a.h + 6); ctx.globalAlpha = 1; ctx.fillStyle = '#8a5a2e'; ctx.fillRect(lx, ly, a.w, a.h); ctx.fillStyle = WEAPONS[a.weapon].color; ctx.fillRect(lx + 3, ly + 6, a.w - 6, 4); }

  // locked house (where the woman is held) — house + padlock until freed
  if (lockedHouse) {
    spr(IMG.house1, lockedHouse.x, lockedHouse.y);
    if (lockedHouse.fire) burnLook(lockedHouse, Math.round(lockedHouse.x - cam.x), Math.round(lockedHouse.y - cam.y), 96, 96);
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
    if (woman.weapon != null) { const wcx = woman.x + woman.w / 2 - cam.x, wcy = woman.y + woman.h / 2 - cam.y; ctx.save(); ctx.translate(Math.round(wcx), Math.round(wcy)); ctx.rotate(Math.atan2(woman.aimy, woman.aimx)); ctx.fillStyle = '#333'; ctx.fillRect(3, -1.5, 11, 3); ctx.fillStyle = WEAPONS[woman.weapon].color; ctx.fillRect(12, -1, 3, 2); ctx.restore(); }
    if (woman.flash > 0) { ctx.globalAlpha = woman.flash / 0.14 * 0.7; ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(woman.x - 3 - cam.x), Math.round(woman.y - 8 - cam.y), 24, 32); ctx.globalAlpha = 1; }
    const hx = Math.round(woman.x - cam.x), hy = Math.round(woman.y - 12 - cam.y);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(hx - 1, hy, woman.w + 2, 4); ctx.fillStyle = '#e0518f'; ctx.fillRect(hx, hy + 1, woman.w * Math.max(0, woman.hp) / woman.maxhp, 2);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Calibri'; ctx.textAlign = 'center'; ctx.fillText('♀', woman.x + 9 - cam.x, hy - 4);
    if (woman.weapon != null) { ctx.fillStyle = woman.ammo > 0 ? '#ffd23f' : '#ff6a6a'; ctx.font = 'bold 8px Calibri'; ctx.fillText('⦿' + woman.ammo, woman.x + 9 - cam.x, hy - 13); }
    ctx.textAlign = 'left';
  }

  for (const z of zombies) {
    if (z.hidden) continue;
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
      const img = (z.crim ? IMG.bandit : IMG.enemy)[z.frame];
      const sc = z.ztype === 'tank' ? 1.45 : z.ztype === 'runner' ? 0.85 : 1;
      const dw = Math.round(24 * sc), dh = Math.round(32 * sc), sx = Math.round(z.x + z.w / 2 - dw / 2 - cam.x), sy = Math.round(z.y + z.h - dh - cam.y + 2);
      if (z.ztype === 'exploder') { const fl = 0.4 + 0.3 * Math.sin(animClock * 9 + z.x); ctx.save(); ctx.globalAlpha = fl; ctx.fillStyle = '#ff5a2a'; ctx.beginPath(); ctx.arc(sx + dw / 2, sy + dh / 2, 16, 0, 7); ctx.fill(); ctx.restore(); }
      ctx.drawImage(img, sx, sy, dw, dh);
      if (z.ztype === 'tank') { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = .5; ctx.fillStyle = '#3a5a3a'; ctx.fillRect(sx, sy, dw, dh); ctx.restore(); }
      if (z.flash > 0) { ctx.globalAlpha = z.flash / 0.12 * 0.7; ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy, dw, dh); ctx.globalAlpha = 1; }
      const mh = z.maxhp || (z.crim ? 5 : ZHP);
      if (z.hp < mh) { const hx = Math.round(z.x - cam.x), hy = Math.round(z.y - 12 - cam.y); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(hx, hy, z.w, 3); ctx.fillStyle = z.crim ? '#e0518f' : z.ztype === 'tank' ? '#c0392b' : '#6fd14a'; ctx.fillRect(hx, hy, z.w * Math.max(0, z.hp) / mh, 3); }
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
  // held weapon (gun barrel / bat + swing / flame nozzle)
  {
    const pcx = player.x + player.w / 2 - cam.x, pcy = player.y + player.h / 2 - cam.y;
    let ang = Math.atan2(face.y, face.x); if (mouse.moved) ang = Math.atan2((mouse.y + cam.y) - (player.y + player.h / 2), (mouse.x + cam.x) - (player.x + player.w / 2));
    const wt = WEAPONS[curW].type, wc = WEAPONS[curW].color;
    ctx.save(); ctx.translate(Math.round(pcx), Math.round(pcy));
    if (wt === 'melee') {
      const a = swingFx > 0 ? swingAng - 0.7 + (1 - swingFx / 0.16) * 1.4 : ang;
      ctx.rotate(a); ctx.strokeStyle = '#b9863f'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(20, 0); ctx.stroke();
      if (swingFx > 0) { ctx.strokeStyle = 'rgba(255,245,210,' + (swingFx / 0.16 * 0.7).toFixed(2) + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 22, -0.7, 0.7); ctx.stroke(); }
    } else if (wt === 'flame') {
      ctx.rotate(ang); ctx.fillStyle = '#555'; ctx.fillRect(2, -3, 12, 6); ctx.fillStyle = wc; ctx.fillRect(13, -2, 4, 4);
    } else {
      ctx.rotate(ang); ctx.fillStyle = '#333'; ctx.fillRect(4, -2, 12, 4); ctx.fillStyle = '#555'; ctx.fillRect(2, -3, 5, 6);
    }
    ctx.restore();
  }

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
  drawHUD(); drawQuests(); drawWeaponBar(); drawSpeech();
  if (state === 'play' && nearHome) drawShopPrompt();
  if (state === 'shop') drawShop();
  if (IS_TOUCH && (state === 'play' || state === 'paused')) drawTouchUI();
  if (state === 'paused') drawPause();
  // win / gameover are shown via the HTML #endScreen overlay (drawn over the frozen frame)
}

function drawWeaponBar() {
  for (let i = 0; i < WEAPONS.length; i++) {
    const r = weaponSlotRect(i), w = WEAPONS[i], cur = i === curW;
    ctx.globalAlpha = owned[i] ? 1 : 0.3;
    ctx.fillStyle = cur ? 'rgba(40,40,28,0.9)' : 'rgba(18,18,14,0.6)'; rr(r.x, r.y, r.w, r.h, 7); ctx.fill();
    ctx.strokeStyle = cur ? (w.color || '#fff') : 'rgba(255,255,255,0.25)'; ctx.lineWidth = cur ? 3 : 1.5; rr(r.x, r.y, r.w, r.h, 7); ctx.stroke();
    ctx.drawImage(IMG.wicon[i], Math.round(r.x + r.w / 2 - 14), r.y + 4);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '9px Calibri'; ctx.fillText('' + (i + 1), r.x + 4, r.y + 11);
    ctx.textAlign = 'right'; ctx.fillStyle = wAmmo[i] > 0 ? '#ffd23f' : '#ff6a6a';
    ctx.fillText(w.mag === Infinity ? '∞' : wAmmo[i], r.x + r.w - 4, r.y + r.h - 4);
    // spare-magazine pips above the slot
    if (w.mag !== Infinity) for (let m = 0; m < MAX_MAGS; m++) { ctx.fillStyle = m < reserve[i] ? '#ffd23f' : 'rgba(255,255,255,0.2)'; ctx.fillRect(r.x + 6 + m * 9, r.y - 6, 7, 3); }
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
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
    ctx.font = 'bold 12px Trebuchet MS,sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(label, sx + 1, sy - 47); ctx.fillStyle = color; ctx.fillText(label, sx, sy - 48);
  } else {
    const ccx = VIEW_W / 2, ccy = (VIEW_H + 50) / 2; const ang = Math.atan2(wy - (cam.y + VIEW_H / 2), wx - (cam.x + VIEW_W / 2)); const dx = Math.cos(ang), dy = Math.sin(ang);
    const halfW = VIEW_W / 2 - 30, halfH = (VIEW_H - 50) / 2 - 30; const scale = Math.min(halfW / (Math.abs(dx) || 1e-6), halfH / (Math.abs(dy) || 1e-6));
    const ex = ccx + dx * scale, ey = ccy + dy * scale;
    ctx.translate(ex, ey); ctx.rotate(ang); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); ctx.rotate(-ang);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Trebuchet MS,sans-serif'; ctx.fillText(label, 0, -13);
  }
  ctx.restore();
}

function drawQuests() {
  if (!quests.length) return;
  const todo = quests.filter(q => !q.done);
  const doneN = quests.length - todo.length;
  const x = questPanel.x, y0 = questPanel.y, lh = 15;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  if (questsCollapsed) {
    questPanel.h = 24;
    ctx.fillStyle = 'rgba(15,16,12,0.42)'; ctx.fillRect(x, y0, questPanel.w, questPanel.h);
    ctx.font = 'bold 11px Trebuchet MS,sans-serif'; ctx.fillStyle = '#ffe08a';
    ctx.fillText('ЗАВДАННЯ ' + doneN + '/' + quests.length + '  ▸', x + 7, y0 + 12);
    return;
  }
  const lines = todo.slice(0, 4);
  questPanel.h = 7 + (Math.max(1, lines.length) + 1) * lh;
  ctx.fillStyle = 'rgba(15,16,12,0.42)'; ctx.fillRect(x, y0, questPanel.w, questPanel.h);
  ctx.font = 'bold 11px Trebuchet MS,sans-serif'; ctx.fillStyle = '#ffe08a';
  ctx.fillText('ЗАВДАННЯ ' + doneN + '/' + quests.length + '  ▾', x + 7, y0 + 11);
  ctx.font = '11px Trebuchet MS,sans-serif';
  if (lines.length === 0) { ctx.fillStyle = '#9bf09b'; ctx.fillText('✓ усі виконано!', x + 7, y0 + 11 + lh); }
  else lines.forEach((q, i) => { const yy = y0 + 11 + (i + 1) * lh; ctx.fillStyle = '#fff'; const pr = (q.prog && q.prog !== '🔑' && q.prog !== '?') ? '  ' + q.prog : ''; ctx.fillText('• ' + q.label + pr, x + 7, yy); });
}

function drawMenu() {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H); g.addColorStop(0, '#aee6ff'); g.addColorStop(1, '#cdeeb0');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // floating coins decoration
  for (let i = 0; i < 6; i++) { const cx = 120 + i * 100, cy = 120 + Math.sin(animClock * 2 + i) * 14; ctx.drawImage(IMG.coin, cx - 16, cy - 16); }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 66px Trebuchet MS,sans-serif'; ctx.fillText('☀ PUNK TOWN', VIEW_W / 2 + 2, VIEW_H / 2 - 58);
  ctx.fillStyle = '#3f8f3a'; ctx.fillText('☀ PUNK TOWN', VIEW_W / 2, VIEW_H / 2 - 60);
  ctx.fillStyle = '#4a5a38'; ctx.font = '20px Trebuchet MS,sans-serif';
  ctx.fillText('Знайди ключ, визволь жінку, приведи ДОДОМУ цілою та здолай боса', VIEW_W / 2, VIEW_H / 2 - 14);
  const blink = 0.5 + 0.5 * Math.sin(animClock * 4);
  ctx.globalAlpha = 0.5 + 0.5 * blink; ctx.fillStyle = '#e8932a'; ctx.font = 'bold 28px Trebuchet MS,sans-serif';
  ctx.fillText('Натисни ПРОБІЛ або клікни, щоб почати', VIEW_W / 2, VIEW_H / 2 + 36); ctx.globalAlpha = 1;
  ctx.fillStyle = '#5a6a48'; ctx.font = '15px Trebuchet MS,sans-serif';
  ctx.fillText('WASD — рух · Shift — біг · миша/F — стрілянина · 1-6 — зброя · Esc — пауза · M — музика', VIEW_W / 2, VIEW_H - 40);
  ctx.textAlign = 'left';
}

function drawPause() {
  ctx.fillStyle = 'rgba(20,30,15,0.55)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 56px Trebuchet MS,sans-serif';
  ctx.fillText('ПАУЗА', VIEW_W / 2, VIEW_H / 2 - 10);
  ctx.font = '22px Trebuchet MS,sans-serif'; ctx.fillText('Esc — продовжити', VIEW_W / 2, VIEW_H / 2 + 34);
  ctx.textAlign = 'left';
}

function drawBullets() {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const b of bullets) { const bx = b.x - cam.x, by = b.y - cam.y; const gg = ctx.createRadialGradient(bx, by, 0, bx, by, 9); gg.addColorStop(0, b.color); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = .45; ctx.fillStyle = gg; ctx.fillRect(bx - 9, by - 9, 18, 18); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 2, 0, 7); ctx.fill(); }
  for (const b of eBullets) { const bx = b.x - cam.x, by = b.y - cam.y; const R = b.big ? 16 : 10; const gg = ctx.createRadialGradient(bx, by, 0, bx, by, R); gg.addColorStop(0, b.color); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = .55; ctx.fillStyle = gg; ctx.fillRect(bx - R, by - R, R * 2, R * 2); ctx.globalAlpha = .9; ctx.strokeStyle = b.color; ctx.lineWidth = b.big ? 4 : 2; ctx.beginPath(); ctx.moveTo(bx - b.vx * 0.025, by - b.vy * 0.025); ctx.lineTo(bx, by); ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, b.big ? 2.8 : 1.6, 0, 7); ctx.fill(); }
  ctx.restore();
}

function drawAtmosphere() {
  // gentle desaturating wash — moody but clearly readable
  ctx.save(); ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(208,210,200,0.45)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); ctx.restore();
  // drifting ash/dust
  ctx.fillStyle = 'rgba(210,205,190,0.45)';
  for (let i = 0; i < 24; i++) { const t = animClock * (8 + (i % 4) * 3); const x = ((i * 137 + t) % (VIEW_W + 40)) - 20; const y = ((i * 251 + animClock * (10 + i % 3) * 0.4) % (VIEW_H + 40)); ctx.globalAlpha = 0.2 + 0.25 * Math.sin(animClock * 1.5 + i); ctx.fillRect(x, y, 2, 2); }
  ctx.globalAlpha = 1;
  // soft vignette for framing
  const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H / 2, VIEW_W / 2, VIEW_H / 2, VIEW_W / 1.0); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,14,10,0.32)'); ctx.fillStyle = v; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function drawHomeIndicator() {
  if (!homes.length) return; const hm = homes[0]; const hx = hm.x + 48, hy = hm.y; const sx = hx - cam.x, sy = hy - cam.y;
  const pulse = 0.5 + 0.5 * Math.sin(animClock * 4); ctx.save(); ctx.textAlign = 'center';
  if (sx >= 10 && sx <= VIEW_W - 10 && sy >= 50 && sy <= VIEW_H - 10) {
    ctx.strokeStyle = 'rgba(95,224,122,' + (0.55 + 0.4 * pulse) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy - 46, 12 + pulse * 5, 0, 7); ctx.stroke();
    ctx.fillStyle = '#3fbf60'; ctx.beginPath(); ctx.moveTo(sx - 7, sy - 34); ctx.lineTo(sx + 7, sy - 34); ctx.lineTo(sx, sy - 26); ctx.closePath(); ctx.fill();
    ctx.font = 'bold 14px Trebuchet MS,sans-serif'; ctx.fillText('ДІМ', sx, sy - 62);
  } else {
    const ccx = VIEW_W / 2, ccy = (VIEW_H + 50) / 2; const ang = Math.atan2(hy - (cam.y + VIEW_H / 2), hx - (cam.x + VIEW_W / 2)); const dx = Math.cos(ang), dy = Math.sin(ang);
    const halfW = VIEW_W / 2 - 34, halfH = (VIEW_H - 50) / 2 - 34; const scale = Math.min(halfW / (Math.abs(dx) || 1e-6), halfH / (Math.abs(dy) || 1e-6));
    const ex = ccx + dx * scale, ey = ccy + dy * scale; const dist = Math.round(Math.hypot(hx - (player.x + 9), hy - (player.y + 11)));
    ctx.translate(ex, ey); ctx.rotate(ang); ctx.fillStyle = '#3fbf60'; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-6, -9); ctx.lineTo(-6, 9); ctx.closePath(); ctx.fill(); ctx.rotate(-ang);
    ctx.fillStyle = '#bff5cc'; ctx.font = 'bold 11px Trebuchet MS,sans-serif'; ctx.fillText('ДІМ ' + dist, 0, -16);
  }
  ctx.restore();
}

function drawSpeech() {
  if (speechT <= 0 || !speech) return;
  const w = Math.min(560, VIEW_W - 40), h = 70, x = VIEW_W / 2 - w / 2, y = VIEW_H - h - (IS_TOUCH ? 96 : 16);
  ctx.globalAlpha = Math.min(1, speechT * 2);
  ctx.fillStyle = 'rgba(14,28,20,.92)'; rr(x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(224,81,143,.7)'; ctx.lineWidth = 2; rr(x, y, w, h, 14); ctx.stroke();
  // little woman portrait
  ctx.save(); ctx.translate(x + 34, y + 46); ctx.scale(1.2, 1.2); ctx.drawImage(IMG.woman[0], -12, -22); ctx.restore();
  ctx.fillStyle = '#ff9aa2'; ctx.font = 'bold 15px Trebuchet MS,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('Жінка', x + 64, y + 24);
  ctx.fillStyle = '#f0f6f1'; ctx.font = '15px Trebuchet MS,sans-serif';
  ctx.fillText(speech, x + 64, y + 48);
  ctx.globalAlpha = 1;
}

function panel(x, y, w, h) { ctx.fillStyle = 'rgba(18,30,22,0.84)'; rr(x, y, w, h, 12); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.5; rr(x, y, w, h, 12); ctx.stroke(); }
function drawShopPrompt() {
  ctx.fillStyle = 'rgba(20,40,28,.85)'; rr(btnShop.x, btnShop.y, btnShop.w, btnShop.h, 10); ctx.fill();
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; rr(btnShop.x, btnShop.y, btnShop.w, btnShop.h, 10); ctx.stroke();
  ctx.fillStyle = '#ffe08a'; ctx.font = 'bold 15px Trebuchet MS,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🛒 Магазин' + (IS_TOUCH ? '' : ' (B)'), btnShop.x + btnShop.w / 2, btnShop.y + btnShop.h / 2);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
function drawShop() {
  ctx.fillStyle = 'rgba(8,14,10,0.82)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const w = 380, x = VIEW_W / 2 - w / 2, y = VIEW_H / 2 - 130;
  panel(x, y, w, 70 + SHOP.length * 42 + 16);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffe08a'; ctx.font = 'bold 26px Trebuchet MS,sans-serif'; ctx.fillText('🛒 МАГАЗИН ВИЖИВАЛЬНИКА', VIEW_W / 2, y + 34);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Trebuchet MS,sans-serif'; ctx.fillText('💲 Монет: ' + totalCoins, VIEW_W / 2, y + 56);
  for (let i = 0; i < SHOP.length; i++) {
    const r = shopRowRect(i), c = SHOP[i].cost(), ok = totalCoins >= c;
    ctx.fillStyle = ok ? 'rgba(60,90,55,0.7)' : 'rgba(60,40,40,0.5)'; rr(r.x, r.y, r.w, r.h, 8); ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = ok ? '#fff' : '#b59a9a'; ctx.font = 'bold 15px Trebuchet MS,sans-serif';
    ctx.fillText((IS_TOUCH ? '' : (i + 1) + '. ') + SHOP[i].label, r.x + 12, r.y + r.h / 2);
    ctx.textAlign = 'right'; ctx.fillStyle = ok ? '#ffd23f' : '#ff7a7a'; ctx.fillText('💲' + c, r.x + r.w - 12, r.y + r.h / 2);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '13px Trebuchet MS,sans-serif';
  ctx.fillText(IS_TOUCH ? 'Торкнись товару, щоб купити · торкнись поза списком — вийти' : 'Натисни 1–6 щоб купити · B/Esc — вийти', VIEW_W / 2, y + 70 + SHOP.length * 42 + 4);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
function drawHUD() {
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  // --- vitals panel (top-left) ---
  panel(10, 8, 216, 52);
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.35)';
  rr(20, 17, 150, 12, 6); ctx.stroke();
  ctx.fillStyle = health > maxHealth * 0.6 ? '#7CFC68' : health > maxHealth * 0.3 ? '#ffd23f' : '#ff6f6f'; rr(21, 18, Math.max(0, health) / maxHealth * 148, 10, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; rr(20, 35, 150, 10, 5); ctx.stroke();
  ctx.fillStyle = stamina > 25 ? '#56b8ff' : '#c46bff'; rr(21, 36, stamina / 100 * 148, 8, 4); ctx.fill();
  ctx.fillStyle = '#ff9aa2'; ctx.font = 'bold 20px Trebuchet MS,sans-serif'; ctx.fillText('♥' + lives, 180, 32);
  // --- weapon panel ---
  const w = WEAPONS[curW];
  panel(234, 8, 212, 52);
  ctx.drawImage(IMG.wicon[curW], 242, 18, 32, 32);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Trebuchet MS,sans-serif'; ctx.fillText(w.name, 280, 24);
  ctx.fillStyle = wAmmo[curW] > 0 ? '#ffd23f' : '#ff7a7a'; ctx.font = 'bold 14px Trebuchet MS,sans-serif';
  ctx.fillText(w.mag === Infinity ? '⦿ ∞' : ('⦿ ' + wAmmo[curW] + '/' + w.mag), 280, 44);
  if (w.mag !== Infinity) for (let m = 0; m < MAX_MAGS; m++) { ctx.fillStyle = m < reserve[curW] ? '#ffd23f' : 'rgba(255,255,255,0.18)'; ctx.fillRect(376 + m * 10, 40, 8, 8); }
  // --- score panel (top-right): icons left, numbers right-aligned ---
  const pw = 120, sx = VIEW_W - 10 - pw;
  panel(sx, 8, pw, 70);
  ctx.drawImage(IMG.coin, sx + 12, 11, 20, 20);
  ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 18px Trebuchet MS,sans-serif'; ctx.textAlign = 'right'; ctx.fillText('' + totalCoins, sx + pw - 14, 21);
  ctx.fillStyle = '#9bf09b'; ctx.font = 'bold 17px Trebuchet MS,sans-serif'; ctx.textAlign = 'left'; ctx.fillText('☠', sx + 13, 41);
  ctx.textAlign = 'right'; ctx.fillText('' + kills, sx + pw - 14, 41);
  ctx.textAlign = 'left'; ctx.fillStyle = '#ffe08a'; ctx.font = 'bold 15px Trebuchet MS,sans-serif'; ctx.fillText('✦', sx + 13, 60);
  ctx.textAlign = 'right'; ctx.fillText('' + score, sx + pw - 14, 60); ctx.textAlign = 'left';
  // combo
  if (combo > 1) { const a = Math.min(1, comboT); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.font = 'bold 26px Trebuchet MS,sans-serif'; ctx.fillStyle = '#000'; ctx.fillText('КОМБО ×' + combo, VIEW_W / 2 + 1, 112); ctx.fillStyle = combo >= 10 ? '#ff5a4a' : '#ffd23f'; ctx.fillText('КОМБО ×' + combo, VIEW_W / 2, 111); ctx.textAlign = 'left'; ctx.globalAlpha = 1; }
  // toast
  if (toastT > 0) { ctx.globalAlpha = Math.min(1, toastT); ctx.font = 'bold 22px Trebuchet MS,sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(toast, VIEW_W / 2 + 1, 81); ctx.fillStyle = '#ffd23f'; ctx.fillText(toast, VIEW_W / 2, 80); ctx.textAlign = 'left'; ctx.globalAlpha = 1; }
}

function drawOverlay() {
  ctx.fillStyle = state === 'win' ? 'rgba(40,80,40,0.55)' : 'rgba(60,30,30,0.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center'; ctx.fillStyle = state === 'win' ? '#aef5b0' : '#ff9a9a'; ctx.font = 'bold 60px Trebuchet MS,sans-serif';
  ctx.fillText(state === 'win' ? 'ПЕРЕМОГА!' : (womanDead ? 'МІСІЮ ПРОВАЛЕНО' : 'ГРУ ЗАВЕРШЕНО'), VIEW_W / 2, VIEW_H / 2 - 16);
  ctx.fillStyle = '#fff'; ctx.font = '22px Trebuchet MS,sans-serif';
  const sub = state === 'win' ? 'Усі завдання виконано! Вбито: ' + kills : (failReason || 'Спробуй ще — нова мапа чекає');
  ctx.fillText(sub + '   —   R: нова гра', VIEW_W / 2, VIEW_H / 2 + 34);
  ctx.textAlign = 'left';
}

let last = 0;
function frame(t) {
  const dt = Math.min((t - last) / 1000, 0.05); last = t;
  update(dt); draw();
  if ((state === 'win' || state === 'gameover') && !endShown) { endShown = true; showEndScreen(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(t => { last = t; frame(t); });
