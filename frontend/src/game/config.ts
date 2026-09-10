import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainFarmScene } from './scenes/MainFarmScene';

export function createPhaserConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#0d2b0d',
    scene: [BootScene, MainFarmScene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      pixelArt: false,
    },
    // Disable Phaser's default banner in console
    banner: false,
  };
}
