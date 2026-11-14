import Phaser from 'phaser';
import { CONFIG, SURVIVAL } from '../data/config';
import { ITEMS, type ItemId } from '../data/items';
import { RECIPES, type Recipe } from '../data/recipes';
import type { Inventory } from '../sim/inventory';
import type { Vitals } from '../sim/survival';

export type HudAction =
  | { kind: 'select'; index: number }
  | { kind: 'action' }
  | { kind: 'toggleCraft' }
  | { kind: 'craft'; index: number };

export interface HudState {
  inv: Inventory;
  selected: number;
  panelOpen: boolean;
  message: string;
  vitals: Vitals;
  dayText: string;
  dead: boolean;
  respawnIn: number;
}

const SLOT = 50;
const GAP = 6;
const TEXT_STYLE = { fontFamily: 'sans-serif', fontSize: '12px', color: '#e8d9a0' };
const SMALL_STYLE = { fontFamily: 'sans-serif', fontSize: '10px', color: '#e8d9a0' };
const ROW_H = 44;
const ROW_GAP = 6;
const ROW_POOL = 8;
const BAR_X = 62;
const BAR_W = 120;
const BAR_H = 8;
const BAR_Y = [48, 62, 76];

// Sabit düzen. Koordinatlar ekran (oyun) pikseli; UI kamerasında çizilir.
export class Hud {
  private W: number;
  private H: number;
  private shapes: Phaser.GameObjects.Graphics;
  private slotLabels: { name: Phaser.GameObjects.Text; count: Phaser.GameObjects.Text }[] = [];
  private actionLabel: Phaser.GameObjects.Text;
  private craftLabel: Phaser.GameObjects.Text;
  private message: Phaser.GameObjects.Text;
  private barLabels: Phaser.GameObjects.Text[] = [];
  private dayLabel: Phaser.GameObjects.Text;
  private deadLabel: Phaser.GameObjects.Text;
  private panelTitle: Phaser.GameObjects.Text;
  private panelRows: Phaser.GameObjects.Text[] = [];
  private panelInv: Phaser.GameObjects.Text;
  private objects: Phaser.GameObjects.GameObject[] = [];

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
    this.actionLabel = scene.add.text(a.x, a.y, 'VUR', TEXT_STYLE).setOrigin(0.5).setDepth(901);
    const c = this.craftBox();
    this.craftLabel = scene.add.text(c.x + c.w / 2, c.y + c.h / 2, 'ÜRET', TEXT_STYLE).setOrigin(0.5).setDepth(901);
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
    this.panelTitle = scene.add.text(p.x + 12, p.y + 12, 'Üretim', TEXT_STYLE).setDepth(901);
    for (let i = 0; i < ROW_POOL; i++) {
      this.panelRows.push(scene.add.text(0, 0, '', TEXT_STYLE).setDepth(901).setVisible(false));
    }
    this.panelInv = scene.add
      .text(p.x + 12, p.y + p.h - 90, '', SMALL_STYLE)
      .setDepth(901)
      .setWordWrapWidth(p.w - 24);

    this.deadLabel = scene.add
      .text(this.W / 2, this.H / 2, '', { fontFamily: 'sans-serif', fontSize: '22px', color: '#e8d9a0', align: 'center' })
      .setOrigin(0.5)
      .setDepth(950)
      .setVisible(false);

