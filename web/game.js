// PUNK TOWN — bright top-down shooter. Collect 15 coins, dodge/blast goofy
// zombies, heal at home. Sunny, friendly atmosphere (no horror).

// ---- co-op room + shared world seed (same room code → identical map) ----
let coop = null; try { coop = JSON.parse(sessionStorage.getItem('coop') || 'null'); } catch (e) {}
function codeSeed(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
let GENSEED = coop ? codeSeed(coop.code) : (Math.floor(Math.random() * 1e9) >>> 0);
function R() { GENSEED = (GENSEED * 1103515245 + 12345) & 0x7fffffff; return GENSEED / 0x7fffffff; }
const LEVEL = genWorld(GENSEED);   // procedural town (deterministic by seed)
let district = 1; try { district = Math.max(1, +(sessionStorage.getItem('punktown_district') || 1)); } catch (e) {}
const HPBONUS = district - 1;   // tougher zombies in later districts
let VIEW_W = window.innerWidth, VIEW_H = window.innerHeight, DPR = Math.min(window.devicePixelRatio || 1, 2);
const TS = LEVEL.tileSize;
const COLS = LEVEL.width / TS, ROWS = LEVEL.height / TS;
const LW = LEVEL.width, LH = LEVEL.height;
const WINCOINS = 15;

const SPEED = 110, RUN_MULT = 1.8;
const STAM_MAX = 100, STAM_DRAIN = 32, STAM_REGEN = 10, STAM_REGEN_HOME = 50;
const ZSPEED = 48, ZCHASE = 80;
const ZHP = 4, LOOT_CHANCE = 0.3;
const MAX_ZOMBIES = 50 + (district - 1) * 8, RESPAWN_EVERY = Math.max(1.0, 2.2 - (district - 1) * 0.18);
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
  hp = (hp + HPBONUS) * 2;   // ×2 base toughness
  return { x, y, w, h, vx: 0, vy: 0, t: 0, hp, maxhp: hp, flash: 0, frame: 0, ztype, sm,
    armed, zw: armed ? Math.floor(Math.random() * ZWEAPONS.length) : 0,
    shootCD: 0.6 + Math.random() * 2, hasBullet: false, aimx: 1, aimy: 0 };
}
function mkCrim(x, y) {
  const armed = Math.random() < 0.35;
  return { x, y, w: 18, h: 22, vx: 0, vy: 0, t: 0, hp: 5, flash: 0, frame: 0, crim: true, carrying: 0, stealCD: 0, fleeT: 0, stolenWeapon: null,
    armed, zw: armed ? Math.floor(Math.random() * ZWEAPONS.length) : 0, shootCD: 0.8 + Math.random() * 1.5, hasBullet: false, aimx: 1, aimy: 0 };
}
function coinVal() { const r = R(); return r < 0.5 ? 1 : r < 0.8 ? 2 : r < 0.94 ? 3 : 5; }   // varying coin worth (seeded)
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
const DAYCYCLE = 140; let nightF = 0;   // 0 = day, 1 = deep night
const zPow = () => 2 * (1 + nightF);    // zombie strength: ×2 by day, ×4 at deep night
let eventT = 35 + Math.random() * 30, eventMsg = '', eventMsgT = 0, supplyMarker = null;
let minimapOn = true;
// ---- hero choice & special abilities ----
let hero = 'male'; try { hero = localStorage.getItem('punk_hero') || 'male'; } catch (e) {}   // 'male' | 'female'
let captiveMale = false;     // the rescued captive is a man (when the hero is the woman)
let abilCD = 0, flipT = 0, invShield = 0; const flipDir = { x: 1, y: 0 };
const ABIL_CD = 12, FLIP_DUR = 0.42, FLIP_SPEED = 880, MALE_INV = 5;
// ---- costumes (skins): fully distinct outfits, drawn procedurally ----
// MALE outfits (jackets/uniforms/armor)
const SKINS_M = [
  { name: 'Класика', cost: 0, base: true },
  { name: 'Солдат', cost: 14, spec: { skin: '#caa688', body: ['#5a6340', '#454d30'], arms: '#4d5436', legs: '#3a4028', accent: '#2e3320', deco: 'pockets', head: { type: 'helmet', col: '#4a5236' } } },
  { name: 'Хазмат', cost: 18, spec: { skin: '#e6df5a', body: ['#ecd83e', '#cdb822'], arms: '#e0ca34', legs: '#cdb822', accent: '#9a8a18', deco: 'onepiece', head: { type: 'hazmat', col: '#ecd83e', visor: '#33454f' } } },
  { name: 'Лицар', cost: 26, spec: { skin: '#caa688', body: ['#9aa2ab', '#787f88'], arms: '#838b94', legs: '#5a6068', accent: '#cfd6dd', deco: 'plates', head: { type: 'knight', col: '#aab0b8' } } },
  { name: 'Ніндзя', cost: 20, spec: { skin: '#caa688', body: ['#26262e', '#17171d'], arms: '#1f1f26', legs: '#141419', accent: '#8a1a1a', deco: 'belt', head: { type: 'ninja', col: '#1a1a20' } } },
  { name: 'Робітник', cost: 16, spec: { skin: '#caa688', body: ['#e0731f', '#c25e12'], arms: '#caa688', legs: '#33415a', accent: '#ffd23f', deco: 'hivis', head: { type: 'hardhat', col: '#f3a712' } } },
  { name: 'Кібер', cost: 24, spec: { skin: '#b8a48c', body: ['#2a2f45', '#1b2030'], arms: '#242a3e', legs: '#1b2030', accent: '#34e0e0', deco: 'neon', head: { type: 'cyber', col: '#2a2f45', visor: '#34e0e0' } } },
];
// FEMALE outfits (gowns + headwear)
const SKINS_F = [
  { name: 'Класика', cost: 0, base: true },
  { name: 'Багряна', cost: 16, spec: { skin: '#e8c4a0', hair: '#46301e', body: ['#d6314f', '#9e1f34'], accent: '#ffd23f', dress: 'long', sleeve: '#d6314f', head: { type: 'tiara', col: '#ffe08a' } } },
  { name: 'Смарагдова', cost: 16, spec: { skin: '#e8c4a0', hair: '#2c1c12', body: ['#2e9e5b', '#1d7040'], accent: '#ffe08a', dress: 'long', head: { type: 'flower', flower: '#ff8fc0' } } },
  { name: 'Королева', cost: 32, spec: { skin: '#e8c4a0', hair: '#caa14a', body: ['#8e44ad', '#682f80'], accent: '#ffd23f', dress: 'ball', sleeve: '#8e44ad', head: { type: 'crown' } } },
  { name: 'Відьма', cost: 22, spec: { skin: '#d8d8e4', hair: '#15131e', body: ['#2a2238', '#151022'], accent: '#7b5cff', dress: 'long', head: { type: 'witchhat', accent: '#7b5cff' } } },
  { name: 'Снігова', cost: 24, spec: { skin: '#ecd6c0', hair: '#e6e6f2', body: ['#d4e9ff', '#9cc2e6'], accent: '#ffffff', dress: 'ball', head: { type: 'veil' } } },
  { name: 'Неонова', cost: 26, spec: { skin: '#dcc4ac', hair: '#34e0e0', body: ['#3a2150', '#1f1230'], accent: '#34e0e0', dress: 'long', head: { type: 'tiara', col: '#34e0e0' } } },
];
function costumeCanvas(spec, step, female) {
  const c = document.createElement('canvas'); c.width = 24; c.height = 32; const x = c.getContext('2d');
  const RR = (X, Y, W, H, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); };
  const eyes = col => { x.fillStyle = col || '#1a1410'; x.beginPath(); x.arc(9.5, 8, 1.6, 0, 7); x.arc(14.5, 8, 1.6, 0, 7); x.fill(); };
  const l = step === 1 ? 2 : 0, r2 = step === 2 ? 2 : 0, sway = step === 1 ? -1.4 : step === 2 ? 1.4 : 0;
  x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(12, 30, 9, 3.6, 0, 0, 7); x.fill();
  if (female && spec.dress) {
    const flare = spec.dress === 'ball' ? 8.5 : 5.5;
    x.fillStyle = spec.shoe || '#2a2630'; RR(8, 27, 3.2, 3, 1); x.fill(); RR(12.8, 27, 3.2, 3, 1); x.fill();   // shoes
    const g = x.createLinearGradient(0, 15, 0, 29); g.addColorStop(0, spec.body[0]); g.addColorStop(1, spec.body[1]); x.fillStyle = g;
    x.beginPath(); x.moveTo(8, 15); x.lineTo(16, 15); x.lineTo(16 + flare + sway, 29); x.lineTo(8 - flare + sway, 29); x.closePath(); x.fill();   // flared skirt
    x.fillStyle = spec.accent; x.beginPath(); x.moveTo(8 - flare + sway, 29); x.lineTo(16 + flare + sway, 29); x.lineTo(15.6 + flare + sway, 27.6); x.lineTo(8.4 - flare + sway, 27.6); x.closePath(); x.fill();   // hem
    x.strokeStyle = 'rgba(0,0,0,.10)'; x.lineWidth = 1; x.beginPath(); x.moveTo(12, 16); x.lineTo(12 + sway, 28); x.moveTo(10, 16); x.lineTo(10 - flare * 0.5 + sway, 28); x.moveTo(14, 16); x.lineTo(14 + flare * 0.5 + sway, 28); x.stroke();
    x.fillStyle = spec.body[0]; RR(7, 11, 10, 6, 3); x.fill();                                  // bodice
    x.fillStyle = spec.accent; x.fillRect(7, 15, 10, 1.6);                                       // sash
    x.fillStyle = spec.sleeve || spec.skin; RR(4.6, 12, 2.6, 7, 2); x.fill(); RR(16.8, 12, 2.6, 7, 2); x.fill();   // arms
    x.fillStyle = spec.accent; x.beginPath(); x.arc(12, 12, 0.9, 0, 7); x.fill();                // neckline gem
  } else {
    x.fillStyle = spec.legs; RR(7, 22, 4, 8 - l, 2); x.fill(); RR(13, 22, 4, 8 - r2, 2); x.fill();
    const g = x.createLinearGradient(0, 12, 0, 25); g.addColorStop(0, spec.body[0]); g.addColorStop(1, spec.body[1]); x.fillStyle = g; RR(4, 12, 16, 13, 5); x.fill();
    x.fillStyle = spec.accent; RR(4, 12, 16, 2, 2); x.fill();
    x.fillStyle = spec.arms; RR(2, 14, 4, 8, 3); x.fill(); RR(18, 14, 4, 8, 3); x.fill();
    if (spec.deco === 'pockets') { x.fillStyle = spec.accent; x.fillRect(7, 18, 3, 3); x.fillRect(14, 18, 3, 3); }
    else if (spec.deco === 'plates') { x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1; x.beginPath(); x.moveTo(6, 16); x.lineTo(18, 16); x.moveTo(6, 20); x.lineTo(18, 20); x.stroke(); }
    else if (spec.deco === 'hivis') { x.fillStyle = spec.accent; x.fillRect(5, 15, 14, 2); x.fillRect(5, 20, 14, 2); }
    else if (spec.deco === 'belt') { x.fillStyle = spec.accent; x.fillRect(5, 21, 14, 2); }
    else if (spec.deco === 'neon') { x.strokeStyle = spec.head.visor; x.lineWidth = 1.2; x.beginPath(); x.moveTo(12, 13); x.lineTo(12, 24); x.moveTo(6, 17); x.lineTo(18, 17); x.stroke(); }
  }
  // ---- head / headgear ----
  const ht = spec.head.type, hair = spec.hair || '#3a2a1c';
  const skinHead = () => { x.fillStyle = spec.skin; x.beginPath(); x.arc(12, 8, 7, 0, 7); x.fill(); };
  const longHair = () => { x.fillStyle = hair; x.beginPath(); x.arc(12, 7, 7.7, Math.PI, 0); x.fill(); x.fillRect(4.3, 6, 2.7, 12); x.fillRect(17, 6, 2.7, 12); };
  if (ht === 'helmet') { skinHead(); eyes(); x.fillStyle = spec.head.col; x.beginPath(); x.arc(12, 7, 7.4, Math.PI, 0); x.fill(); x.fillRect(5, 6, 14, 2); }
  else if (ht === 'hazmat') { x.fillStyle = spec.head.col; x.beginPath(); x.arc(12, 8, 7.6, 0, 7); x.fill(); x.fillStyle = spec.head.visor; RR(8, 4.5, 8, 6, 2); x.fill(); x.fillStyle = '#555'; x.beginPath(); x.arc(12, 12, 2, 0, 7); x.fill(); }
  else if (ht === 'knight') { x.fillStyle = spec.head.col; x.beginPath(); x.arc(12, 8, 7.4, 0, 7); x.fill(); x.fillStyle = '#2a2e33'; x.fillRect(11, 3.5, 2, 9); x.strokeStyle = '#e3e8ee'; x.lineWidth = 1; x.beginPath(); x.arc(12, 8, 7.4, 0, 7); x.stroke(); }
  else if (ht === 'ninja') { x.fillStyle = spec.head.col; x.beginPath(); x.arc(12, 8, 7.4, 0, 7); x.fill(); x.fillStyle = spec.skin; x.fillRect(5.5, 6.6, 13, 2.6); eyes('#1a1410'); x.fillStyle = spec.head.col; x.fillRect(5.5, 9.2, 13, 1.2); }
  else if (ht === 'hardhat') { skinHead(); eyes(); x.fillStyle = spec.head.col; x.beginPath(); x.arc(12, 6, 6.6, Math.PI, 0); x.fill(); x.fillRect(4, 5, 16, 2); x.fillRect(11, 1, 2, 5); }
  else if (ht === 'cyber') { skinHead(); x.fillStyle = '#2a2e33'; x.beginPath(); x.arc(12, 6, 7, Math.PI, 0); x.fill(); x.fillStyle = spec.head.visor; RR(6, 6.5, 12, 3.4, 1.5); x.fill(); x.fillStyle = '#fff'; x.globalAlpha = .6; x.fillRect(7, 7.2, 3, 1.4); x.globalAlpha = 1; }
  else if (ht === 'crown') { longHair(); skinHead(); eyes(); x.fillStyle = '#ffd23f'; x.beginPath(); x.moveTo(6.5, 4); x.lineTo(8, 0.5); x.lineTo(9.8, 4); x.lineTo(12, 0); x.lineTo(14.2, 4); x.lineTo(16, 0.5); x.lineTo(17.5, 4); x.closePath(); x.fill(); x.fillStyle = '#c0392b'; x.beginPath(); x.arc(12, 2.4, 1, 0, 7); x.fill(); }
  else if (ht === 'tiara') { longHair(); skinHead(); eyes(); x.fillStyle = spec.head.col || '#ffe08a'; x.fillRect(7, 3.4, 10, 1.5); x.beginPath(); x.arc(12, 3.2, 1.4, Math.PI, 0); x.fill(); }
  else if (ht === 'flower') { longHair(); skinHead(); eyes(); const fl = spec.head.flower || '#ff8fc0'; x.fillStyle = fl; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283; x.beginPath(); x.arc(6 + Math.cos(a) * 2, 4 + Math.sin(a) * 2, 1.4, 0, 7); x.fill(); } x.fillStyle = '#ffe08a'; x.beginPath(); x.arc(6, 4, 1, 0, 7); x.fill(); }
  else if (ht === 'witchhat') { longHair(); skinHead(); eyes(); x.fillStyle = '#17131f'; x.beginPath(); x.moveTo(12, -6.5); x.lineTo(7.5, 3.5); x.lineTo(16.5, 3.5); x.closePath(); x.fill(); x.fillRect(4, 3.2, 16, 2); x.fillStyle = spec.head.accent || '#7b5cff'; x.fillRect(8, 1.8, 6, 1.4); }
  else if (ht === 'veil') { x.fillStyle = 'rgba(240,244,255,.78)'; x.beginPath(); x.moveTo(4.5, 4); x.quadraticCurveTo(12, -1.5, 19.5, 4); x.lineTo(20, 17); x.lineTo(4, 17); x.closePath(); x.fill(); skinHead(); eyes(); x.fillStyle = '#ffe08a'; x.fillRect(7.5, 3.6, 9, 1.3); }
  else { skinHead(); eyes(); if (female) longHair(); else { x.fillStyle = hair; x.beginPath(); x.arc(12, 6, 7, Math.PI, 0); x.fill(); } }
  return c;
}
const buildSkin = (spec, female) => [0, 1, 2].map(s => costumeCanvas(spec, s, female));
const skinFramesM = SKINS_M.map(s => s.base ? IMG.player : buildSkin(s.spec, false));
const skinFramesF = SKINS_F.map(s => s.base ? IMG.woman : buildSkin(s.spec, true));
const skinSet = (h, idx) => (h === 'female' ? skinFramesF : skinFramesM)[idx] || (h === 'female' ? IMG.woman : IMG.player);
const loadSkinSet = k => { try { return new Set(JSON.parse(localStorage.getItem(k) || '[0]')); } catch (e) { return new Set([0]); } };
const loadCur = k => { try { return +(localStorage.getItem(k) || 0) || 0; } catch (e) { return 0; } };
let ownedM = loadSkinSet('punk_skins_m'), ownedF = loadSkinSet('punk_skins_f'), curM = loadCur('punk_skin_m'), curF = loadCur('punk_skin_f');
if (!ownedM.has(curM)) curM = 0; if (!ownedF.has(curF)) curF = 0;
const activeSkins = () => hero === 'female' ? SKINS_F : SKINS_M;
const ownedSet = () => hero === 'female' ? ownedF : ownedM;
const curSkinVal = () => hero === 'female' ? curF : curM;
function saveSkins() { try { localStorage.setItem('punk_skins_m', JSON.stringify([...ownedM])); localStorage.setItem('punk_skins_f', JSON.stringify([...ownedF])); localStorage.setItem('punk_skin_m', curM); localStorage.setItem('punk_skin_f', curF); } catch (e) {} }
function buyOrEquipSkin(i) {
  const set = activeSkins(), s = set[i]; if (!s) return; const own = ownedSet();
  const equip = () => { if (hero === 'female') curF = i; else curM = i; };
  if (own.has(i)) { equip(); saveSkins(); AUDIO.sfx.pickup(); showToast('Вдягнено: ' + s.name); }
  else if (totalCoins >= s.cost) { totalCoins -= s.cost; own.add(i); equip(); saveSkins(); AUDIO.sfx.win(); showToast('Куплено костюм: ' + s.name); }
  else { AUDIO.sfx.hurt(); showToast('Замало монет (' + s.cost + ')'); }
}
const heroImg = () => skinSet(hero, curSkinVal());
function useAbility() {
  if (state !== 'play' || abilCD > 0) return;
  if (hero === 'female') {
    flipT = FLIP_DUR; flipDir.x = face.x; flipDir.y = face.y; abilCD = ABIL_CD; invuln = Math.max(invuln, FLIP_DUR + 0.1);
    shakeT = Math.max(shakeT, 0.12); AUDIO.sfx.melee(); showToast('🤸 Сальто!');
    if (coop && NET.role() === 'client') NET.send({ t: 'abil', a: 'flip', dx: +face.x.toFixed(2), dy: +face.y.toFixed(2) });
  } else {
    invuln = Math.max(invuln, MALE_INV); invShield = MALE_INV; abilCD = ABIL_CD; AUDIO.sfx.pickup(); showToast('🛡 Невразливість 5с!');
    if (coop && NET.role() === 'client') NET.send({ t: 'abil', a: 'shield' });
  }
}
function announce(t) { eventMsg = t; eventMsgT = 3.5; shakeT = Math.max(shakeT, 0.15); AUDIO.sfx.hurt(); }
// ---- towns, NPCs & side-quests ----
const towns = LEVEL.towns || [];
const npcs = [];
for (const tn of towns) {
  npcs.push({ x: tn.shop[0], y: tn.shop[1], bx: tn.shop[0], by: tn.shop[1], w: 18, h: 22, kind: 'shop', town: tn, frame: 0, walkT: 0, wanderT: 0, vx: 0, vy: 0 });
  npcs.push({ x: tn.quest[0], y: tn.quest[1], bx: tn.quest[0], by: tn.quest[1], w: 18, h: 22, kind: 'quest', town: tn, frame: 0, walkT: 0, wanderT: 0, vx: 0, vy: 0, gave: false });
  (tn.villagers || []).forEach((v, i) => npcs.push({ x: v[0], y: v[1], bx: v[0], by: v[1], w: 18, h: 22, kind: i === 0 ? 'merc' : 'villager', town: tn, fem: i % 2 === 0, frame: 0, walkT: 0, wanderT: i * 0.5, vx: 0, vy: 0 }));
}
let nearShopTown = null, nearQuestNPC = null, sideQuest = null, sideDone = 0, bountyKilled = false;
const rint = n => Math.floor(Math.random() * n);
function pickFarPoint(town, min, max) {
  const cand = [];
  for (const [c, r] of reachCells) { const wx = c * TS, wy = r * TS, d = Math.hypot(wx - town.x, wy - town.y); if (d > min && d < max) cand.push([wx, wy]); }
  return cand.length ? cand[rint(cand.length)] : null;
}
function otherTown(town) { const o = towns.filter(t => t !== town); return o.length ? o[rint(o.length)] : { x: homes[0].x, y: homes[0].y, name: 'Дім' }; }
function spawnBounty(town) {
  const p = pickFarPoint(town, 220, 700) || [town.x + 260, town.y];
  const z = mkZombie(p[0], p[1]);
  z.bounty = true; z.ztype = 'tank'; z.w = 26; z.h = 30; z.sm = 0.95; z.armed = false; z.hp = z.maxhp = 55 + HPBONUS * 4; z.name = 'МУТАНТ';
  zombies.push(z); return z;
}
function spawnHorde(town) {
  for (let i = 0; i < 10; i++) { const a = Math.random() * 6.283, r = 120 + Math.random() * 130, x = town.x + Math.cos(a) * r, y = town.y + Math.sin(a) * r; if (!boxSolid(x, y, 18, 22)) zombies.push(mkZombie(x, y)); }
  shakeT = Math.max(shakeT, 0.2);
}
function offerQuest(npc) {
  if (sideQuest) return;
  const isHost = !coop || NET.role() === 'host';
  const pool = isHost ? ['hunt', 'collect', 'reach', 'deliver', 'bounty', 'defend'] : ['hunt', 'collect', 'reach', 'deliver'];
  const kind = pool[rint(pool.length)];
  const q = { kind, town: npc.town, npc, reward: 12 + rint(12) };
  bountyKilled = false;
  if (kind === 'hunt') { q.need = 6 + rint(7); q.base = kills; }
  else if (kind === 'collect') { q.need = 10 + rint(12); q.base = coinsTotal; }
  else if (kind === 'defend') { q.need = 8 + rint(6); q.base = kills; q.reward += 10; spawnHorde(npc.town); announce('🛡 Орда суне на ' + npc.town.name + '!'); }
  else if (kind === 'reach') { const p = pickFarPoint(npc.town, 380, 1500) || [npc.town.x + 500, npc.town.y]; q.dx = p[0]; q.dy = p[1]; q.timeLeft = 16 + Math.round(Math.hypot(p[0] - player.x, p[1] - player.y) / 165); q.reward += 8; }
  else if (kind === 'deliver') { const o = otherTown(npc.town); q.dx = o.x; q.dy = o.y; q.destName = o.name; q.reward += 6; }
  else if (kind === 'bounty') { q.target = spawnBounty(npc.town); q.reward += 16; }
  npc.gave = true; sideQuest = q;
  showToast('📜 ' + npc.town.name + ': ' + sideQuestText()); AUDIO.sfx.pickup();
}
function sideQuestText() {
  const q = sideQuest; if (!q) return '';
  if (q.kind === 'hunt') return '☠ Убий зомбі ' + Math.min(kills - q.base, q.need) + '/' + q.need + ' → +' + q.reward + '💰';
  if (q.kind === 'collect') return '💰 Збери монети ' + Math.min(coinsTotal - q.base, q.need) + '/' + q.need + ' → +' + q.reward + '💰';
  if (q.kind === 'defend') return '🛡 Відбий орду ' + Math.min(kills - q.base, q.need) + '/' + q.need + ' → +' + q.reward + '💰';
  if (q.kind === 'bounty') return '🎯 Вистеж і вбий Мутанта → +' + q.reward + '💰';
  if (q.kind === 'deliver') return '📦 Доставка у «' + q.destName + '» → +' + q.reward + '💰';
  if (q.kind === 'reach') return '🏃 Дістанься точки · ' + Math.max(0, Math.ceil(q.timeLeft)) + 'с → +' + q.reward + '💰';
  return '';
}
function updateSideQuest(dt) {
  const q = sideQuest; if (!q) return;
  let done = false, fail = false;
  if (q.kind === 'hunt' || q.kind === 'defend') done = (kills - q.base) >= q.need;
  else if (q.kind === 'collect') done = (coinsTotal - q.base) >= q.need;
  else if (q.kind === 'bounty') done = bountyKilled;
  else if (q.kind === 'deliver') done = Math.hypot(player.x + 9 - q.dx, player.y + 11 - q.dy) < 60;
  else if (q.kind === 'reach') { q.timeLeft -= dt; if (Math.hypot(player.x + 9 - q.dx, player.y + 11 - q.dy) < 60) done = true; else if (q.timeLeft <= 0) fail = true; }
  if (done) {
    totalCoins += q.reward; coinsTotal += q.reward; score += q.reward * 5; sideDone++;
    if (q.npc) q.npc.gave = false;
    showToast('✅ Завдання виконано! +' + q.reward + '💰'); AUDIO.sfx.win(); sideQuest = null;
  } else if (fail) { if (q.npc) q.npc.gave = false; showToast('⌛ Не встиг — завдання провалено'); AUDIO.sfx.hurt(); sideQuest = null; }
}
function updateNPCs(dt) {
  nearShopTown = null; nearQuestNPC = null; nearMerc = null;
  const pcx = player.x + 9, pcy = player.y + 11;
  for (const n of npcs) {
    if (n.kind === 'villager') {
      n.wanderT -= dt;
      if (n.wanderT <= 0) { if (Math.random() < 0.4) { n.vx = n.vy = 0; } else { const a = Math.random() * 6.283; n.vx = Math.cos(a) * 13; n.vy = Math.sin(a) * 13; } n.wanderT = 1.4 + Math.random() * 2.4; }
      const nx = n.x + n.vx * dt, ny = n.y + n.vy * dt;
      if (Math.hypot(nx - n.bx, ny - n.by) > 26 || boxSolid(nx, ny, n.w, n.h)) { n.vx = -n.vx; n.vy = -n.vy; } else { n.x = nx; n.y = ny; }
      n.walkT += dt; n.frame = Math.hypot(n.vx, n.vy) > 1 ? 1 + (Math.floor(n.walkT * 6) % 2) : 0;
    }
    const d = Math.hypot(pcx - (n.x + 9), pcy - (n.y + 11));
    if (n.kind === 'shop' && d < 46) nearShopTown = n.town;
    if (n.kind === 'merc' && d < 46) nearMerc = n.town;
    if (n.kind === 'quest' && d < 46) { nearQuestNPC = n; if (!sideQuest) offerQuest(n); }
  }
  updateSideQuest(dt);
}
// ---- mercenary camp: buy trained animal companions ----
const ANIMALS = [
  { name: 'Пес', icon: '🐕', cost: 18, hp: 40, speed: 165, dmg: 3, rate: 0.45, range: 30, atk: 'melee', desc: 'швидкий, дешевий' },
  { name: 'Вовк', icon: '🐺', cost: 34, hp: 65, speed: 188, dmg: 6, rate: 0.5, range: 34, atk: 'melee', desc: 'сильний, прудкий' },
  { name: 'Пантера', icon: '🐆', cost: 48, hp: 55, speed: 228, dmg: 8, rate: 0.4, range: 34, atk: 'melee', desc: 'дуже швидка, б\'є часто' },
  { name: 'Ведмідь', icon: '🐻', cost: 65, hp: 150, speed: 122, dmg: 13, rate: 0.75, range: 42, atk: 'melee', desc: 'танк, нищівний' },
  { name: 'Сокіл', icon: '🦅', cost: 42, hp: 28, speed: 240, dmg: 4, rate: 0.7, range: 250, atk: 'ranged', desc: 'дальня атака з повітря' },
];
const pets = [], MAX_PETS = 3;
let nearMerc = null;
function buyPet(i) {
  const a = ANIMALS[i]; if (!a) return;
  if (pets.length >= MAX_PETS) { AUDIO.sfx.hurt(); showToast('Уже маєш ' + MAX_PETS + ' тварин'); return; }
  if (totalCoins < a.cost) { AUDIO.sfx.hurt(); showToast('Замало монет (' + a.cost + ')'); return; }
  totalCoins -= a.cost;
  pets.push({ x: player.x + (Math.random() * 40 - 20), y: player.y + 24, w: 16, h: 14, type: i, hp: a.hp, maxhp: a.hp, fireCD: 0, aimx: 1, aimy: 0, bob: Math.random() * 6, orbit: pets.length * (6.283 / MAX_PETS) });
  AUDIO.sfx.win(); showToast(a.icon + ' ' + a.name + ' приєднався!');
}
function updatePets(dt, combat) {
  petPhase += dt * 1.3;   // pets run around the player in a circle
  for (let i = pets.length - 1; i >= 0; i--) {
    const p = pets[i], a = ANIMALS[p.type];
    p.bob += dt;
    const pcx = p.x + 8, pcy = p.y + 7, plx = player.x + 9, ply = player.y + 11, distToP = Math.hypot(plx - pcx, ply - pcy);
    let tgt = null, bd = 1e9;
    if (combat) for (const z of zombies) { if (z.dead || z.hidden) continue; const zx = z.x + z.w / 2, zy = z.y + z.h / 2; if (Math.hypot(zx - plx, zy - ply) > 340) continue; const d = (zx - pcx) ** 2 + (zy - pcy) ** 2; if (d < bd) { bd = d; tgt = z; } }
    let mx = 0, my = 0;
    if (tgt) {
      const zx = tgt.x + tgt.w / 2, zy = tgt.y + tgt.h / 2, d = Math.hypot(zx - pcx, zy - pcy) || 1;
      p.aimx = (zx - pcx) / d; p.aimy = (zy - pcy) / d;
      p.fireCD -= dt;
      if (a.atk === 'ranged') { if (d > a.range) { mx = p.aimx; my = p.aimy; } if (p.fireCD <= 0 && d < a.range) { bullets.push({ x: pcx, y: pcy, vx: p.aimx * 520, vy: p.aimy * 520, life: 0.9, dmg: a.dmg, color: '#cfe0ff' }); p.fireCD = a.rate; } }
      else { if (d > a.range) { mx = p.aimx; my = p.aimy; } else if (p.fireCD <= 0) { damageZombie(tgt, a.dmg, p.aimx, p.aimy); spawnBurst(zx, zy, '#ffd0d0', 4, 70, 2); p.fireCD = a.rate; } }
    }
    if (!tgt || distToP > 150) { const ang = p.orbit + petPhase, R = 42, ox = plx + Math.cos(ang) * R, oy = ply + Math.sin(ang) * R, dx = ox - pcx, dy = oy - pcy, dd = Math.hypot(dx, dy) || 1; if (dd > 5) { mx = dx / dd; my = dy / dd; } else { mx = my = 0; } }
    if (mx || my) { const m = Math.hypot(mx, my) || 1; tryMove(p, mx / m * a.speed * dt, my / m * a.speed * dt); }
    if (combat) {
      for (const z of zombies) { if (z.dead || z.hidden) continue; const zdx = z.x + z.w / 2 - pcx, zdy = z.y + z.h / 2 - pcy; if (zdx * zdx + zdy * zdy < 24 * 24) { p.hp -= (z.ztype === 'tank' ? 16 : 9) * dt; } }   // zombies bite the pet when close (not only on full overlap)
      if (p.hp <= 0) { spawnBurst(pcx, pcy, '#c0392b', 12, 120, 3); showToast(a.icon + ' ' + a.name + ' загинув'); pets.splice(i, 1); continue; }
      if (p.hp < a.hp) for (const hm of homes) if (aabb(p.x, p.y, p.w, p.h, hm.x - 16, hm.y - 40, 128, 112)) p.hp = Math.min(a.hp, p.hp + 30 * dt);
    }
  }
}
function triggerEvent() {
  const px = player.x, py = player.y;
  const near = reachCells.filter(([c, r]) => { const d = Math.hypot(c * TS - px, r * TS - py); return d > 340 && d < 700; });
  const pick = () => near.length ? near[Math.floor(Math.random() * near.length)] : null;
  const r = Math.random();
  if (r < 0.45) { const n = 10 + Math.floor(Math.random() * 8); for (let k = 0; k < n; k++) { const s = pick(); if (s) zombies.push(mkZombie(s[0] * TS, s[1] * TS)); } announce('🧟 ОРДА ЗОМБІ!'); }
  else if (r < 0.75) { const n = 5 + Math.floor(Math.random() * 5); for (let k = 0; k < n; k++) { const s = pick(); if (s) zombies.push(mkCrim(s[0] * TS, s[1] * TS)); } announce('🦹 НАБІГ БАНДИТІВ!'); }
  else { const s = pick(); if (s) { const sx = s[0] * TS, sy = s[1] * TS; for (let k = 0; k < 6; k++) coins.push({ x: sx + Math.random() * 44 - 22, y: sy + Math.random() * 44 - 22, v: coinVal() + 2 }); ammoCrates.push({ x: sx, y: sy, w: 20, h: 20 }); supplyMarker = { x: sx + 10, y: sy + 10, t: 32 }; announce('📦 ПОСТАЧАННЯ!'); AUDIO.sfx.pickup(); } }
}
const SHOP = [
  { label: '❤ Аптечка — повне HP', cost: () => 4, buy: () => { health = maxHealth; } },
  { label: '🩹 Аптечка в запас (макс 3)', cost: () => 5, buy: () => { if (medkits >= MAX_MED) return false; medkits++; } },
  { label: '🔫 Повний боєзапас', cost: () => 6, buy: () => { for (let i = 0; i < WEAPONS.length; i++) if (owned[i]) { wAmmo[i] = WEAPONS[i].mag; if (WEAPONS[i].mag !== Infinity) reserve[i] = MAX_MAGS; } } },
  { label: '💪 Шкода +25%', cost: () => 12 + dmgLvl * 12, buy: () => { dmgMul += 0.25; dmgLvl++; } },
  { label: '⚡ Швидкість +12%', cost: () => 10 + spdLvl * 10, buy: () => { spdMul += 0.12; spdLvl++; } },
  { label: '🛡 Броня +25 HP', cost: () => 14 + hpLvl * 14, buy: () => { maxHealth += 25; health += 25; hpLvl++; } },
  { label: '🔓 Випадкова зброя', cost: () => 20, buy: () => { const lk = [2, 3, 4, 5].filter(i => !owned[i]); if (lk.length) { const wi = lk[Math.floor(Math.random() * lk.length)]; owned[wi] = true; wAmmo[wi] = WEAPONS[wi].mag; } } },
];
function shopRowRect(i) { const w = 380, x = VIEW_W / 2 - w / 2, y = VIEW_H / 2 - 130 + 70 + i * 42; return { x, y, w, h: 36 }; }
function buyItem(i) { const it = SHOP[i]; if (!it) return; const c = it.cost(); if (totalCoins >= c) { totalCoins -= c; const r = it.buy(); if (r === false) { totalCoins += c; AUDIO.sfx.hurt(); showToast('Максимум аптечок (' + MAX_MED + ')'); return; } AUDIO.sfx.pickup(); showToast('Куплено: ' + it.label); } else { AUDIO.sfx.hurt(); showToast('Замало монет (' + c + ')'); } }
let endShown = false;
const $title = document.getElementById('titleScreen'), $end = document.getElementById('endScreen');
const reachCells = (LEVEL.reach || []).filter(([c, r]) => r >= 0 && r < ROWS && c >= 0 && c < COLS && !solid[r][c]);

