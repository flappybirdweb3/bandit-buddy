import Phaser from 'phaser';
import { eventBus } from '../EventBus';
import type { FarmData, FarmPlot, UserProfile } from '@/types/game.types';

const PLOT_SIZE = 96;
const PLOT_GAP = 12;
const COLS = 3;

interface PlotSprite {
  bg: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  timer: Phaser.GameObjects.Text;
  dog: Phaser.GameObjects.Image | null;
  ripeGlow: Phaser.Tweens.Tween | null;
  zone: Phaser.GameObjects.Zone;
}

export class MainFarmScene extends Phaser.Scene {
  private farmData: FarmData | null = null;
  private plotSprites: PlotSprite[] = [];
  private guardDogTween: Phaser.Tweens.Tween | null = null;
  private isOwnFarm = true;
  private visitingUserId: string | null = null;
  private visitingUsername: string | null = null;

  constructor() {
    super({ key: 'MainFarmScene' });
  }

  create() {
    const { width, height } = this.scale;

    // Sky gradient background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a4a1a, 0x1a4a1a, 0x2d6a2d, 0x2d6a2d, 1);
    bg.fillRect(0, 0, width, height);

    // Grass ground
    const ground = this.add.graphics();
    ground.fillStyle(0x388e3c, 1);
    ground.fillRect(0, height - 80, width, 80);
    ground.fillStyle(0x2e7d32, 1);
    ground.fillRect(0, height - 84, width, 8);

    // Farm sign
    this.farmSign = this.add.text(width / 2, 36, '🏡 My Farm', {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#1a4a1a', strokeThickness: 4,
    }).setOrigin(0.5);

    // Back button (when visiting friend's farm)
    this.backBtn = this.add.text(16, 16, '← Back', {
      fontSize: '14px', color: '#ffffff', backgroundColor: '#00000066',
      padding: { x: 8, y: 4 },
    }).setInteractive({ cursor: 'pointer' })
      .on('pointerdown', () => eventBus.emit('back-to-my-farm'))
      .setVisible(false);

    // Friends button
    this.add.text(width - 16, height - 20, '👥 Friends', {
      fontSize: '14px', color: '#fff', backgroundColor: '#2e7d3299',
      padding: { x: 10, y: 5 },
    }).setOrigin(1, 1)
      .setInteractive({ cursor: 'pointer' })
      .on('pointerdown', () => eventBus.emit('show-friends'));

    this.buildPlotGrid();

    // Subscribe to events from React
    const unsubFarm = eventBus.on('farm-updated', (data) => this.onFarmUpdated(data));
    const unsubProfile = eventBus.on('profile-updated', (p) => this.onProfileUpdated(p));
    const unsubVisit = eventBus.on('visit-farm', ({ userId, username }) => {
      this.visitFarm(userId, username);
    });
    const unsubBack = eventBus.on('back-to-my-farm', () => this.returnToOwnFarm());
    const unsubSteal = eventBus.on('steal-animation', ({ success, plotIndex }) => {
      this.playStealAnimation(plotIndex, success);
    });

    this.events.once('destroy', () => {
      unsubFarm(); unsubProfile(); unsubVisit(); unsubBack(); unsubSteal();
    });

    eventBus.emit('scene-ready', 'MainFarmScene');
  }

  private farmSign!: Phaser.GameObjects.Text;
  private backBtn!: Phaser.GameObjects.Text;

  private buildPlotGrid() {
    const { width, height } = this.scale;
    const rows = 2;
    const totalW = COLS * PLOT_SIZE + (COLS - 1) * PLOT_GAP;
    const totalH = rows * PLOT_SIZE + (rows - 1) * PLOT_GAP;
    const startX = (width - totalW) / 2;
    const startY = (height - totalH) / 2 + 10;

    this.plotSprites = [];

    for (let i = 0; i < 6; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = startX + col * (PLOT_SIZE + PLOT_GAP) + PLOT_SIZE / 2;
      const y = startY + row * (PLOT_SIZE + PLOT_GAP) + PLOT_SIZE / 2;

      const bg = this.add.image(x, y, 'plot-empty').setDisplaySize(PLOT_SIZE, PLOT_SIZE);

      const label = this.add.text(x, y + 28, '', {
        fontSize: '11px', color: '#ffffff',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5);

      const timer = this.add.text(x, y + 10, '', {
        fontSize: '13px', color: '#fff176',
        fontStyle: 'bold', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5);

      const zone = this.add.zone(x, y, PLOT_SIZE, PLOT_SIZE).setInteractive({ cursor: 'pointer' });
      zone.on('pointerdown', () => this.onPlotClick(i));
      zone.on('pointerover', () => bg.setTint(0xdddddd));
      zone.on('pointerout', () => bg.clearTint());

      this.plotSprites.push({ bg, label, timer, dog: null, ripeGlow: null, zone });
    }

    // Countdown updater
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: this.updateTimers,
      callbackScope: this,
    });
  }

