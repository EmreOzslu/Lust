import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { stickVector } from '../sim/input';
import type { Vec2 } from '../sim/movement';

// Yüzen joystick: ekranın sol tarafına dokunulduğu yerde açılır, parmak kalkınca kapanır.
export class Joystick {
  private scene: Phaser.Scene;
  private base: Phaser.GameObjects.Graphics;
  private knob: Phaser.GameObjects.Graphics;
  private pointerId = -1;
  private originX = 0;
  private originY = 0;
  private knobX = 0;
  private knobY = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.base = scene.add.graphics().setDepth(1000).setVisible(false);
    this.knob = scene.add.graphics().setDepth(1001).setVisible(false);

    this.base.fillStyle(0x0b1a1f, 0.35);
    this.base.fillCircle(0, 0, CONFIG.joystickRadius);
    this.base.lineStyle(2, 0xe8d9a0, 0.5);
    this.base.strokeCircle(0, 0, CONFIG.joystickRadius);

    this.knob.fillStyle(0xe8d9a0, 0.6);
    this.knob.fillCircle(0, 0, CONFIG.joystickRadius * 0.4);

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
  }

  get active(): boolean {
    return this.pointerId !== -1;
  }

  getVector(): Vec2 {
    if (!this.active) return { x: 0, y: 0 };
    return stickVector(
      this.knobX - this.originX,
      this.knobY - this.originY,
      CONFIG.joystickRadius,
      CONFIG.joystickDeadzone,
    );
  }

  // Kamera ayrı bir UI kamerası kullanır; joystick sadece UI kamerasında görünür olmalı.
  getObjects(): Phaser.GameObjects.GameObject[] {
    return [this.base, this.knob];
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.active) return;
    const { width, height } = this.scene.scale;
    if (pointer.x > width * 0.6 || pointer.y < height * 0.25) return;

    this.pointerId = pointer.id;
    this.originX = pointer.x;
    this.originY = pointer.y;
    this.knobX = pointer.x;
    this.knobY = pointer.y;
    this.base.setPosition(this.originX, this.originY).setVisible(true);
    this.knob.setPosition(this.knobX, this.knobY).setVisible(true);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!this.active || pointer.id !== this.pointerId) return;
    const dx = pointer.x - this.originX;
    const dy = pointer.y - this.originY;
    const len = Math.hypot(dx, dy);
    const k = len > CONFIG.joystickRadius ? CONFIG.joystickRadius / len : 1;
    this.knobX = this.originX + dx * k;
    this.knobY = this.originY + dy * k;
    this.knob.setPosition(this.knobX, this.knobY);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (!this.active || pointer.id !== this.pointerId) return;
    this.pointerId = -1;
    this.base.setVisible(false);
    this.knob.setVisible(false);
  }
}