// ---- campaign: find key → free woman from locked house → escort her home; always also kill the boss ----
const BOSS_NAMES = ['Гнилий Король', 'Зомбі-Велетень', 'Лорд Гнилля', 'Старий Грець'];
const ri = n => Math.floor(R() * n);
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
  woman = { x: hsp[0], y: hsp[1], w: 18, h: 22, hp: 40, maxhp: 40, flash: 0, invuln: 0, frame: 0, walkT: 0, active: false, weapon: null, ammo: 0, fireCD: 0, aimx: 1, aimy: 0 };
  quests.push({ type: 'rescue', label: 'Врятувати жінку' });
  const bs = questSpot(700); boss = mkZombie(bs[0], bs[1]); boss.isBoss = true; boss.hp = 24; boss.maxhp = 24; boss.w = 30; boss.h = 34; boss.name = BOSS_NAMES[ri(BOSS_NAMES.length)]; boss.armed = true; boss.zw = 1; zombies.push(boss);
  quests.push({ type: 'boss', label: 'Здолати боса' });
  // one random side objective for variety
  if (R() < 0.5) quests.push({ type: 'coins', target: 25 + ri(20), label: 'Монети' });
  else quests.push({ type: 'kills', target: 12 + ri(12), label: 'Зомбі' });
})();
// gangs of coin-stealing bandits, scattered across the town
for (let gi = 0; gi < 7; gi++) { const s = questSpot(380); const n = 3 + ri(4); for (let k = 0; k < n; k++) zombies.push(mkCrim(s[0] + ri(80) - 40, s[1] + ri(80) - 40)); }
for (let k = 0; k < (district - 1) * 8; k++) { const s = questSpot(300); zombies.push(mkZombie(s[0] + ri(60) - 30, s[1] + ri(60) - 30)); }   // harder districts = more zombies

