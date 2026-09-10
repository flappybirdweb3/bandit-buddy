import Phaser from 'phaser';
import { eventBus } from '../EventBus';
import type { FarmData, FarmPlot, UserProfile } from '@/types/game.types';

const PLOT_SIZE = 96;
const PLOT_GAP = 12;
const COLS = 3;
const PLOT_PRICES = [150, 300, 500, 800, 1200, 2000];
const MAX_PLOTS = 12;

interface PlotSprite {
  bg: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  timer: Phaser.GameObjects.Text;
  levelBadge: Phaser.GameObjects.Text;
  dog: Phaser.GameObjects.Image | null;
  ripeGlow: Phaser.Tweens.Tween | null;
  swayTween: Phaser.Tweens.Tween | null;
  zone: Phaser.GameObjects.Zone;
}

interface LockedSlot {
  bg: Phaser.GameObjects.Image;
  lock: Phaser.GameObjects.Text;
  price: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
}

export class MainFarmScene extends Phaser.Scene {
  private farmData: FarmData | null = null;
  private plotSprites: PlotSprite[] = [];
  private lockedSlot: LockedSlot | null = null;
  private guardDogTween: Phaser.Tweens.Tween | null = null;
  private isOwnFarm = true;
  private visitingUserId: string | null = null;
  private visitingUsername: string | null = null;
  private currentRenderKey = '';
  private farmFrameGfx: Phaser.GameObjects.Graphics | null = null;
  private guardDogSprite: Phaser.GameObjects.Image | null = null;
  private guardDogLabel: Phaser.GameObjects.Text | null = null;
  private activeTool: string = 'cursor';
  private uiBlocked = false;
  private sparkleCounter = 0;

  constructor() {
    super({ key: 'MainFarmScene' });
  }

  create() {
    // Rich illustrated farm background (drawn first, lowest z-order)
    this.drawBackground();

    // Farm sign
    this.farmSign = this.add.text(this.scale.width / 2, 36, '🏡 My Farm', {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#1a4a1a', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(25);

    // Back button (shown when visiting a friend)
    this.backBtn = this.add.text(16, 16, '← Back', {
      fontSize: '14px', color: '#ffffff', backgroundColor: '#00000066',
      padding: { x: 8, y: 4 },
    }).setInteractive({ cursor: 'pointer' })
      .on('pointerdown', () => { if (this.uiBlocked) return; eventBus.emit('back-to-my-farm'); })
      .setVisible(false)
      .setDepth(25);

    // 1-second countdown ticker (independent of grid rebuilds)
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: this.updateTimers,
      callbackScope: this,
    });

    // Placeholder grid while farm data loads
    this.rebuildGrid(6);

    // React ↔ Phaser event bridge
    const unsubFarm    = eventBus.on('farm-updated',    (data) => this.onFarmUpdated(data));
    const unsubProfile = eventBus.on('profile-updated', (p)    => this.onProfileUpdated(p));
    const unsubVisit   = eventBus.on('visit-farm',      ({ userId, username }) => this.visitFarm(userId, username));
    const unsubBack    = eventBus.on('back-to-my-farm', ()     => this.returnToOwnFarm());
    const unsubSteal   = eventBus.on('steal-animation',   ({ success, plotIndex }) =>
      this.playStealAnimation(plotIndex, success));
    const unsubPlant   = eventBus.on('plant-animation',   ({ plotIndex }) => this.playPlantAnimation(plotIndex));
    const unsubHarvest = eventBus.on('harvest-animation', ({ plotIndex, gold }) => this.playHarvestAnimation(plotIndex, gold));
    const unsubWater   = eventBus.on('water-animation',   ({ plotIndex }) => this.playWaterAnimation(plotIndex));
    const unsubDig     = eventBus.on('dig-animation',     ({ plotIndex }) => this.playDigAnimation(plotIndex));
    const unsubTool    = eventBus.on('tool-changed', (tool) => {
      this.activeTool = tool;
      this.renderPlots();
    });
    const unsubOverlay = eventBus.on('ui-overlay', (open) => { this.uiBlocked = open; });

    // Periodic gold sparkle on ripe plots (every 2s, one random plot)
    this.time.addEvent({
      delay: 2000,
      loop: true,
      callback: this.emitRipeSparkle,
      callbackScope: this,
    });

    this.events.once('destroy', () => {
      unsubFarm(); unsubProfile(); unsubVisit(); unsubBack();
      unsubSteal(); unsubPlant(); unsubHarvest(); unsubWater(); unsubDig();
      unsubTool(); unsubOverlay();
    });

    eventBus.emit('scene-ready', 'MainFarmScene');
  }

  private farmSign!: Phaser.GameObjects.Text;
  private backBtn!: Phaser.GameObjects.Text;

