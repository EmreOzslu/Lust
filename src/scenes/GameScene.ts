import Phaser from 'phaser';
import { BUILD_ORDER, PIECES, type PieceId } from '../data/buildables';
import { CONFIG, SURVIVAL } from '../data/config';
import { PAL } from '../data/palette';
import { ITEMS, TOOL_ITEM, type ItemId } from '../data/items';
import { RECIPES, type Recipe } from '../data/recipes';
import { TILE } from '../data/tiles';
import { drawAtlas, drawBag, drawLight, drawPiece, drawPlayer } from '../render/art';
import { FRAME_COUNT, TILE_PX, frameFor, variantAt } from '../render/atlas';
import { dayNumber, isNight } from '../sim/clock';
import type { Piece } from '../sim/structures';
import { Inventory } from '../sim/inventory';
import { findHarvestTarget, harvestHit } from '../sim/harvest';
import { generateWorld, isBlockedTile, type WorldMap } from '../sim/map';
import { moveCircle, type Vec2 } from '../sim/movement';
import { STATION_TILES, Structures, type PlaceReason } from '../sim/structures';
import { STATION_TEXT } from '../data/recipes';
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
import { Hud, type HudAction, type StorageView } from './Hud';
import { Joystick } from './Joystick';

type Dir = Phaser.Input.Keyboard.Key;

const LIGHT_SMALL = 160; // fener
const LIGHT_BIG = 320; // kamp ateşi
const LIGHT_WARM = 128; // ateşin sıcak haresi

const REASON_TEXT: Record<PlaceReason, string> = {
  bounds: 'Harita dışı',
  terrain: 'Burada inşa edilmez',
  occupied: 'Yer dolu',
  no_authority: 'Önce yetki çekirdeği koy',
  spawn: 'Doğma noktasına inşa edilmez',
};

export class GameScene extends Phaser.Scene {
  private map!: WorldMap;
  private pos: Vec2 = { x: 0, y: 0 };
  private spawn: Vec2 = { x: 0, y: 0 };
  private player!: Phaser.GameObjects.Image;
  private joystick!: Joystick;
  private hud!: Hud;
  private worldCam!: Phaser.Cameras.Scene2D.Camera;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private lightRT!: Phaser.GameObjects.RenderTexture;
  private inv = new Inventory(CONFIG.inventorySize);
  private remaining = new Map<number, number>();
  private selected = 0;
  private panelOpen = false;
  private buildMode = false;
  private pieceIndex = 0;
  private cooldown = 0;
  private message = '';
  private messageLeft = 0;
  private tapStart: { x: number; y: number; id: number } | null = null;

  private structures!: Structures;
  private pieceImgs = new Map<number, Phaser.GameObjects.Image>();
  private vitals: Vitals = startVitals();
  private clock = 0;
  private dead = false;
  private respawnLeft = 0;
  private bags: Bag[] = [];
  private bagGfx = new Map<Bag, Phaser.GameObjects.Image>();
  private lastLit = false;
  private lastDay = 1;
  private storageAt: { tx: number; ty: number } | null = null;

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
    this.structures = new Structures(this.map.size);

    this.buildWorld();
    this.makeTextures();

    this.spawn = {
      x: (this.map.spawn.tx + 0.5) * T,
      y: (this.map.spawn.ty + 0.5) * T,
    };
    this.pos = { ...this.spawn };
    this.player = this.add.image(this.pos.x, this.pos.y, 'player').setDepth(10);

    this.worldCam = this.cameras.main;
    this.worldCam.setBounds(0, 0, this.map.size * T, this.map.size * T);
    this.worldCam.setZoom(CONFIG.cameraZoom);
    this.worldCam.startFollow(this.player, true, 0.15, 0.15);

    this.joystick = new Joystick(this);
    this.hud = new Hud(this);

    // Gece karartması ve ışıklar: tek bir render texture'da. Dünya kamerası görmez.
    this.lightRT = this.add
      .renderTexture(0, 0, this.scale.width, this.scale.height)
      .setOrigin(0, 0)
      .setDepth(800);

    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCam.ignore([this.groundLayer, this.player, ...this.pieceImgs.values()]);
    this.worldCam.ignore([...this.joystick.getObjects(), ...this.hud.getObjects(), this.lightRT]);

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

