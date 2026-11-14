import Phaser from 'phaser';
import { CONFIG, SURVIVAL } from '../data/config';
import { ITEMS, TOOL_ITEM, type ItemId } from '../data/items';
import { RECIPES, type Recipe } from '../data/recipes';
import { PAL } from '../data/palette';
import { drawAtlas, drawBag, drawPlayer } from '../render/art';
import { FRAME_COUNT, TILE_PX, frameFor, variantAt } from '../render/atlas';
import { TILE } from '../data/tiles';
import { Inventory } from '../sim/inventory';
import { dayNumber, isNight } from '../sim/clock';
import { findHarvestTarget, harvestHit } from '../sim/harvest';
import { generateWorld, isBlockedTile, type WorldMap } from '../sim/map';
import { moveCircle, type Vec2 } from '../sim/movement';
import {
  dropBag,
  isDead,
  pickupBags,
  restore,
  startVitals,
  tickVitals,
  type Bag,
  type Vitals,
} from '../sim/survival';
import { Hud, type HudAction } from './Hud';
import { Joystick } from './Joystick';

type Dir = Phaser.Input.Keyboard.Key;

export class GameScene extends Phaser.Scene {
  private map!: WorldMap;
  private pos: Vec2 = { x: 0, y: 0 };
  private spawn: Vec2 = { x: 0, y: 0 };
  private player!: Phaser.GameObjects.Image;
  private joystick!: Joystick;
  private hud!: Hud;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private inv = new Inventory(CONFIG.inventorySize);
  private remaining = new Map<number, number>();
  private selected = 0;
  private panelOpen = false;
  private cooldown = 0;
  private message = '';
  private messageLeft = 0;

  private vitals: Vitals = startVitals();
  private clock = 0;
  private dead = false;
  private respawnLeft = 0;
  private bags: Bag[] = [];
  private bagGfx = new Map<Bag, Phaser.GameObjects.Image>();

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

    this.buildWorld();

    this.spawn = {
      x: (this.map.spawn.tx + 0.5) * T,
      y: (this.map.spawn.ty + 0.5) * T,
    };
    this.pos = { ...this.spawn };
    const pc = this.textures.createCanvas('player', 28, 28);
    if (pc) {
      drawPlayer(pc.getContext(), 28);
      pc.refresh();
    }
    const bc = this.textures.createCanvas('bag', 32, 32);
    if (bc) {
      drawBag(bc.getContext(), 32);
      bc.refresh();
    }
    this.player = this.add.image(this.pos.x, this.pos.y, 'player').setDepth(10);

    const worldCam = this.cameras.main;
    worldCam.setBounds(0, 0, this.map.size * T, this.map.size * T);
    worldCam.setZoom(CONFIG.cameraZoom);
    worldCam.startFollow(this.player, true, 0.15, 0.15);

    this.joystick = new Joystick(this);
    this.hud = new Hud(this);

