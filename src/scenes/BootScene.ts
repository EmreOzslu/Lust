import Phaser from 'phaser';

// Açılış sahnesi: asıl oyuna geçiş.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.scene.start('GameScene');
  }
}
