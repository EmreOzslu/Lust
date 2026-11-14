import { describe, it, expect } from 'vitest';
import { startVitals, tickVitals, isDead, restore, dropBag, pickupBags } from './survival';
import { cycleLength, isNight, dayNumber } from './clock';
import { Inventory } from './inventory';
import { SURVIVAL } from '../data/config';

describe('döngü', () => {
  it('gündüz ilk dayLength saniyedir, sonra gece', () => {
    expect(isNight(0)).toBe(false);
    expect(isNight(SURVIVAL.dayLength - 1)).toBe(false);
    expect(isNight(SURVIVAL.dayLength)).toBe(true);
    expect(isNight(cycleLength() - 1)).toBe(true);
    expect(isNight(cycleLength())).toBe(false);
  });

  it('gün sayısı döngüde artar', () => {
    expect(dayNumber(0)).toBe(1);
    expect(dayNumber(cycleLength())).toBe(2);
  });
});

describe('hayati değerler', () => {
  it('açlık ve susuzluk zamanla azalır', () => {
    const v = tickVitals(startVitals(), 10, false, true);
    expect(v.hunger).toBeCloseTo(SURVIVAL.startHunger - SURVIVAL.hungerDrain * 10, 6);
    expect(v.thirst).toBeCloseTo(SURVIVAL.startThirst - SURVIVAL.thirstDrain * 10, 6);
    expect(v.hp).toBe(SURVIVAL.startHp);
  });

  it('açlık sıfırken can gider', () => {
    const v = tickVitals({ hp: 50, hunger: 0, thirst: 50 }, 2, false, true);
    expect(v.hp).toBeCloseTo(50 - SURVIVAL.starveDmg * 2, 6);
  });

  it('gece ısınmıyorsa soğuk vurur, ısınınca vurmaz', () => {
    const cold = tickVitals({ hp: 50, hunger: 50, thirst: 50 }, 10, true, false);
    const warm = tickVitals({ hp: 50, hunger: 50, thirst: 50 }, 10, true, true);
    expect(cold.hp).toBeLessThan(50);
    expect(warm.hp).toBe(50);
  });

  it('değerler 0..max aralığında kalır', () => {
    const v = tickVitals({ hp: 1, hunger: 0.1, thirst: 0.1 }, 100, true, false);
    expect(v.hp).toBe(0);
    expect(v.hunger).toBe(0);
    expect(isDead(v)).toBe(true);
    expect(restore(startVitals(), 'hunger', 9999).hunger).toBe(SURVIVAL.maxVital);
  });
});

describe('çanta bırakma ve toplama', () => {
  it('ölünce tüm eşyalar çantaya geçer ve envanter boşalır', () => {
    const inv = new Inventory(4);
    inv.add('wood', 7);
    inv.add('axe_stone', 1);
    const bag = dropBag(inv, 10, 20);
    expect(bag).not.toBeNull();
    expect(bag!.stacks.reduce((n, s) => n + s.count, 0)).toBe(8);
    expect(inv.count('wood')).toBe(0);
    expect(inv.count('axe_stone')).toBe(0);
  });

  it('eşyası yoksa çanta oluşmaz', () => {
    expect(dropBag(new Inventory(2), 0, 0)).toBeNull();
  });

  it('menzildeki çanta toplanır, uzaktakine dokunulmaz', () => {
    const inv = new Inventory(4);
    const near = { x: 0, y: 0, stacks: [{ id: 'wood' as const, count: 5 }] };
    const far = { x: 500, y: 500, stacks: [{ id: 'stone' as const, count: 5 }] };
    const bags = [near, far];
    const emptied = pickupBags(inv, bags, 0, 0, 10);
    expect(emptied).toEqual([near]);
    expect(inv.count('wood')).toBe(5);
    expect(bags).toEqual([far]);
  });

  it('çanta yer yetmezse kısmen boşalır ve kalan eşya yerde kalır', () => {
    const inv = new Inventory(1);
    inv.add('stone', 50); // dolu
    const bag = { x: 0, y: 0, stacks: [{ id: 'wood' as const, count: 30 }] };
    const bags = [bag];
    const emptied = pickupBags(inv, bags, 0, 0, 10);
    expect(emptied).toEqual([]);
    expect(bags).toHaveLength(1);
    expect(bags[0].stacks[0].count).toBe(30);
  });
});
