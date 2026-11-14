import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { stickVector } from '../sim/input';
import type { Vec2 } from '../sim/movement';

// Yüzen joystick. Olaylar GameScene'den iletilir; HUD'a değen dokunuşlar buraya gelmez.
export class Joystick {
  private base: Phaser.GameObjects.Graphics;
  private knob: Phaser.GameObjects.Graphics;
  private pointerId = -1;
  private originX = 0;
  private originY = 0;
  private knobX = 0;
  private knobY = 0;

  constructor(scene: Phaser.Scene) {
    this.base = scene.add.graphics().setDepth(1000).setVisible(false);
    this.knob = scene.add.graphics().setDepth(1001).setVisible(false);

    this.base.fillStyle(0x0b1a1f, 0.35);
    this.base.fillCircle(0, 0, CONFIG.joystickRadius);
    this.base.lineStyle(2, 0xe8d9a0, 0.5);
    this.base.strokeCircle(0, 0, CONFIG.joystickRadius);

    this.knob.fillStyle(0xe8d9a0, 0.6);
    this.knob.fillCircle(0, 0, CONFIG.joystickRadius * 0.4);
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

  getObjects(): Phaser.GameObjects.GameObject[] {
    return [this.base, this.knob];
  }

  // Sol alan ve HUD'un üstü: sadece burada joystick açılır.
  tryStart(id: number, x: number, y: number, screenW: number, screenH: number): boolean {
    if (this.active) return false;
    if (x > screenW * 0.6 || y < screenH * 0.25 || y > screenH - CONFIG.hudReserve) return false;
    this.pointerId = id;
    this.originX = x;
    this.originY = y;
    this.knobX = x;
    this.knobY = y;
    this.base.setPosition(x, y).setVisible(true);
    this.knob.setPosition(x, y).setVisible(true);
    return true;
  }

  move(id: number, x: number, y: number): void {
    if (!this.active || id !== this.pointerId) return;
    const dx = x - this.originX;
    const dy = y - this.originY;
    const len = Math.hypot(dx, dy);
    const k = len > CONFIG.joystickRadius ? CONFIG.joystickRadius / len : 1;
    this.knobX = this.originX + dx * k;
    this.knobY = this.originY + dy * k;
    this.knob.setPosition(this.knobX, this.knobY);
  }

  end(id: number): void {
    if (!this.active || id !== this.pointerId) return;
    this.pointerId = -1;
    this.base.setVisible(false);
    this.knob.setVisible(false);
  }
}
