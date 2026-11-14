import { TILE } from './tiles';
import type { ItemId, ToolKind } from './items';

export interface ResourceDef {
  item: ItemId;
  // Düğümün toplam miktarı; tükenince tile çimene döner.
  amount: number;
  // Gerekli araç türü. null ise araç gerekmez.
  tool: ToolKind | null;
  // Araç yoksa elle kırılabilir mi?
  handAllowed: boolean;
}

// Tile id → kaynak. Elle kırılabilirlik, araç-malzeme kilidi olmasın diye var:
// balta odun ister, odun da ağaçtan gelir; taş da kazma ister, kazma taş ister.
export const RESOURCES: Record<number, ResourceDef> = {
  [TILE.Forest]: { item: 'wood', amount: 10, tool: 'axe', handAllowed: true },
  [TILE.Rock]: { item: 'stone', amount: 12, tool: 'pick', handAllowed: true },
  [TILE.Scrap]: { item: 'scrap', amount: 2, tool: null, handAllowed: true },
};
