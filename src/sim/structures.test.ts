import { describe, it, expect } from 'vitest';
import { Structures, AUTHORITY_TILES, ENCLOSURE_LIMIT } from './structures';
import { generateWorld } from './map';
import { PIECES } from '../data/buildables';

// Düz çimen harita (kenarları hariç), spawn merkezde.
function flatMap() {
  const map = generateWorld(1);
  map.tiles.fill(0);
  return map;
}

describe('yetki ve yerleştirme', () => {
  it('yetki çekirdeği olmadan duvar yerleşmez, çekirdek yerleşir', () => {
    const map = flatMap();
    const s = new Structures(map.size);
    expect(s.canPlace(map, 'wall_wood', 20, 20)).toBe('no_authority');
    expect(s.canPlace(map, 'core', 20, 20)).toBeNull();
    s.place('core', 20, 20);
    expect(s.canPlace(map, 'wall_wood', 22, 20)).toBeNull();
    expect(s.canPlace(map, 'wall_wood', 20 + AUTHORITY_TILES + 1, 20)).toBe('no_authority');
  });

  it('dolu kare, sınır ve arazi reddedilir', () => {
    const map = flatMap();
    const s = new Structures(map.size);
    s.place('core', 20, 20);
    expect(s.canPlace(map, 'floor', 20, 20)).toBe('occupied');
    expect(s.canPlace(map, 'floor', -1, 0)).toBe('bounds');
    map.tiles[21 * map.size + 21] = 2; // taşlık
    expect(s.canPlace(map, 'floor', 21, 21)).toBe('terrain');
  });

  it('başlangıç karesine inşa edilmez (doğma noktası güvenliği)', () => {
    const map = flatMap();
    const s = new Structures(map.size);
    s.place('core', map.spawn.tx + 2, map.spawn.ty);
    expect(s.canPlace(map, 'floor', map.spawn.tx, map.spawn.ty)).toBe('spawn');
  });

  it('kapı açıkken geçilebilir, kapalıyken engel', () => {
    const map = flatMap();
    const s = new Structures(map.size);
    s.place('core', 20, 20);
    s.place('door', 22, 22);
    expect(s.blocks(22, 22)).toBe(true);
    s.toggleDoor(22, 22);
    expect(s.blocks(22, 22)).toBe(false);
  });
});

describe('kapalı alan ve sıcaklık', () => {
  // 3x3 oda: duvarlar (19..21 halka), iç (20,20) boş.
  function room(s: Structures) {
    for (let x = 19; x <= 21; x++) {
      s.place('wall_wood', x, 19);
      s.place('wall_wood', x, 21);
    }
    s.place('wall_wood', 19, 20);
    s.place('wall_wood', 21, 20);
  }

  it('tam kapalı odada sıcaktır, açık bir boşlukta değildir', () => {
    const map = flatMap();
    const s = new Structures(map.size);
    s.place('core', 30, 30);
    room(s);
    expect(s.warm(20, 20)).toBe(true);
    expect(s.warm(40, 40)).toBe(false);
  });

  it('bir duvar boşluğu bırakılırsa oda açık sayılır', () => {
    const map = flatMap();
    const s = new Structures(map.size);
    s.place('core', 30, 30);
    room(s);
    s.remove(21, 20);
    expect(s.enclosed(20, 20)).toBe(false);
  });

  it('kamp ateşi yakınındaysa sıcaktır', () => {
    const map = flatMap();
    const s = new Structures(map.size);
    s.place('core', 30, 30);
    s.place('campfire', 40, 40);
    const r = PIECES.campfire.warmTiles ?? 0;
    expect(s.warm(40 + r, 40)).toBe(true);
    expect(s.warm(40 + r + 2, 40)).toBe(false);
  });

  it('sınırı aşan büyük kapalı alan "açık" sayılır (taşma)', () => {
    const map = flatMap();
    const s = new Structures(map.size);
    // 30x30 dış çember: iç alan 29*29 = 841 > ENCLOSURE_LIMIT
    for (let i = 10; i <= 40; i++) {
      s.place('wall_stone', i, 10);
      s.place('wall_stone', i, 40);
      s.place('wall_stone', 10, i);
      s.place('wall_stone', 40, i);
    }
    expect(s.enclosed(25, 25)).toBe(false);
    expect(ENCLOSURE_LIMIT).toBeLessThan(29 * 29);
  });
});
