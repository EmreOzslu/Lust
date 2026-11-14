import { describe, it, expect } from 'vitest';
import { Structures, AUTHORITY_TILES, ENCLOSURE_LIMIT } from './structures';
import { generateWorld } from './map';
import { PIECES, UPKEEP, DECAY_DAMAGE } from '../data/buildables';
import { Inventory } from './inventory';

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

  it('dolu kare, sınır, arazi ve doğma noktası reddedilir', () => {
    const map = flatMap();
    const s = new Structures(map.size);
    s.place('core', 20, 20);
    expect(s.canPlace(map, 'floor', 20, 20)).toBe('occupied');
    expect(s.canPlace(map, 'floor', -1, 0)).toBe('bounds');
    map.tiles[21 * map.size + 21] = 2;
    expect(s.canPlace(map, 'floor', 21, 21)).toBe('terrain');
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

  it('yapılar doğru canla başlar, sandık ve çekirdek depolama alır', () => {
    const map = flatMap();
    const s = new Structures(map.size);
    s.place('core', 20, 20);
    s.place('chest', 22, 20);
    s.place('wall_wood', 23, 20);
    expect(s.at(20, 20)!.hp).toBe(PIECES.core.hp);
    expect(s.at(20, 20)!.storage).toBeInstanceOf(Inventory);
    expect(s.at(22, 20)!.storage).toBeInstanceOf(Inventory);
    expect(s.at(23, 20)!.storage).toBeUndefined();
  });
});

describe('istasyon ve depolama', () => {
  it('tezgâh/fırın menzilde aranır', () => {
    const map = flatMap();
    const s = new Structures(map.size);
    s.place('workbench', 10, 10);
    expect(s.nearKind('workbench', 11, 10, 3)).toBe(true);
    expect(s.nearKind('workbench', 20, 10, 3)).toBe(false);
    expect(s.nearKind('furnace', 10, 10, 3)).toBe(false);
  });

  it('en yakın depolama yapısı bulunur', () => {
    const map = flatMap();
    const s = new Structures(map.size);
    s.place('core', 20, 20);
    s.place('chest', 25, 20);
    expect(s.storageNear(21, 20, 6)).toEqual({ tx: 20, ty: 20 });
    expect(s.storageNear(40, 40, 3)).toBeNull();
  });
});

describe('hasar ve bakım', () => {
  it('hasar canı düşürür, sıfırda yapı kaldırılır', () => {
    const map = flatMap();
    const s = new Structures(map.size);
    s.place('core', 20, 20);
    s.place('wall_wood', 22, 20);
    expect(s.damage(22, 20, 100)).toBeNull();
    expect(s.at(22, 20)!.hp).toBe(PIECES.wall_wood.hp - 100);
    const gone = s.damage(22, 20, 1000);
    expect(gone?.kind).toBe('wall_wood');
    expect(s.at(22, 20)).toBeUndefined();
  });

  it('çekirdek bakımı yeterliyse bakım düşer, yapılar sağlam kalır', () => {
    const map = flatMap();
    const s = new Structures(map.size);
    s.place('core', 20, 20);
    s.place('wall_wood', 22, 20);
    const core = s.at(20, 20)!;
    core.storage!.add('wood', 10);
    const r = s.tickDay();
    expect(r.upkeepPaid).toBe(true);
    expect(core.storage!.count('wood')).toBe(10 - (UPKEEP.wood ?? 0));
    expect(r.destroyed).toHaveLength(0);
  });

  it('bakım yoksa yapılar çürür ve zamanla yıkılır', () => {
    const map = flatMap();
    const s = new Structures(map.size);
    s.place('core', 20, 20);
    s.place('campfire', 22, 20); // 100 can
    let destroyed: string[] = [];
    for (let day = 0; day < 3; day++) {
      const r = s.tickDay();
      expect(r.upkeepPaid).toBe(false);
      destroyed = destroyed.concat(r.destroyed.map(([, p]) => p.kind));
    }
    // 100 can, 80 hasar/gün → ikinci günde yıkılır
    expect(DECAY_DAMAGE).toBeGreaterThan(PIECES.campfire.hp / 2);
    expect(destroyed).toContain('campfire');
  });

  it('çekirdek yoksa bakım ödenmez', () => {
    const map = flatMap();
    const s = new Structures(map.size);
    s.place('wall_wood', 22, 20);
    expect(s.tickDay().upkeepPaid).toBe(false);
  });
});

describe('kapalı alan ve sıcaklık', () => {
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
