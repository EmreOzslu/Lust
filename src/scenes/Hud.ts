import Phaser from 'phaser';
import { BAR, PAL } from '../data/palette';
import { CONFIG, SURVIVAL } from '../data/config';
import { BUILD_ORDER, PIECES } from '../data/buildables';
import { ITEMS, type ItemId } from '../data/items';
import { RECIPES, STATION_TEXT, type Recipe } from '../data/recipes';
import type { Inventory } from '../sim/inventory';
import type { Vitals } from '../sim/survival';

export type HudAction =
  | { kind: 'select'; index: number }
  | { kind: 'action' }
  | { kind: 'toggleCraft' }
  | { kind: 'craft'; index: number }
  | { kind: 'toggleBuild' }
  | { kind: 'piece'; index: number }
  | { kind: 'withdraw'; id: ItemId }
  | { kind: 'deposit'; id: ItemId };

export interface StorageView {
  title: string;
  store: { id: ItemId; count: number }[];
  bag: { id: ItemId; count: number }[];
}

export interface HudState {
  inv: Inventory;
  selected: number;
  panelOpen: boolean;
  message: string;
  vitals: Vitals;
  dayText: string;
  dead: boolean;
  respawnIn: number;
  buildMode: boolean;
  pieceIndex: number;
  storage: StorageView | null;
  // Yakındaki istasyonlar (tarif satırlarında gösterilir)
  stations: { workbench: boolean; furnace: boolean };
}

const SLOT = 50;
const GAP = 6;
const CHIP_W = 66;
const CHIP_GAP = 4;
const CHIP_H = 34;
const TEXT_STYLE = { fontFamily: 'sans-serif', fontSize: '12px', color: PAL.creamHex };
const TITLE_STYLE = { fontFamily: 'Georgia, serif', fontSize: '14px', color: PAL.creamHex };
const SMALL_STYLE = { fontFamily: 'sans-serif', fontSize: '10px', color: PAL.creamHex };
const ROW_H = 44;
const ROW_GAP = 6;
const ROW_POOL = 16;
const BAR_X = 62;
const BAR_W = 120;
const BAR_H = 8;
const BAR_Y = [48, 62, 76];

type Box = { x: number; y: number; w: number; h: number };

// Sabit düzen. Koordinatlar ekran (oyun) pikseli; UI kamerasında çizilir.
export class Hud {
  private W: number;
  private H: number;
  private shapes: Phaser.GameObjects.Graphics;
  private slotLabels: { name: Phaser.GameObjects.Text; count: Phaser.GameObjects.Text }[] = [];
  private actionLabel: Phaser.GameObjects.Text;
  private craftLabel: Phaser.GameObjects.Text;
  private buildLabel: Phaser.GameObjects.Text;
  private chipLabels: Phaser.GameObjects.Text[] = [];
  private message: Phaser.GameObjects.Text;
  private barLabels: Phaser.GameObjects.Text[] = [];
  private dayLabel: Phaser.GameObjects.Text;
  private deadLabel: Phaser.GameObjects.Text;
  private panelTitle: Phaser.GameObjects.Text;
  private panelRows: Phaser.GameObjects.Text[] = [];
  private panelInv: Phaser.GameObjects.Text;
  private headStore: Phaser.GameObjects.Text;
  private headBag: Phaser.GameObjects.Text;
  private objects: Phaser.GameObjects.GameObject[] = [];
  // Son çizilen durumdan türetilen tıklama alanları
  private rowHits: { box: Box; action: HudAction }[] = [];
  private buildOpen = false;

