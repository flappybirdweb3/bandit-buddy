import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    const { width, height } = this.scale;

    // Loading bar
    const barBg = this.add.rectangle(width / 2, height / 2, 300, 20, 0x333333);
    const bar = this.add.rectangle(width / 2 - 150, height / 2, 0, 16, 0x4caf50);
    bar.setOrigin(0, 0.5);

    this.add.text(width / 2, height / 2 - 40, '🥷 Bandit Buddy', {
      fontSize: '28px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.load.on('progress', (v: number) => { bar.width = 296 * v; });
    this.load.on('complete', () => { barBg.destroy(); bar.destroy(); });

    // Generate procedural textures (no external files needed)
    this.generateTextures();
  }

  create() {
    this.scene.start('MainFarmScene');
  }

  private generateTextures() {
    // Soil plot - empty
    const soilGfx = this.make.graphics({ x: 0, y: 0 });
    soilGfx.fillStyle(0x8b5e3c);
    soilGfx.fillRoundedRect(4, 4, 88, 88, 8);
    soilGfx.lineStyle(2, 0x6b3f1c);
    soilGfx.strokeRoundedRect(4, 4, 88, 88, 8);
    soilGfx.generateTexture('plot-empty', 96, 96);
    soilGfx.destroy();

    // Growing crop
    const growGfx = this.make.graphics({ x: 0, y: 0 });
    growGfx.fillStyle(0x8b5e3c);
    growGfx.fillRoundedRect(4, 4, 88, 88, 8);
    growGfx.fillStyle(0x4caf50);
    growGfx.fillTriangle(48, 20, 30, 60, 66, 60);
    growGfx.fillRect(44, 55, 8, 25);
    growGfx.generateTexture('crop-growing', 96, 96);
    growGfx.destroy();

    // Ripe crop (golden)
    const ripeGfx = this.make.graphics({ x: 0, y: 0 });
    ripeGfx.fillStyle(0x8b5e3c);
    ripeGfx.fillRoundedRect(4, 4, 88, 88, 8);
    ripeGfx.lineStyle(3, 0xffd700, 1);
    ripeGfx.strokeRoundedRect(4, 4, 88, 88, 8);
    ripeGfx.fillStyle(0xffc107);
    ripeGfx.fillTriangle(48, 16, 26, 62, 70, 62);
    ripeGfx.fillRect(44, 58, 8, 22);
    ripeGfx.fillStyle(0xffeb3b);
    ripeGfx.fillCircle(48, 14, 10);
    ripeGfx.generateTexture('crop-ripe', 96, 96);
    ripeGfx.destroy();

    // Guard dog
    const dogGfx = this.make.graphics({ x: 0, y: 0 });
    dogGfx.fillStyle(0xa0522d);
    dogGfx.fillEllipse(28, 26, 36, 28);   // body
    dogGfx.fillEllipse(46, 16, 20, 18);   // head
    dogGfx.fillStyle(0x8b4513);
    dogGfx.fillRect(12, 36, 8, 20);       // leg1
    dogGfx.fillRect(24, 36, 8, 20);       // leg2
    dogGfx.fillRect(36, 36, 8, 20);       // leg3
    dogGfx.fillRect(48, 36, 8, 20);       // leg4
    dogGfx.fillTriangle(44, 8, 50, 8, 47, 0); // ear
    dogGfx.fillStyle(0x000000);
    dogGfx.fillCircle(50, 14, 3);         // eye
    dogGfx.generateTexture('guard-dog', 64, 56);
    dogGfx.destroy();

    // Gold coin
    const coinGfx = this.make.graphics({ x: 0, y: 0 });
    coinGfx.fillStyle(0xffd700);
    coinGfx.fillCircle(16, 16, 14);
    coinGfx.fillStyle(0xffa000);
    coinGfx.fillCircle(16, 16, 10);
    coinGfx.generateTexture('coin', 32, 32);
    coinGfx.destroy();

    // Steal cursor
    const stealGfx = this.make.graphics({ x: 0, y: 0 });
    stealGfx.fillStyle(0xff5722, 0.9);
    stealGfx.fillCircle(20, 20, 18);
    stealGfx.lineStyle(3, 0xffffff);
    stealGfx.strokeCircle(20, 20, 18);
    stealGfx.generateTexture('steal-icon', 40, 40);
    stealGfx.destroy();

    // Particles
    const sparkGfx = this.make.graphics({ x: 0, y: 0 });
    sparkGfx.fillStyle(0xffd700);
    sparkGfx.fillCircle(4, 4, 4);
    sparkGfx.generateTexture('spark', 8, 8);
    sparkGfx.destroy();

    const bloodGfx = this.make.graphics({ x: 0, y: 0 });
    bloodGfx.fillStyle(0xff1744);
    bloodGfx.fillCircle(4, 4, 4);
    bloodGfx.generateTexture('bite-particle', 8, 8);
    bloodGfx.destroy();
  }
}
