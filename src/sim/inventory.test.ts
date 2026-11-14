import { describe, it, expect } from 'vitest';
import { Inventory } from './inventory';
import { RECIPES } from '../data/recipes';

const axeRecipe = RECIPES.find((r) => r.id === 'axe_stone')!;

describe('Inventory', () => {
  it('stackleyerek ekler', () => {
    const inv = new Inventory(4);
    expect(inv.add('wood', 30)).toBe(true);
    expect(inv.add('wood', 30)).toBe(true);
    expect(inv.count('wood')).toBe(60);
    expect(inv.slots[0]).toEqual({ id: 'wood', count: 50 });
    expect(inv.slots[1]).toEqual({ id: 'wood', count: 10 });
  });

  it('yer yoksa ekleme reddedilir ve hiçbir şey değişmez', () => {
    const inv = new Inventory(1);
    expect(inv.add('wood', 50)).toBe(true);
    expect(inv.add('stone', 1)).toBe(false);
    expect(inv.count('stone')).toBe(0);
  });

  it('araçlar yığılmaz (stack 1)', () => {
    const inv = new Inventory(2);
    expect(inv.add('axe_stone', 1)).toBe(true);
    expect(inv.add('axe_stone', 1)).toBe(true);
    expect(inv.slots[0]).toEqual({ id: 'axe_stone', count: 1 });
    expect(inv.slots[1]).toEqual({ id: 'axe_stone', count: 1 });
  });

  it('remove boş slotu temizler', () => {
    const inv = new Inventory(3);
    inv.add('wood', 10);
    expect(inv.remove('wood', 4)).toBe(true);
    expect(inv.count('wood')).toBe(6);
    expect(inv.remove('wood', 6)).toBe(true);
    expect(inv.slots[0]).toBeNull();
  });

  it('yetersiz miktarda remove başarısız olur', () => {
    const inv = new Inventory(2);
    inv.add('wood', 3);
    expect(inv.remove('wood', 4)).toBe(false);
    expect(inv.count('wood')).toBe(3);
  });

  it('malzeme yetince taş balta üretilir ve malzeme tüketilir', () => {
    const inv = new Inventory(6);
    inv.add('wood', 4);
    inv.add('stone', 2);
    expect(inv.canCraft(axeRecipe)).toBe(true);
    expect(inv.craft(axeRecipe)).toBe(true);
    expect(inv.count('axe_stone')).toBe(1);
    expect(inv.count('wood')).toBe(0);
    expect(inv.count('stone')).toBe(0);
  });

  it('malzeme eksikse üretim olmaz ve hiçbir şey tüketilmez', () => {
    const inv = new Inventory(6);
    inv.add('wood', 4);
    inv.add('stone', 1);
    expect(inv.craft(axeRecipe)).toBe(false);
    expect(inv.count('wood')).toBe(4);
    expect(inv.count('stone')).toBe(1);
  });

  it('sonuç sığmazsa malzemeler geri verilir', () => {
    // 2 slot: wood 50 (dolu) + stone 5. Üretim wood 4 + stone 2 tüketir ama
    // slotlar tamamen boşalmaz; tool için yer kalmaz → reddedilmeli, geri verilmeli.
    const inv = new Inventory(2);
    inv.add('wood', 50);
    inv.add('stone', 5);
    expect(inv.craft(axeRecipe)).toBe(false);
    expect(inv.count('wood')).toBe(50);
    expect(inv.count('stone')).toBe(5);
    expect(inv.count('axe_stone')).toBe(0);
  });
});
