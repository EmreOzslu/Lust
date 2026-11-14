import { PIECES, type PieceId } from '../data/buildables';
import { TILE } from '../data/tiles';
import { isBlockedTile, type WorldMap } from './map';

export interface Piece {
  kind: PieceId;
  open: boolean; // yalnızca kapı için anlamlı
}

export type PlaceReason = 'bounds' | 'terrain' | 'occupied' | 'no_authority' | 'spawn';

// Yetki çekirdeğinin menzili (tile). Authority alanı dışına inşa yok.
export const AUTHORITY_TILES = 8;
// Kapalı alan kontrolünde taşma sınırı: bu kadar tile'dan büyük alan "açık" sayılır.
export const ENCLOSURE_LIMIT = 200;

export class Structures {
  private cells = new Map<number, Piece>();
  readonly size: number;

  constructor(size: number) {
    this.size = size;
  }

  private idx(tx: number, ty: number): number {
    return ty * this.size + tx;
  }

  at(tx: number, ty: number): Piece | undefined {
    return this.cells.get(this.idx(tx, ty));
  }

  entries(): [number, Piece][] {
    return [...this.cells.entries()];
  }

  // Bu kare yürünmez mi? Kapı açıksa geçilebilir.
  blocks(tx: number, ty: number): boolean {
    const p = this.at(tx, ty);
    if (!p) return false;
    if (p.kind === 'door') return !p.open;
    return PIECES[p.kind].blocks;
  }

  // Yetki çekirdeği, (tx,ty) merkezinde AUTHORITY_TILES menzilinde mi?
  hasAuthority(tx: number, ty: number): boolean {
    for (const [i, p] of this.cells) {
      if (p.kind !== 'core') continue;
      const cx = i % this.size;
      const cy = (i - cx) / this.size;
      if (Math.hypot(cx - tx, cy - ty) <= AUTHORITY_TILES) return true;
    }
    return false;
  }

  canPlace(map: WorldMap, kind: PieceId, tx: number, ty: number): PlaceReason | null {
    if (tx < 0 || ty < 0 || tx >= this.size || ty >= this.size) return 'bounds';
    if (isBlockedTile(map, tx, ty)) return 'terrain';
    const t = map.tiles[this.idx(tx, ty)];
    if (t !== TILE.Grass && t !== TILE.Scrap) return 'terrain';
    if (this.at(tx, ty)) return 'occupied';
    if (tx === map.spawn.tx && ty === map.spawn.ty) return 'spawn';
    if (PIECES[kind].needsAuthority && !this.hasAuthority(tx, ty)) return 'no_authority';
    return null;
  }

  place(kind: PieceId, tx: number, ty: number): boolean {
    const i = this.idx(tx, ty);
    if (this.cells.has(i)) return false;
    this.cells.set(i, { kind, open: false });
    return true;
  }

  remove(tx: number, ty: number): Piece | null {
    const i = this.idx(tx, ty);
    const p = this.cells.get(i) ?? null;
    if (p) this.cells.delete(i);
    return p;
  }

  toggleDoor(tx: number, ty: number): boolean {
    const p = this.at(tx, ty);
    if (!p || p.kind !== 'door') return false;
    p.open = !p.open;
    return true;
  }

  // Kamp ateşi menzili içinde mi?
  nearCampfire(tx: number, ty: number): boolean {
    for (const [i, p] of this.cells) {
      if (p.kind !== 'campfire') continue;
      const cx = i % this.size;
      const cy = (i - cx) / this.size;
      const r = PIECES.campfire.warmTiles ?? 0;
      if (Math.hypot(cx - tx, cy - ty) <= r) return true;
    }
    return false;
  }

  // Yapılarla çevrili mi? Yapılar duvar sayılır; arazi açık kabul edilir.
  // Harita kenarına ya da sınır aşan alana ulaşılırsa açık sayılır.
  enclosed(tx: number, ty: number): boolean {
    if (this.blocks(tx, ty)) return false;
    const seen = new Set<number>([this.idx(tx, ty)]);
    const stack: [number, number][] = [[tx, ty]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      if (x === 0 || y === 0 || x === this.size - 1 || y === this.size - 1) return false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        const ni = this.idx(nx, ny);
        if (seen.has(ni) || this.blocks(nx, ny)) continue;
        seen.add(ni);
        if (seen.size > ENCLOSURE_LIMIT) return false;
        stack.push([nx, ny]);
      }
    }
    return true;
  }

  // Gece soğuğuna karşı korunma: ateşe yakın ya da kapalı alanda.
  warm(tx: number, ty: number): boolean {
    return this.nearCampfire(tx, ty) || this.enclosed(tx, ty);
  }
}
