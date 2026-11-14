import type { ItemId } from './items';

export interface Recipe {
  id: string;
  result: ItemId;
  count: number;
  cost: Partial<Record<ItemId, number>>;
}

// M2: tezgâhsız, elle üretim. Tezgâh seviyeleri M4+ kapsamında.
export const RECIPES: Recipe[] = [
  { id: 'axe_stone', result: 'axe_stone', count: 1, cost: { wood: 4, stone: 2 } },
  { id: 'pick_stone', result: 'pick_stone', count: 1, cost: { wood: 4, stone: 3 } },
];