// bushes (decor) — some hide an ambush gang that springs out when you get close
const bushes = [];
{
  const cells = reachCells.slice();
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  let ambushes = 0;
  for (const [c, r] of cells) {
    if (tileIdx[r][c] !== 0) continue;                                   // bushes only on grass
    const wx = c * TS + 16, wy = r * TS + 16;
    if (Math.hypot(wx - player.x, wy - player.y) < 220) continue;
    if (bushes.some(b => Math.abs(b.x - wx) < 64 && Math.abs(b.y - wy) < 64)) continue;
    const ambush = ambushes < 14;
    const bush = { x: wx, y: wy, ambush, triggered: false, members: [] };
    if (ambush) { const n = 2 + Math.floor(R() * 4); for (let k = 0; k < n; k++) { const z = mkCrim(wx + R() * 26 - 13, wy + R() * 26 - 13); z.hidden = true; zombies.push(z); bush.members.push(z); } ambushes++; }
    bushes.push(bush);
    if (bushes.length >= 70) break;
  }
}

// driveable cars parked on roads
const vehicles = [];
{
  const road = reachCells.filter(([c, r]) => tileIdx[r][c] === 7);
  for (let i = road.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [road[i], road[j]] = [road[j], road[i]]; }
  for (const [c, r] of road) { const wx = c * TS + 16, wy = r * TS + 16; if (Math.hypot(wx - player.x, wy - player.y) < 140) continue; if (vehicles.every(v => Math.hypot(v.x - wx, v.y - wy) > 220)) { vehicles.push({ x: wx, y: wy, col: ['#6a7e8a', '#8a6a5a', '#6a8a6a', '#8a8a5a'][Math.floor(R() * 4)] }); if (vehicles.length >= 6) break; } }
}
let driving = false, carHp = 0, nearVehicle = null;
function enterCar(v) { driving = true; carHp = 100; player.x = v.x; player.y = v.y; const i = vehicles.indexOf(v); if (i >= 0) vehicles.splice(i, 1); showToast('🚗 За кермом! Дави ворогів'); }
function exitCar() { if (!driving) return; driving = false; vehicles.push({ x: player.x, y: player.y, col: '#7a7a6a' }); }

// wandering survivors that join your squad and fight
function mkAlly(x, y) { return { x, y, w: 18, h: 22, vx: 0, vy: 0, t: 0, hp: 30, maxhp: 30, flash: 0, invuln: 0, frame: 0, walkT: 0, fireCD: 0, aimx: 1, aimy: 0, joined: false }; }
const allies = [];
{
  const cells = reachCells.slice();
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  let n = 0;
  for (const [c, r] of cells) { const wx = c * TS + 16, wy = r * TS + 16; if (Math.hypot(wx - player.x, wy - player.y) < 320) continue; if (allies.every(a => Math.hypot(a.x + 9 - wx, a.y + 11 - wy) > 320)) { allies.push(mkAlly(wx - 9, wy - 11)); if (++n >= 3) break; } }
}
function updateAllies(dt) {
  for (let i = allies.length - 1; i >= 0; i--) {
    const a = allies[i]; a.flash = Math.max(0, a.flash - dt); a.invuln = Math.max(0, a.invuln - dt);
    const acx = a.x + 9, acy = a.y + 11, pcx = player.x + 9, pcy = player.y + 11;
    if (!a.joined) {
      if (Math.hypot(pcx - acx, pcy - acy) < 46) { a.joined = true; showToast('🤝 Вижилець приєднався!'); AUDIO.sfx.pickup(); }
      else { a.t -= dt; if (a.t <= 0) { const an = Math.random() * 6.283; a.vx = Math.cos(an) * 38; a.vy = Math.sin(an) * 38; a.t = 0.6 + Math.random() * 1.5; } tryMove(a, a.vx * dt, a.vy * dt); a.frame = 1 + (Math.floor(animClock * 7 + a.x) % 2); }
      continue;
    }
    const dd = Math.hypot(pcx - acx, pcy - acy);
    if (dd > 54) { const s = 132 * dt; tryMove(a, (pcx - acx) / dd * s, (pcy - acy) / dd * s); a.walkT += dt; a.frame = 1 + (Math.floor(a.walkT * 8) % 2); } else a.frame = 0;
    a.fireCD -= dt; let best = null, bd = 300 * 300;
    for (const z of zombies) { if (z.dead || z.hidden) continue; const dx = z.x + z.w / 2 - acx, dy = z.y + z.h / 2 - acy, q = dx * dx + dy * dy; if (q < bd) { bd = q; best = [dx, dy]; } }
    if (best) { const m = Math.hypot(best[0], best[1]) || 1; a.aimx = best[0] / m; a.aimy = best[1] / m; if (a.fireCD <= 0) { bullets.push({ x: acx, y: acy, vx: a.aimx * 520, vy: a.aimy * 520, life: 1.0, dmg: 1, color: '#9fd0e8' }); a.fireCD = 0.4; } }
    for (const z of zombies) { if (!z.dead && !z.hidden && a.invuln <= 0 && aabb(a.x, a.y, a.w, a.h, z.x, z.y, z.w, z.h)) { a.hp -= 12; a.invuln = 0.6; a.flash = 0.14; spawnBurst(acx, acy, '#9fd0e8', 5, 80, 2); break; } }
    if (a.hp <= 0) { spawnBurst(acx, acy, '#9fd0e8', 12, 130, 3); showToast('Вижилець загинув...'); allies.splice(i, 1); }
  }
}

