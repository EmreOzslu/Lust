import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { TILE_DEFS } from '../data/tiles';
import { generateWorld, isBlockedTile, type WorldMap } from '../sim/map';
import { moveCircle, type Vec2 } from '../sim/movement';
import { Joystick } from './Joystick';

export class GameScene extends Phaser.Scene {
  private map!: WorldMap;
  private pos: Vec2 = { x: 0, y: 0 };
  private player!: Phaser.GameObjects.Graphics;
  private joystick!: Joystick;
  private keys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
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

    // Dünya kamerası: zoom'lu, oyuncuyu takip eder.
    const worldCam = this.cameras.main;
    worldCam.setBounds(0, 0, this.map.size * T, this.map.size * T);
    worldCam.setZoom(CONFIG.cameraZoom);
    worldCam.startFollow(this.player, true, 0.15, 0.15);

    // UI kamerası: zoom'dan etkilenmeyen joystick katmanı.
    this.joystick = new Joystick(this);
    const uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    uiCam.ignore([ground, this.player]);
    worldCam.ignore(this.joystick.getObjects());

    const kb = this.input.keyboard;
    if (kb) {
      this.keys = kb.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
      }) as typeof this.keys;
    }
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
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

  // Joystick öncelikli; yoksa klavye (WASD) — masaüstünde test için.
  private readDirection(): Vec2 {
    if (this.joystick.active) return this.joystick.getVector();
    if (!this.keys) return { x: 0, y: 0 };
    const x = (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0);
    const y = (this.keys.down.isDown ? 1 : 0) - (this.keys.up.isDown ? 1 : 0);
    const len = Math.hypot(x, y);
    return len === 0 ? { x: 0, y: 0 } : { x: x / len, y: y / len };
  }

  // Harita tek piksel/tile olarak bir canvas dokusuna yazılır, nearest filtreyle büyütülür.
  private drawGround(): Phaser.GameObjects.Image {
    const size = this.map.size;
    const tex = this.textures.createCanvas('world', size, size);
    if (!tex) throw new Error('canvas texture oluşturulamadı');
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

    return this.add
      .image(0, 0, 'world')
      .setOrigin(0, 0)
      .setScale(CONFIG.tileSize);
  }
}
