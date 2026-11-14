// Tile karesi indeksi: tip × varyant. Saf fonksiyon, Phaser'a bağımlı değil.
export const TILE_PX = 32;
export const VARIANTS = 2;
export const FRAME_COUNT = 6 * VARIANTS;

export function frameFor(kind: number, variant: number): number {
  return kind * VARIANTS + variant;
}

// Konuma bağlı sabit varyant: aynı tile her zaman aynı görünümde.
export function variantAt(tx: number, ty: number): number {
  let h = (tx * 73856093) ^ (ty * 19349663);
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) % VARIANTS;
}