  // Dokular, karakter ve yapı görselleri: çizim kodundan üretilir.
  private makeTextures(): void {
    const pc = this.textures.createCanvas('player', 32, 32);
    if (pc) {
      drawPlayer(pc.getContext(), 32);
      pc.refresh();
    }
    const bc = this.textures.createCanvas('bag', 32, 32);
    if (bc) {
      drawBag(bc.getContext(), 32);
      bc.refresh();
    }
    for (const kind of BUILD_ORDER) {
      const t = this.textures.createCanvas(`piece_${kind}`, TILE_PX, TILE_PX);
      if (t) {
        drawPiece(t.getContext(), kind, false);
        t.refresh();
      }
    }
    const open = this.textures.createCanvas('piece_door_open', TILE_PX, TILE_PX);
    if (open) {
      drawPiece(open.getContext(), 'door', true);
      open.refresh();
    }
    const lightSpecs: [string, number, number, number][] = [
      ['light_small', LIGHT_SMALL, PAL.cream, 1],
      ['light_big', LIGHT_BIG, PAL.cream, 1],
      ['light_warm', LIGHT_WARM, PAL.lamp, 0.35],
    ];
    for (const [key, size, color, alpha] of lightSpecs) {
      const lt = this.textures.createCanvas(key, size, size);
      if (lt) {
        drawLight(lt.getContext(), size, color, alpha);
        lt.refresh();
      }
    }
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
      const tx = Math.floor(this.pos.x / CONFIG.tileSize);
      const ty = Math.floor(this.pos.y / CONFIG.tileSize);
      const warm = this.structures.warm(tx, ty);
      this.vitals = tickVitals(this.vitals, dt, night, warm);
      if (isDead(this.vitals)) this.die();
      else this.tickPlayer(dt);
      this.pickUpBags();
    }

    this.updateLights();
    this.checkDay();

