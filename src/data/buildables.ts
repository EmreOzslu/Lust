import type { ItemId } from './items';

export type PieceId = 'core' | 'wall_wood' | 'wall_stone' | 'floor' | 'door' | 'chest' | 'campfire';

export interface PieceDef {
  name: string;
  short: string;
  cost: Partial<Record<ItemId, number>>;
  // Yürünmez mi? (kapı, açıkken geçilebilir)
  blocks: boolean;
  // Yetki çekirdeği menzilinde mi inşa edilebilir?
  needsAuthority: boolean;
  // Kamp ateşi: sıcaklık yarıçapı ve ışık (tile cinsinden)
  warmTiles?: number;
  lightTiles?: number;
}

export const PIECES: Record<PieceId, PieceDef> = {
  core: { name: 'Yetki çekirdeği', short: 'Çekirdek', cost: { wood: 20, stone: 10 }, blocks: true, needsAuthority: false },
  wall_wood: { name: 'Ahşap duvar', short: 'Ahşap', cost: { wood: 10 }, blocks: true, needsAuthority: true },
  wall_stone: { name: 'Taş duvar', short: 'Taş', cost: { stone: 12 }, blocks: true, needsAuthority: true },
  floor: { name: 'Zemin', short: 'Zemin', cost: { wood: 4 }, blocks: false, needsAuthority: true },
  door: { name: 'Kapı', short: 'Kapı', cost: { wood: 8 }, blocks: true, needsAuthority: true },
  chest: { name: 'Sandık', short: 'Sandık', cost: { wood: 8 }, blocks: true, needsAuthority: true },
  campfire: {
    name: 'Kamp ateşi',
    short: 'Ateş',
    cost: { wood: 5, stone: 2 },
    blocks: false,
    needsAuthority: true,
    warmTiles: 3,
    lightTiles: 4,
  },
};

// Tezgâhta sıralanan inşa listesi (HUD sırası).
export const BUILD_ORDER: PieceId[] = ['core', 'wall_wood', 'wall_stone', 'floor', 'door', 'chest', 'campfire'];