  constructor(scene: Phaser.Scene) {
    this.W = scene.scale.width;
    this.H = scene.scale.height;

    this.shapes = scene.add.graphics().setDepth(900);
    this.objects.push(this.shapes);

    for (let i = 0; i < CONFIG.hotbarSize; i++) {
      const { x, y } = this.slotPos(i);
      const name = scene.add.text(x + SLOT / 2, y + 14, '', SMALL_STYLE).setOrigin(0.5).setDepth(901);
      const count = scene.add.text(x + SLOT - 4, y + SLOT - 4, '', SMALL_STYLE).setOrigin(1, 1).setDepth(901);
      this.slotLabels.push({ name, count });
      this.objects.push(name, count);
    }

    const a = this.actionCircle();
    this.actionLabel = scene.add.text(a.x, a.y, 'VUR', TITLE_STYLE).setOrigin(0.5).setDepth(901);
    const c = this.craftBox();
    this.craftLabel = scene.add.text(c.x + c.w / 2, c.y + c.h / 2, 'ÜRET', TITLE_STYLE).setOrigin(0.5).setDepth(901);
    const b = this.buildBox();
    this.buildLabel = scene.add.text(b.x + b.w / 2, b.y + b.h / 2, 'İNŞA', TITLE_STYLE).setOrigin(0.5).setDepth(901);
    for (let i = 0; i < BUILD_ORDER.length; i++) {
      const cb = this.chipBox(i);
      this.chipLabels.push(
        scene.add
          .text(cb.x + cb.w / 2, cb.y + cb.h / 2, PIECES[BUILD_ORDER[i]].short, {
            fontFamily: 'sans-serif',
            fontSize: '10px',
            color: PAL.creamHex,
          })
          .setOrigin(0.5)
          .setDepth(901)
          .setVisible(false),
      );
    }
    this.message = scene.add.text(16, 18, '', TEXT_STYLE).setDepth(901).setWordWrapWidth(this.W - 130);

    for (const [label, y] of [
      ['Can', BAR_Y[0]],
      ['Açlık', BAR_Y[1]],
      ['Susuzluk', BAR_Y[2]],
    ] as const) {
      this.barLabels.push(scene.add.text(16, y - 2, label, SMALL_STYLE).setDepth(901));
    }
    this.dayLabel = scene.add.text(16, 92, '', SMALL_STYLE).setDepth(901);

    const p = this.panelBox();
    this.panelTitle = scene.add.text(p.x + 12, p.y + 12, '', TITLE_STYLE).setDepth(901);
    for (let i = 0; i < ROW_POOL; i++) {
      this.panelRows.push(scene.add.text(0, 0, '', TEXT_STYLE).setDepth(901).setVisible(false));
    }
    this.panelInv = scene.add
      .text(p.x + 12, p.y + p.h - 90, '', SMALL_STYLE)
      .setDepth(901)
      .setWordWrapWidth(p.w - 24);
    this.headStore = scene.add.text(0, 0, '', { ...SMALL_STYLE, color: '#c9a062' }).setDepth(901).setVisible(false);
    this.headBag = scene.add.text(0, 0, '', { ...SMALL_STYLE, color: '#c9a062' }).setDepth(901).setVisible(false);

    this.deadLabel = scene.add
      .text(this.W / 2, this.H / 2, '', { fontFamily: 'Georgia, serif', fontSize: '22px', color: PAL.creamHex, align: 'center' })
      .setOrigin(0.5)
      .setDepth(950)
      .setVisible(false);

    this.objects.push(
      this.actionLabel,
      this.craftLabel,
      this.buildLabel,
      ...this.chipLabels,
      this.message,
      ...this.barLabels,
      this.dayLabel,
      this.deadLabel,
      this.panelTitle,
      this.panelInv,
      this.headStore,
      this.headBag,
      ...this.panelRows,
    );
  }

  getObjects(): Phaser.GameObjects.GameObject[] {
    return this.objects;
  }

  hitTest(x: number, y: number, panelOpen: boolean): HudAction | null {
    if (panelOpen) {
      for (const r of this.rowHits) if (inside(x, y, r.box)) return r.action;
    }
    if (inside(x, y, this.craftBox())) return { kind: 'toggleCraft' };
    if (inside(x, y, this.buildBox())) return { kind: 'toggleBuild' };
    if (this.buildOpen) {
      for (let i = 0; i < BUILD_ORDER.length; i++) {
        if (inside(x, y, this.chipBox(i))) return { kind: 'piece', index: i };
      }
    }
    for (let i = 0; i < CONFIG.hotbarSize; i++) {
      const p = this.slotPos(i);
      if (inside(x, y, { x: p.x, y: p.y, w: SLOT, h: SLOT })) return { kind: 'select', index: i };
    }
    const a = this.actionCircle();
    if (Math.hypot(x - a.x, y - a.y) <= a.r) return { kind: 'action' };
    return null;
  }

