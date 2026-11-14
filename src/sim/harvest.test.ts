import { describe, it, expect } from 'vitest';
import { harvestHit, findHarvestTarget } from './harvest';
import type { WorldMap } from './map';
import { TILE } from '../data/tiles';

// 5x5 çimen; (2,2) ağaç, (0,0) taş, (4,4) hurda.
function makeMap(): WorldMap {
  const size = 5;
  const tiles = new Uint8Array(size * size).fill(TILE.Grass);
  tiles[2 * size + 2] = TILE.Forest;
  tiles[0] = TILE.Rock;
  tiles[4 * size + 4] = TILE.Scrap;
  return { size, tiles, spawn: { tx: 1, ty: 1 } };
}

const idxOf = (x: number, y: number) => y * 5 + x;
const always = () => true;

describe('harvestHit', () => {
  it('ağaç elle yavaş kesilir (1 odun/vuruş), baltayla hızlı (2/vuruş)', () => {
    const map = makeMap();
    const rem = new Map<number, number>();
    const hand = harvestHit(map, rem, idxOf(2, 2), null, always);
    expect(hand).toMatchObject({ ok: true, item: 'wood', count: 1, depleted: false });
    const axe = harvestHit(map, rem, idxOf(2, 2), 'axe_stone', always);
    expect(axe).toMatchObject({ ok: true, item: 'wood', count: 2, depleted: false });
  });

  it('taş (kazma gereken tür) elle kırılabilir: kazma yoksa need_tool yok', () => {
    const map = makeMap();
    const rem = new Map<number, number>();
    expect(harvestHit(map, rem, idxOf(0, 0), null, always).ok).toBe(true);
  });

  it('ağaç 5 baltalı vuruşta tükenir ve tile çimene döner', () => {
    const map = makeMap();
    const rem = new Map<number, number>();
    let last = harvestHit(map, rem, idxOf(2, 2), 'axe_stone', always);
    for (let i = 0; i < 4; i++) last = harvestHit(map, rem, idxOf(2, 2), 'axe_stone', always);
    expect(last).toMatchObject({ ok: true, item: 'wood', count: 2, depleted: true });
    expect(map.tiles[idxOf(2, 2)]).toBe(TILE.Grass);
    expect(rem.size).toBe(0);
  });

  it('taş elle kırılabilir (yavaş, 1 birim/vuruş)', () => {
    const map = makeMap();
    const rem = new Map<number, number>();
    const r = harvestHit(map, rem, idxOf(0, 0), null, always);
    expect(r).toMatchObject({ ok: true, item: 'stone', count: 1, depleted: false });
  });

  it('taş kazmayla 2 birim/vuruş toplar', () => {
    const map = makeMap();
    const rem = new Map<number, number>();
    const r = harvestHit(map, rem, idxOf(0, 0), 'pick_stone', always);
    expect(r).toMatchObject({ ok: true, item: 'stone', count: 2, depleted: false });
  });

  it('yanlış araç ağaca hasar vermez: elle fallback (1/vuruş)', () => {
    const map = makeMap();
    const rem = new Map<number, number>();
    const r = harvestHit(map, rem, idxOf(2, 2), 'pick_stone', always);
    expect(r).toMatchObject({ ok: true, item: 'wood', count: 1, depleted: false });
  });

  it('çanta doluysa vuruş boşa gitmez', () => {
    const map = makeMap();
    const rem = new Map<number, number>();
    const r = harvestHit(map, rem, idxOf(2, 2), 'axe_stone', () => false);
    expect(r).toEqual({ ok: false, reason: 'no_space' });
    expect(rem.size).toBe(0);
    expect(map.tiles[idxOf(2, 2)]).toBe(TILE.Forest);
  });

  it('kaynak olmayan tile için none döner', () => {
    const map = makeMap();
    expect(harvestHit(map, new Map(), idxOf(1, 1), null, always)).toEqual({ ok: false, reason: 'none' });
  });
});

describe('findHarvestTarget', () => {
  it('erişim içinde en yakın kaynağı seçer', () => {
    const map = makeMap();
    // Oyuncu (2,1)'in merkezinde → ağaç (2,2) ~32px uzakta.
    const idx = findHarvestTarget(map, 2.5 * 32, 1.5 * 32, 1.3 * 32, 32);
    expect(idx).toBe(idxOf(2, 2));
  });

  it('erişim dışındaysa null döner', () => {
    const map = makeMap();
    expect(findHarvestTarget(map, 1.5 * 32, 1.5 * 32, 10, 32)).toBeNull();
  });

  it('çimen tile\'ları hedef olmaz; yakında kaynak yoksa null', () => {
    const map = makeMap();
    // (1,1) merkezi (48,48); taş (0,0) merkezi (16,16) ~45px uzakta, erişim 40px.
    expect(findHarvestTarget(map, 1.5 * 32, 1.5 * 32, 40, 32)).toBeNull();
  });

  it('erişim yeterliyse en yakın taşı hedef alır', () => {
    const map = makeMap();
    expect(findHarvestTarget(map, 1.5 * 32, 1.5 * 32, 60, 32)).toBe(idxOf(0, 0));
  });

  it('su: sonsuz, çanta yerine susuzluk verir', () => {
    const map = makeMap();
    map.tiles[idxOf(4, 0)] = TILE.Water;
    const rem = new Map<number, number>();
    const r = harvestHit(map, rem, idxOf(4, 0), null, () => false);
    expect(r).toMatchObject({ ok: true, item: null, stat: 'thirst', restore: 8, depleted: false });
    for (let i = 0; i < 50; i++) harvestHit(map, rem, idxOf(4, 0), null, () => false);
    expect(map.tiles[idxOf(4, 0)]).toBe(TILE.Water);
  });

  it('çalı: 4 vuruşta tükenir, her vuruş 10 açlık verir', () => {
    const map = makeMap();
    map.tiles[idxOf(1, 4)] = TILE.Bush;
    const rem = new Map<number, number>();
    let last = harvestHit(map, rem, idxOf(1, 4), null, always);
    expect(last).toMatchObject({ ok: true, stat: 'hunger', restore: 10, depleted: false });
    for (let i = 0; i < 3; i++) last = harvestHit(map, rem, idxOf(1, 4), null, always);
    expect(last).toMatchObject({ ok: true, depleted: true });
    expect(map.tiles[idxOf(1, 4)]).toBe(TILE.Grass);
  });
});