  // ─────────────────────────────────────────────────────────────
  //  Rich illustrated farm background
  // ─────────────────────────────────────────────────────────────
  private drawBackground() {
    const { width, height } = this.scale;
    const g = this.add.graphics().setDepth(0);

    // Sky gradient (top blue → horizon light-green)
    g.fillGradientStyle(0x4a90d9, 0x4a90d9, 0x87ceeb, 0x87ceeb, 1);
    g.fillRect(0, 0, width, height * 0.55);
    g.fillGradientStyle(0x87ceeb, 0x87ceeb, 0xc5e8c5, 0xc5e8c5, 1);
    g.fillRect(0, height * 0.55, width, height * 0.25);

    // ── Sun (upper-right) ──
    const sx = width - 52, sy = 46;
    g.fillStyle(0xfff9c4, 0.45);
    g.fillCircle(sx, sy, 27);
    g.fillStyle(0xffee58, 0.8);
    g.fillCircle(sx, sy, 21);
    g.fillStyle(0xffd600);
    g.fillCircle(sx, sy, 16);
    g.lineStyle(2, 0xfff176, 0.65);
    for (let r = 0; r < 8; r++) {
      const a = (r * Math.PI * 2) / 8;
      g.lineBetween(
        sx + Math.cos(a) * 29, sy + Math.sin(a) * 29,
        sx + Math.cos(a) * 40, sy + Math.sin(a) * 40,
      );
    }

    // ── Clouds ──
    const clouds = [
      { cx: 52,         cy: 50, s: 1.0  },
      { cx: 165,        cy: 33, s: 0.75 },
      { cx: width - 125, cy: 58, s: 0.85 },
    ];
    for (const c of clouds) {
      g.fillStyle(0xffffff, 0.88);
      g.fillEllipse(c.cx,               c.cy,           60 * c.s, 21 * c.s);
      g.fillEllipse(c.cx - 19 * c.s,    c.cy + 6 * c.s, 37 * c.s, 17 * c.s);
      g.fillEllipse(c.cx + 19 * c.s,    c.cy + 6 * c.s, 37 * c.s, 17 * c.s);
      g.fillEllipse(c.cx +  4 * c.s,    c.cy - 9 * c.s, 35 * c.s, 19 * c.s);
    }

    // ── Far hills ──
    g.fillStyle(0x93c493);
    g.fillPoints([
      { x: 0,           y: height * 0.58 },
      { x: width * 0.18, y: height * 0.40 },
      { x: width * 0.38, y: height * 0.47 },
      { x: width * 0.55, y: height * 0.36 },
      { x: width * 0.75, y: height * 0.44 },
      { x: width,       y: height * 0.38 },
      { x: width,       y: height       },
      { x: 0,           y: height       },
    ], true);

    // ── Mid hills ──
    g.fillStyle(0x5daa5d);
    g.fillPoints([
      { x: 0,            y: height * 0.67 },
      { x: width * 0.12, y: height * 0.54 },
      { x: width * 0.30, y: height * 0.60 },
      { x: width * 0.48, y: height * 0.50 },
      { x: width * 0.66, y: height * 0.57 },
      { x: width * 0.82, y: height * 0.52 },
      { x: width,        y: height * 0.56 },
      { x: width,        y: height       },
      { x: 0,            y: height       },
    ], true);

    // ── Near ground ──
    g.fillStyle(0x4caf50);
    g.fillRect(0, height * 0.72, width, height);
    g.fillStyle(0x33a048);
    g.fillRect(0, height * 0.72, width, 7);

    // ── Dirt path (center) ──
    g.fillStyle(0xc4a882);
    g.fillPoints([
      { x: width * 0.37, y: height      },
      { x: width * 0.63, y: height      },
      { x: width * 0.57, y: height * 0.73 },
      { x: width * 0.43, y: height * 0.73 },
    ], true);
    g.lineStyle(1, 0xb09070, 0.4);
    g.lineBetween(width * 0.44, height * 0.75, width * 0.47, height * 0.92);
    g.lineBetween(width * 0.56, height * 0.75, width * 0.53, height * 0.92);

    // ── Farmhouse (upper-left) ──
    const hx = 16, hy = height * 0.36;

    // Chimney + smoke
    g.fillStyle(0x78909c);
    g.fillRect(hx + 52, hy - 18, 14, 24);
    g.fillStyle(0x546e7a);
    g.fillRect(hx + 50, hy - 20, 18, 6);
    g.fillStyle(0xe0e0e0, 0.7);
    g.fillCircle(hx + 58, hy - 26, 5.5);
    g.fillStyle(0xeeeeee, 0.5);
    g.fillCircle(hx + 55, hy - 34, 4.5);
    g.fillStyle(0xf5f5f5, 0.35);
    g.fillCircle(hx + 60, hy - 41, 3.5);

    // House wall
    g.fillStyle(0xfff8e1);
    g.fillRect(hx, hy + 24, 78, 60);
    g.fillStyle(0xf0e8d0, 0.35);
    g.fillRect(hx + 40, hy + 24, 38, 60);

    // Roof
    g.fillStyle(0x5d4037);
    g.fillTriangle(hx - 6, hy + 28, hx + 39, hy + 2, hx + 84, hy + 28);
    g.fillStyle(0x6d4c41, 0.45);
    g.fillTriangle(hx - 6, hy + 28, hx + 39, hy + 8, hx + 39, hy + 28);
    g.lineStyle(1, 0x4e342e, 0.25);
    for (let ri = 1; ri < 5; ri++) {
      const ratio = ri / 5;
      const rly = hy + 28 - 26 * (1 - ratio);
      const rlw = 90 * ratio;
      g.lineBetween(hx + 39 - rlw / 2, rly, hx + 39 + rlw / 2, rly);
    }

    // Door
    g.fillStyle(0xc62828);
    g.fillRect(hx + 29, hy + 52, 20, 32);
    g.fillStyle(0xd32f2f);
    g.fillEllipse(hx + 39, hy + 52, 20, 13);
    g.lineStyle(1, 0x8b0000, 0.4);
    g.strokeRect(hx + 31, hy + 54, 16, 12);
    g.strokeRect(hx + 31, hy + 68, 16, 10);
    g.fillStyle(0xffc107);
    g.fillCircle(hx + 47, hy + 68, 2.5);

    // Left window
    g.fillStyle(0x90caf9);
    g.fillRect(hx + 6, hy + 34, 22, 18);
    g.fillStyle(0xbbdefb, 0.5);
    g.fillRect(hx + 7, hy + 35, 9, 8);
    g.lineStyle(1.5, 0xffffff, 0.8);
    g.lineBetween(hx + 17, hy + 34, hx + 17, hy + 52);
    g.lineBetween(hx + 6,  hy + 43, hx + 28, hy + 43);
    g.lineStyle(2, 0x8d6e63);
    g.strokeRect(hx + 6, hy + 34, 22, 18);

    // Right window
    g.fillStyle(0x90caf9);
    g.fillRect(hx + 50, hy + 34, 22, 18);
    g.fillStyle(0xbbdefb, 0.5);
    g.fillRect(hx + 51, hy + 35, 9, 8);
    g.lineStyle(1.5, 0xffffff, 0.8);
    g.lineBetween(hx + 61, hy + 34, hx + 61, hy + 52);
    g.lineBetween(hx + 50, hy + 43, hx + 72, hy + 43);
    g.lineStyle(2, 0x8d6e63);
    g.strokeRect(hx + 50, hy + 34, 22, 18);

    // Flower boxes
    g.fillStyle(0x6d4c41);
    g.fillRect(hx + 4,  hy + 52, 26, 6);
    g.fillRect(hx + 48, hy + 52, 26, 6);
    const fclrs = [0xff4081, 0xff80ab, 0xf50057, 0xfce4ec];
    [hx + 8, hx + 14, hx + 20, hx + 26].forEach((fx, i) => {
      g.fillStyle(fclrs[i % 4]); g.fillCircle(fx, hy + 50, 3.5);
    });
    [hx + 52, hx + 58, hx + 64, hx + 70].forEach((fx, i) => {
      g.fillStyle(fclrs[(i + 1) % 4]); g.fillCircle(fx, hy + 50, 3.5);
    });
    g.lineStyle(1.5, 0xd7ccc8);
    g.strokeRect(hx, hy + 24, 78, 60);

    // ── Trees (right side) ──
    for (const { tx, ty } of [
      { tx: width - 46, ty: height * 0.44 },
      { tx: width - 18, ty: height * 0.50 },
    ]) {
      g.fillStyle(0x5d4037);
      g.fillRect(tx - 6, ty, 12, 30);
      g.fillStyle(0x795548);
      g.fillRect(tx - 4, ty, 7, 30);
      const canopy = [
        { dy: 7,   w: 42, h: 24, c: 0x2e7d32 },
        { dy: -5,  w: 35, h: 21, c: 0x388e3c },
        { dy: -18, w: 27, h: 18, c: 0x43a047 },
        { dy: -29, w: 19, h: 14, c: 0x66bb6a },
      ];
      for (const l of canopy) {
        g.fillStyle(l.c);
        g.fillEllipse(tx, ty + l.dy, l.w, l.h);
      }
      g.fillStyle(0xf44336);
      g.fillCircle(tx - 10, ty - 4, 3.5);
      g.fillCircle(tx + 8,  ty - 13, 3.5);
      g.fillCircle(tx - 3,  ty - 24, 3);
    }

    // ── Fence ──
    const fenceY = height * 0.73;
    // Posts first (so rails draw over them)
    for (let fpx = 2; fpx < width + 10; fpx += 32) {
      g.fillStyle(0xbcaaa4);
      g.fillRect(fpx - 3, fenceY - 35, 7, 42);
      g.fillStyle(0xd7ccc8);
      g.fillTriangle(fpx - 3, fenceY - 35, fpx + 4, fenceY - 35, fpx, fenceY - 43);
    }
    // Rails
    g.fillStyle(0xd7ccc8);
    g.fillRect(0, fenceY - 28, width, 5);
    g.fillRect(0, fenceY - 14, width, 5);
    g.lineStyle(1, 0xffffff, 0.22);
    g.lineBetween(0, fenceY - 28, width, fenceY - 28);
    g.lineBetween(0, fenceY - 14, width, fenceY - 14);
  }