  private onPlotClick(plotIndex: number) {
    const plot = this.farmData?.plots[plotIndex];
    if (!plot) return;

    let action: 'plant' | 'harvest' | 'steal' | 'locked' = 'locked';

    if (this.isOwnFarm) {
      if (plot.isEmpty) action = 'plant';
      else if (plot.isRipe) action = 'harvest';
      else action = 'locked';
    } else {
      if (!plot.isEmpty && plot.isRipe && plot.stealableRemaining > 0) {
        action = 'steal';
      } else {
        action = 'locked';
      }
    }

    eventBus.emit('plot-clicked', {
      plotId: plot.id,
      plotIndex,
      action,
      isOwnFarm: this.isOwnFarm,
    });
  }

  private onFarmUpdated(data: FarmData) {
    this.farmData = data;
    this.renderPlots();
  }

  private onProfileUpdated(_p: UserProfile) {}

  private renderPlots() {
    if (!this.farmData) return;

    this.farmData.plots.forEach((plot, i) => {
      const sprite = this.plotSprites[i];
      if (!sprite) return;

      // Pick texture
      let texture = 'plot-empty';
      if (!plot.isEmpty) {
        texture = plot.isRipe ? 'crop-ripe' : 'crop-growing';
      }
      sprite.bg.setTexture(texture);

      // Seed label
      sprite.label.setText(plot.seed?.name ?? '');

      // Ripe glow pulse
      if (sprite.ripeGlow) { sprite.ripeGlow.stop(); sprite.ripeGlow = null; }
      if (plot.isRipe && !plot.isEmpty) {
        sprite.ripeGlow = this.tweens.add({
          targets: sprite.bg,
          alpha: { from: 1, to: 0.7 },
          duration: 700,
          yoyo: true,
          repeat: -1,
        });
      } else {
        sprite.bg.setAlpha(1);
      }

      // Steal icon overlay for friend farms
      if (!this.isOwnFarm && plot.isRipe && plot.stealableRemaining > 0) {
        sprite.label.setText('⚡ Steal!').setColor('#ff5722');
      } else if (!this.isOwnFarm) {
        sprite.label.setColor('#ffffff');
      }

      // Update cursor
      sprite.zone.setInteractive({ cursor: this.getCursor(plot) });
    });
  }

  private getCursor(plot: FarmPlot): string {
    if (this.isOwnFarm) {
      if (plot.isEmpty) return 'pointer';
      if (plot.isRipe) return 'pointer';
      return 'default';
    }
    return (plot.isRipe && plot.stealableRemaining > 0) ? 'pointer' : 'default';
  }

  private updateTimers() {
    if (!this.farmData) return;
    const now = Date.now();

    this.farmData.plots.forEach((plot, i) => {
      const sprite = this.plotSprites[i];
      if (!sprite) return;

      if (plot.isEmpty || !plot.harvestableAt) {
        sprite.timer.setText('');
        return;
      }

      const remaining = new Date(plot.harvestableAt).getTime() - now;
      if (remaining <= 0) {
        sprite.timer.setText('Ready!').setColor('#76ff03');
        return;
      }

      const h = Math.floor(remaining / 3_600_000);
      const m = Math.floor((remaining % 3_600_000) / 60_000);
      const s = Math.floor((remaining % 60_000) / 1_000);

      if (h > 0) sprite.timer.setText(`${h}h ${m}m`);
      else if (m > 0) sprite.timer.setText(`${m}m ${s}s`);
      else sprite.timer.setText(`${s}s`);
      sprite.timer.setColor('#fff176');
    });
  }

  playStealAnimation(plotIndex: number, success: boolean) {
    const sprite = this.plotSprites[plotIndex];
    if (!sprite) return;

    if (success) {
      // Gold coin burst
      const emitter = this.add.particles(sprite.bg.x, sprite.bg.y, 'spark', {
        speed: { min: 60, max: 120 },
        lifespan: 600,
        scale: { start: 1.2, end: 0 },
        quantity: 12,
        tint: 0xffd700,
      });
      this.time.delayedCall(700, () => emitter.destroy());

      // Screen flash green
      const flash = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x76ff03, 0.15)
        .setOrigin(0);
      this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
    } else {
      // Dog bite - red flash + shake
      const emitter = this.add.particles(sprite.bg.x, sprite.bg.y, 'bite-particle', {
        speed: { min: 40, max: 100 },
        lifespan: 500,
        quantity: 8,
        tint: 0xff1744,
      });
      this.time.delayedCall(600, () => emitter.destroy());

      this.cameras.main.shake(400, 0.008);
      const flash = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xff1744, 0.2)
        .setOrigin(0);
      this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
    }
  }

  private visitFarm(userId: string, username: string) {
    this.isOwnFarm = false;
    this.visitingUserId = userId;
    this.visitingUsername = username;
    this.farmSign.setText(`🏠 ${username}'s Farm`);
    this.backBtn.setVisible(true);
  }

  private returnToOwnFarm() {
    this.isOwnFarm = true;
    this.visitingUserId = null;
    this.visitingUsername = null;
    this.farmSign.setText('🏡 My Farm');
    this.backBtn.setVisible(false);
  }
}