    this.objects.push(
      this.actionLabel,
      this.craftLabel,
      this.message,
      ...this.barLabels,
      this.dayLabel,
      this.deadLabel,
      this.panelTitle,
      this.panelInv,
      ...this.panelRows,
    );
  }

  getObjects(): Phaser.GameObjects.GameObject[] {
    return this.objects;
  }

  hitTest(x: number, y: number, panelOpen: boolean): HudAction | null {
    if (panelOpen) {
      for (let i = 0; i < RECIPES.length; i++) {
        if (inside(x, y, this.rowBox(i))) return { kind: 'craft', index: i };
      }
    }
    if (inside(x, y, this.craftBox())) return { kind: 'toggleCraft' };
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

    // Hotbar
    for (let i = 0; i < CONFIG.hotbarSize; i++) {
      const { x, y } = this.slotPos(i);
      g.fillStyle(0x0b1a1f, 0.55);
      g.fillRoundedRect(x, y, SLOT, SLOT, 6);
      const sel = i === state.selected;
      g.lineStyle(sel ? 3 : 1, sel ? 0xe8d9a0 : 0x6b6a68, sel ? 1 : 0.7);
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

    // Hayati değer çubukları: can, açlık, susuzluk
    const bars: [number, number, number][] = [
      [state.vitals.hp, 0xc0504d, 0],
      [state.vitals.hunger, 0xd9a441, 1],
      [state.vitals.thirst, 0x4fa3c7, 2],
    ];
    for (const [val, color, row] of bars) {
      const y = BAR_Y[row];
      g.fillStyle(0x0b1a1f, 0.6);
      g.fillRoundedRect(BAR_X, y, BAR_W, BAR_H, 3);
      g.fillStyle(color, 1);
      g.fillRoundedRect(BAR_X, y, BAR_W * Math.max(0, val) / SURVIVAL.maxVital, BAR_H, 3);
    }
    this.dayLabel.setText(state.dayText);

    // Aksiyon butonu
    const a = this.actionCircle();
    g.fillStyle(0x0b1a1f, 0.5);
    g.fillCircle(a.x, a.y, a.r);
    g.lineStyle(2, 0xe8d9a0, 0.8);
    g.strokeCircle(a.x, a.y, a.r);

    // Üret butonu
    const c = this.craftBox();
    g.fillStyle(state.panelOpen ? 0xe8d9a0 : 0x0b1a1f, state.panelOpen ? 0.9 : 0.6);
    g.fillRoundedRect(c.x, c.y, c.w, c.h, 8);
    this.craftLabel.setColor(state.panelOpen ? '#0b1a1f' : '#e8d9a0');

    this.message.setText(state.message);

    // Üretim paneli
    this.panelTitle.setVisible(state.panelOpen);
    this.panelInv.setVisible(state.panelOpen);
    for (const t of this.panelRows) t.setVisible(false);
    if (state.panelOpen) {
      const p = this.panelBox();
      g.fillStyle(0x0b1a1f, 0.85);
      g.fillRoundedRect(p.x, p.y, p.w, p.h, 10);
      g.lineStyle(2, 0xe8d9a0, 0.5);
      g.strokeRoundedRect(p.x, p.y, p.w, p.h, 10);

      RECIPES.forEach((recipe, i) => {
        if (i >= ROW_POOL) return;
        const txt = this.panelRows[i];
        const r = this.rowBox(i);
        const can = state.inv.canCraft(recipe);
        g.fillStyle(can ? 0xe8d9a0 : 0x6b6a68, 0.2);
        g.fillRoundedRect(r.x, r.y, r.w, r.h, 6);
        txt.setPosition(r.x + 10, r.y + r.h / 2).setOrigin(0, 0.5).setVisible(true);
        txt.setColor(can ? '#e8d9a0' : '#8f8c86');
        txt.setText(`${ITEMS[recipe.result].name} ×${recipe.count}  —  ${costText(recipe)}`);
      });

      this.panelInv.setText('Çanta:\n' + inventorySummary(state.inv));
    }

    // Ölüm ekranı
    this.deadLabel.setVisible(state.dead);
    if (state.dead) {
      g.fillStyle(0x000000, 0.6);
      g.fillRect(0, 0, this.W, this.H);
      this.deadLabel.setText(`Öldün\nUyanıyorsun... ${Math.ceil(state.respawnIn)}`);
    }
  }

  private slotPos(i: number): { x: number; y: number } {
    const n = CONFIG.hotbarSize;
    const total = n * SLOT + (n - 1) * GAP;
    return { x: (this.W - total) / 2 + i * (SLOT + GAP), y: this.H - 92 };
  }

  private actionCircle(): { x: number; y: number; r: number } {
    return { x: this.W - 58, y: this.H - 170, r: 38 };
  }

  private craftBox(): { x: number; y: number; w: number; h: number } {
    return { x: this.W - 100, y: 14, w: 84, h: 34 };
  }

  private panelBox(): { x: number; y: number; w: number; h: number } {
    return { x: 16, y: 116, w: this.W - 32, h: this.H - 116 - 120 };
  }

  private rowBox(i: number): { x: number; y: number; w: number; h: number } {
    const p = this.panelBox();
    return { x: p.x + 8, y: p.y + 40 + i * (ROW_H + ROW_GAP), w: p.w - 16, h: ROW_H };
  }
}

function inside(x: number, y: number, r: { x: number; y: number; w: number; h: number }): boolean {
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