  // ─────────────────────────────────────────────────────────────
  //  Wooden frame border around the farm grid
  // ─────────────────────────────────────────────────────────────
  private drawFarmFrame(startX: number, startY: number, totalW: number, totalH: number) {
    this.farmFrameGfx?.destroy();
    this.farmFrameGfx = null;

    const pad = 11, t = 11; // padding & thickness
    const fx = startX - pad;
    const fy = startY - pad;
    const fw = totalW + pad * 2;
    const fh = totalH + pad * 2;

    const g = this.add.graphics().setDepth(5);

    const drawBar = (x: number, y: number, w: number, h: number) => {
      const horiz = w > h;
      // Drop shadow
      g.fillStyle(0x2a1200, 0.5);
      g.fillRect(x + 2, y + 2, w, h);
      // Dark edge
      g.fillStyle(0x5c3200);
      g.fillRect(x, y, w, h);
      // Main wood face
      g.fillStyle(0x9a6a14);
      g.fillRect(x, y, w - 1, h - 1);
      // Highlight strip
      g.fillStyle(0xc8a040, 0.65);
      if (horiz) {
        g.fillRect(x, y, w - 1, 2);
        g.fillRect(x, y + h - 3, w - 1, 2);
      } else {
        g.fillRect(x, y, 2, h - 1);
        g.fillRect(x + w - 3, y, 2, h - 1);
      }
      // Wood grain
      g.lineStyle(1, 0x7a5000, 0.3);
      if (horiz) {
        for (let gx = x + 6; gx < x + w - 6; gx += 16) {
          g.lineBetween(gx, y + 2, gx + 7, y + h - 2);
        }
      } else {
        for (let gy = y + 6; gy < y + h - 6; gy += 16) {
          g.lineBetween(x + 2, gy, x + t - 2, gy + 5);
        }
      }
    };

    drawBar(fx,          fy,          fw,         t );  // top
    drawBar(fx,          fy + fh - t, fw,         t );  // bottom
    drawBar(fx,          fy + t,      t,  fh - t * 2);  // left
    drawBar(fx + fw - t, fy + t,      t,  fh - t * 2);  // right

    // Corner blocks with decorative knot
    for (const [cx, cy] of [
      [fx,          fy         ],
      [fx + fw - t, fy         ],
      [fx,          fy + fh - t],
      [fx + fw - t, fy + fh - t],
    ] as [number, number][]) {
      g.fillStyle(0x5c3200);
      g.fillRect(cx, cy, t, t);
      g.fillStyle(0x8b6914);
      g.fillRect(cx + 1, cy + 1, t - 2, t - 2);
      g.fillStyle(0x3d2000);
      g.fillCircle(cx + t / 2, cy + t / 2, 3.5);
      g.fillStyle(0x6b4400);
      g.fillCircle(cx + t / 2, cy + t / 2, 2.2);
    }

    this.farmFrameGfx = g;
  }

