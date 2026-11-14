import { TILE } from './tiles';
import type { ItemId, ToolKind } from './items';

export type VitalStat = 'hunger' | 'thirst';

export interface ResourceDef {
  // Çantaya giden eşya. Doğrudan etkili kaynaklarda (su, çalı) null.
  item: ItemId | null;
  // Düğümün toplam miktarı; tükenince tile çimene döner. Su için sonsuz.
  amount: number;
  // Gerekli araç türü. null ise araç gerekmez.
  tool: ToolKind | null;
  // Araç yoksa elle kırılabilir mi?
  handAllowed: boolean;
  // Doğrudan etki: her birim, ilgili ihtiyacı bu kadar doldurur.
  effect?: { stat: VitalStat; perUnit: number };
}

// Tile id → kaynak. Elle kırılabilirlik, araç-malzeme kilidi olmasın diye var:
// balta odun ister, odun da ağaçtan gelir; taş da kazma ister, kazma taş ister.
export const RESOURCES: Record<number, ResourceDef> = {
  [TILE.Forest]: { item: 'wood', amount: 10, tool: 'axe', handAllowed: true },
  [TILE.Rock]: { item: 'stone', amount: 12, tool: 'pick', handAllowed: true },
  [TILE.Scrap]: { item: 'scrap', amount: 2, tool: null, handAllowed: true },
  [TILE.Water]: {
    item: null,
    amount: Infinity,
    tool: null,
    handAllowed: true,
    effect: { stat: 'thirst', perUnit: 8 },
  },
  [TILE.Bush]: {
    item: null,
    amount: 4,
    tool: null,
    handAllowed: true,
    effect: { stat: 'hunger', perUnit: 10 },
  },
};
