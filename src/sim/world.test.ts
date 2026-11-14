import { describe, it, expect } from 'vitest';
import { generateWorld, floodFromSpawn, isBlockedTile } from './map';
import { CONFIG } from '../data/config';
import { TILE } from '../data/tiles';

describe('generateWorld', () => {
  it('aynı seed aynı haritayı üretir', () => {
    const a = generateWorld(CONFIG.seed);
    const b = generateWorld(CONFIG.seed);
    expect(Buffer.from(a.tiles).equals(Buffer.from(b.tiles))).toBe(true);
  });

  it('farklı seed farklı harita üretir', () => {
    const a = generateWorld(1);
    const b = generateWorld(2);
    expect(Buffer.from(a.tiles).equals(Buffer.from(b.tiles))).toBe(false);
  });

  it('doğru boyutta ve geçerli tile kimlikleri içerir', () => {
    const map = generateWorld(CONFIG.seed);
    expect(map.tiles.length).toBe(CONFIG.mapSize * CONFIG.mapSize);
    const valid = new Set<number>(Object.values(TILE));
    for (const t of map.tiles) expect(valid.has(t)).toBe(true);
  });

  it('spawn noktası yürünebilir, her seed için', () => {
    for (const seed of [1, 2, 42, 1337, 9999]) {
      const map = generateWorld(seed);
      expect(isBlockedTile(map, map.spawn.tx, map.spawn.ty)).toBe(false);
    }
  });

  it('spawn\'dan ulaşılan alan, minimum büyüklüğün üstünde (her seed)', () => {
    for (const seed of [1, 2, 42, 1337, 9999]) {
      const map = generateWorld(seed);
      const reached = floodFromSpawn(map);
      let count = 0;
      for (const r of reached) count += r;
      expect(count).toBeGreaterThanOrEqual(CONFIG.minSpawnPocket);
    }
  });

  it('yürünebilir her tile spawn\'dan ulaşılabilir (ada yok)', () => {
    const map = generateWorld(CONFIG.seed);
    const reached = floodFromSpawn(map);
    for (let ty = 0; ty < map.size; ty++)
      for (let tx = 0; tx < map.size; tx++) {
        if (isBlockedTile(map, tx, ty)) continue;
        expect(reached[ty * map.size + tx]).toBe(1);
      }
  });

  it('harita sınırları dışı engelli sayılır', () => {
    const map = generateWorld(CONFIG.seed);
    expect(isBlockedTile(map, -1, 0)).toBe(true);
    expect(isBlockedTile(map, map.size, 0)).toBe(true);
  });
});