// barricades — build a wall in front of you for coins; zombies bash it down
const barricades = []; const BARR_COST = 3;
function buildBarricade() {
  if (driving) return;
  const c = Math.floor((player.x + 9 + face.x * TS) / TS), r = Math.floor((player.y + 11 + face.y * TS) / TS);
  if (c < 1 || r < 1 || c >= COLS - 1 || r >= ROWS - 1) return;
  if (solid[r][c] || barricades.some(b => b.c === c && b.r === r)) { showToast('Тут не можна'); return; }
  if (totalCoins < BARR_COST) { showToast('Замало монет (' + BARR_COST + ')'); AUDIO.sfx.hurt(); return; }
  totalCoins -= BARR_COST; solid[r][c] = true; barricades.push({ c, r, hp: 60, maxhp: 60 }); AUDIO.sfx.pickup(); showToast('🧱 Барикаду поставлено');
}
function updateBarricades(dt) {
  for (let i = barricades.length - 1; i >= 0; i--) {
    const b = barricades[i], bx = b.c * TS + 16, by = b.r * TS + 16;
    for (const z of zombies) { if (z.dead || z.hidden) continue; if (Math.abs(z.x + z.w / 2 - bx) < 28 && Math.abs(z.y + z.h / 2 - by) < 28) b.hp -= dt * 14; }
    if (b.hp <= 0) { solid[b.r][b.c] = false; spawnBurst(bx, by, '#7a5a30', 16, 150, 3); barricades.splice(i, 1); }
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
let medkits = 0; const MAX_MED = 3; let petPhase = 0;
// carry money, weapons, upgrades, pets & medkits to the next district
function saveCarry() { try { sessionStorage.setItem('punktown_carry', JSON.stringify({ coins: totalCoins, owned, wAmmo, reserve, curW, medkits, dmgMul, spdMul, maxHealth, dmgLvl, spdLvl, hpLvl, pets: pets.map(p => p.type) })); } catch (e) {} }
function useMedkit() { if (state !== 'play' || medkits <= 0 || health >= maxHealth) { if (medkits <= 0) showToast('Немає аптечок'); return; } medkits--; health = Math.min(maxHealth, health + 70); AUDIO.sfx.pickup(); showToast('🩹 +HP'); for (let i = 0; i < 8; i++) particles.push({ x: player.x + 9 + (Math.random() * 20 - 10), y: player.y + player.h, vx: Math.random() * 16 - 8, vy: -28, life: 0.6, max: 0.6, color: '#7dff9a', size: 3, grav: -10 }); }
(function loadCarry() {
  if (district <= 1) { try { sessionStorage.removeItem('punktown_carry'); } catch (e) {} return; }
  let c = null; try { c = JSON.parse(sessionStorage.getItem('punktown_carry') || 'null'); } catch (e) {}
  if (!c) return;
  totalCoins = c.coins || 0; coinsTotal = totalCoins; medkits = c.medkits || 0; curW = c.curW || 0;
  for (let i = 0; i < WEAPONS.length; i++) { if (c.owned && c.owned[i]) owned[i] = true; if (c.wAmmo && c.wAmmo[i] != null) wAmmo[i] = c.wAmmo[i]; if (c.reserve && c.reserve[i] != null) reserve[i] = c.reserve[i]; }
  dmgMul = c.dmgMul || 1; spdMul = c.spdMul || 1; maxHealth = c.maxHealth || 100; health = maxHealth; dmgLvl = c.dmgLvl || 0; spdLvl = c.spdLvl || 0; hpLvl = c.hpLvl || 0;
  for (const t of (c.pets || [])) if (pets.length < MAX_PETS && ANIMALS[t]) pets.push({ x: player.x + (Math.random() * 40 - 20), y: player.y + 24, w: 16, h: 14, type: t, hp: ANIMALS[t].hp, maxhp: ANIMALS[t].hp, fireCD: 0, aimx: 1, aimy: 0, bob: Math.random() * 6, orbit: Math.random() * 6.283 });
})();
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
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.code === 'Tab') minimapOn = !minimapOn;
  if (state === 'title' && (e.code === 'Space' || e.code === 'Enter')) startGame();
  else if ((state === 'win' || state === 'gameover') && e.code === 'KeyR') location.reload();
  else if (e.code === 'Space' && state === 'play') useAbility();
  else if (e.code === 'KeyH' && state === 'play') useMedkit();
  else if (e.code === 'KeyE' && state === 'play') { if (driving) exitCar(); else if (nearVehicle) enterCar(nearVehicle); }
  else if (e.code === 'KeyC' && state === 'play') buildBarricade();
  else if (e.code === 'KeyB' && state === 'play' && nearShopTown) { state = 'shop'; }
  else if (e.code === 'KeyB' && state === 'play' && nearMerc) { state = 'merc'; }
  else if ((e.code === 'KeyB' || e.code === 'Escape') && state === 'merc') { state = 'play'; }
  else if ((e.code === 'KeyB' || e.code === 'Escape') && state === 'shop') { state = 'play'; }
  else if ((e.code === 'KeyB' || e.code === 'Escape') && state === 'skins') { state = 'shop'; }
  else if (e.code === 'Escape' && state === 'play') { state = 'paused'; AUDIO.stopMusic(); }
  else if (e.code === 'Escape' && state === 'paused') { state = 'play'; AUDIO.startMusic(); }
  else if (state === 'shop' && /^Digit[1-6]$/.test(e.code)) buyItem(+e.code.slice(5) - 1);
  if (e.code === 'KeyM') { const on = AUDIO.toggleMusic(); showToast(on ? '♪ музика увімкнена' : '♪ музика вимкнена'); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
const mouse = { x: VIEW_W / 2, y: VIEW_H / 2, down: false, moved: false };
canvas.addEventListener('mousemove', e => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.moved = true; });
canvas.addEventListener('mousedown', () => { canvas.focus(); if (state === 'title') { startGame(); return; } if (state === 'shop') { for (let i = 0; i < SHOP.length; i++) { const r = shopRowRect(i); if (mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h) { buyItem(i); return; } } const sb = skinsBtnRect(); if (mouse.x >= sb.x && mouse.x <= sb.x + sb.w && mouse.y >= sb.y && mouse.y <= sb.y + sb.h) state = 'skins'; return; } if (state === 'skins') { for (let i = 0; i < activeSkins().length; i++) { const r = skinRect(i); if (mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h) { buyOrEquipSkin(i); return; } } state = 'shop'; return; } if (state === 'merc') { for (let i = 0; i < ANIMALS.length; i++) { const r = mercRowRect(i); if (mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h) { buyPet(i); return; } } state = 'play'; return; } if (state !== 'play') return; if (inAbil(mouse.x, mouse.y)) { useAbility(); return; } if (inMed(mouse.x, mouse.y)) { useMedkit(); return; } if (inQuestPanel(mouse.x, mouse.y)) { questsCollapsed = !questsCollapsed; return; } const wi = weaponSlotAt(mouse.x, mouse.y); if (wi >= 0) { if (owned[wi]) curW = wi; return; } mouse.down = true; });

// hero picker on the title screen
{ const btns = document.querySelectorAll('#heroPick .hero');
  const paint = () => btns.forEach(b => { const on = b.dataset.hero === hero; b.style.borderColor = on ? '#ffd23f' : 'transparent'; b.style.background = on ? 'rgba(255,210,63,.18)' : 'rgba(255,255,255,.08)'; });
  btns.forEach(b => b.addEventListener('click', () => { hero = b.dataset.hero; try { localStorage.setItem('punk_hero', hero); } catch (e) {} paint(); }));
  paint();
}
function updateRescueLabel() { const rq = quests.find(q => q.type === 'rescue'); if (rq) rq.label = captiveMale ? 'Врятувати чоловіка' : 'Врятувати жінку'; }
function startGame() { if (state !== 'title') return; captiveMale = (hero === 'female'); updateRescueLabel(); state = 'play'; if ($title) $title.classList.add('hidden'); AUDIO.start(); tryFullscreen(); }
function showEndScreen() {
  if (!$end) return;
  if (score > best) { best = score; try { localStorage.setItem('punktown_best', best); } catch (e) {} }
  const t = document.getElementById('endTitle'), p = document.getElementById('endText');
  const stat = ' · Очки: ' + score + ' · Рекорд: ' + best + ' · Вбито: ' + kills;
  const btn = document.getElementById('againBtn');
  if (state === 'win') {
    t.textContent = '🎉 РАЙОН ' + district + ' ЗАЧИЩЕНО!'; t.className = 'win'; p.textContent = (captiveMale ? 'Чоловіка' : 'Жінку') + ' врятовано, боса повалено!' + stat;
    btn.textContent = '➜ Наступний район'; btn.onclick = () => { saveCarry(); try { sessionStorage.setItem('punktown_district', district + 1); } catch (e) {} location.reload(); };
  } else {
    t.textContent = '☠ КІНЕЦЬ ГРИ'; t.className = 'lose'; p.textContent = (failReason || 'Тебе здолали.') + ' · Дійшов до району ' + district + stat;
    btn.textContent = '↺ Почати з 1 району'; btn.onclick = () => { try { sessionStorage.setItem('punktown_district', 1); } catch (e) {} location.reload(); };
  }
  $end.classList.remove('hidden');
}
document.getElementById('startBtn').addEventListener('click', startGame);
// (againBtn handler is set per-result in showEndScreen)

// ---- co-op lobby (reload into a room so seed = code → identical map) ----
function roomCode() { const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
const setMP = t => { const s = document.getElementById('mpStatus'); if (s) s.textContent = t; };
{ const hb = document.getElementById('hostBtn'), jb = document.getElementById('joinBtn'), jc = document.getElementById('joinCode');
  if (hb) hb.addEventListener('click', () => { const code = roomCode(); sessionStorage.setItem('coop', JSON.stringify({ role: 'host', code })); location.reload(); });
  if (jb) jb.addEventListener('click', () => { if (jc.style.display === 'none' || !jc.style.display) { jc.style.display = 'inline-block'; jc.focus(); return; } const code = (jc.value || '').trim().toUpperCase(); if (code.length < 4) { jc.focus(); return; } sessionStorage.setItem('coop', JSON.stringify({ role: 'client', code })); location.reload(); }); }
let remotePlayer = null, player2 = null, remoteInput = null, netSnap = null, netSnapNew = false, netSendT = 0, netInT = 0;
const ZTYPES = ['normal', 'runner', 'tank', 'exploder'];
const ZTI = { normal: 0, runner: 1, tank: 2, exploder: 3 };
function spawnPlayer2() { const h = homes[0]; player2 = { x: h.x + 44, y: h.y + 40, w: 18, h: 22, face: { x: 1, y: 0 }, frame: 0, health: 100, invuln: 0, flash: 0, fireCD: 0, dead: false, respawnT: 0, active: true }; }
if (coop) {
  NET.on('err', t => {
    const m = {
      'broker': '⚠ Не вдалося підключитись до сервера кімнат. Перевір інтернет і спробуй ще раз.',
      'subscribe': '⚠ Збій підписки на кімнату. Спробуй ще раз.',
    };
    setMP(m[t] || ('⚠ Помилка зв’язку: ' + t + ' — спробуй ще раз'));
  });
  NET.on('open', () => { setMP('✅ Напарник у грі!'); if (NET.role() === 'host') spawnPlayer2(); if (state === 'title') startGame(); });
  NET.on('close', () => { setMP('⚠ Напарник відключився'); remotePlayer = null; if (NET.role() === 'host') { player2 = null; remoteInput = null; } });
  NET.on('data', d => { if (!d) return; if (d.t === 'in') remoteInput = d; else if (d.t === 'snap') { netSnap = d; netSnapNew = true; } else if (d.t === 'grab') hostGrab(d); else if (d.t === 'abil') hostAbil(d); });
  if (coop.role === 'host') { NET.on('ready', () => setMP('Кімната: ' + coop.code + '  — дай цей код напарнику, тоді тисни «Грати»')); NET.host(coop.code); setMP('Створення кімнати…'); }
  else { player.x += 36; NET.join(coop.code); setMP('Приєднання до кімнати ' + coop.code + '…'); }   // offset so the two players don't spawn stacked
}
// world interactions (key, door, …) should trigger from EITHER player
function eitherOver(bx, by, bw, bh) {
  if (aabb(player.x, player.y, player.w, player.h, bx, by, bw, bh)) return true;
  if (player2 && player2.active && !player2.dead && aabb(player2.x, player2.y, player2.w, player2.h, bx, by, bw, bh)) return true;
  return false;
}
// ---- host: build a world snapshot for the client (host is authoritative) ----
// Only send what's near the client (player2) — keeps each packet tiny so the
// public relay isn't flooded (that was the lag). The boss is always included.
function snapNear(x, y) {
  const R = 860, ax = player2 && player2.active ? player2.x + 9 : player.x + 9, ay = player2 && player2.active ? player2.y + 11 : player.y + 11;
  return (x - ax) * (x - ax) + (y - ay) * (y - ay) < R * R;
}
function buildSnapshot() {
  const z = [];
  for (const e of zombies) {
    if (e.hidden || e.dead) continue;
    if (!e.isBoss && !snapNear(e.x, e.y)) continue;
    let fl = 0; if (e.crim) fl |= 1; if (e.armed) fl |= 2; if (e.isBoss) fl |= 4;
    z.push([Math.round(e.x), Math.round(e.y), e.frame | 0, ZTI[e.ztype] || 0, fl, e.w, e.h, Math.round(e.hp), Math.round(e.maxhp || e.hp), Math.round((e.aimx || 0) * 100), Math.round((e.aimy || 0) * 100), e.zw | 0, Math.round(e.vx || 0), Math.round(e.vy || 0)]);
  }
  return {
    t: 'snap', nf: +nightF.toFixed(3),
    p1: { x: Math.round(player.x), y: Math.round(player.y), fx: +face.x.toFixed(2), fy: +face.y.toFixed(2), fr: player.frame, h: Math.round(health), dr: driving ? 1 : 0, ca: driving ? +Math.atan2(face.y, face.x).toFixed(2) : 0, vx: Math.round(player.vx || 0), vy: Math.round(player.vy || 0), hero: hero, skin: curSkinVal(), shield: invShield > 0 ? 1 : 0 },
    cm: captiveMale ? 1 : 0,
    mh: player2 ? Math.round(player2.health) : 100,
    cn: totalCoins, ct: coinsTotal, kl: kills, sc: score, di: district,
    fl: [hasKey ? 1 : 0, womanFreed ? 1 : 0, womanRescued ? 1 : 0, bossDead ? 1 : 0],
    bn: boss && !bossDead ? boss.name : '',
    z,
    bu: bullets.filter(b => snapNear(b.x, b.y)).map(b => [Math.round(b.x), Math.round(b.y), b.color, Math.round(b.vx), Math.round(b.vy)]),
    eb: eBullets.filter(b => snapNear(b.x, b.y)).map(b => [Math.round(b.x), Math.round(b.y), b.big ? 1 : 0, Math.round(b.vx), Math.round(b.vy)]),
    co: coins.filter(c => snapNear(c.x, c.y)).map(c => [Math.round(c.x), Math.round(c.y), c.v || 1]),
    lt: loot.filter(l => snapNear(l.x, l.y)).map(l => [Math.round(l.x), Math.round(l.y), l.weapon]),
    ac: ammoCrates.filter(a => snapNear(a.x, a.y)).map(a => [Math.round(a.x), Math.round(a.y)]),
    al: allies.filter(a => snapNear(a.x, a.y)).map(a => [Math.round(a.x), Math.round(a.y), a.frame | 0, a.joined ? 1 : 0, Math.round(a.hp), Math.round(a.maxhp || 30), Math.round(a.vx || 0), Math.round(a.vy || 0)]),
    wm: woman && woman.active ? [Math.round(woman.x), Math.round(woman.y), woman.frame | 0, womanRescued ? 1 : 0, womanDead ? 1 : 0, Math.round(woman.vx || 0), Math.round(woman.vy || 0)] : null,
    st: state,
  };
}
// host: client used a special ability
function hostAbil(d) {
  if (!player2) return;
  if (d.a === 'flip') { player2.flipT = FLIP_DUR + 0.05; player2.invuln = Math.max(player2.invuln, FLIP_DUR + 0.1); }
  else if (d.a === 'shield') { player2.invuln = Math.max(player2.invuln, MALE_INV); player2.shield = MALE_INV; }
}
// host: client (player2) grabbed a world item → remove the nearest matching one
function hostGrab(d) {
  if (d.kind === 'loot') { let bi = -1, bd = 40 * 40; for (let i = 0; i < loot.length; i++) { const q = (loot[i].x - d.x) ** 2 + (loot[i].y - d.y) ** 2; if (q < bd) { bd = q; bi = i; } } if (bi >= 0) loot.splice(bi, 1); }
  else if (d.kind === 'ammo') { let bi = -1, bd = 40 * 40; for (let i = 0; i < ammoCrates.length; i++) { const q = (ammoCrates[i].x - d.x) ** 2 + (ammoCrates[i].y - d.y) ** 2; if (q < bd) { bd = q; bi = i; } } if (bi >= 0) ammoCrates.splice(bi, 1); }
}
// ---- client: apply the host's snapshot into local state for rendering ----
function applySnapshot(s) {
  nightF = s.nf;
  remotePlayer = s.p1;   // has vx/vy for extrapolation between snapshots, hero, shield
  if (remotePlayer) remotePlayer.shield = remotePlayer.shield ? 0.3 : 0;   // ring shown while host shield active
  captiveMale = !!s.cm; updateRescueLabel();
  health = s.mh; totalCoins = s.cn; if (s.ct != null) coinsTotal = s.ct; kills = s.kl; score = s.sc; district = s.di;
  hasKey = !!s.fl[0]; womanFreed = !!s.fl[1]; womanRescued = !!s.fl[2]; bossDead = !!s.fl[3];
  zombies.length = 0;
  for (const a of s.z) zombies.push({
    x: a[0], y: a[1], frame: a[2], ztype: ZTYPES[a[3]], crim: !!(a[4] & 1), armed: !!(a[4] & 2), isBoss: !!(a[4] & 4),
    w: a[5], h: a[6], hp: a[7], maxhp: a[8], aimx: a[9] / 100, aimy: a[10] / 100, zw: a[11], vx: a[12] || 0, vy: a[13] || 0, name: s.bn, hidden: false, flash: 0, sm: 1, dead: false,
  });
  const bz = zombies.find(z => z.isBoss); if (bz) boss = bz;   // keep boss pointer correct for the objective arrow
  bullets.length = 0; for (const a of s.bu) bullets.push({ x: a[0], y: a[1], color: a[2], vx: a[3] || 0, vy: a[4] || 0, life: 1, dmg: 0 });
  eBullets.length = 0; for (const a of s.eb) eBullets.push({ x: a[0], y: a[1], big: !!a[2], color: a[2] ? '#c46bff' : '#ff5a4a', vx: a[3] || 0, vy: a[4] || 0, life: 1, dmg: 0 });
  coins.length = 0; for (const a of s.co) coins.push({ x: a[0], y: a[1], v: a[2] });
  loot.length = 0; if (s.lt) for (const a of s.lt) loot.push({ x: a[0], y: a[1], w: 22, h: 18, weapon: a[2] });
  ammoCrates.length = 0; if (s.ac) for (const a of s.ac) ammoCrates.push({ x: a[0], y: a[1], w: 20, h: 20 });
  allies.length = 0; if (s.al) for (const a of s.al) allies.push({ x: a[0], y: a[1], w: 18, h: 22, frame: a[2], joined: !!a[3], hp: a[4], maxhp: a[5], vx: a[6] || 0, vy: a[7] || 0, flash: 0 });
  if (s.wm) { woman.active = true; woman.x = s.wm[0]; woman.y = s.wm[1]; woman.frame = s.wm[2]; womanRescued = !!s.wm[3]; womanDead = !!s.wm[4]; woman.vx = s.wm[5] || 0; woman.vy = s.wm[6] || 0; }
  else if (woman) woman.active = false;
  if ((s.st === 'win' || s.st === 'gameover') && state === 'play') state = s.st;   // end together (never knock client back to title)
}
// ---- host: drive player2 (the client's character) from received input ----
function updateP2(dt) {
  const ri = remoteInput;
  player2.invuln = Math.max(0, player2.invuln - dt);
  player2.flash = Math.max(0, player2.flash - dt);
  player2.flipT = Math.max(0, (player2.flipT || 0) - dt); player2.shield = Math.max(0, (player2.shield || 0) - dt);
  if (player2.dead) { player2.respawnT -= dt; if (player2.respawnT <= 0) { player2.dead = false; player2.health = 100; const h = homes[0]; player2.x = h.x + 44; player2.y = h.y + 40; } return; }
  player2.x = ri.x; player2.y = ri.y; player2.face.x = ri.fx; player2.face.y = ri.fy; player2.frame = ri.fr;
  player2.dr = ri.dr ? 1 : 0; player2.ca = ri.ca || 0; player2.hero = ri.hero || 'male'; player2.skin = ri.skin || 0;   // driving state + hero sprite/costume
  player2.fireCD = Math.max(0, player2.fireCD - dt);
  if (ri.fire && player2.fireCD <= 0) {
    const mx = player2.x + 9, my = player2.y + 11, ax = ri.ax || 1, ay = ri.ay || 0, base = Math.atan2(ay, ax);
    if (ri.melee) {
      for (const z of zombies) { if (z.dead || z.hidden) continue; const zx = z.x + z.w / 2 - mx, zy = z.y + z.h / 2 - my, dd = Math.hypot(zx, zy); if (dd <= 44 && (zx * ax + zy * ay) / (dd || 1) > 0.1) damageZombie(z, ri.dmg || 4, ax, ay); }
      AUDIO.sfx.melee();
    } else {
      const pel = ri.pel || 1, spr = ri.spr || 0;
      for (let p = 0; p < pel; p++) { const a = base + (Math.random() - 0.5) * spr * (pel > 1 ? 2 : 1); bullets.push({ x: mx, y: my, vx: Math.cos(a) * (ri.spd || 620), vy: Math.sin(a) * (ri.spd || 620), life: 1.0, dmg: ri.dmg || 1, color: ri.col || '#9fd0ff' }); }
    }
    player2.fireCD = Math.max(0.08, ri.rate || 0.18);
  }
}
// client: grab weapon/ammo drops locally, then ask the host to remove the world item
function clientPickups() {
  for (let i = loot.length - 1; i >= 0; i--) { const a = loot[i];
    if (aabb(player.x, player.y, player.w, player.h, a.x, a.y, a.w, a.h)) {
      const justStarters = owned.filter(Boolean).length <= 2;
      owned[a.weapon] = true; wAmmo[a.weapon] = WEAPONS[a.weapon].mag; if (justStarters) curW = a.weapon;
      spawnBurst(a.x + 11, a.y + 9, WEAPONS[a.weapon].color, 14, 130, 3); AUDIO.sfx.pickup(); showToast('Нова зброя: ' + WEAPONS[a.weapon].name);
      loot.splice(i, 1); NET.send({ t: 'grab', kind: 'loot', x: Math.round(a.x), y: Math.round(a.y) });
    }
  }
  for (let i = ammoCrates.length - 1; i >= 0; i--) { const a = ammoCrates[i];
    if (WEAPONS[curW].mag !== Infinity && reserve[curW] < MAX_MAGS && aabb(player.x, player.y, player.w, player.h, a.x, a.y, a.w, a.h)) {
      reserve[curW] = Math.min(MAX_MAGS, reserve[curW] + 1); spawnBurst(a.x + 10, a.y + 8, '#ffd23f', 8, 90, 2); AUDIO.sfx.pickup(); showToast('+ магазин (' + WEAPONS[curW].name + ')');
      ammoCrates.splice(i, 1); NET.send({ t: 'grab', kind: 'ammo', x: Math.round(a.x), y: Math.round(a.y) });
    }
  }
}
// ---- client: local movement + send input; world comes from snapshots ----
function updateClient(dt) {
  if (netSnapNew) { applySnapshot(netSnap); netSnapNew = false; }   // apply ONCE per snapshot…
  for (const z of zombies) { z.x += (z.vx || 0) * dt; z.y += (z.vy || 0) * dt; }   // …extrapolate in between → smooth
  for (const b of bullets) { b.x += (b.vx || 0) * dt; b.y += (b.vy || 0) * dt; }
  for (const b of eBullets) { b.x += (b.vx || 0) * dt; b.y += (b.vy || 0) * dt; }
  for (const a of allies) { a.x += (a.vx || 0) * dt; a.y += (a.vy || 0) * dt; }
  if (remotePlayer) { remotePlayer.x += (remotePlayer.vx || 0) * dt; remotePlayer.y += (remotePlayer.vy || 0) * dt; }
  if (woman && woman.active) { woman.x += (woman.vx || 0) * dt; woman.y += (woman.vy || 0) * dt; }
  if (state !== 'play') return;

  let ix = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  let iy = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
  if (tMove.active) { ix = tMove.mx; iy = tMove.my; }
  const mag = Math.hypot(ix, iy), moving = mag > 0.06;
  if (moving) { face.x = ix / mag; face.y = iy / mag; }
  const running = (keys.ShiftLeft || keys.ShiftRight || (tMove.active && mag > 0.92)) && stamina > 0 && moving;
  const onSand = tileAt(player.x + player.w / 2, player.y + player.h / 2) === 3;
  const sp = (driving ? 245 : SPEED * spdMul * (running ? RUN_MULT : 1) * (onSand ? 0.5 : 1)) * dt;
  let mvx = ix, mvy = iy; if (mag > 1) { mvx = ix / mag; mvy = iy / mag; }
  abilCD = Math.max(0, abilCD - dt); invShield = Math.max(0, invShield - dt); invuln = Math.max(0, invuln - dt);
  if (flipT > 0) { tryMove(player, flipDir.x * FLIP_SPEED * dt, flipDir.y * FLIP_SPEED * dt); flipT -= dt; player.frame = 1; }
  else { tryMove(player, mvx * sp, mvy * sp); if (moving) { player.walkT += dt * (running ? 1.5 : 1); player.frame = 1 + (Math.floor(player.walkT * 9) % 2); } else player.frame = 0; }
  stamina = clamp(stamina + (running ? -STAM_DRAIN : STAM_REGEN) * dt, 0, STAM_MAX);
  nearVehicle = null; if (!driving) { let bd = 46 * 46; for (const v of vehicles) { const d = (v.x - player.x - 9) ** 2 + (v.y - player.y - 11) ** 2; if (d < bd) { bd = d; nearVehicle = v; } } }
  clientPickups();
  updateNPCs(dt); updatePets(dt, false);

  // weapon select (owned only) + auto-reload from a spare magazine
  for (let i = 0; i < WEAPONS.length; i++) if (keys['Digit' + (i + 1)] && owned[i]) curW = i;
  if (WEAPONS[curW].mag !== Infinity && wAmmo[curW] <= 0 && reserve[curW] > 0) { wAmmo[curW] = WEAPONS[curW].mag; reserve[curW]--; AUDIO.sfx.pickup(); }

  let aim = null;
  if (tFire.active) { aim = autoAim(); face.x = aim.x; face.y = aim.y; }
  let firing = false, ax = face.x, ay = face.y;
  if (mouse.down) { firing = true; ax = mouse.x + cam.x - (player.x + player.w / 2); ay = mouse.y + cam.y - (player.y + player.h / 2); const m = Math.hypot(ax, ay) || 1; ax /= m; ay /= m; }
  else if (tFire.active) { firing = true; ax = aim.x; ay = aim.y; }
  else if (keys.KeyF) { firing = true; }
  const w = WEAPONS[curW], hasAmmo = w.mag === Infinity || wAmmo[curW] > 0;
  fireCD -= dt;
  if (firing && hasAmmo && fireCD <= 0) {   // client owns its ammo; host spawns the bullet
    fireCD = w.rate; if (w.mag !== Infinity) wAmmo[curW]--;
    (w.type === 'melee' ? AUDIO.sfx.melee : w.type === 'flame' ? AUDIO.sfx.flame : AUDIO.sfx.shoot)();
  }
  const sendFire = firing && hasAmmo;
  netInT -= dt;
  if (netInT <= 0) {
    netInT = 0.04;
    NET.send({ t: 'in', x: Math.round(player.x), y: Math.round(player.y), fx: +face.x.toFixed(2), fy: +face.y.toFixed(2), fr: player.frame,
      fire: sendFire, ax: +ax.toFixed(2), ay: +ay.toFixed(2),
      dmg: Math.round(w.dmg * dmgMul), rate: w.rate, spd: w.speed || 620, col: w.color, pel: w.pellets || 1, spr: w.spread || 0, melee: w.type === 'melee',
      dr: driving ? 1 : 0, ca: driving ? +Math.atan2(face.y, face.x).toFixed(2) : 0, hero: hero, skin: curSkinVal() });
  }
  cam.x = clamp(player.x + player.w / 2 - VIEW_W / 2, 0, LW - VIEW_W);
  cam.y = clamp(player.y + player.h / 2 - VIEW_H / 2, 0, LH - VIEW_H);
}
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
const btnPause = { y: 48, w: 58, h: 46, get x() { return VIEW_W - 70; } };
const btnShop = { x: 10, y: 100, w: 120, h: 34 };   // appears near home on mobile
const btnCar = { x: 10, y: 140, w: 130, h: 34 };    // appears near a car / when driving
const btnBuild = { x: 10, y: 180, w: 130, h: 34 };  // build barricade (mobile)
const abilBtn = { r: 36, get x() { return VIEW_W - 168; }, get y() { return VIEW_H - 96; } };   // special-ability button (left of fire)
const medBtn = { r: 30, get x() { return VIEW_W - 150; }, get y() { return VIEW_H - 178; } };   // medkit button (above ability)
const inMed = (x, y) => Math.hypot(x - medBtn.x, y - medBtn.y) <= medBtn.r + 10;
const inBtn = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
const inFire = (x, y) => Math.hypot(x - fireBtn.x, y - fireBtn.y) <= fireBtn.r + 12;
const inAbil = (x, y) => Math.hypot(x - abilBtn.x, y - abilBtn.y) <= abilBtn.r + 10;
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
    if (state === 'shop') { let hit = false; for (let i = 0; i < SHOP.length; i++) { const r = shopRowRect(i); if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { buyItem(i); hit = true; break; } } if (!hit) { const sb = skinsBtnRect(); if (x >= sb.x && x <= sb.x + sb.w && y >= sb.y && y <= sb.y + sb.h) { state = 'skins'; hit = true; } } if (!hit) state = 'play'; continue; }
    if (state === 'skins') { let hit = false; for (let i = 0; i < activeSkins().length; i++) { const r = skinRect(i); if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { buyOrEquipSkin(i); hit = true; break; } } if (!hit) state = 'shop'; continue; }
    if (state === 'merc') { let hit = false; for (let i = 0; i < ANIMALS.length; i++) { const r = mercRowRect(i); if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { buyPet(i); hit = true; break; } } if (!hit) state = 'play'; continue; }
    if (inBtn(btnPause, x, y)) { if (state === 'play') { state = 'paused'; AUDIO.stopMusic(); } else if (state === 'paused') { state = 'play'; AUDIO.startMusic(); } continue; }
    if (state !== 'play') continue;
    if (nearShopTown && inBtn(btnShop, x, y)) { state = 'shop'; continue; }
    if (nearMerc && inBtn(btnShop, x, y)) { state = 'merc'; continue; }
    if ((nearVehicle || driving) && inBtn(btnCar, x, y)) { if (driving) exitCar(); else enterCar(nearVehicle); continue; }
    if (!driving && inBtn(btnBuild, x, y)) { buildBarricade(); continue; }
    if (inAbil(x, y)) { useAbility(); continue; }
    if (inMed(x, y)) { useMedkit(); continue; }
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
  if (z.bounty) { bountyKilled = true; shakeT = Math.max(shakeT, 0.3); spawnBurst(z.x + 9, z.y + 11, '#ffd23f', 24, 200, 4); showToast('🎯 Ціль ліквідовано!'); }
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
    if (Math.hypot(player.x + 9 - ex, player.y + 11 - ey) < R) hurt(Math.round(26 * zPow()));
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
  { const p = (animClock % DAYCYCLE) / DAYCYCLE, m = Math.min(p, 1 - p);   // day 80% / night 20% (night around the cycle edges)
    const t = Math.max(0, Math.min(1, (m - 0.10) / 0.05)); nightF = 1 - t * t * (3 - 2 * t); }
  if (state !== 'play') return;
  dt = Math.min(dt, 0.033);
  if (coop && NET.role() === 'client') { updateClient(dt); return; }   // client only moves itself + sends input

  // movement (keyboard or touch joystick — analog-friendly)
  let ix = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  let iy = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
  if (tMove.active) { ix = tMove.mx; iy = tMove.my; }
  const mag = Math.hypot(ix, iy);
  const moving = mag > 0.06;
  if (moving) { face.x = ix / mag; face.y = iy / mag; }
  const running = (keys.ShiftLeft || keys.ShiftRight || (tMove.active && mag > 0.92)) && stamina > 0 && moving;
  const onSand = tileAt(player.x + player.w / 2, player.y + player.h / 2) === 3;
  const sp = (driving ? 245 : SPEED * spdMul * (running ? RUN_MULT : 1) * (onSand ? 0.5 : 1)) * dt;
  let mvx = ix, mvy = iy; if (mag > 1) { mvx = ix / mag; mvy = iy / mag; }
  abilCD = Math.max(0, abilCD - dt); invShield = Math.max(0, invShield - dt);
  if (flipT > 0) { tryMove(player, flipDir.x * FLIP_SPEED * dt, flipDir.y * FLIP_SPEED * dt); player.vx = flipDir.x * FLIP_SPEED; player.vy = flipDir.y * FLIP_SPEED; flipT -= dt; player.frame = 1; }
  else { tryMove(player, mvx * sp, mvy * sp); player.vx = dt > 0 ? mvx * sp / dt : 0; player.vy = dt > 0 ? mvy * sp / dt : 0;   // px/s, for net smoothing
    if (moving) { player.walkT += dt * (running ? 1.5 : 1); player.frame = 1 + (Math.floor(player.walkT * 9) % 2); } else { player.frame = 0; } }
  // nearest mountable vehicle
  nearVehicle = null; if (!driving) { let bd = 46 * 46; for (const v of vehicles) { const d = (v.x - player.x - 9) ** 2 + (v.y - player.y - 11) ** 2; if (d < bd) { bd = d; nearVehicle = v; } } }
  if (coop && NET.role() === 'host' && player2 && remoteInput) updateP2(dt);   // drive the client's character

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
  respawnT -= dt; if (respawnT <= 0) { respawnT = RESPAWN_EVERY * (1 - nightF * 0.6); respawnZombie(); if (nightF > 0.55) respawnZombie(); }   // hordes at night
  // dynamic events
  eventT -= dt; if (eventT <= 0) { eventT = 45 + Math.random() * 40; triggerEvent(); }
  eventMsgT = Math.max(0, eventMsgT - dt);
  if (supplyMarker) { supplyMarker.t -= dt; if (supplyMarker.t <= 0) supplyMarker = null; }

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
    const zx = z.x + z.w / 2, zy = z.y + z.h / 2;
    let px = player.x + player.w / 2, py = player.y + player.h / 2;
    if (player2 && player2.active && !player2.dead) { const p2x = player2.x + 9, p2y = player2.y + 11; if ((p2x - zx) ** 2 + (p2y - zy) ** 2 < (px - zx) ** 2 + (py - zy) ** 2) { px = p2x; py = p2y; } }
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
        eBullets.push({ x: zx, y: zy, vx: z.aimx * w.speed, vy: z.aimy * w.speed, life: 1.8, dmg: Math.round(w.dmg * zPow()), color: w.color, owner: z });
        z.hasBullet = true; z.shootCD = w.cd; AUDIO.sfx.eshoot(z.zw);
      }
    }
    if (aabb(player.x, player.y, player.w, player.h, z.x, z.y, z.w, z.h)) {
      if (flipT > 0) { if (!z.dead) damageZombie(z, 999, flipDir.x, flipDir.y); }   // female flip-charge mows them down
      else if (driving) { if (!z.dead) { damageZombie(z, 999, Math.sign(z.x - player.x), Math.sign(z.y - player.y)); carHp -= z.ztype === 'tank' ? 8 : 2.5; if (carHp <= 0) { exitCar(); announce('🚗 Машина розбита!'); } } }
      else if (z.crim) {
        if (z.stealCD <= 0 && z.fleeT <= 0) {
          let stole = false;
          const stealable = [2, 3, 4, 5].filter(i => owned[i]);   // only non-starter guns can be grabbed
          if (z.stolenWeapon == null && stealable.length && Math.random() < 0.3) {
            const wi = stealable[Math.floor(Math.random() * stealable.length)];
            owned[wi] = false; z.stolenWeapon = wi; if (curW === wi) curW = 1; showToast('Бандит вкрав зброю: ' + WEAPONS[wi].name + '!'); stole = true;
          } else if (totalCoins > 0) { totalCoins--; z.carrying++; showToast('Бандит вкрав монету! 💰'); stole = true; }
          hurt(8); z.stealCD = 1.0; if (stole) z.fleeT = 4.0;       // flee after a successful theft
        }
      } else hurt(Math.round((z.ztype === 'tank' ? 26 : 16) * zPow()));
    }
    if (player2 && player2.active && !player2.dead && !z.dead && aabb(player2.x, player2.y, player2.w, player2.h, z.x, z.y, z.w, z.h)) {
      if (player2.dr || player2.flipT > 0) damageZombie(z, 999, Math.sign(z.x - player2.x), Math.sign(z.y - player2.y));   // run over while driving / flip-charge
      else if (player2.invuln <= 0) {
        player2.health -= Math.round((z.ztype === 'tank' ? 22 : 14) * zPow()); player2.invuln = 0.5; player2.flash = 0.14; spawnBurst(player2.x + 9, player2.y + 11, '#9fd0ff', 5, 80, 2);
        if (player2.health <= 0) { player2.dead = true; player2.respawnT = 2.5; spawnBurst(player2.x + 9, player2.y + 11, '#ff5a4a', 14, 130, 3); }
      }
    }
  }

  // enemy bullets
  for (let i = eBullets.length - 1; i >= 0; i--) {
    const b = eBullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0 || boxSolid(b.x - 1, b.y - 1, 2, 2) || b.x < 0 || b.x > LW || b.y < 0 || b.y > LH;
    if (!dead && aabb(player.x, player.y, player.w, player.h, b.x - 2, b.y - 2, 4, 4)) { if (driving) { carHp -= b.dmg; if (carHp <= 0) { exitCar(); announce('🚗 Машина розбита!'); } } else if (invuln <= 0) hurt(b.dmg); dead = true; }
    if (!dead && player2 && player2.active && !player2.dead && player2.invuln <= 0 && aabb(player2.x, player2.y, player2.w, player2.h, b.x - 2, b.y - 2, 4, 4)) { player2.health -= b.dmg; player2.invuln = 0.4; player2.flash = 0.14; if (player2.health <= 0) { player2.dead = true; player2.respawnT = 2.5; } dead = true; }
    if (!dead) for (let pi = pets.length - 1; pi >= 0; pi--) { const pe = pets[pi]; if (aabb(pe.x, pe.y, pe.w, pe.h, b.x - 2, b.y - 2, 4, 4)) { pe.hp -= b.dmg; spawnBurst(pe.x + 8, pe.y + 7, '#c0392b', 5, 80, 2); if (pe.hp <= 0) { spawnBurst(pe.x + 8, pe.y + 7, '#c0392b', 12, 120, 3); showToast(ANIMALS[pe.type].icon + ' ' + ANIMALS[pe.type].name + ' загинув'); pets.splice(pi, 1); } dead = true; break; } }
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
  coins = coins.filter(co => {
    if (aabb(player.x, player.y, player.w, player.h, co.x - 10, co.y - 10, 28, 28)) { const v = co.v || 1; totalCoins += v; coinsTotal += v; score += v * 5; spawnBurst(co.x, co.y, '#ffd23f', 6 + v * 2, 80, 2); AUDIO.sfx.coin(); return false; }
    if (player2 && player2.active && !player2.dead && aabb(player2.x, player2.y, player2.w, player2.h, co.x - 10, co.y - 10, 28, 28)) { const v = co.v || 1; totalCoins += v; coinsTotal += v; score += v * 5; spawnBurst(co.x, co.y, '#ffd23f', 6 + v * 2, 80, 2); AUDIO.sfx.coin(); return false; }
    return true;
  });
  // key pickup (either player)
  if (keyItem && !keyItem.got && eitherOver(keyItem.x - 6, keyItem.y - 6, 28, 28)) { keyItem.got = true; hasKey = true; AUDIO.sfx.pickup(); spawnBurst(keyItem.x + 6, keyItem.y + 6, '#ffd23f', 16, 140, 3); showToast('Знайдено ключ! Іди до будинку 🏚'); }
  // unlock the house with the key (either player)
  if (hasKey && !womanFreed && lockedHouse && eitherOver(lockedHouse.x - 40, lockedHouse.y - 36, 176, 168)) {   // generous zone so the house is always openable
    womanFreed = true; woman.active = true; AUDIO.sfx.pickup(); spawnBurst(lockedHouse.x + 48, lockedHouse.y + 60, '#ffd23f', 20, 160, 3); say('Дякую, що ' + (hero === 'female' ? 'відчинила' : 'відчинив') + '! Прикрий мене — і веди ДОДОМУ, будь ласка.');
  }
  // woman: follow, take damage, escort, or die
  if (woman && woman.active && !womanRescued && !womanDead) {
    woman.invuln = Math.max(0, woman.invuln - dt); woman.flash = Math.max(0, woman.flash - dt);
    const wcx = woman.x + woman.w / 2, wcy = woman.y + woman.h / 2;
    let pcx2 = player.x + player.w / 2, pcy2 = player.y + player.h / 2;
    if (player2 && player2.active && !player2.dead) { const p2x = player2.x + 9, p2y = player2.y + 11; if ((p2x - wcx) ** 2 + (p2y - wcy) ** 2 < (pcx2 - wcx) ** 2 + (pcy2 - wcy) ** 2) { pcx2 = p2x; pcy2 = p2y; } }
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
    for (const hm of homes) if (aabb(woman.x, woman.y, woman.w, woman.h, hm.x - 16, hm.y - 40, 128, 112)) { womanRescued = true; woman.active = false; spawnBurst(woman.x + 9, woman.y + 11, '#7dff9a', 16, 130, 3); say('Я вдома! Дякую, що ' + (hero === 'female' ? 'врятувала' : 'врятував') + ' мене! 💚'); AUDIO.sfx.win(); }
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
  updateBurn(dt); updateAllies(dt); updateBarricades(dt); updateNPCs(dt); updatePets(dt, true);

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
function drawCar(cx, cy, ang, col, sc) {
  sc = sc || 1; const x = cx - cam.x, y = cy - cam.y;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sc, sc);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 4, 24, 11, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#15151a'; ctx.fillRect(-18, -14, 8, 6); ctx.fillRect(-18, 8, 8, 6); ctx.fillRect(10, -14, 8, 6); ctx.fillRect(10, 8, 8, 6);
  ctx.fillStyle = col; rr(-22, -12, 44, 24, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.14)'; rr(-22, -12, 44, 5, 7); ctx.fill();
  ctx.fillStyle = '#2f3e47'; rr(-7, -10, 17, 20, 4); ctx.fill();
  ctx.fillStyle = '#9fd0e8'; rr(9, -8, 6, 16, 2); ctx.fill();
  ctx.fillStyle = '#ffe08a'; ctx.fillRect(20, -8, 3, 4); ctx.fillRect(20, 4, 3, 4);
  ctx.restore();
}
function drawBuildPrompt() {
  ctx.fillStyle = 'rgba(20,40,28,.8)'; rr(btnBuild.x, btnBuild.y, btnBuild.w, btnBuild.h, 10); ctx.fill();
  ctx.strokeStyle = '#caa15a'; ctx.lineWidth = 2; rr(btnBuild.x, btnBuild.y, btnBuild.w, btnBuild.h, 10); ctx.stroke();
  ctx.fillStyle = '#e8d2a0'; ctx.font = 'bold 14px Trebuchet MS,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🧱 Барикада 💲' + BARR_COST, btnBuild.x + btnBuild.w / 2, btnBuild.y + btnBuild.h / 2);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
function drawCarPrompt() {
  ctx.fillStyle = 'rgba(20,40,28,.85)'; rr(btnCar.x, btnCar.y, btnCar.w, btnCar.h, 10); ctx.fill();
  ctx.strokeStyle = '#9fd0e8'; ctx.lineWidth = 2; rr(btnCar.x, btnCar.y, btnCar.w, btnCar.h, 10); ctx.stroke();
  ctx.fillStyle = '#cfeaff'; ctx.font = 'bold 15px Trebuchet MS,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText((driving ? '🚪 Вийти' : '🚗 Сісти') + (IS_TOUCH ? '' : ' (E)'), btnCar.x + btnCar.w / 2, btnCar.y + btnCar.h / 2);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
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
  for (const v of vehicles) drawCar(v.x, v.y, 0, v.col, 1);
  for (const b of barricades) { const x = b.c * TS - cam.x, y = b.r * TS - cam.y; if (x < -40 || x > VIEW_W + 40 || y < -40 || y > VIEW_H + 40) continue; ctx.fillStyle = '#5a4730'; ctx.fillRect(x + 2, y + 7, TS - 4, TS - 14); ctx.strokeStyle = '#3a2e1e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 4, y + 8); ctx.lineTo(x + TS - 4, y + TS - 8); ctx.moveTo(x + TS - 4, y + 8); ctx.lineTo(x + 4, y + TS - 8); ctx.stroke(); ctx.fillStyle = 'rgba(40,20,10,' + (0.5 * (1 - b.hp / b.maxhp)).toFixed(2) + ')'; ctx.fillRect(x, y, TS, TS); }
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
    spr((captiveMale ? IMG.player : IMG.woman)[woman.frame], woman.x - 3, woman.y - 8);
    if (woman.weapon != null) { const wcx = woman.x + woman.w / 2 - cam.x, wcy = woman.y + woman.h / 2 - cam.y; ctx.save(); ctx.translate(Math.round(wcx), Math.round(wcy)); ctx.rotate(Math.atan2(woman.aimy, woman.aimx)); ctx.fillStyle = '#333'; ctx.fillRect(3, -1.5, 11, 3); ctx.fillStyle = WEAPONS[woman.weapon].color; ctx.fillRect(12, -1, 3, 2); ctx.restore(); }
    if (woman.flash > 0) { ctx.globalAlpha = woman.flash / 0.14 * 0.7; ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(woman.x - 3 - cam.x), Math.round(woman.y - 8 - cam.y), 24, 32); ctx.globalAlpha = 1; }
    const hx = Math.round(woman.x - cam.x), hy = Math.round(woman.y - 12 - cam.y);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(hx - 1, hy, woman.w + 2, 4); ctx.fillStyle = '#e0518f'; ctx.fillRect(hx, hy + 1, woman.w * Math.max(0, woman.hp) / woman.maxhp, 2);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Calibri'; ctx.textAlign = 'center'; ctx.fillText('♀', woman.x + 9 - cam.x, hy - 4);
    if (woman.weapon != null) { ctx.fillStyle = woman.ammo > 0 ? '#ffd23f' : '#ff6a6a'; ctx.font = 'bold 8px Calibri'; ctx.fillText('⦿' + woman.ammo, woman.x + 9 - cam.x, hy - 13); }
    ctx.textAlign = 'left';
  }
  drawNPCs(); drawPets();
  // squad survivors
  for (const a of allies) {
    spr(IMG.player[a.frame], a.x - 3, a.y - 8);
    if (a.flash > 0) { ctx.globalAlpha = a.flash / 0.14 * 0.7; ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(a.x - 3 - cam.x), Math.round(a.y - 8 - cam.y), 24, 32); ctx.globalAlpha = 1; }
    const ax = a.x + 9 - cam.x, ay = a.y - 12 - cam.y;
    ctx.fillStyle = a.joined ? '#9fd0e8' : '#ffd23f'; ctx.beginPath(); ctx.arc(ax, ay - 2, 2.6, 0, 7); ctx.fill();   // marker dot
    if (a.joined && a.hp < a.maxhp) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(ax - 9, ay + 2, 18, 3); ctx.fillStyle = '#9fd0e8'; ctx.fillRect(ax - 9, ay + 2, 18 * Math.max(0, a.hp) / a.maxhp, 3); }
    if (!a.joined) { ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 11px Trebuchet MS,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('?', ax, ay - 6); ctx.textAlign = 'left'; }
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

  if (driving) {
    drawCar(player.x + 9, player.y + 11, Math.atan2(face.y, face.x), '#9a3030', 1.2);
    const hx = Math.round(player.x + 9 - 22 - cam.x), hy = Math.round(player.y - 22 - cam.y);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(hx, hy, 44, 4); ctx.fillStyle = carHp > 30 ? '#9fd0e8' : '#ff6f6f'; ctx.fillRect(hx, hy, 44 * Math.max(0, carHp) / 100, 4);
  } else {
    const pcx = player.x + 9 - cam.x, pcy = player.y + 3 - cam.y;
    if (invShield > 0) { ctx.save(); ctx.globalAlpha = 0.35 + 0.2 * Math.sin(animClock * 8); ctx.strokeStyle = '#6fd0ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pcx, pcy + 5, 19, 0, 7); ctx.stroke(); ctx.restore(); }
    const blink = invuln > 0 && invShield <= 0 && flipT <= 0 && Math.floor(invuln * 20) % 2 === 0;
    if (flipT > 0) {
      ctx.save(); ctx.globalAlpha = 0.45; ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(pcx - flipDir.x * 26, pcy + 6 - flipDir.y * 26); ctx.lineTo(pcx, pcy + 6); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.translate(pcx, pcy + 6); ctx.rotate((1 - flipT / FLIP_DUR) * Math.PI * 2 * (flipDir.x < 0 ? -1 : 1)); ctx.drawImage(heroImg()[1], -13, -18); ctx.restore();
    } else if (!blink) spr(heroImg()[player.frame], player.x - 3, player.y - 8);
  }
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

  // co-op partner (other player on the same map)
  const partner = coop ? (NET.role() === 'host' ? (player2 && player2.active ? player2 : null) : remotePlayer) : null;
  if (partner) {
    const pf = (partner.fr != null ? partner.fr : partner.frame) | 0;
    const ph = partner.h != null ? partner.h : partner.health;
    if ((partner.shield || 0) > 0) { const pcx = partner.x + 9 - cam.x, pcy = partner.y + 8 - cam.y; ctx.save(); ctx.globalAlpha = 0.4; ctx.strokeStyle = '#6fd0ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pcx, pcy, 19, 0, 7); ctx.stroke(); ctx.restore(); }
    if (partner.dr) drawCar(partner.x + 9, partner.y + 11, partner.ca || 0, '#3a6ea5', 1.2);   // partner is driving
    else spr(skinSet(partner.hero || 'male', partner.skin || 0)[pf || 0], partner.x - 3, partner.y - 8);
    const tx = Math.round(partner.x + 9 - cam.x), ty = Math.round(partner.y - 16 - cam.y);
    ctx.fillStyle = '#9fd0ff'; ctx.font = 'bold 11px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('2P', tx, ty); ctx.textAlign = 'left';
    if (typeof ph === 'number') { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(tx - 14, ty + 4, 28, 3); ctx.fillStyle = '#7fe07f'; ctx.fillRect(tx - 14, ty + 4, 28 * Math.max(0, ph) / 100, 3); }
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
  if (supplyMarker) drawPointer(supplyMarker.x, supplyMarker.y, '📦', '#ffe08a');
  if (sideQuest) {
    if (sideQuest.kind === 'deliver') drawPointer(sideQuest.dx, sideQuest.dy, '📦 ' + sideQuest.destName, '#b89cff');
    else if (sideQuest.kind === 'reach') drawPointer(sideQuest.dx, sideQuest.dy, '🏁', '#b89cff');
    else if (sideQuest.kind === 'bounty' && sideQuest.target && !sideQuest.target.dead) drawPointer(sideQuest.target.x + 13, sideQuest.target.y, '🎯 ЦІЛЬ', '#ff5a4a');
  }
  drawHUD(); drawQuests(); drawSideQuest(); drawWeaponBar(); drawSpeech(); drawMinimap(); drawPetsHUD();
  if (state === 'play' && (nearShopTown || nearMerc)) drawShopPrompt();
  if (state === 'play' && (nearVehicle || driving)) drawCarPrompt();
  if (state === 'play' && IS_TOUCH && !driving) drawBuildPrompt();
  if (state === 'shop') drawShop();
  if (state === 'skins') drawSkins();
  if (state === 'merc') drawMerc();
  if (IS_TOUCH && (state === 'play' || state === 'paused')) drawTouchUI();
  if (state === 'play' || state === 'paused') drawAbility();
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
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(btnPause.x, btnPause.y, btnPause.w, btnPause.h, 9); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 26px Calibri'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(state === 'paused' ? '▶' : '⏸', btnPause.x + btnPause.w / 2, btnPause.y + btnPause.h / 2 + 1); ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.restore();
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawAbility() {
  const ready = abilCD <= 0, fem = hero === 'female';
  ctx.save();
  ctx.beginPath(); ctx.arc(abilBtn.x, abilBtn.y, abilBtn.r, 0, 7);
  ctx.fillStyle = ready ? (fem ? 'rgba(255,110,190,0.5)' : 'rgba(110,200,255,0.5)') : 'rgba(70,72,82,0.5)'; ctx.fill();
  ctx.strokeStyle = ready ? '#fff' : 'rgba(255,255,255,0.4)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = '24px Calibri'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(fem ? '🤸' : '🛡', abilBtn.x, abilBtn.y);
  if (!ready) { ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(abilBtn.x, abilBtn.y, abilBtn.r - 1, -Math.PI / 2, -Math.PI / 2 + (1 - abilCD / ABIL_CD) * Math.PI * 2); ctx.stroke(); }
  else if (!IS_TOUCH) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '10px Calibri'; ctx.fillText('Пробіл', abilBtn.x, abilBtn.y + abilBtn.r + 9); }
  // medkit button
  const hasMed = medkits > 0;
  ctx.beginPath(); ctx.arc(medBtn.x, medBtn.y, medBtn.r, 0, 7);
  ctx.fillStyle = hasMed ? 'rgba(70,180,90,0.55)' : 'rgba(70,72,82,0.45)'; ctx.fill();
  ctx.strokeStyle = hasMed ? '#fff' : 'rgba(255,255,255,0.4)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = '20px Calibri'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🩹', medBtn.x, medBtn.y);
  ctx.fillStyle = '#0c1a10'; ctx.beginPath(); ctx.arc(medBtn.x + medBtn.r - 4, medBtn.y - medBtn.r + 4, 9, 0, 7); ctx.fill();
  ctx.fillStyle = hasMed ? '#9fe0a0' : '#888'; ctx.font = 'bold 12px Calibri'; ctx.fillText(medkits + '', medBtn.x + medBtn.r - 4, medBtn.y - medBtn.r + 5);
  if (!IS_TOUCH) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '10px Calibri'; ctx.fillText('H', medBtn.x, medBtn.y + medBtn.r + 9); }
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.restore();
}

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
  // night — blue darkening + a light around the player
  if (nightF > 0.02) {
    ctx.fillStyle = 'rgba(10,16,38,' + (nightF * 0.52).toFixed(3) + ')'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const px = player.x + 9 - cam.x, py = player.y + 11 - cam.y;
    const lg = ctx.createRadialGradient(px, py, 40, px, py, 280);
    lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(4,6,16,' + (nightF * 0.5).toFixed(3) + ')');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
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

function drawNPCs() {
  for (const tn of towns) {
    const lx = Math.round(tn.x + 9 - cam.x), ly = Math.round(tn.y - 132 - cam.y);
    if (lx < -120 || lx > VIEW_W + 120 || ly < -30 || ly > VIEW_H + 30) continue;
    ctx.font = 'bold 14px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center';
    const w = ctx.measureText('🏙 ' + tn.name).width + 16;
    ctx.fillStyle = 'rgba(20,24,16,.55)'; rr(lx - w / 2, ly - 14, w, 20, 7); ctx.fill();
    ctx.fillStyle = '#ffe8a0'; ctx.textBaseline = 'middle'; ctx.fillText('🏙 ' + tn.name, lx, ly - 4); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  }
  for (const n of npcs) {
    if (n.x - cam.x < -40 || n.x - cam.x > VIEW_W + 40 || n.y - cam.y < -50 || n.y - cam.y > VIEW_H + 40) continue;
    spr((n.kind === 'quest' || n.fem ? IMG.woman : IMG.player)[n.frame || 0], n.x - 3, n.y - 8);
    const ax = Math.round(n.x + 9 - cam.x), ay = Math.round(n.y - 14 - cam.y);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (n.kind === 'shop') { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.arc(ax, ay, 9, 0, 7); ctx.fill(); ctx.font = '14px Calibri'; ctx.fillStyle = '#fff'; ctx.fillText('🛒', ax, ay + 1); }
    else if (n.kind === 'merc') { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.arc(ax, ay, 9, 0, 7); ctx.fill(); ctx.font = '14px Calibri'; ctx.fillStyle = '#fff'; ctx.fillText('🐾', ax, ay + 1); }
    else if (n.kind === 'quest') { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.arc(ax, ay, 9, 0, 7); ctx.fill(); ctx.font = 'bold 15px Calibri'; ctx.fillStyle = sideQuest && sideQuest.npc === n ? '#9fe0ff' : '#ffd23f'; ctx.fillText(sideQuest && sideQuest.npc === n ? '…' : '!', ax, ay + 1); }
    else { ctx.fillStyle = '#bfe0ff'; ctx.beginPath(); ctx.arc(ax, ay + 2, 2.4, 0, 7); ctx.fill(); }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
}
function drawPetsHUD() {
  if (!pets.length) return;
  const x0 = VIEW_W - 86; let y0 = 86 + Math.round(150 * LH / LW) + (minimapOn ? 14 : 0);
  for (const p of pets) {
    const a = ANIMALS[p.type];
    ctx.fillStyle = 'rgba(12,18,12,0.7)'; rr(x0, y0, 76, 17, 6); ctx.fill();
    ctx.font = '14px Calibri'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(a.icon, x0 + 4, y0 + 9);
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x0 + 26, y0 + 6, 44, 5); ctx.fillStyle = p.hp > a.hp * 0.3 ? '#7fe07f' : '#ff6f6f'; ctx.fillRect(x0 + 26, y0 + 6, 44 * Math.max(0, p.hp) / a.hp, 5);
    y0 += 21;
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
function drawPets() {
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';   // ensure pets aren't faded by leaked alpha/blend
  for (const p of pets) {
    const a = ANIMALS[p.type], sx = Math.round(p.x + 8 - cam.x), sy = Math.round(p.y + 7 - cam.y);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(sx, sy + 7, 8, 3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '18px Calibri'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';   // opaque so the emoji isn't tinted by the shadow colour
    ctx.fillText(a.icon, sx, sy - 1 + Math.sin(p.bob * 8) * 1.2);
    if (p.hp < a.hp) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(sx - 9, sy - 11, 18, 3); ctx.fillStyle = '#7fe07f'; ctx.fillRect(sx - 9, sy - 11, 18 * Math.max(0, p.hp) / a.hp, 3); }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
}
function mercRowRect(i) { const w = 410, x = VIEW_W / 2 - w / 2, y = VIEW_H / 2 - 150 + 64 + i * 48; return { x, y, w, h: 42 }; }
function drawMerc() {
  ctx.fillStyle = 'rgba(8,14,10,0.85)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const w = 410, x = VIEW_W / 2 - w / 2, y = VIEW_H / 2 - 150;
  panel(x, y, w, 64 + ANIMALS.length * 48 + 30);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffd9a0'; ctx.font = 'bold 24px Trebuchet MS,sans-serif'; ctx.fillText('🐾 ТАБІР НАЙМАНЦІВ', VIEW_W / 2, y + 32);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Trebuchet MS,sans-serif'; ctx.fillText('💲 Монет: ' + totalCoins + '   ·   Тварин: ' + pets.length + '/' + MAX_PETS, VIEW_W / 2, y + 52);
  for (let i = 0; i < ANIMALS.length; i++) {
    const r = mercRowRect(i), a = ANIMALS[i], ok = totalCoins >= a.cost && pets.length < MAX_PETS;
    ctx.fillStyle = ok ? 'rgba(60,90,55,0.7)' : 'rgba(60,40,40,0.5)'; rr(r.x, r.y, r.w, r.h, 8); ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = '22px Calibri'; ctx.fillStyle = '#fff'; ctx.fillText(a.icon, r.x + 16, r.y + r.h / 2);
    ctx.font = 'bold 15px Trebuchet MS,sans-serif'; ctx.fillStyle = ok ? '#fff' : '#b59a9a'; ctx.fillText(a.name, r.x + 44, r.y + r.h / 2 - 8);
    ctx.font = '11px Trebuchet MS,sans-serif'; ctx.fillStyle = '#aac4d4'; ctx.fillText('❤' + a.hp + '  ⚔' + a.dmg + '  ⚡' + a.speed + '  ' + (a.atk === 'ranged' ? '🏹 дальній' : '🦷 ближній'), r.x + 44, r.y + r.h / 2 + 9);
    ctx.textAlign = 'right'; ctx.fillStyle = ok ? '#ffd23f' : '#ff7a7a'; ctx.font = 'bold 15px Trebuchet MS,sans-serif'; ctx.fillText('💲' + a.cost, r.x + r.w - 14, r.y + r.h / 2);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '13px Trebuchet MS,sans-serif';
  ctx.fillText(IS_TOUCH ? 'Торкнись тварини, щоб найняти · поза списком — вихід' : 'Клік по тварині · Esc/B — вихід', VIEW_W / 2, y + 64 + ANIMALS.length * 48 + 14);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
function drawSideQuest() {
  if (!sideQuest) return;
  const txt = '📜 ' + sideQuest.town.name + ' · ' + sideQuestText();
  ctx.font = 'bold 13px "Trebuchet MS",sans-serif'; const w = ctx.measureText(txt).width + 22;
  const x = (VIEW_W - w) / 2, y = 86;
  ctx.fillStyle = 'rgba(30,28,16,.82)'; rr(x, y, w, 24, 8); ctx.fill();
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1.5; rr(x, y, w, 24, 8); ctx.stroke();
  ctx.fillStyle = '#ffe8a0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, VIEW_W / 2, y + 12); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
function drawMinimap() {
  if (!minimapOn) return;
  const mw = 150, mh = Math.round(mw * LH / LW), mx = VIEW_W - 10 - mw, my = 86;
  ctx.fillStyle = 'rgba(12,18,12,0.7)'; rr(mx - 3, my - 3, mw + 6, mh + 6, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.5; rr(mx - 3, my - 3, mw + 6, mh + 6, 8); ctx.stroke();
  const sx = mw / LW, sy = mh / LH;
  const dot = (wx, wy, col, r) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mx + wx * sx, my + wy * sy, r || 2, 0, 7); ctx.fill(); };
  dot(homes[0].x + 48, homes[0].y, '#3fbf60', 3);
  if (boss && !bossDead) dot(boss.x, boss.y, '#ff5a4a', 3);
  if (keyItem && !keyItem.got) dot(keyItem.x, keyItem.y, '#ffd23f', 2.5);
  if (lockedHouse && !womanFreed) dot(lockedHouse.x + 48, lockedHouse.y + 48, '#9fd0e8', 3);
  if (woman && woman.active && !womanRescued) dot(woman.x, woman.y, '#ff9aa2', 2.5);
  if (supplyMarker) dot(supplyMarker.x, supplyMarker.y, '#ffe08a', 2.5);
  if (sideQuest && (sideQuest.kind === 'deliver' || sideQuest.kind === 'reach')) dot(sideQuest.dx, sideQuest.dy, '#b89cff', 3);
  if (sideQuest && sideQuest.kind === 'bounty' && sideQuest.target && !sideQuest.target.dead) dot(sideQuest.target.x, sideQuest.target.y, '#ff5a4a', 3);
  for (const tn of towns) { ctx.fillStyle = '#7fd0ff'; ctx.fillRect(mx + tn.x * sx - 2.5, my + tn.y * sy - 2.5, 5, 5); }   // towns
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx + (player.x + 9) * sx, my + (player.y + 11) * sy, 3, 0, 7); ctx.fill();
}
function drawSpeech() {
  if (speechT <= 0 || !speech) return;
  const w = Math.min(560, VIEW_W - 40), h = 70, x = VIEW_W / 2 - w / 2, y = VIEW_H - h - (IS_TOUCH ? 96 : 16);
  ctx.globalAlpha = Math.min(1, speechT * 2);
  ctx.fillStyle = 'rgba(14,28,20,.92)'; rr(x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(224,81,143,.7)'; ctx.lineWidth = 2; rr(x, y, w, h, 14); ctx.stroke();
  // little woman portrait
  ctx.save(); ctx.translate(x + 34, y + 46); ctx.scale(1.2, 1.2); ctx.drawImage((captiveMale ? IMG.player : IMG.woman)[0], -12, -22); ctx.restore();
  ctx.fillStyle = '#ff9aa2'; ctx.font = 'bold 15px Trebuchet MS,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(captiveMale ? 'Полонений' : 'Жінка', x + 64, y + 24);
  ctx.fillStyle = '#f0f6f1'; ctx.font = '15px Trebuchet MS,sans-serif';
  ctx.fillText(speech, x + 64, y + 48);
  ctx.globalAlpha = 1;
}

function panel(x, y, w, h) { ctx.fillStyle = 'rgba(18,30,22,0.84)'; rr(x, y, w, h, 12); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.5; rr(x, y, w, h, 12); ctx.stroke(); }
function drawShopPrompt() {
  ctx.fillStyle = 'rgba(20,40,28,.85)'; rr(btnShop.x, btnShop.y, btnShop.w, btnShop.h, 10); ctx.fill();
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; rr(btnShop.x, btnShop.y, btnShop.w, btnShop.h, 10); ctx.stroke();
  ctx.fillStyle = '#ffe08a'; ctx.font = 'bold 15px Trebuchet MS,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const label = nearShopTown ? '🛒 Магазин' : '🐾 Найманці';
  ctx.fillText(label + (IS_TOUCH ? '' : ' (B)'), btnShop.x + btnShop.w / 2, btnShop.y + btnShop.h / 2);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
function drawShop() {
  ctx.fillStyle = 'rgba(8,14,10,0.82)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const w = 380, x = VIEW_W / 2 - w / 2, y = VIEW_H / 2 - 130;
  panel(x, y, w, 70 + (SHOP.length + 1) * 42 + 16);
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
  const sb = skinsBtnRect();
  ctx.fillStyle = 'rgba(70,60,95,0.75)'; rr(sb.x, sb.y, sb.w, sb.h, 8); ctx.fill();
  ctx.strokeStyle = '#b89cff'; ctx.lineWidth = 1.5; rr(sb.x, sb.y, sb.w, sb.h, 8); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Trebuchet MS,sans-serif';
  ctx.fillText('👕 Костюми →', VIEW_W / 2, sb.y + sb.h / 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '13px Trebuchet MS,sans-serif';
  ctx.fillText(IS_TOUCH ? 'Торкнись товару, щоб купити · торкнись поза списком — вийти' : 'Натисни 1–6 щоб купити · B/Esc — вийти', VIEW_W / 2, y + 70 + (SHOP.length + 1) * 42 + 6);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
function skinsBtnRect() { const w = 380, x = VIEW_W / 2 - w / 2, y = VIEW_H / 2 - 130 + 70 + SHOP.length * 42; return { x, y, w, h: 36 }; }
function skinRect(i) { const cols = 4, sw = 86, sh = 104, gap = 8, total = cols * sw + (cols - 1) * gap, x0 = VIEW_W / 2 - total / 2, y0 = VIEW_H / 2 - 96, cx = i % cols, cy = (i / cols) | 0; return { x: x0 + cx * (sw + gap), y: y0 + cy * (sh + gap), w: sw, h: sh }; }
function drawSkins() {
  ctx.fillStyle = 'rgba(8,14,10,0.85)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const pw = 4 * 86 + 3 * 8 + 30, px = VIEW_W / 2 - pw / 2, py = VIEW_H / 2 - 160;
  panel(px, py, pw, 2 * 112 + 92);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#c9b6ff'; ctx.font = 'bold 24px Trebuchet MS,sans-serif'; ctx.fillText('👕 КОСТЮМИ — ' + (hero === 'female' ? 'Жінка' : 'Чоловік'), VIEW_W / 2, py + 34);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Trebuchet MS,sans-serif'; ctx.fillText('💲 Монет: ' + totalCoins, VIEW_W / 2, py + 56);
  const SET = activeSkins();
  for (let i = 0; i < SET.length; i++) {
    const r = skinRect(i), s = SET[i], own = ownedSet().has(i), eq = curSkinVal() === i;
    ctx.fillStyle = eq ? 'rgba(255,210,63,0.22)' : 'rgba(40,52,36,0.7)'; rr(r.x, r.y, r.w, r.h, 10); ctx.fill();
    ctx.strokeStyle = eq ? '#ffd23f' : 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; rr(r.x, r.y, r.w, r.h, 10); ctx.stroke();
    const fr = skinSet(hero, i)[0]; ctx.drawImage(fr, r.x + r.w / 2 - 22, r.y + 12, 44, 58);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Trebuchet MS,sans-serif'; ctx.fillText(s.name, r.x + r.w / 2, r.y + r.h - 24);
    ctx.font = 'bold 11px Trebuchet MS,sans-serif';
    if (eq) { ctx.fillStyle = '#ffd23f'; ctx.fillText('вдягнено', r.x + r.w / 2, r.y + r.h - 9); }
    else if (own) { ctx.fillStyle = '#9fe0a0'; ctx.fillText('вдягнути', r.x + r.w / 2, r.y + r.h - 9); }
    else { ctx.fillStyle = totalCoins >= s.cost ? '#ffd23f' : '#ff7a7a'; ctx.fillText('💲' + s.cost, r.x + r.w / 2, r.y + r.h - 9); }
  }
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '13px Trebuchet MS,sans-serif';
  ctx.fillText(IS_TOUCH ? 'Торкнись костюма · торкнись поза — назад' : 'Клік по костюму · Esc/B — назад', VIEW_W / 2, py + 2 * 112 + 80);
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
  // day/night indicator (top-centre)
  { const ix = VIEW_W / 2, iy = 22; const night = nightF > 0.5;
    ctx.fillStyle = night ? '#cfd6ff' : '#ffd23f'; ctx.beginPath(); ctx.arc(ix, iy, 10, 0, 7); ctx.fill();
    if (night) { ctx.fillStyle = 'rgba(18,30,22,0.95)'; ctx.beginPath(); ctx.arc(ix + 4, iy - 3, 9, 0, 7); ctx.fill(); }   // moon crescent
    else { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; for (let a = 0; a < 8; a++) { const an = a / 8 * 6.283; ctx.beginPath(); ctx.moveTo(ix + Math.cos(an) * 13, iy + Math.sin(an) * 13); ctx.lineTo(ix + Math.cos(an) * 16, iy + Math.sin(an) * 16); ctx.stroke(); } }
    ctx.fillStyle = '#cfd6c0'; ctx.font = 'bold 12px Trebuchet MS,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Район ' + district, ix, 46); ctx.textAlign = 'left';
  }
  // combo
  if (combo > 1) { const a = Math.min(1, comboT); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.font = 'bold 26px Trebuchet MS,sans-serif'; ctx.fillStyle = '#000'; ctx.fillText('КОМБО ×' + combo, VIEW_W / 2 + 1, 112); ctx.fillStyle = combo >= 10 ? '#ff5a4a' : '#ffd23f'; ctx.fillText('КОМБО ×' + combo, VIEW_W / 2, 111); ctx.textAlign = 'left'; ctx.globalAlpha = 1; }
  // event announcement banner
  if (eventMsgT > 0) { const a = Math.min(1, eventMsgT); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.font = 'bold 36px Trebuchet MS,sans-serif'; ctx.fillStyle = '#000'; ctx.fillText(eventMsg, VIEW_W / 2 + 2, 162); ctx.fillStyle = '#ff5a4a'; ctx.fillText(eventMsg, VIEW_W / 2, 160); ctx.textAlign = 'left'; ctx.globalAlpha = 1; }
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
  if (coop && NET.connected() && NET.role() === 'host') {
    netSendT -= dt;
    if (netSendT <= 0) { NET.send(buildSnapshot()); netSendT = 1 / 12; }   // host broadcasts the world ~12Hz
  }
  if ((state === 'win' || state === 'gameover') && !endShown) { endShown = true; showEndScreen(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(t => { last = t; frame(t); });
