import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainFarmScene } from './scenes/MainFarmScene';

export function createPhaserConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  // On desktop the parent is the 430px frame, not the full viewport.
  // Read clientWidth/Height so Phaser initialises at the correct size.
  const w = parent.clientWidth  || window.innerWidth;
  const h = parent.clientHeight || window.innerHeight;
  return {
    type: Phaser.AUTO,
    parent,
    width: w,
    height: h,
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