    const ptx = Math.floor(this.pos.x / CONFIG.tileSize);
    const pty = Math.floor(this.pos.y / CONFIG.tileSize);
    const storage = this.storageView();
    if (this.storageAt && !storage) {
      this.storageAt = null;
      this.panelOpen = false;
    }
    this.hud.update({
      storage,
      stations: {
        workbench: this.structures.nearKind('workbench', ptx, pty, STATION_TILES),
        furnace: this.structures.nearKind('furnace', ptx, pty, STATION_TILES),
      },
      inv: this.inv,
      selected: this.selected,
      panelOpen: this.panelOpen,
      message: this.message,
      vitals: this.vitals,
      dayText: `Gün ${dayNumber(this.clock)} · ${isNight(this.clock) ? 'Gece' : 'Gündüz'}`,
      dead: this.dead,
      respawnIn: this.respawnLeft,
      buildMode: this.buildMode,
      pieceIndex: this.pieceIndex,
    });
  }

  // Gece: karanlık katman, fener ve kamp ateşi ışığı ile delinir. Gündüz: temiz.
  private updateLights(): void {
    const night = isNight(this.clock) && !this.dead;
    if (!night) {
      if (this.lastLit) this.lightRT.clear();
      this.lastLit = false;
      return;
    }
    const cam = this.worldCam;
    const toScreen = (wx: number, wy: number) => ({
      x: (wx - cam.worldView.x) * cam.zoom,
      y: (wy - cam.worldView.y) * cam.zoom,
    });
    this.lightRT.clear();
    this.lightRT.fill(PAL.night, SURVIVAL.nightAlpha);

    const lantern = toScreen(this.pos.x, this.pos.y);
    this.lightRT.erase('light_small', lantern.x - LIGHT_SMALL / 2, lantern.y - LIGHT_SMALL / 2);

    for (const [i, p] of this.structures.entries()) {
      if (p.kind !== 'campfire') continue;
      const wx = ((i % this.map.size) + 0.5) * CONFIG.tileSize;
      const wy = (Math.floor(i / this.map.size) + 0.5) * CONFIG.tileSize;
      const s = toScreen(wx, wy);
      const flicker = 0.9 + 0.1 * Math.sin(this.clock * 7 + i);
      this.lightRT.erase('light_big', s.x - LIGHT_BIG / 2, s.y - LIGHT_BIG / 2);
      this.lightRT.draw('light_warm', s.x - LIGHT_WARM / 2, s.y - LIGHT_WARM / 2, flicker);
    }
    this.lastLit = true;
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
      (tx, ty) => isBlockedTile(this.map, tx, ty) || this.structures.blocks(tx, ty),
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
    this.tapStart = { x: p.x, y: p.y, id: p.id };
    this.joystick.tryStart(p.id, p.x, p.y, this.scale.width, this.scale.height);
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    this.joystick.move(p.id, p.x, p.y);
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    this.joystick.end(p.id);
    const t = this.tapStart;
    if (!t || t.id !== p.id) return;
    this.tapStart = null;
    // Kısa dokunuş (sürükleme değil) ve inşa modu: dünyada yerleştir/yık.
    if (this.buildMode && Math.hypot(p.x - t.x, p.y - t.y) < 12) this.buildAt(p.x, p.y);
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
      case 'withdraw':
        this.transferItem(act.id, true);
        break;
      case 'deposit':
        this.transferItem(act.id, false);
        break;
      case 'toggleBuild':
        this.buildMode = !this.buildMode;
        this.say(this.buildMode ? 'İnşa modu: dünyaya dokun' : 'İnşa modu kapandı');
        break;
      case 'piece': {
        this.pieceIndex = act.index;
        const def = PIECES[BUILD_ORDER[act.index]];
        this.say(`${def.name}: ${costText(def.cost)}`);
        break;
      }
    }
  }

  private select(i: number): void {
    this.selected = i;
  }

  private togglePanel(): void {
    this.panelOpen = !this.panelOpen;
    if (!this.panelOpen) this.storageAt = null;
  }

  // Açık sandık/çekirdek varsa paneline veri hazırlar.
  private storageView(): StorageView | null {
    if (!this.storageAt || !this.panelOpen) return null;
    const p = this.structures.at(this.storageAt.tx, this.storageAt.ty);
    if (!p?.storage) return null;
    const totals = (inv: Inventory) => {
      const m = new Map<ItemId, number>();
      for (const st of inv.slots) if (st) m.set(st.id, (m.get(st.id) ?? 0) + st.count);
      return [...m.entries()].map(([id, count]) => ({ id, count }));
    };
    const title = p.kind === 'core' ? 'Yetki çekirdeği' : 'Sandık';
    return { title, store: totals(p.storage), bag: totals(this.inv) };
  }

  // Gün değişince bakım: çekirdek yetmezse yapılar çürür.
  private checkDay(): void {
    const day = dayNumber(this.clock);
    if (day === this.lastDay) return;
    this.lastDay = day;
    const r = this.structures.tickDay();
    for (const [i, piece] of r.destroyed) {
      const tx = i % this.map.size;
      const ty = (i - tx) / this.map.size;
      this.removePieceImage(tx, ty);
      this.spill(tx, ty, piece);
    }
    if (this.storageAt && !this.structures.at(this.storageAt.tx, this.storageAt.ty)) this.storageAt = null;
    if (!r.upkeepPaid) {
      this.say(
        r.destroyed.length
          ? `Bakım yok! ${r.destroyed.length} yapı yıkıldı`
          : 'Bakım yok! Yapılar çürüyor',
      );
    } else {
      this.say('Çekirdek bakımı yapıldı');
    }
  }

  // Yıkılan yapının deposu yere dökülür (bir çanta olarak).
  private spill(tx: number, ty: number, piece: Piece): void {
    if (!piece.storage) return;
    const stacks = piece.storage.takeAll();
    if (stacks.length === 0) return;
    this.addBag({ x: (tx + 0.5) * CONFIG.tileSize, y: (ty + 0.5) * CONFIG.tileSize, stacks });
  }

  private addBag(bag: Bag): void {
    this.bags.push(bag);
    const img = this.add.image(bag.x, bag.y, 'bag').setDepth(8);
    this.uiCam.ignore(img);
    this.bagGfx.set(bag, img);
  }

  private heldItem(): ItemId | null {
    return this.inv.slots[this.selected]?.id ?? null;
  }

  private doAction(): void {
    if (this.cooldown > 0 || this.dead) return;
    const T = CONFIG.tileSize;
    const reach = CONFIG.reachTiles * T;
    const idx = findHarvestTarget(this.map, this.pos.x, this.pos.y, reach, T);
    if (idx === null) {
      // Kaynak yoksa yakındaki kapıyı aç/kapa.
      const door = this.nearestDoor(reach);
      if (door) {
        this.structures.toggleDoor(door.tx, door.ty);
        this.refreshPiece(door.tx, door.ty);
        this.say(this.structures.at(door.tx, door.ty)?.open ? 'Kapı açıldı' : 'Kapı kapandı');
        return;
      }
      const box = this.structures.storageNear(
        Math.floor(this.pos.x / T),
        Math.floor(this.pos.y / T),
        CONFIG.reachTiles + 0.5,
      );
      if (box) {
        this.storageAt = box;
        this.panelOpen = true;
        this.say('Sandık açık');
        return;
      }
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

  private nearestDoor(reach: number): { tx: number; ty: number } | null {
    const T = CONFIG.tileSize;
    let best: { tx: number; ty: number } | null = null;
    let bestD = Infinity;
    for (const [i, p] of this.structures.entries()) {
      if (p.kind !== 'door') continue;
      const tx = i % this.map.size;
      const ty = (i - tx) / this.map.size;
      const d = Math.hypot((tx + 0.5) * T - this.pos.x, (ty + 0.5) * T - this.pos.y);
      if (d <= reach && d < bestD) {
        bestD = d;
        best = { tx, ty };
      }
    }
    return best;
  }

  private craft(recipe: Recipe | undefined): void {
    if (!recipe) return;
    if (recipe.station) {
      const T = CONFIG.tileSize;
      const near = this.structures.nearKind(
        recipe.station,
        Math.floor(this.pos.x / T),
        Math.floor(this.pos.y / T),
        STATION_TILES,
      );
      if (!near) {
        this.say(`${STATION_TEXT[recipe.station]} yakında değil`);
        return;
      }
    }
    if (this.inv.craft(recipe)) this.say(`Üretildi: ${ITEMS[recipe.result].name}`);
    else if (!this.inv.canCraft(recipe)) this.say('Malzeme yetersiz');
    else this.say('Çanta dolu');
  }

  private transferItem(id: ItemId, fromStore: boolean): void {
    if (!this.storageAt) return;
    const p = this.structures.at(this.storageAt.tx, this.storageAt.ty);
    if (!p?.storage) return;
    const moved = fromStore
      ? Inventory.transfer(p.storage, this.inv, id)
      : Inventory.transfer(this.inv, p.storage, id);
    if (moved === 0) this.say('Yer yok');
    else this.say(`${moved} ${ITEMS[id].name} ${fromStore ? 'alındı' : 'konuldu'}`);
  }

  // İnşa modunda dünyaya dokunuş: boş kareye yerleştir, dolu kareyi (kendi yapını) yık.
  private buildAt(px: number, py: number): void {
    const T = CONFIG.tileSize;
    const w = this.worldCam.getWorldPoint(px, py);
    const tx = Math.floor(w.x / T);
    const ty = Math.floor(w.y / T);
    const reach = 3;
    const ptx = Math.floor(this.pos.x / T);
    const pty = Math.floor(this.pos.y / T);
    if (Math.hypot(tx - ptx, ty - pty) > reach) {
      this.say('Çok uzak');
      return;
    }

    const existing = this.structures.at(tx, ty);
    if (existing) {
      const def = PIECES[existing.kind];
      this.structures.remove(tx, ty);
      this.removePieceImage(tx, ty);
      this.spill(tx, ty, existing);
      if (this.storageAt && this.storageAt.tx === tx && this.storageAt.ty === ty) this.storageAt = null;
      for (const [id, n] of Object.entries(def.cost) as [ItemId, number][]) {
        if (!this.inv.add(id, n)) this.floatText(tx * T + T / 2, ty * T + T / 2, 'Çanta dolu');
      }
      this.say(`Yıkıldı: ${def.name}`);
      return;
    }

    const kind: PieceId = BUILD_ORDER[this.pieceIndex];
    const def = PIECES[kind];
    if (kind === 'core' && this.structures.hasCore()) {
      this.say('Zaten bir yetki çekirdeği var');
      return;
    }
    if (!(Object.entries(def.cost) as [ItemId, number][]).every(([id, n]) => this.inv.count(id) >= n)) {
      this.say('Malzeme yetersiz');
      return;
    }
    const reason = this.structures.canPlace(this.map, kind, tx, ty);
    if (reason) {
      this.say(REASON_TEXT[reason]);
      return;
    }
    if (def.blocks && tx === ptx && ty === pty) {
      this.say('Üstünde duruyorsun');
      return;
    }

    for (const [id, n] of Object.entries(def.cost) as [ItemId, number][]) this.inv.remove(id, n);
    this.structures.place(kind, tx, ty);
    this.addPieceImage(kind, tx, ty);
    this.say(`Yerleştirildi: ${def.name}`);
  }

  private addPieceImage(kind: PieceId, tx: number, ty: number): void {
    const T = CONFIG.tileSize;
    const img = this.add
      .image((tx + 0.5) * T, (ty + 0.5) * T, `piece_${kind}`)
      .setDepth(5);
    this.uiCam.ignore(img);
    this.pieceImgs.set(ty * this.map.size + tx, img);
  }

  private removePieceImage(tx: number, ty: number): void {
    const i = ty * this.map.size + tx;
    this.pieceImgs.get(i)?.destroy();
    this.pieceImgs.delete(i);
  }

  private refreshPiece(tx: number, ty: number): void {
    const p = this.structures.at(tx, ty);
    const img = this.pieceImgs.get(ty * this.map.size + tx);
    if (!p || !img) return;
    img.setTexture(p.kind === 'door' && p.open ? 'piece_door_open' : `piece_${p.kind}`);
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
    this.buildMode = false;
    this.joystick.cancel();
    const bag = dropBag(this.inv, this.pos.x, this.pos.y);
    if (bag) this.addBag(bag);
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

function costText(cost: Partial<Record<ItemId, number>>): string {
  return (Object.entries(cost) as [ItemId, number][]).map(([id, n]) => `${n} ${ITEMS[id].name}`).join(', ');
}
