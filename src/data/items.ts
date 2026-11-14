export type ToolKind = 'axe' | 'pick';

export type ItemId = 'wood' | 'stone' | 'scrap' | 'axe_stone' | 'pick_stone';

export interface ItemDef {
  name: string;
  stack: number;
  color: number;
  // Araçlar için: hangi kaynak türünü kırar ve her vuruşta kaç birim toplar.
  tool?: ToolKind;
  power?: number;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  wood: { name: 'Odun', stack: 50, color: 0x8a5a2b },
  stone: { name: 'Taş', stack: 50, color: 0x9a9a96 },
  scrap: { name: 'Hurda', stack: 50, color: 0xb08d57 },
  axe_stone: { name: 'Taş balta', stack: 1, color: 0xc9b48a, tool: 'axe', power: 2 },
  pick_stone: { name: 'Taş kazma', stack: 1, color: 0xc9b48a, tool: 'pick', power: 2 },
};

// Her araç türünün çantadaki karşılığı.
export const TOOL_ITEM: Record<ToolKind, ItemId> = {
  axe: 'axe_stone',
  pick: 'pick_stone',
};
