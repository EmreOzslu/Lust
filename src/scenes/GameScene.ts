import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { ITEMS, TOOL_ITEM, type ItemId } from '../data/items';
import { RECIPES, type Recipe } from '../data/recipes';
import { TILE_DEFS } from '../data/tiles';
import { Inventory } from '../sim/inventory';
import { findHarvestTarget, harvestHit } from '../sim/harvest';
import { generateWorld, isBlockedTile, type WorldMap } from '../sim/map';
import { moveCircle, type Vec2 } from '../sim/movement';
import { Hud, type HudAction } from './Hud';
import { Joystick } from './Joystick';

type Dir = Phaser.Input.Keyboard.Key;

export class GameScene extends Phaser.Scene {
  private map!: WorldMap;
  private pos: Vec2 = { x: 0, y: 0 };
  private player!: Phaser.GameObjects.Graphics;
  private joystick!: Joystick;
  private hud!: Hud;
  private worldCam!: Phaser.Cameras.Scene2D.Camera;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private groundTex!: Phaser.Textures.CanvasTexture;
  private inv = new Inventory(CONFIG.inventorySize);
  private remaining = new Map<number, number>();
  private selected = 0;
  private panelOpen = false;
  private cooldown = 0;
  private message = '';
  private messageLeft = 0;
  private dirty = true;

  private keys!: {
    up: Dir;
    down: Dir;
    left: Dir;
    right: Dir;
    action: Dir;
    craft: Dir;
    numbers: Dir[];
  };

  constructor() {
    super('GameScene');
  }