  // ─────────────────────────────────────────────────────────────
  //  Grid build / rebuild
  // ─────────────────────────────────────────────────────────────
  private getNextPlotCost(count: number): number | null {
    if (!this.isOwnFarm) return null;
    if (count >= MAX_PLOTS) return null;
    const idx = count - 6;
    return idx >= 0 ? (PLOT_PRICES[idx] ?? null) : null;
  }

  private rebuildGrid(plotCount: number) {
    const renderKey = `${plotCount}-${this.isOwnFarm}`;
    if (renderKey === this.currentRenderKey) return;
    this.currentRenderKey = renderKey;

    // Destroy existing plot sprites
    this.plotSprites.forEach((s) => {
      s.ripeGlow?.stop();
      s.swayTween?.stop();
      s.bg.destroy(); s.label.destroy(); s.timer.destroy();
      s.levelBadge.destroy(); s.dog?.destroy(); s.zone.destroy();
    });
    this.plotSprites = [];

    // Destroy locked slot
    if (this.lockedSlot) {
      this.lockedSlot.bg.destroy();
      this.lockedSlot.lock.destroy();
      this.lockedSlot.price.destroy();
      this.lockedSlot.zone.destroy();
      this.lockedSlot = null;
    }

    const nextCost   = this.getNextPlotCost(plotCount);
    const totalSlots = plotCount + (nextCost !== null ? 1 : 0);
    const rows       = Math.max(2, Math.ceil(totalSlots / COLS));
    const { width, height } = this.scale;
    const totalW = COLS * PLOT_SIZE + (COLS - 1) * PLOT_GAP;
    const totalH = rows * PLOT_SIZE + (rows - 1) * PLOT_GAP;
    const startX = (width - totalW) / 2;
    const startY = (height - totalH) / 2 + 10;

    // Wooden frame around the grid
    this.drawFarmFrame(startX, startY, totalW, totalH);

    // Active plot tiles
    for (let i = 0; i < plotCount; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x   = startX + col * (PLOT_SIZE + PLOT_GAP) + PLOT_SIZE / 2;
      const y   = startY + row * (PLOT_SIZE + PLOT_GAP) + PLOT_SIZE / 2;

      const bg = this.add.image(x, y, 'plot-empty')
        .setDisplaySize(PLOT_SIZE, PLOT_SIZE)
        .setDepth(10);

      const label = this.add.text(x, y + 28, '', {
        fontSize: '11px', color: '#ffffff',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(12);

      const timer = this.add.text(x, y + 10, '', {
        fontSize: '13px', color: '#fff176',
        fontStyle: 'bold', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(12);

      const levelBadge = this.add.text(
        x - PLOT_SIZE / 2 + 4, y - PLOT_SIZE / 2 + 4, '', {
          fontSize: '11px', color: '#ffd700', fontStyle: 'bold',
          stroke: '#000', strokeThickness: 2,
        },
      ).setOrigin(0, 0).setDepth(12);

      const zone = this.add.zone(x, y, PLOT_SIZE, PLOT_SIZE)
        .setInteractive({ cursor: 'pointer' })
        .setDepth(13);
      zone.on('pointerdown', () => this.onPlotClick(i));
      zone.on('pointerover', () => { bg.setAlpha(0.78); });
      zone.on('pointerout',  () => { bg.setAlpha(1); this.applyPlotTint(i); });

      this.plotSprites.push({ bg, label, timer, levelBadge, dog: null, ripeGlow: null, swayTween: null, zone });
    }

    // Locked "buy next plot" slot
    if (nextCost !== null) {
      const i   = plotCount;
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x   = startX + col * (PLOT_SIZE + PLOT_GAP) + PLOT_SIZE / 2;
      const y   = startY + row * (PLOT_SIZE + PLOT_GAP) + PLOT_SIZE / 2;

      const lockedBg = this.add.image(x, y, 'plot-empty')
        .setDisplaySize(PLOT_SIZE, PLOT_SIZE)
        .setAlpha(0.35)
        .setTint(0x222222)
        .setDepth(10);

      const lock = this.add.text(x, y - 12, '🔒', { fontSize: '24px' })
        .setOrigin(0.5).setDepth(12);

      const price = this.add.text(x, y + 18, `${nextCost}G`, {
        fontSize: '13px', color: '#ffd700', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(12);

      const zone = this.add.zone(x, y, PLOT_SIZE, PLOT_SIZE)
        .setInteractive({ cursor: 'pointer' })
        .setDepth(13);
      zone.on('pointerdown', () => { if (this.uiBlocked) return; eventBus.emit('buy-plot', { cost: nextCost }); });
      zone.on('pointerover', () => { lockedBg.setAlpha(0.6); lockedBg.clearTint(); });
      zone.on('pointerout',  () => { lockedBg.setAlpha(0.35); lockedBg.setTint(0x222222); });

      this.lockedSlot = { bg: lockedBg, lock, price, zone };
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Plot interaction
  // ─────────────────────────────────────────────────────────────
  private onPlotClick(plotIndex: number) {
    if (this.uiBlocked) return;
    const plot = this.farmData?.plots[plotIndex];
    if (!plot) return;

    // Tool-specific behaviour on own farm
    if (this.isOwnFarm) {
      if (this.activeTool === 'dig') {
        if (!plot.isEmpty) {
          eventBus.emit('plot-tool-action', { tool: 'dig', plotId: plot.id, plotIndex });
        }
        return;
      }
      if (this.activeTool === 'water') {
        if (!plot.isEmpty && !plot.isRipe) {
          eventBus.emit('plot-tool-action', { tool: 'water', plotId: plot.id, plotIndex });
        } else if (plot.isRipe) {
          eventBus.emit('show-toast', { message: 'Crop is ripe — harvest it!', type: 'info' });
        }
        return;
      }
      if (this.activeTool === 'spray') {
        if (!plot.isEmpty && plot.hasBugs) {
          eventBus.emit('plot-tool-action', { tool: 'bug-spray', plotId: plot.id, plotIndex });
        } else if (!plot.isEmpty && !plot.isRipe) {
          // Open tier-selection modal for fertilizer
          eventBus.emit('fertilizer-select', { plotId: plot.id, plotIndex });
        }
        return;
      }
      if (this.activeTool === 'weed-kill') {
        if (!plot.isEmpty && plot.hasWeeds) {
          eventBus.emit('plot-tool-action', { tool: 'weed-kill', plotId: plot.id, plotIndex });
        }
        return;
      }
    }

    // Default cursor / seed / steal behaviour
    let action: 'plant' | 'harvest' | 'steal' | 'attack' | 'locked' | 'upgrade' = 'locked';
    if (this.isOwnFarm) {
      if (plot.isEmpty)        action = 'plant';
      else if (plot.isRipe)    action = 'harvest';
      else                     action = 'upgrade';
    } else {
      if (!plot.isEmpty && plot.isRipe && plot.stealableRemaining > 0) {
        action = 'steal';
      } else if (!plot.isEmpty) {
        action = 'attack';
      }
    }
    eventBus.emit('plot-clicked', { plotId: plot.id, plotIndex, action, isOwnFarm: this.isOwnFarm });
  }

  // Resolve tint for a plot based on active tool
  private applyPlotTint(plotIndex: number) {
    const sprite = this.plotSprites[plotIndex];
    const plot   = this.farmData?.plots[plotIndex];
    if (!sprite || !plot) return;

    let tint: number | null = null;

    if (this.isOwnFarm) {
      switch (this.activeTool) {
        case 'dig':
          tint = !plot.isEmpty ? 0xff8833 : null;
          break;
        case 'seed':
          tint = plot.isEmpty ? 0x66ff66 : null;
          break;
        case 'water':
          // Bright blue on dry soil plots, dim blue on moist/growing plots
          tint = (!plot.isEmpty && !plot.isRipe && plot.hasDrySoil) ? 0x44aaff
               : (!plot.isEmpty && !plot.isRipe)                    ? 0x8888cc
               : null;
          break;
        case 'spray':
          tint = (!plot.isEmpty && plot.hasBugs)            ? 0xff4444  // has bugs → red (spray bugs)
               : (!plot.isEmpty && !plot.isRipe && plot.fertilized) ? 0xccff44  // fertilized, can add more
               : (!plot.isEmpty && !plot.isRipe)            ? 0x88ff44  // unfertilized → lime (fertilize)
               : null;
          break;
        case 'weed-kill':
          tint = (!plot.isEmpty && plot.hasWeeds) ? 0x88ff44  // has weeds → green highlight
               : null;
          break;
      }
    } else if (this.activeTool === 'steal' || this.activeTool === 'cursor') {
      tint = (!plot.isEmpty && plot.isRipe && plot.stealableRemaining > 0) ? 0xff4444 : null;
    }

    if (tint !== null) sprite.bg.setTint(tint);
    else sprite.bg.clearTint();
  }

  // ─────────────────────────────────────────────────────────────
  //  Farm data handlers
  // ─────────────────────────────────────────────────────────────
  private onFarmUpdated(data: FarmData) {
    this.farmData = data;
    this.rebuildGrid(data.plots.length);
    this.renderPlots();
    this.renderGuardDog(data.hasGuardDog, data.guardDogType);
  }

  private renderGuardDog(hasGuardDog: boolean, dogType: string | null) {
    // Remove existing dog
    if (this.guardDogSprite) { this.guardDogSprite.destroy(); this.guardDogSprite = null; }
    if (this.guardDogLabel)  { this.guardDogLabel.destroy();  this.guardDogLabel  = null; }
    if (this.guardDogTween)  { this.guardDogTween.stop();     this.guardDogTween  = null; }

    if (!hasGuardDog) return;

    // Position: bottom-right corner of the farm grid
    const cols = 3;
    const rows = Math.max(2, Math.ceil(this.farmData!.plots.length / cols));
    const totalW = cols * PLOT_SIZE + (cols - 1) * PLOT_GAP;
    const totalH = rows * PLOT_SIZE + (rows - 1) * PLOT_GAP;
    const { width, height } = this.scale;
    const startX = (width - totalW) / 2;
    const startY = (height - totalH) / 2 + 10;

    const dogX = startX + totalW + 10 + 37;
    const dogY = startY + totalH - 30;

    this.guardDogSprite = this.add.image(dogX, dogY, 'guard-dog')
      .setDisplaySize(74, 62)
      .setDepth(12);

    const PET_LABEL: Record<string, string> = {
      dog_stray: '🐶 Stray', dog_beagle: '🐕 Beagle', dog_husky: '🐺 Husky',
      dog_shepherd: '🦮 Shepherd', elephant: '🐘 Elephant',
      guard_pup: '🐕 Pup', guard_hound: '🐺 Hound',
    };
    const labelText = PET_LABEL[dogType ?? ''] ?? '🐕 Guard';
    this.guardDogLabel = this.add.text(dogX, dogY + 36, labelText, {
      fontSize: '11px', color: '#ffd700',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(12);

    // Gentle bob animation
    this.guardDogTween = this.tweens.add({
      targets: [this.guardDogSprite, this.guardDogLabel],
      y: { value: '+=5' },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private onProfileUpdated(_p: UserProfile) {}

  // ─────────────────────────────────────────────────────────────
  //  Render / update plot sprites
  // ─────────────────────────────────────────────────────────────
  private renderPlots() {
    if (!this.farmData) return;

    this.farmData.plots.forEach((plot, i) => {
      const sprite = this.plotSprites[i];
      if (!sprite) return;

      // Seed-specific texture for ripe crops
      let texture = 'plot-empty';
      if (!plot.isEmpty) {
        if (plot.isRipe) {
          const key = `crop-${plot.seed?.iconKey ?? 'wheat'}`;
          texture = this.textures.exists(key) ? key : 'crop-ripe';
        } else {
          texture = 'crop-growing';
        }
      }
      sprite.bg.setTexture(texture);

      // Label
      sprite.label.setText(plot.seed?.name ?? '');

      // Level badge (★ for levels 2+)
      const level = plot.level ?? 1;
      sprite.levelBadge.setText(level > 1 ? '★'.repeat(level - 1) : '');

      // Ripe glow pulse
      if (sprite.ripeGlow) { sprite.ripeGlow.stop(); sprite.ripeGlow = null; }
      if (plot.isRipe && !plot.isEmpty) {
        sprite.ripeGlow = this.tweens.add({
          targets: sprite.bg,
          alpha: { from: 1, to: 0.75 },
          duration: 700,
          yoyo: true,
          repeat: -1,
        });
      } else {
        sprite.bg.setAlpha(1);
      }

      // Growing sway animation (leaves swaying in the wind)
      if (sprite.swayTween) { sprite.swayTween.stop(); sprite.swayTween = null; sprite.bg.setAngle(0); }
      if (!plot.isEmpty && !plot.isRipe) {
        sprite.swayTween = this.tweens.add({
          targets: sprite.bg,
          angle: { from: -1.2, to: 1.2 },
          duration: 1400 + i * 180,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      // Steal mode label
      if (!this.isOwnFarm && plot.isRipe && plot.stealableRemaining > 0) {
        sprite.label.setText('⚡ Steal!').setColor('#ff5722');
      } else if (!this.isOwnFarm) {
        sprite.label.setColor('#ffffff');
      }

      // Fertilized indicator
      if (plot.fertilized && !plot.isEmpty) {
        sprite.label.setText((sprite.label.text || plot.seed?.name || '') + ' 🌿');
      }

      // Dry soil indicator (show even before infestation coloring)
      if (!plot.isEmpty && plot.hasDrySoil && !plot.isRipe) {
        sprite.label.setText((sprite.label.text || plot.seed?.name || '') + ' 💧');
        if (!plot.hasBugs && !plot.hasWeeds) sprite.label.setColor('#88ccff');
      }

      // Infestation indicators (bugs / weeds)
      if (!plot.isEmpty) {
        let infestLabel = sprite.label.text;
        if (plot.hasBugs)  infestLabel += ' 🐛';
        if (plot.hasWeeds) infestLabel += ' 🌾';
        if (plot.hasBugs || plot.hasWeeds) sprite.label.setText(infestLabel).setColor('#ff4444');
      }

      this.applyPlotTint(i);
      sprite.zone.setInteractive({ cursor: this.getCursor(plot) });
    });
  }

  private getCursor(plot: FarmPlot): string {
    if (this.isOwnFarm) return 'pointer';
    // On neighbor farm: pointer if ripe (steal) or has a crop (attack)
    return (!plot.isEmpty) ? 'pointer' : 'default';
  }

  // ─────────────────────────────────────────────────────────────
  //  Countdown timers (runs every second)
  // ─────────────────────────────────────────────────────────────
  private updateTimers() {
    if (!this.farmData) return;
    const now = Date.now();

    this.farmData.plots.forEach((plot, i) => {
      const sprite = this.plotSprites[i];
      if (!sprite) return;

      if (plot.isEmpty || !plot.harvestableAt) { sprite.timer.setText(''); return; }

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

  // ─────────────────────────────────────────────────────────────
  //  Steal animation
  // ─────────────────────────────────────────────────────────────
  playStealAnimation(plotIndex: number, success: boolean) {
    const sprite = this.plotSprites[plotIndex];
    if (!sprite) return;

    if (success) {
      const emitter = this.add.particles(sprite.bg.x, sprite.bg.y, 'spark', {
        speed: { min: 60, max: 120 },
        lifespan: 600,
        scale: { start: 1.2, end: 0 },
        quantity: 12,
        tint: 0xffd700,
      }).setDepth(20);
      this.time.delayedCall(700, () => emitter.destroy());

      const flash = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x76ff03, 0.15).setOrigin(0);
      this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
    } else {
      const emitter = this.add.particles(sprite.bg.x, sprite.bg.y, 'bite-particle', {
        speed: { min: 40, max: 100 },
        lifespan: 500,
        quantity: 8,
        tint: 0xff1744,
      }).setDepth(20);
      this.time.delayedCall(600, () => emitter.destroy());

      this.cameras.main.shake(400, 0.008);
      const flash = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xff1744, 0.2).setOrigin(0);
      this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Crop animations
  // ─────────────────────────────────────────────────────────────
  playPlantAnimation(plotIndex: number) {
    const sprite = this.plotSprites[plotIndex];
    if (!sprite) return;
    const { x, y } = sprite.bg;

    // Soil puff burst
    const soil = this.add.particles(x, y + 10, 'soil-particle', {
      speed: { min: 50, max: 110 },
      angle: { min: -155, max: -25 },
      scale: { start: 1, end: 0 },
      lifespan: 480,
      quantity: 10,
      gravityY: 350,
    }).setDepth(20);
    this.time.delayedCall(550, () => soil.destroy());

    // Seedling emoji floating up
    const sprout = this.add.text(x, y - 10, '🌱', { fontSize: '22px' })
      .setOrigin(0.5).setDepth(22);
    this.tweens.add({
      targets: sprout,
      y: y - 60,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.Out',
      onComplete: () => sprout.destroy(),
    });
  }

  playHarvestAnimation(plotIndex: number, gold: number) {
    const sprite = this.plotSprites[plotIndex];
    if (!sprite) return;
    const { x, y } = sprite.bg;

    // Gold coin particles flying up
    const coins = this.add.particles(x, y, 'spark', {
      speed: { min: 80, max: 160 },
      angle: { min: -130, max: -50 },
      scale: { start: 1.4, end: 0 },
      lifespan: 800,
      quantity: 8,
      gravityY: 180,
      tint: 0xffd700,
    }).setDepth(20);
    this.time.delayedCall(900, () => coins.destroy());

    // "+XXG" floating text
    const popup = this.add.text(x, y - 15, `+${Math.round(gold)}G`, {
      fontSize: '20px', color: '#ffd700', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(25);
    this.tweens.add({
      targets: popup,
      y: y - 75,
      alpha: 0,
      duration: 1300,
      ease: 'Cubic.Out',
      onComplete: () => popup.destroy(),
    });

    // Brief golden screen glow
    const flash = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xffd700, 0.12).setOrigin(0).setDepth(19);
    this.tweens.add({ targets: flash, alpha: 0, duration: 450, onComplete: () => flash.destroy() });

    // Subtle camera pulse
    this.cameras.main.shake(250, 0.004);
  }

  playWaterAnimation(plotIndex: number) {
    const sprite = this.plotSprites[plotIndex];
    if (!sprite) return;
    const { x, y } = sprite.bg;

    // Expanding water rings
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 110, () => {
        const ring = this.add.image(x, y, 'water-ring')
          .setScale(0.4).setAlpha(0.85).setDepth(21);
        this.tweens.add({
          targets: ring,
          scaleX: 3.8, scaleY: 3.8,
          alpha: 0,
          duration: 550,
          ease: 'Cubic.Out',
          onComplete: () => ring.destroy(),
        });
      });
    }

    // Water drop particles
    const drops = this.add.particles(x, y - 15, 'water-drop', {
      speed: { min: 40, max: 100 },
      angle: { min: -130, max: -50 },
      scale: { start: 0.9, end: 0 },
      lifespan: 450,
      quantity: 6,
      gravityY: 320,
    }).setDepth(20);
    this.time.delayedCall(550, () => drops.destroy());
  }

  playDigAnimation(plotIndex: number) {
    const sprite = this.plotSprites[plotIndex];
    if (!sprite) return;
    const { x, y } = sprite.bg;

    const soil = this.add.particles(x, y + 5, 'soil-particle', {
      speed: { min: 70, max: 150 },
      angle: { min: -160, max: -20 },
      scale: { start: 1.3, end: 0 },
      lifespan: 550,
      quantity: 14,
      gravityY: 400,
    }).setDepth(20);
    this.time.delayedCall(650, () => soil.destroy());
    this.cameras.main.shake(200, 0.006);
  }

  private emitRipeSparkle() {
    if (!this.farmData) return;
    const ripePlots = this.farmData.plots
      .map((p, i) => i)
      .filter((i) => {
        const p = this.farmData!.plots[i];
        return p.isRipe && !p.isEmpty;
      });
    if (ripePlots.length === 0) return;

    // Pick one random ripe plot per tick
    const idx = ripePlots[Math.floor(Math.random() * ripePlots.length)];
    const sprite = this.plotSprites[idx];
    if (!sprite) return;
    const { x, y } = sprite.bg;

    const emitter = this.add.particles(x, y - 15, 'spark', {
      speed: { min: 25, max: 65 },
      angle: { min: -130, max: -50 },
      scale: { start: 0.7, end: 0 },
      lifespan: 550,
      quantity: 4,
      gravityY: 80,
    }).setDepth(20);
    this.time.delayedCall(650, () => emitter.destroy());
  }

  // ─────────────────────────────────────────────────────────────
  //  Visit / return
  // ─────────────────────────────────────────────────────────────
  private visitFarm(userId: string, username: string) {
    this.isOwnFarm = false;
    this.visitingUserId = userId;
    this.visitingUsername = username;
    this.farmSign.setText(`🏠 ${username}'s Farm`);
    this.backBtn.setVisible(true);
    this.currentRenderKey = '';
  }

  private returnToOwnFarm() {
    this.isOwnFarm = true;
    this.visitingUserId = null;
    this.visitingUsername = null;
    this.farmSign.setText('🏡 My Farm');
    this.backBtn.setVisible(false);
    this.currentRenderKey = '';
  }
}
