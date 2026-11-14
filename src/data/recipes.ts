import type { ItemId } from './items';

// İstasyon: tarifin çalışması için yakında bulunması gereken yapı.
export type Station = 'workbench' | 'furnace';

export interface Recipe {
  id: string;
  result: ItemId;
  count: number;
  cost: Partial<Record<ItemId, number>>;
  station?: Station;
}

export const RECIPES: Recipe[] = [
  { id: 'axe_stone', result: 'axe_stone', count: 1, cost: { wood: 4, stone: 2 } },
  { id: 'pick_stone', result: 'pick_stone', count: 1, cost: { wood: 4, stone: 3 } },
  { id: 'smelt_metal', result: 'metal', count: 1, cost: { scrap: 3, wood: 2 }, station: 'furnace' },
  { id: 'axe_steel', result: 'axe_steel', count: 1, cost: { wood: 8, metal: 4 }, station: 'workbench' },
  { id: 'pick_steel', result: 'pick_steel', count: 1, cost: { wood: 8, metal: 4 }, station: 'workbench' },
];

export const STATION_TEXT: Record<Station, string> = {
  workbench: 'Tezgâh',
  furnace: 'Fırın',
};