  create(): void {
    const T = CONFIG.tileSize;
    this.map = generateWorld(CONFIG.seed);

    const ground = this.drawGround();

    this.pos = {
      x: (this.map.spawn.tx + 0.5) * T,
      y: (this.map.spawn.ty + 0.5) * T,
    };
    this.player = this.add.graphics().setDepth(10);
    this.player.fillStyle(0x0b1a1f, 0.4);
    this.player.fillEllipse(0, CONFIG.playerRadius, CONFIG.playerRadius * 2, CONFIG.playerRadius);
    this.player.fillStyle(0xe8d9a0, 1);
    this.player.fillCircle(0, 0, CONFIG.playerRadius);
    this.player.setPosition(this.pos.x, this.pos.y);

    this.worldCam = this.cameras.main;
    this.worldCam.setBounds(0, 0, this.map.size * T, this.map.size * T);
    this.worldCam.setZoom(CONFIG.cameraZoom);
    this.worldCam.startFollow(this.player, true, 0.15, 0.15);

    this.joystick = new Joystick(this);
    this.hud = new Hud(this);

    // UI kamerası: zoom'dan etkilenmeyen joystick ve HUD katmanı.
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCam.ignore([ground, this.player]);
    this.worldCam.ignore([...this.joystick.getObjects(), ...this.hud.getObjects()]);

    const kb = this.input.keyboard;
    if (kb) {
      const numberKeys: Dir[] = [];
      for (let i = 0; i < CONFIG.hotbarSize; i++) {
        numberKeys.push(kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE + i));
      }
      this.keys = {
        up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        action: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        craft: kb.addKey(Phaser.Input.Keyboard.KeyCodes.C),
        numbers: numberKeys,
      };
    }

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.message) {
      this.messageLeft -= dt;
      if (this.messageLeft <= 0) {
        this.message = '';
        this.dirty = true;
      }
    }

    if (this.keys) this.readKeys();

    const dir = this.readDirection();
    const step = CONFIG.playerSpeed * dt;
    this.pos = moveCircle(
      this.pos,
      dir.x * step,
      dir.y * step,
      CONFIG.playerRadius,
      CONFIG.tileSize,
      (tx, ty) => isBlockedTile(this.map, tx, ty),
    );
    this.player.setPosition(this.pos.x, this.pos.y);

    if (this.dirty) {
      this.hud.update({
        inv: this.inv,
        selected: this.selected,
        panelOpen: this.panelOpen,
        message: this.message,
      });
      this.dirty = false;
    }
  }

  private readKeys(): void {
    const k = this.keys;
    if (Phaser.Input.Keyboard.JustDown(k.action)) this.doAction();
    if (Phaser.Input.Keyboard.JustDown(k.craft)) this.togglePanel();
    k.numbers.forEach((key, i) => {
      if (Phaser.Input.Keyboard.JustDown(key)) this.select(i);
    });
  }

  // Joystick öncelikli; yoksa WASD — masaüstünde test için.
  private readDirection(): Vec2 {
    if (this.joystick.active) return this.joystick.getVector();
    if (!this.keys) return { x: 0, y: 0 };
    const x = (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0);
    const y = (this.keys.down.isDown ? 1 : 0) - (this.keys.up.isDown ? 1 : 0);
    const len = Math.hypot(x, y);
    return len === 0 ? { x: 0, y: 0 } : { x: x / len, y: y / len };
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    const act = this.hud.hitTest(p.x, p.y, this.panelOpen);
    if (act) {
      this.handleHud(act);
      return;
    }
    if (this.panelOpen) return;
    this.joystick.tryStart(p.id, p.x, p.y, this.scale.width, this.scale.height);
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    this.joystick.move(p.id, p.x, p.y);
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    this.joystick.end(p.id);
  }

  private handleHud(act: HudAction): void {
    switch (act.kind) {
      case 'select':
        this.select(act.index);
        break;
      case 'action':
        this.doAction();
        break;
      case 'toggleCraft':
        this.togglePanel();
        break;
      case 'craft':
        this.craft(RECIPES[act.index]);
        break;
    }
  }

  private select(i: number): void {
    this.selected = i;
    this.dirty = true;
  }

  private togglePanel(): void {
    this.panelOpen = !this.panelOpen;
    this.dirty = true;
  }

  private heldItem(): ItemId | null {
    return this.inv.slots[this.selected]?.id ?? null;
  }

  private doAction(): void {
    if (this.cooldown > 0) return;
    const T = CONFIG.tileSize;
    const idx = findHarvestTarget(
      this.map,
      this.pos.x,
      this.pos.y,
      CONFIG.reachTiles * T,
      T,
    );
    if (idx === null) {
      this.say('Yakında kaynak yok');
      return;
    }
    this.cooldown = CONFIG.actionCooldown;

    const res = harvestHit(this.map, this.remaining, idx, this.heldItem(), (id, n) =>
      this.inv.canAdd(id, n),
    );
    const tx = idx % this.map.size;
    const ty = (idx - tx) / this.map.size;
    const wx = (tx + 0.5) * T;
    const wy = (ty + 0.5) * T;

    if (!res.ok) {
      if (res.reason === 'need_tool') {
        this.say(`Önce ${ITEMS[TOOL_ITEM[res.need]].name} gerekli`);
      } else if (res.reason === 'no_space') {
        this.say('Çanta dolu');
      }
      return;
    }

    this.inv.add(res.item, res.count);
    this.floatText(wx, wy, `+${res.count} ${ITEMS[res.item].name}`);
    if (res.depleted) this.paintTile(idx);
    this.dirty = true;
  }

  private craft(recipe: Recipe | undefined): void {
    if (!recipe) return;
    if (this.inv.craft(recipe)) {
      this.say(`Üretildi: ${ITEMS[recipe.result].name}`);
    } else if (!this.inv.canCraft(recipe)) {
      this.say('Malzeme yetersiz');
    } else {
      this.say('Çanta dolu');
    }
  }

  private say(text: string): void {
    this.message = text;
    this.messageLeft = CONFIG.messageSeconds;
    this.dirty = true;
  }

  private floatText(x: number, y: number, text: string): void {
    const t = this.add
      .text(x, y, text, { fontFamily: 'sans-serif', fontSize: '12px', color: '#e8d9a0' })
      .setOrigin(0.5)
      .setDepth(50);
    this.uiCam.ignore(t);
    this.tweens.add({
      targets: t,
      y: y - 28,
      alpha: 0,
      duration: 700,
      onComplete: () => t.destroy(),
    });
  }

  // Harita tek piksel/tile olarak bir canvas dokusuna yazılır, nearest filtreyle büyütülür.
  private drawGround(): Phaser.GameObjects.Image {
    const size = this.map.size;
    const tex = this.textures.createCanvas('world', size, size);
    if (!tex) throw new Error('canvas texture oluşturulamadı');
    this.groundTex = tex;
    const ctx = tex.getContext();
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const c = TILE_DEFS[this.map.tiles[i]].color;
      img.data[i * 4] = (c >> 16) & 0xff;
      img.data[i * 4 + 1] = (c >> 8) & 0xff;
      img.data[i * 4 + 2] = c & 0xff;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);

    return this.add.image(0, 0, 'world').setOrigin(0, 0).setScale(CONFIG.tileSize);
  }

  // Tükenen düğümün tile'ını çimene boyar.
  private paintTile(idx: number): void {
    const size = this.map.size;
    const tx = idx % size;
    const ty = (idx - tx) / size;
    const c = TILE_DEFS[this.map.tiles[idx]].color;
    const ctx = this.groundTex.getContext();
    ctx.fillStyle = '#' + c.toString(16).padStart(6, '0');
    ctx.fillRect(tx, ty, 1, 1);
    this.groundTex.refresh();
  }
}
