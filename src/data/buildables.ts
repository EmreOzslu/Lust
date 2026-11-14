import type { ItemId } from './items';

export type PieceId =
  | 'core'
  | 'wall_wood'
  | 'wall_stone'
  | 'wall_metal'
  | 'floor'
  | 'door'
  | 'chest'
  | 'workbench'
  | 'furnace'
  | 'campfire';

export interface PieceDef {
  name: string;
  short: string;
  cost: Partial<Record<ItemId, number>>;
  // Dayanıklılık (can). Çürüme ve saldırılar bunu düşürür.
  hp: number;
  // Yürünmez mi? (kapı açıkken geçilebilir)
  blocks: boolean;
  // Yetki çekirdeği menzilinde mi inşa edilebilir?
  needsAuthority: boolean;
  // Kamp ateşi: sıcaklık ve ışık yarıçapı (tile)
  warmTiles?: number;
  lightTiles?: number;
  // Depolama kapasitesi (sandık ve çekirdek)
  storageSlots?: number;
}

export const PIECES: Record<PieceId, PieceDef> = {
  core: { name: 'Yetki çekirdeği', short: 'Çekirdek', cost: { wood: 20, stone: 10 }, hp: 1000, blocks: true, needsAuthority: false, storageSlots: 24 },
  wall_wood: { name: 'Ahşap duvar', short: 'Ahşap', cost: { wood: 10 }, hp: 250, blocks: true, needsAuthority: true },
  wall_stone: { name: 'Taş duvar', short: 'Taş', cost: { stone: 12 }, hp: 500, blocks: true, needsAuthority: true },
  wall_metal: { name: 'Metal duvar', short: 'Metal', cost: { metal: 8 }, hp: 1000, blocks: true, needsAuthority: true },
  floor: { name: 'Zemin', short: 'Zemin', cost: { wood: 4 }, hp: 100, blocks: false, needsAuthority: true },
  door: { name: 'Kapı', short: 'Kapı', cost: { wood: 8 }, hp: 250, blocks: true, needsAuthority: true },
  chest: { name: 'Sandık', short: 'Sandık', cost: { wood: 8 }, hp: 250, blocks: true, needsAuthority: true, storageSlots: 12 },
  workbench: { name: 'Tezgâh', short: 'Tezgâh', cost: { wood: 10, stone: 4 }, hp: 400, blocks: true, needsAuthority: true },
  furnace: { name: 'Fırın', short: 'Fırın', cost: { stone: 12 }, hp: 500, blocks: true, needsAuthority: true },
  campfire: {
    name: 'Kamp ateşi',
    short: 'Ateş',
    cost: { wood: 5, stone: 2 },
    hp: 100,
    blocks: false,
    needsAuthority: true,
    warmTiles: 3,
    lightTiles: 4,
  },
};

// Tezgâhta sıralanan inşa listesi (HUD sırası).
export const BUILD_ORDER: PieceId[] = [
  'core', 'wall_wood', 'wall_stone', 'wall_metal', 'floor',
  'door', 'chest', 'workbench', 'furnace', 'campfire',
];

// Çekirdek bakımı: her oyun gününde çekirdek deposundan bu kadar odun düşer.
// Yetmezse tüm yapılar bu kadar can kaybeder.
export const UPKEEP: Partial<Record<ItemId, number>> = { wood: 5 };
export const DECAY_DAMAGE = 80;
