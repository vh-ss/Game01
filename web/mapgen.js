// Procedural town generator — runs in-browser, so every run/restart is a NEW map.
// Returns a level object (same shape the engine expects), with reachability info
// so objects are only ever placed where the player can actually walk.
function genWorld() {
  const TS = 32, W = 44, H = 34;
  const ri = n => Math.floor(Math.random() * n);
  const g = Array.from({ length: H }, () => new Array(W).fill(0)); // 0 grass

  // border fence
  for (let x = 0; x < W; x++) { g[0][x] = 5; g[H - 1][x] = 5; }
  for (let y = 0; y < H; y++) { g[y][0] = 5; g[y][W - 1] = 5; }
  // cross roads through the centre
  const RH1 = 15, RH2 = 16, RV1 = 21, RV2 = 22;
  for (let x = 1; x < W - 1; x++) { g[RH1][x] = 7; g[RH2][x] = 7; }
  for (let y = 1; y < H - 1; y++) { g[y][RV1] = 7; g[y][RV2] = 7; }

  // pond (random quadrant) with a sandy beach
  const quads = [[9, 8], [33, 8], [9, 26], [33, 26]];
  const [pcx, pcy] = quads[ri(4)]; const pr = 3.5 + Math.random() * 1.6;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (g[y][x] === 5 || g[y][x] === 7) continue;
    const d = Math.hypot((x - pcx) * 1.1, (y - pcy));
    if (d < pr) g[y][x] = 2; else if (d < pr + 1.4 && g[y][x] === 0) g[y][x] = 3;
  }
  // sandy patch elsewhere
  const [scx, scy] = quads[ri(4)];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { if (g[y][x] !== 0) continue; if (Math.hypot(x - scx, (y - scy) * 1.1) < 2.4 + Math.random() * 1.4) g[y][x] = 3; }

  function put(x0, y0, w, h, code, hollow) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      if (x > 0 && x < W - 1 && y > 0 && y < H - 1 && g[y][x] !== 2 && g[y][x] !== 5 && g[y][x] !== 7) {
        const edge = x === x0 || x === x0 + w - 1 || y === y0 || y === y0 + h - 1;
        if (hollow && !edge) continue; g[y][x] = code;
      }
    }
  }
  // random hedges + fenced yards
  for (let i = 0; i < 3 + ri(3); i++) put(3 + ri(W - 10), 3 + ri(H - 10), 3 + ri(3), 3 + ri(3), 1, true);
  for (let i = 0; i < 2; i++) put(4 + ri(W - 14), 4 + ri(H - 14), 5 + ri(3), 4 + ri(3), 5, true);
  // tree clusters
  for (let i = 0; i < 8; i++) { const cx = 3 + ri(W - 6), cy = 3 + ri(H - 6); for (let k = 0; k < 5; k++) { const x = cx + ri(5) - 2, y = cy + ri(5) - 2; if (x > 0 && x < W - 1 && y > 0 && y < H - 1 && g[y][x] === 0) g[y][x] = 4; } }
  // central plaza + home (always clear & central)
  for (let y = 13; y < 17; y++) for (let x = 19; x < 24; x++) g[y][x] = 7;
  const home = [20 * TS, 14 * TS], player = [21 * TS, 17 * TS];

  // reachability flood-fill from the player's start
  const WALK = new Set([0, 3, 7]);
  const reach = Array.from({ length: H }, () => new Array(W).fill(false));
  const stack = [[player[0] / TS | 0, player[1] / TS | 0]]; reach[player[1] / TS | 0][player[0] / TS | 0] = true;
  while (stack.length) { const [c, r] = stack.pop(); for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c + dc, nr = r + dr; if (nc >= 0 && nc < W && nr >= 0 && nr < H && WALK.has(g[nr][nc]) && !reach[nr][nc]) { reach[nr][nc] = true; stack.push([nc, nr]); } } }
  const reachCells = []; for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) if (reach[r][c]) reachCells.push([c, r]);

  // place objects only on reachable cells, spread out, away from player
  function place(count, gap, minFromPlayer) {
    const cells = reachCells.slice();
    for (let i = cells.length - 1; i > 0; i--) { const j = ri(i + 1);[cells[i], cells[j]] = [cells[j], cells[i]]; }
    const out = [];
    for (const [c, r] of cells) { const wx = c * TS, wy = r * TS; if (Math.hypot(wx - player[0], wy - player[1]) < minFromPlayer) continue; if (out.every(p => Math.hypot(p[0] - wx, p[1] - wy) >= gap)) { out.push([wx, wy]); if (out.length >= count) break; } }
    return out;
  }
  const zombies = place(16, 140, 240);
  const coins = place(22, 110, 140);

  // decorative houses on open grass
  const houses = []; let t = 0;
  while (houses.length < 6 && t++ < 500) { const c = 2 + ri(W - 5), r = 2 + ri(H - 6); const wx = c * TS, wy = r * TS; if (g[r][c] === 0 && houses.every(h => Math.abs(h[0] - wx) > 120 || Math.abs(h[1] - wy) > 120)) houses.push([wx, wy]); }

  const tiles = []; for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (g[r][c] !== 0) tiles.push([c * TS, r * TS, g[r][c]]);
  const reachList = []; for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (reach[r][c]) reachList.push([c, r]);
  return { width: W * TS, height: H * TS, tileSize: TS, tiles, houses, homes: [home], zombies, coins, playerStart: player, reach: reachList };
}
