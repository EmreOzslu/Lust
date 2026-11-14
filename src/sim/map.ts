import { CONFIG, SURVIVAL } from '../data/config';
import { TILE, TILE_DEFS } from '../data/tiles';
import { mulberry32 } from './rng';

export interface WorldMap {
  size: number;
  tiles: Uint8Array;
  spawn: { tx: number; ty: number };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

// Değer gürültüsü: rastgele ızgara + yumuşak interpolasyon. u,v ∈ [0,1].
function createValueNoise(rand: () => number, cells: number): (u: number, v: number) => number {
  const n = cells + 1;
  const grid = new Float64Array(n * n);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();

  return (u, v) => {
    const x = u * cells;
    const y = v * cells;
    const x0 = Math.min(Math.floor(x), cells - 1);
    const y0 = Math.min(Math.floor(y), cells - 1);
    const sx = smooth(x - x0);
    const sy = smooth(y - y0);
    const a = grid[y0 * n + x0];
    const b = grid[y0 * n + x0 + 1];
    const c = grid[(y0 + 1) * n + x0];
    const d = grid[(y0 + 1) * n + x0 + 1];
    return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
  };
}

export function isBlockedTile(map: WorldMap, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.size || ty >= map.size) return true;
  return TILE_DEFS[map.tiles[ty * map.size + tx]].blocks;
}

export function generateWorld(seed: number): WorldMap {
  const size = CONFIG.mapSize;
  const rand = mulberry32(seed);
  const elevA = createValueNoise(rand, CONFIG.noiseCells);
  const elevB = createValueNoise(rand, CONFIG.noiseCells * 2);
  const moist = createValueNoise(rand, CONFIG.noiseCells);
  const tiles = new Uint8Array(size * size);

  for (let ty = 0; ty < size; ty++) {
    for (let tx = 0; tx < size; tx++) {
      const u = tx / size;
      const v = ty / size;
      const e = 0.65 * elevA(u, v) + 0.35 * elevB(u, v);
      const m = moist(u, v);
      let t: number;
      if (e < CONFIG.waterElevation) t = TILE.Water;
      else if (e > CONFIG.rockElevation) t = TILE.Rock;
      else if (m > CONFIG.forestMoisture) t = TILE.Forest;
      else if (rand() < CONFIG.scrapChance) t = TILE.Scrap;
      else if (rand() < SURVIVAL.bushChance) t = TILE.Bush;
      else t = TILE.Grass;
      tiles[ty * size + tx] = t;
    }
  }

  const cx = Math.floor(size / 2);
  const cy = Math.floor(size / 2);

  // Başlangıç bölgesi: geniş yarıçapta engeller kaldırılır (su dahil), merkez tamamen çimen.
  const openR = CONFIG.spawnOpenRadius;
  for (let dy = -openR; dy <= openR; dy++) {
    for (let dx = -openR; dx <= openR; dx++) {
      if (dx * dx + dy * dy > openR * openR) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      if (TILE_DEFS[tiles[y * size + x]].blocks) tiles[y * size + x] = TILE.Grass;
    }
  }
  const clearR = CONFIG.spawnClearRadius;
  for (let dy = -clearR; dy <= clearR; dy++) {
    for (let dx = -clearR; dx <= clearR; dx++) {
      if (dx * dx + dy * dy > clearR * clearR) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 0 && y >= 0 && x < size && y < size) tiles[y * size + x] = TILE.Grass;
    }
  }

  // Spawn'a ulaşılamayan yürünebilir adalar kayaya çevrilir: ölü alan bırakılmaz.
  const world: WorldMap = { size, tiles, spawn: { tx: cx, ty: cy } };
  const reached = floodFromSpawn(world);
  for (let i = 0; i < tiles.length; i++) {
    if (!TILE_DEFS[tiles[i]].blocks && !reached[i]) tiles[i] = TILE.Rock;
  }

  return world;
}

// Spawn'dan 4-yönlü ulaşılabilen tile'ların maskesi.
export function floodFromSpawn(map: WorldMap): Uint8Array {
  const { size, spawn } = map;
  const seen = new Uint8Array(size * size);
  const start = spawn.ty * size + spawn.tx;
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % size;
    const y = (i - x) / size;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (isBlockedTile(map, nx, ny)) continue;
      const ni = ny * size + nx;
      if (seen[ni]) continue;
      seen[ni] = 1;
      stack.push(ni);
    }
  }
  return seen;
}
