import { ITEMS, type ItemId, type ToolKind } from '../data/items';
import { RESOURCES } from '../data/resources';
import { TILE } from '../data/tiles';
import type { WorldMap } from './map';

export type HarvestResult =
  | { ok: true; item: ItemId; count: number; depleted: boolean }
  | { ok: false; reason: 'none' }
  | { ok: false; reason: 'need_tool'; need: ToolKind }
  | { ok: false; reason: 'no_space' };

// Tek vuruş. remaining: tile index → kalan miktar (yalnızca kısmen kırılmış düğümler).
// canAccept: çantada yer var mı? Yer yoksa vuruş boşa gitmez.
export function harvestHit(
  map: WorldMap,
  remaining: Map<number, number>,
  idx: number,
  held: ItemId | null,
  canAccept: (item: ItemId, count: number) => boolean,
): HarvestResult {
  const res = RESOURCES[map.tiles[idx]];
  if (!res) return { ok: false, reason: 'none' };

  const heldDef = held ? ITEMS[held] : undefined;
  const matched = res.tool !== null && heldDef?.tool === res.tool;
  if (res.tool && !matched && !res.handAllowed) {
    return { ok: false, reason: 'need_tool', need: res.tool };
  }

  const power = matched ? (heldDef?.power ?? 1) : 1;
  const left = remaining.get(idx) ?? res.amount;
  const count = Math.min(power, left);
  if (!canAccept(res.item, count)) return { ok: false, reason: 'no_space' };

  const after = left - count;
  if (after <= 0) {
    remaining.delete(idx);
    map.tiles[idx] = TILE.Grass;
    return { ok: true, item: res.item, count, depleted: true };
  }
  remaining.set(idx, after);
  return { ok: true, item: res.item, count, depleted: false };
}

// Oyuncuya en yakın kaynak tile'ının indeksi. Erişim yarıçapı piksel cinsinden.
export function findHarvestTarget(
  map: WorldMap,
  px: number,
  py: number,
  reachPx: number,
  tileSize: number,
): number | null {
  const minTx = Math.max(0, Math.floor((px - reachPx) / tileSize));
  const maxTx = Math.min(map.size - 1, Math.floor((px + reachPx) / tileSize));
  const minTy = Math.max(0, Math.floor((py - reachPx) / tileSize));
  const maxTy = Math.min(map.size - 1, Math.floor((py + reachPx) / tileSize));

  let best: number | null = null;
  let bestD = Infinity;
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const idx = ty * map.size + tx;
      if (!RESOURCES[map.tiles[idx]]) continue;
      const cx = (tx + 0.5) * tileSize;
      const cy = (ty + 0.5) * tileSize;
      const d = Math.hypot(cx - px, cy - py);
      if (d <= reachPx && d < bestD) {
        bestD = d;
        best = idx;
      }
    }
  }
  return best;
}