    // Gece karartması: UI katmanında, zoom'dan bağımsız tam ekran.
    this.nightOverlay = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, PAL.night, 0)
      .setOrigin(0, 0)
      .setDepth(800);

    // UI kamerası: joystick, HUD ve karartma. Dünya kamerası bunları görmez.
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCam.ignore([this.groundLayer, this.player]);
    worldCam.ignore([...this.joystick.getObjects(), ...this.hud.getObjects(), this.nightOverlay]);

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
      if (this.messageLeft <= 0) this.message = '';
    }

    if (this.dead) {
      this.respawnLeft -= dt;
      if (this.respawnLeft <= 0) this.respawn();
    } else {
      this.clock += dt;
      const night = isNight(this.clock);
      this.vitals = tickVitals(this.vitals, dt, night, false);
      if (isDead(this.vitals)) this.die();
      else this.tickPlayer(dt);
      this.pickUpBags();
    }

    this.nightOverlay.setAlpha(!this.dead && isNight(this.clock) ? SURVIVAL.nightAlpha : 0);

    this.hud.update({
      inv: this.inv,
      selected: this.selected,
      panelOpen: this.panelOpen,
      message: this.message,
      vitals: this.vitals,
      dayText: `Gün ${dayNumber(this.clock)} · ${isNight(this.clock) ? 'Gece' : 'Gündüz'}`,
      dead: this.dead,
      respawnIn: this.respawnLeft,
    });
  }

  private tickPlayer(dt: number): void {
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
    if (this.dead) return;
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
        this.selected = act.index;
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
  }

  private togglePanel(): void {
    this.panelOpen = !this.panelOpen;
  }

  private heldItem(): ItemId | null {
    return this.inv.slots[this.selected]?.id ?? null;
  }

  private doAction(): void {
    if (this.cooldown > 0 || this.dead) return;
    const T = CONFIG.tileSize;
    const idx = findHarvestTarget(this.map, this.pos.x, this.pos.y, CONFIG.reachTiles * T, T);
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
      if (res.reason === 'need_tool') this.say(`Önce ${ITEMS[TOOL_ITEM[res.need]].name} gerekli`);
      else if (res.reason === 'no_space') this.say('Çanta dolu');
      return;
    }

    if (res.item) {
      this.inv.add(res.item, res.count);
      this.floatText(wx, wy, `+${res.count} ${ITEMS[res.item].name}`);
    }
    if (res.stat) {
      this.vitals = restore(this.vitals, res.stat, res.restore);
      this.floatText(wx, wy, `+${res.restore} ${res.stat === 'thirst' ? 'Su' : 'Yemek'}`);
    }
    if (res.depleted) this.paintTile(idx);
  }

  private craft(recipe: Recipe | undefined): void {
    if (!recipe) return;
    if (this.inv.craft(recipe)) this.say(`Üretildi: ${ITEMS[recipe.result].name}`);
    else if (!this.inv.canCraft(recipe)) this.say('Malzeme yetersiz');
    else this.say('Çanta dolu');
  }

  private say(text: string): void {
    this.message = text;
    this.messageLeft = CONFIG.messageSeconds;
  }

  // Ölüm: envanter öldüğün yere çanta olarak bırakılır, kısa bir süre sonra başlangıca dönersin.
  private die(): void {
    this.dead = true;
    this.respawnLeft = SURVIVAL.respawnSeconds;
    this.message = '';
    this.panelOpen = false;
    this.joystick.cancel();
    const bag = dropBag(this.inv, this.pos.x, this.pos.y);
    if (bag) {
      this.bags.push(bag);
      const img = this.add.image(bag.x, bag.y, 'bag').setDepth(8);
      this.uiCam.ignore(img);
      this.bagGfx.set(bag, img);
    }
  }

  private respawn(): void {
    this.dead = false;
    this.pos = { ...this.spawn };
    this.player.setPosition(this.pos.x, this.pos.y);
    this.vitals = startVitals();
    this.selected = 0;
  }

  private pickUpBags(): void {
    if (this.bags.length === 0) return;
    const emptied = pickupBags(this.inv, this.bags, this.pos.x, this.pos.y, SURVIVAL.bagPickupTiles * CONFIG.tileSize);
    for (const bag of emptied) {
      this.bagGfx.get(bag)?.destroy();
      this.bagGfx.delete(bag);
    }
  }

  private floatText(x: number, y: number, text: string): void {
    const t = this.add
      .text(x, y, text, { fontFamily: 'Georgia, serif', fontSize: '13px', color: PAL.creamHex })
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

  // Harita Phaser tilemap olarak kurulur. Her kare bir (tip, varyant) çifti.
  // Tükenen düğüm, layer üzerinde çimen karesiyle değiştirilir.
  private buildWorld(): void {
    const size = this.map.size;
    const atlas = this.textures.createCanvas('atlas', FRAME_COUNT * TILE_PX, TILE_PX);
    if (!atlas) throw new Error('atlas oluşturulamadı');
    drawAtlas(atlas.getContext(), FRAME_COUNT);
    atlas.refresh();

    const data: number[][] = [];
    for (let ty = 0; ty < size; ty++) {
      const row: number[] = [];
      for (let tx = 0; tx < size; tx++) {
        row.push(frameFor(this.map.tiles[ty * size + tx], variantAt(tx, ty)));
      }
      data.push(row);
    }
    const tmap = this.make.tilemap({ data, tileWidth: TILE_PX, tileHeight: TILE_PX });
    const tiles = tmap.addTilesetImage('atlas', 'atlas', TILE_PX, TILE_PX, 0, 0);
    if (!tiles) throw new Error('tileset oluşturulamadı');
    this.groundLayer = tmap.createLayer(0, tiles, 0, 0)!;
    this.groundLayer.setDepth(0);
  }

  private paintTile(idx: number): void {
    const size = this.map.size;
    const tx = idx % size;
    const ty = (idx - tx) / size;
    this.groundLayer.putTileAt(frameFor(TILE.Grass, variantAt(tx, ty)), tx, ty);
  }
}