  update(state: HudState): void {
    const g = this.shapes;
    g.clear();
    this.buildOpen = state.buildMode;
    this.rowHits = [];

    // Hotbar
    for (let i = 0; i < CONFIG.hotbarSize; i++) {
      const { x, y } = this.slotPos(i);
      g.fillStyle(PAL.panel, 0.55);
      g.fillRoundedRect(x, y, SLOT, SLOT, 6);
      const sel = i === state.selected;
      g.lineStyle(sel ? 3 : 1, sel ? PAL.brass : PAL.stone, sel ? 1 : 0.7);
      g.strokeRoundedRect(x, y, SLOT, SLOT, 6);

      const s = state.inv.slots[i];
      const label = this.slotLabels[i];
      if (s) {
        g.fillStyle(ITEMS[s.id].color, 1);
        g.fillRoundedRect(x + 10, y + 20, SLOT - 20, 16, 3);
        label.name.setText(ITEMS[s.id].name);
        label.count.setText(s.count > 1 ? String(s.count) : '');
      } else {
        label.name.setText('');
        label.count.setText('');
      }
    }

    // Hayati değer çubukları
    const bars: [number, number, number][] = [
      [state.vitals.hp, BAR.hp, 0],
      [state.vitals.hunger, BAR.hunger, 1],
      [state.vitals.thirst, BAR.thirst, 2],
    ];
    for (const [val, color, row] of bars) {
      const y = BAR_Y[row];
      g.fillStyle(PAL.panel, 0.6);
      g.fillRoundedRect(BAR_X, y, BAR_W, BAR_H, 3);
      g.fillStyle(color, 1);
      g.fillRoundedRect(BAR_X, y, (BAR_W * Math.max(0, val)) / SURVIVAL.maxVital, BAR_H, 3);
    }
    this.dayLabel.setText(state.dayText);

    // Aksiyon butonu
    const a = this.actionCircle();
    g.fillStyle(PAL.panel, 0.5);
    g.fillCircle(a.x, a.y, a.r);
    g.lineStyle(2, PAL.brass, 0.8);
    g.strokeCircle(a.x, a.y, a.r);

    // İnşa butonu ve parça şeridi (iki satır)
    const bb = this.buildBox();
    g.fillStyle(PAL.panel, state.buildMode ? 0.9 : 0.6);
    g.fillRoundedRect(bb.x, bb.y, bb.w, bb.h, 8);
    g.lineStyle(1, PAL.brass, state.buildMode ? 1 : 0.6);
    g.strokeRoundedRect(bb.x, bb.y, bb.w, bb.h, 8);
    BUILD_ORDER.forEach((_kind, i) => {
      const cb = this.chipBox(i);
      const sel = state.buildMode && i === state.pieceIndex;
      g.fillStyle(sel ? PAL.brass : PAL.panel, sel ? 0.9 : 0.75);
      g.fillRoundedRect(cb.x, cb.y, cb.w, cb.h, 6);
      g.lineStyle(1, PAL.brass, 0.6);
      g.strokeRoundedRect(cb.x, cb.y, cb.w, cb.h, 6);
      const lbl = this.chipLabels[i];
      lbl.setVisible(state.buildMode);
      lbl.setColor(sel ? PAL.nightHex : PAL.creamHex);
    });

    // Üret butonu
    const c = this.craftBox();
    g.fillStyle(state.panelOpen ? PAL.brass : PAL.panel, state.panelOpen ? 0.9 : 0.6);
    g.fillRoundedRect(c.x, c.y, c.w, c.h, 8);
    this.craftLabel.setColor(state.panelOpen ? PAL.nightHex : PAL.creamHex);

    this.message.setText(state.message);
    this.drawPanel(state);

    // Ölüm ekranı
    this.deadLabel.setVisible(state.dead);
    if (state.dead) {
      g.fillStyle(0x000000, 0.6);
      g.fillRect(0, 0, this.W, this.H);
      this.deadLabel.setText(`Öldün\nUyanıyorsun... ${Math.ceil(state.respawnIn)}`);
    }
  }

  // Üretim paneli (tarifler) ya da sandık paneli (depo ↔ çanta).
  private drawPanel(state: HudState): void {
    const g = this.shapes;
    this.panelTitle.setVisible(state.panelOpen);
    this.panelInv.setVisible(state.panelOpen && !state.storage);
    for (const t of this.panelRows) t.setVisible(false);
    if (!state.panelOpen) return;

    const p = this.panelBox();
    g.fillStyle(PAL.panel, 0.85);
    g.fillRoundedRect(p.x, p.y, p.w, p.h, 10);
    g.lineStyle(2, PAL.brass, 0.5);
    g.strokeRoundedRect(p.x, p.y, p.w, p.h, 10);

    this.headStore.setVisible(false);
    this.headBag.setVisible(false);
    if (state.storage) {
      this.drawStorage(state.storage);
      return;
    }

    this.panelTitle.setText('Üretim');
    RECIPES.forEach((recipe, i) => {
      const txt = this.panelRows[i];
      const box = this.rowBox(i);
      const can = state.inv.canCraft(recipe) && this.stationOk(recipe, state.stations);
      g.fillStyle(can ? PAL.brass : PAL.stone, 0.2);
      g.fillRoundedRect(box.x, box.y, box.w, box.h, 6);
      txt.setPosition(box.x + 10, box.y + box.h / 2).setOrigin(0, 0.5).setVisible(true);
      txt.setColor(can ? PAL.creamHex : '#8f8c86');
      const st = recipe.station ? `  [${STATION_TEXT[recipe.station]}]` : '';
      txt.setText(`${ITEMS[recipe.result].name} ×${recipe.count} — ${costText(recipe)}${st}`);
      this.rowHits.push({ box, action: { kind: 'craft', index: i } });
    });
    this.panelInv.setText('Çanta:\n' + inventorySummary(state.inv));
  }

