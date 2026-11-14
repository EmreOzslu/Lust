import { DECAY_DAMAGE, PIECES, UPKEEP, type PieceId } from '../data/buildables';
import { TILE } from '../data/tiles';
import { Inventory } from './inventory';
import { isBlockedTile, type WorldMap } from './map';

export interface Piece {
  kind: PieceId;
  open: boolean; // yalnızca kapı için anlamlı
  hp: number;
  storage?: Inventory; // sandık ve çekirdek
}

export type PlaceReason = 'bounds' | 'terrain' | 'occupied' | 'no_authority' | 'spawn';

// Yetki çekirdeğinin menzili (tile). Authority alanı dışına inşa yok.
export const AUTHORITY_TILES = 8;
// Kapalı alan kontrolünde taşma sınırı: bu kadar tile'dan büyük alan "açık" sayılır.
export const ENCLOSURE_LIMIT = 200;
// İstasyonların (tezgâh, fırın) kullanılabileceği mesafe (tile).
export const STATION_TILES = 3;

export class Structures {
  private cells = new Map<number, Piece>();
  readonly size: number;

  constructor(size: number) {
    this.size = size;
  }

  private idx(tx: number, ty: number): number {
    return ty * this.size + tx;
  }

  private xy(i: number): [number, number] {
    const x = i % this.size;
    return [x, (i - x) / this.size];
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

  hasAuthority(tx: number, ty: number): boolean {
    for (const [i, p] of this.cells) {
      if (p.kind !== 'core') continue;
      const [cx, cy] = this.xy(i);
      if (Math.hypot(cx - tx, cy - ty) <= AUTHORITY_TILES) return true;
    }
    return false;
  }

  hasCore(): boolean {
    for (const p of this.cells.values()) if (p.kind === 'core') return true;
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
    const def = PIECES[kind];
    const piece: Piece = { kind, open: false, hp: def.hp };
    if (def.storageSlots) piece.storage = new Inventory(def.storageSlots);
    this.cells.set(i, piece);
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

  // Yakında (menzil içinde) belirli türde bir yapı var mı? İstasyon kontrolü için.
  nearKind(kind: PieceId, tx: number, ty: number, range: number): boolean {
    for (const [i, p] of this.cells) {
      if (p.kind !== kind) continue;
      const [cx, cy] = this.xy(i);
      if (Math.hypot(cx - tx, cy - ty) <= range) return true;
    }
    return false;
  }

  nearCampfire(tx: number, ty: number): boolean {
    return this.nearKind('campfire', tx, ty, PIECES.campfire.warmTiles ?? 0);
  }

  // Depolama olan en yakın yapı (sandık ya da çekirdek) menzil içinde mi?
  storageNear(tx: number, ty: number, range: number): { tx: number; ty: number } | null {
    let best: { tx: number; ty: number } | null = null;
    let bestD = Infinity;
    for (const [i, p] of this.cells) {
      if (!p.storage) continue;
      const [cx, cy] = this.xy(i);
      const d = Math.hypot(cx - tx, cy - ty);
      if (d <= range && d < bestD) {
        bestD = d;
        best = { tx: cx, ty: cy };
      }
    }
    return best;
  }

  // Yapılar çevresinde kapalı mı? Yapılar duvar sayılır; arazi açık kabul edilir.
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

  // Hasar: can düşer, sıfıra inen yapı kaldırılır. Kaldırılan yapıyı döndürür.
  damage(tx: number, ty: number, amount: number): Piece | null {
    const p = this.at(tx, ty);
    if (!p) return null;
    p.hp -= amount;
    if (p.hp > 0) return null;
    return this.remove(tx, ty);
  }

  // Oyun günü değişince çalışır. Çekirdek bakımı çekirdek deposundan düşer;
  // yetmezse her yapı DECAY_DAMAGE kadar can kaybeder. Yıkılanlar döner.
  tickDay(): { destroyed: [number, Piece][]; upkeepPaid: boolean } {
    let upkeepPaid = true;
    const core = this.entries().find(([, p]) => p.kind === 'core');
    if (core) {
      const store = core[1].storage!;
      for (const [id, n] of Object.entries(UPKEEP) as [keyof typeof UPKEEP, number][]) {
        if (store.count(id) < n) upkeepPaid = false;
      }
      if (upkeepPaid) {
        for (const [id, n] of Object.entries(UPKEEP) as [keyof typeof UPKEEP, number][]) store.remove(id, n);
      }
    } else {
      upkeepPaid = false;
    }

    const destroyed: [number, Piece][] = [];
    if (!upkeepPaid) {
      for (const [i, p] of this.entries()) {
        p.hp -= DECAY_DAMAGE;
        if (p.hp <= 0) {
          this.cells.delete(i);
          destroyed.push([i, p]);
        }
      }
    }
    return { destroyed, upkeepPaid };
  }
}
