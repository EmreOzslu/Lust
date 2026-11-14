import { SURVIVAL } from '../data/config';
import { Inventory, type Stack } from './inventory';

export interface Vitals {
  hp: number;
  hunger: number;
  thirst: number;
}

const clamp = (v: number) => Math.max(0, Math.min(SURVIVAL.maxVital, v));

export function startVitals(): Vitals {
  return { hp: SURVIVAL.startHp, hunger: SURVIVAL.startHunger, thirst: SURVIVAL.startThirst };
}

// Bir kare: açlık/susuzluk azalır; sıfırdaysa can gider; geceyse ve ısınmıyorsa soğuk vurur.
export function tickVitals(v: Vitals, dt: number, night: boolean, warm: boolean): Vitals {
  const hunger = clamp(v.hunger - SURVIVAL.hungerDrain * dt);
  const thirst = clamp(v.thirst - SURVIVAL.thirstDrain * dt);
  let dmg = 0;
  if (hunger <= 0) dmg += SURVIVAL.starveDmg * dt;
  if (thirst <= 0) dmg += SURVIVAL.thirstDmg * dt;
  if (night && !warm) dmg += SURVIVAL.coldDmg * dt;
  return { hp: clamp(v.hp - dmg), hunger, thirst };
}

export function restore(v: Vitals, stat: 'hunger' | 'thirst', amount: number): Vitals {
  return { ...v, [stat]: clamp(v[stat] + amount) };
}

export function isDead(v: Vitals): boolean {
  return v.hp <= 0;
}

// Ölünce bırakılan çanta. Yerdeki eşyalar yürüyerek toplanır.
export interface Bag {
  x: number;
  y: number;
  stacks: Stack[];
}

export function dropBag(inv: Inventory, x: number, y: number): Bag | null {
  const stacks = inv.takeAll();
  return stacks.length ? { x, y, stacks } : null;
}

// Menzildeki çantalardan sığdığı kadar eşya alır. Boşalan çantaları listeden çıkarır ve döndürür.
export function pickupBags(inv: Inventory, bags: Bag[], x: number, y: number, radius: number): Bag[] {
  const emptied: Bag[] = [];
  for (let b = bags.length - 1; b >= 0; b--) {
    const bag = bags[b];
    if (Math.hypot(bag.x - x, bag.y - y) > radius) continue;
    for (let i = bag.stacks.length - 1; i >= 0; i--) {
      const st = bag.stacks[i];
      const take = Math.min(st.count, inv.freeSpace(st.id));
      if (take <= 0) continue;
      inv.add(st.id, take);
      st.count -= take;
      if (st.count === 0) bag.stacks.splice(i, 1);
    }
    if (bag.stacks.length === 0) {
      bags.splice(b, 1);
      emptied.push(bag);
    }
  }
  return emptied;
}
