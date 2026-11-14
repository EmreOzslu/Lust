import Phaser from 'phaser';

// M0: boş sahne. Dikey açıldığını ve render'ın çalıştığını doğrular.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2, 'LUST\nM0 iskelet çalışıyor', {
        fontFamily: 'sans-serif',
        fontSize: '28px',
        color: '#e8d9a0',
        align: 'center',
      })
      .setOrigin(0.5);
  }
}
