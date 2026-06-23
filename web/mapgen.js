// Procedural town generator — runs in-browser, so every run is a NEW map.
// Large open world with a road grid, ponds, woods, yards and several TOWNS
// (safe hubs with NPCs, a shop and a quest-giver).
function genWorld(seed) {
  const TS = 32, W = 200, H = 150;            // big world
  let _s = (seed >>> 0) || 123456789;
  const rnd = () => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; };
  const ri = n => Math.floor(rnd() * n);
  const g = Array.from({ length: H }, () => new Array(W).fill(0)); // 0 grass

  // border fence
  for (let x = 0; x < W; x++) { g[0][x] = 5; g[H - 1][x] = 5; }
  for (let y = 0; y < H; y++) { g[y][0] = 5; g[y][W - 1] = 5; }

  // road grid (open lanes across the whole world)
  const rows = [], colsR = [];
  for (let y = 12; y < H - 6; y += 18) { rows.push(y); for (let x = 1; x < W - 1; x++) { g[y][x] = 7; g[y + 1][x] = 7; } }
  for (let x = 12; x < W - 6; x += 18) { colsR.push(x); for (let y = 1; y < H - 1; y++) { g[y][x] = 7; g[y][x + 1] = 7; } }

  // ponds with sandy beaches
  for (let i = 0; i < 12; i++) {
    const pcx = 8 + ri(W - 16), pcy = 8 + ri(H - 16), pr = 4 + ri(5);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (g[y][x] === 5 || g[y][x] === 7) continue;
      const d = Math.hypot((x - pcx) * 1.1, (y - pcy));
      if (d < pr) g[y][x] = 2; else if (d < pr + 1.4 && g[y][x] === 0) g[y][x] = 3;
    }
  }
  // sandy patches
  for (let i = 0; i < 12; i++) { const sx = 6 + ri(W - 12), sy = 6 + ri(H - 12), srr = 2.5 + ri(3); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { if (g[y][x] !== 0) continue; if (Math.hypot(x - sx, (y - sy) * 1.1) < srr) g[y][x] = 3; } }

  function put(x0, y0, w, h, code, hollow) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      if (x > 0 && x < W - 1 && y > 0 && y < H - 1 && g[y][x] !== 2 && g[y][x] !== 5 && g[y][x] !== 7) {
        const edge = x === x0 || x === x0 + w - 1 || y === y0 || y === y0 + h - 1;
        if (hollow && !edge) continue; g[y][x] = code;
      }
    }
  }
  for (let i = 0; i < 60; i++) put(3 + ri(W - 10), 3 + ri(H - 10), 3 + ri(4), 3 + ri(4), 1, true);   // hedges
  for (let i = 0; i < 28; i++) put(4 + ri(W - 14), 4 + ri(H - 14), 5 + ri(4), 4 + ri(4), 5, true);   // fenced yards
  for (let i = 0; i < 48; i++) { const fx = 3 + ri(W - 12), fy = 3 + ri(H - 12), len = 4 + ri(6), horiz = ri(2); for (let k = 0; k < len; k++) { const x = horiz ? fx + k : fx, y = horiz ? fy : fy + k; if (x > 0 && x < W - 1 && y > 0 && y < H - 1 && g[y][x] === 0) g[y][x] = 5; } }
  for (let i = 0; i < 180; i++) { const cx = 3 + ri(W - 6), cy = 3 + ri(H - 6); for (let k = 0; k < 7; k++) { const x = cx + ri(7) - 3, y = cy + ri(7) - 3; if (x > 0 && x < W - 1 && y > 0 && y < H - 1 && g[y][x] === 0) g[y][x] = 4; } }   // woods
  for (let i = 0; i < 520; i++) { const x = 2 + ri(W - 4), y = 2 + ri(H - 4); if (g[y][x] === 0) g[y][x] = 4; }   // lone trees

  // central plaza + home (player start)
  const cx = W / 2 | 0, cy = H / 2 | 0;
  for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 3; x <= cx + 3; x++) g[y][x] = 7;
  const home = [(cx - 1) * TS, (cy - 1) * TS], player = [cx * TS, (cy + 1) * TS];

  // ---- TOWNS: safe hubs with a shop, a quest-giver and villagers ----
  const TOWN_NAMES = ['Гавань', 'Стара Площа', 'Форт-Надія', 'Ринок', 'Притулок', 'Залізна Брама'];
  const towns = [];
  const clearAt = (x, y, code) => { if (x > 0 && x < W - 1 && y > 0 && y < H - 1) g[y][x] = code; };
  let tt = 0;
  while (towns.length < 4 && tt++ < 600) {
    const tcx = 18 + ri(W - 36), tcy = 18 + ri(H - 36);
    if (Math.hypot(tcx - cx, tcy - cy) < 22) continue;                       // not on top of home
    if (towns.some(t => Math.hypot(t.cx - tcx, t.cy - tcy) < 40)) continue;  // spread out
    // plaza: road core + grass ring (clears trees/water/fences)
    for (let y = tcy - 9; y <= tcy + 9; y++) for (let x = tcx - 9; x <= tcx + 9; x++) {
      const d = Math.hypot(x - tcx, y - tcy); if (d < 9) clearAt(x, y, d < 3.5 ? 7 : 0);
    }
    // ring of small buildings (brick), with gaps to walk through
    for (let b = 0; b < 7; b++) { const a = b / 7 * 6.283; const bx = tcx + Math.round(Math.cos(a) * 7), by = tcy + Math.round(Math.sin(a) * 7); put(bx - 1, by - 1, 3, 3, 6, true); }
    // connector roads to the nearest grid lane (guarantees reachability)
    let ry = rows[0]; for (const y of rows) if (Math.abs(y - tcy) < Math.abs(ry - tcy)) ry = y;
    for (let y = Math.min(tcy, ry); y <= Math.max(tcy, ry); y++) { clearAt(tcx, y, 7); clearAt(tcx + 1, y, 7); }
    let rcx = colsR[0]; for (const x of colsR) if (Math.abs(x - tcx) < Math.abs(rcx - tcx)) rcx = x;
    for (let x = Math.min(tcx, rcx); x <= Math.max(tcx, rcx); x++) { clearAt(x, tcy, 7); clearAt(x + 1, tcy, 7); }
    // NPC anchor tiles (kept walkable)
    const shop = [tcx + 3, tcy - 1], quest = [tcx - 3, tcy - 1];
    const villagers = [[tcx, tcy - 3], [tcx + 2, tcy + 3], [tcx - 2, tcy + 3], [tcx + 4, tcy + 1]];
    for (const [x, y] of [shop, quest, ...villagers, [tcx, tcy]]) clearAt(x, y, 0);
    towns.push({ cx: tcx, cy: tcy, name: TOWN_NAMES[towns.length % TOWN_NAMES.length], shop, quest, villagers });
  }
  const inTown = (wx, wy) => towns.some(t => Math.hypot(wx - t.cx * TS, wy - t.cy * TS) < 11 * TS);

  // reachability flood-fill from player start
  const WALK = new Set([0, 3, 7]);
  const reach = Array.from({ length: H }, () => new Array(W).fill(false));
  const stack = [[player[0] / TS | 0, player[1] / TS | 0]]; reach[player[1] / TS | 0][player[0] / TS | 0] = true;
  while (stack.length) { const [c, r] = stack.pop(); for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c + dc, nr = r + dr; if (nc >= 0 && nc < W && nr >= 0 && nr < H && WALK.has(g[nr][nc]) && !reach[nr][nc]) { reach[nr][nc] = true; stack.push([nc, nr]); } } }
  const reachCells = []; for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) if (reach[r][c]) reachCells.push([c, r]);

  function place(count, gap, minFromPlayer, avoidTowns) {
    const cells = reachCells.slice();
    for (let i = cells.length - 1; i > 0; i--) { const j = ri(i + 1);[cells[i], cells[j]] = [cells[j], cells[i]]; }
    const out = [];
    for (const [c, r] of cells) { const wx = c * TS, wy = r * TS; if (Math.hypot(wx - player[0], wy - player[1]) < minFromPlayer) continue; if (avoidTowns && inTown(wx, wy)) continue; if (out.every(p => Math.hypot(p[0] - wx, p[1] - wy) >= gap)) { out.push([wx, wy]); if (out.length >= count) break; } }
    return out;
  }
  const zombies = place(70, 150, 360, true);     // none inside towns (safe)
  const coins = place(95, 110, 220, false);

  const houses = []; let t = 0;
  while (houses.length < 26 && t++ < 2500) { const c = 2 + ri(W - 5), r = 2 + ri(H - 6); const wx = c * TS, wy = r * TS; if (g[r][c] === 0 && !inTown(wx, wy) && houses.every(h => Math.abs(h[0] - wx) > 120 || Math.abs(h[1] - wy) > 120)) houses.push([wx, wy]); }

  // wrecked cars on the roads
  const roadCells = reachCells.filter(([c, r]) => g[r][c] === 7);
  for (let i = roadCells.length - 1; i > 0; i--) { const j = ri(i + 1);[roadCells[i], roadCells[j]] = [roadCells[j], roadCells[i]]; }
  const cars = [];
  for (const [c, r] of roadCells) { const wx = c * TS, wy = r * TS; if (Math.hypot(wx - player[0], wy - player[1]) < 200) continue; if (cars.every(cc => Math.abs(cc[0] - wx) > 120 || Math.abs(cc[1] - wy) > 120)) { cars.push([wx - 6, wy + 2]); if (cars.length >= 26) break; } }

  // town world-coordinates for the game layer
  const townsOut = towns.map(t => ({
    x: t.cx * TS, y: t.cy * TS, name: t.name,
    shop: [t.shop[0] * TS, t.shop[1] * TS],
    quest: [t.quest[0] * TS, t.quest[1] * TS],
    villagers: t.villagers.map(v => [v[0] * TS, v[1] * TS]),
  }));

  const tiles = []; for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (g[r][c] !== 0) tiles.push([c * TS, r * TS, g[r][c]]);
  const reachList = []; for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (reach[r][c]) reachList.push([c, r]);
  return { width: W * TS, height: H * TS, tileSize: TS, tiles, houses, cars, homes: [home], zombies, coins, playerStart: player, reach: reachList, towns: townsOut };
}
