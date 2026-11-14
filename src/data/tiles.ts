export const TILE = {
  Grass: 0,
  Forest: 1,
  Rock: 2,
  Water: 3,
  Scrap: 4,
  Bush: 5,
} as const;

export interface TileDef {
  name: string;
  color: number;
  blocks: boolean;
}

export const TILE_DEFS: Record<number, TileDef> = {
  [TILE.Grass]: { name: 'Çimen', color: 0x3f6b3c, blocks: false },
  [TILE.Forest]: { name: 'Orman', color: 0x1f3d2b, blocks: true },
  [TILE.Rock]: { name: 'Taşlık', color: 0x6b6a68, blocks: true },
  [TILE.Water]: { name: 'Göl', color: 0x1d4e6b, blocks: true },
  [TILE.Scrap]: { name: 'Hurdalık', color: 0x7a5c3a, blocks: false },
  [TILE.Bush]: { name: 'Çalı', color: 0x6a3a5a, blocks: false },
};
