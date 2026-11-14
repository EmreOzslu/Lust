import { ITEMS, type ItemId } from '../data/items';
import type { Recipe } from '../data/recipes';

export interface Stack {
  id: ItemId;
  count: number;
}

// Sabit slotlu çanta. İlk slotlar hotbar olarak da kullanılır.
export class Inventory {
  readonly slots: (Stack | null)[];

  constructor(size: number) {
    this.slots = new Array<Stack | null>(size).fill(null);
  }

  freeSpace(id: ItemId): number {
    const stack = ITEMS[id].stack;
    let space = 0;
    for (const s of this.slots) {
      if (s === null) space += stack;
      else if (s.id === id) space += stack - s.count;
    }
    return space;
  }

  canAdd(id: ItemId, count: number): boolean {
    return count <= this.freeSpace(id);
  }

  add(id: ItemId, count: number): boolean {
    if (!this.canAdd(id, count)) return false;
    const stack = ITEMS[id].stack;
    let left = count;
    for (const s of this.slots) {
      if (left === 0) break;
      if (s && s.id === id) {
        const take = Math.min(left, stack - s.count);
        s.count += take;
        left -= take;
      }
    }
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      if (this.slots[i] === null) {
        const take = Math.min(left, stack);
        this.slots[i] = { id, count: take };
        left -= take;
      }
    }
    return true;
  }

  count(id: ItemId): number {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  remove(id: ItemId, count: number): boolean {
    if (this.count(id) < count) return false;
    let left = count;
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const take = Math.min(left, s.count);
      s.count -= take;
      left -= take;
      if (s.count === 0) this.slots[i] = null;
    }
    return true;
  }

  canCraft(recipe: Recipe): boolean {
    return (Object.entries(recipe.cost) as [ItemId, number][]).every(
      ([id, need]) => this.count(id) >= need,
    );
  }

  // Malzemeleri tüketir, sonucu ekler. Çanta dolarsa malzemeler geri verilir.
  craft(recipe: Recipe): boolean {
    if (!this.canCraft(recipe)) return false;
    const cost = Object.entries(recipe.cost) as [ItemId, number][];
    for (const [id, need] of cost) this.remove(id, need);
    if (!this.add(recipe.result, recipe.count)) {
      for (const [id, need] of cost) this.add(id, need);
      return false;
    }
    return true;
  }
}
