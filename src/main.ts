import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';

// Dikey (portrait) kilitli, mobil odaklı 2D oyun.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b1a1f',
  width: 390,
  height: 844,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene],
});

export default game;