  private drawStorage(view: StorageView): void {
    const g = this.shapes;
    const p = this.panelBox();
    const colW = (p.w - 24 - 8) / 2;
    const left = { x: p.x + 8, w: colW };
    const right = { x: p.x + 8 + colW + 8, w: colW };
    this.panelTitle.setText(view.title);
    this.panelInv.setVisible(false);

    const drawCol = (
      col: { x: number; w: number },
      heading: string,
      rows: { id: ItemId; count: number }[],
      action: 'withdraw' | 'deposit',
      tag: string,
    ) => {
      const head = action === 'withdraw' ? this.headStore : this.headBag;
      head.setPosition(col.x + 4, p.y + 36).setVisible(true).setText(heading);
      rows.slice(0, 8).forEach((r, i) => {
        const box: Box = { x: col.x, y: p.y + 56 + i * (ROW_H + ROW_GAP), w: col.w, h: ROW_H };
        const txt = this.panelRows[i + (action === 'withdraw' ? 0 : 8)];
        g.fillStyle(PAL.brass, 0.2);
        g.fillRoundedRect(box.x, box.y, box.w, box.h, 6);
        txt.setPosition(box.x + 8, box.y + box.h / 2).setOrigin(0, 0.5).setVisible(true);
        txt.setColor(PAL.creamHex);
        txt.setText(`${ITEMS[r.id].name} ×${r.count}\n${tag}`);
        this.rowHits.push({ box, action: { kind: action, id: r.id } });
      });
    };
    drawCol(left, 'Sandıkta', view.store, 'withdraw', 'al');
    drawCol(right, 'Çantada', view.bag, 'deposit', 'koy');
  }

  private stationOk(recipe: Recipe, stations: { workbench: boolean; furnace: boolean }): boolean {
    if (!recipe.station) return true;
    return stations[recipe.station];
  }

  private slotPos(i: number): { x: number; y: number } {
    const n = CONFIG.hotbarSize;
    const total = n * SLOT + (n - 1) * GAP;
    return { x: (this.W - total) / 2 + i * (SLOT + GAP), y: this.H - 92 };
  }

  private actionCircle(): { x: number; y: number; r: number } {
    return { x: this.W - 58, y: this.H - 170, r: 38 };
  }

  private craftBox(): Box {
    return { x: this.W - 100, y: 14, w: 84, h: 34 };
  }

  private buildBox(): Box {
    return { x: this.W - 100, y: 54, w: 84, h: 34 };
  }

  // İki satır: ilk 5 parça üstte, kalanı altta; ikisi de aksiyon butonunun üstünde.
  private chipBox(i: number): Box {
    const row = Math.floor(i / 5);
    const col = i % 5;
    return {
      x: 16 + col * (CHIP_W + CHIP_GAP),
      y: this.H - 302 + row * (CHIP_H + 6),
      w: CHIP_W,
      h: CHIP_H,
    };
  }

  private panelBox(): Box {
    return { x: 16, y: 116, w: this.W - 32, h: this.H - 116 - 120 };
  }

  private rowBox(i: number): Box {
    const p = this.panelBox();
    return { x: p.x + 8, y: p.y + 40 + i * (ROW_H + ROW_GAP), w: p.w - 16, h: ROW_H };
  }
}

function inside(x: number, y: number, r: Box): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function costText(recipe: Recipe): string {
  return (Object.entries(recipe.cost) as [ItemId, number][])
    .map(([id, n]) => `${n} ${ITEMS[id].name}`)
    .join(', ');
}

function inventorySummary(inv: Inventory): string {
  const totals = new Map<ItemId, number>();
  for (const s of inv.slots) if (s) totals.set(s.id, (totals.get(s.id) ?? 0) + s.count);
  if (totals.size === 0) return 'boş';
  return [...totals.entries()].map(([id, n]) => `${ITEMS[id].name} ×${n}`).join('   ');
}
