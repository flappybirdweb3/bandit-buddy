import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2 - 60, '🦝 Bandit Buddy', {
      fontSize: '28px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    const barBg = this.add.rectangle(width / 2, height / 2, 300, 20, 0x333333);
    const bar = this.add.rectangle(width / 2 - 150, height / 2, 0, 16, 0x4caf50);
    bar.setOrigin(0, 0.5);
    this.load.on('progress', (v: number) => { bar.width = 296 * v; });
    this.load.on('complete', () => { barBg.destroy(); bar.destroy(); });
    this.generateTextures();
  }

  create() {
    this.scene.start('MainFarmScene');
  }

  // Shared soil + wooden frame base drawn on every plot tile
  private plotBase(g: Phaser.GameObjects.Graphics) {
    // Soil body
    g.fillStyle(0x6b4226);
    g.fillRoundedRect(4, 4, 88, 88, 8);

    // Top strip lighter
    g.fillStyle(0x7a4e2d, 0.55);
    g.fillRect(8, 8, 80, 22);

    // Diagonal furrows
    g.lineStyle(1, 0x4e2a10, 0.4);
    for (let i = -75; i < 96; i += 12) {
      g.lineBetween(Math.max(8, i), 8, Math.min(88, i + 80), 88);
    }
    for (let i = 88; i > -10; i -= 12) {
      g.lineBetween(Math.min(88, i), 8, Math.max(8, i - 80), 88);
    }

    // Moisture spots
    g.fillStyle(0x3d1f08, 0.35);
    g.fillCircle(22, 32, 5);
    g.fillCircle(64, 48, 4);
    g.fillCircle(44, 72, 6);

    // Pebbles
    g.fillStyle(0xaaaaaa, 0.65);
    g.fillCircle(30, 22, 2.5);
    g.fillCircle(73, 30, 2.0);
    g.fillCircle(20, 64, 2.0);
    g.fillCircle(76, 72, 1.8);

    // Wooden frame: outer shadow stroke
    g.lineStyle(8, 0x3d1c00);
    g.strokeRoundedRect(2, 2, 92, 92, 10);
    // Frame main wood
    g.lineStyle(6, 0x8b6914);
    g.strokeRoundedRect(2, 2, 92, 92, 10);
    // Frame highlight (lighter inner edge)
    g.lineStyle(2, 0xc8a040);
    g.strokeRoundedRect(3, 3, 90, 90, 9);

    // Corner knots
    g.fillStyle(0x4a2800);
    g.fillCircle(10, 10, 4.5);
    g.fillCircle(86, 10, 4.5);
    g.fillCircle(10, 86, 4.5);
    g.fillCircle(86, 86, 4.5);
    g.fillStyle(0x7a5200);
    g.fillCircle(10, 10, 2.8);
    g.fillCircle(86, 10, 2.8);
    g.fillCircle(10, 86, 2.8);
    g.fillCircle(86, 86, 2.8);
  }

  private generateTextures() {

    // ═══════════════════════════════════════════════════════════
    //  PLOT EMPTY — rich soil + wooden frame
    // ═══════════════════════════════════════════════════════════
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      this.plotBase(g);
      g.generateTexture('plot-empty', 96, 96);
      g.destroy();
    }

    // ═══════════════════════════════════════════════════════════
    //  CROP GROWING — 3 seedlings with leaves
    // ═══════════════════════════════════════════════════════════
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      this.plotBase(g);

      const sprouts: [number, number][] = [[25, 74], [48, 68], [71, 76]];
      for (const [sx, sy] of sprouts) {
        g.lineStyle(2, 0x1b5e20);
        g.lineBetween(sx, sy, sx, sy - 26);
        g.fillStyle(0x4caf50);
        g.fillEllipse(sx - 11, sy - 19, 17, 9);
        g.fillStyle(0x388e3c);
        g.fillEllipse(sx + 11, sy - 23, 17, 9);
        g.fillStyle(0x66bb6a);
        g.fillCircle(sx, sy - 27, 5);
      }
      // Dewdrop on middle right leaf
      g.fillStyle(0xb3e5fc, 0.85);
      g.fillCircle(59, 46, 3);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(58, 45, 1.2);

      g.generateTexture('crop-growing', 96, 96);
      g.destroy();
    }

    // ═══════════════════════════════════════════════════════════
    //  CROP WHEAT — golden stalks with spikelets & awns
    // ═══════════════════════════════════════════════════════════
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      this.plotBase(g);

      const stalks = [
        { x: 19, lean: -4 }, { x: 33, lean: -1 }, { x: 48, lean: 2 },
        { x: 63, lean: -2 }, { x: 77, lean: 4 },
      ];

      // Stems + side blades
      for (const { x, lean } of stalks) {
        g.lineStyle(2, 0xd4aa00);
        g.lineBetween(x, 85, x + lean, 28);
        g.lineStyle(1.5, 0x9ccc65);
        g.lineBetween(x + lean * 0.35, 60, x + lean * 0.35 - 11, 51);
        g.lineBetween(x + lean * 0.65, 46, x + lean * 0.65 + 11, 37);
      }

      // Grain heads
      for (const { x, lean } of stalks) {
        const tx = x + lean;
        g.fillStyle(0xf9a825);
        g.fillEllipse(tx, 31, 9, 14);
        g.fillStyle(0xfdd835);
        g.fillEllipse(tx - 5, 36, 7, 11);
        g.fillEllipse(tx + 5, 36, 7, 11);
        g.fillStyle(0xfff176);
        g.fillEllipse(tx - 3, 25, 5, 9);
        g.fillEllipse(tx + 3, 25, 5, 9);
        g.fillEllipse(tx, 21, 5, 8);
        // Awns
        g.lineStyle(1, 0xc8960a);
        g.lineBetween(tx, 19, tx, 12);
        g.lineBetween(tx - 5, 23, tx - 9, 15);
        g.lineBetween(tx + 5, 23, tx + 9, 15);
      }

      g.generateTexture('crop-wheat', 96, 96);
      g.destroy();
    }

    // ═══════════════════════════════════════════════════════════
    //  CROP CARROT — orange tapered roots + feathery green tops
    // ═══════════════════════════════════════════════════════════
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      this.plotBase(g);

      const carrots: [number, number][] = [[24, 50], [48, 46], [72, 52]];

      for (const [cx, cy] of carrots) {
        // Tapered body
        g.fillStyle(0xff7043);
        g.fillPoints([
          { x: cx - 8, y: cy }, { x: cx + 8, y: cy },
          { x: cx + 3, y: cy + 29 }, { x: cx - 3, y: cy + 29 },
        ], true);
        // Highlight streak
        g.fillStyle(0xff8a65, 0.65);
        g.fillRect(cx - 3, cy + 2, 3, 21);
        // Segment lines
        g.lineStyle(1, 0xe64a19, 0.35);
        g.lineBetween(cx - 7, cy + 10, cx + 7, cy + 10);
        g.lineBetween(cx - 6, cy + 19, cx + 6, cy + 19);
        // Feathery green tops (5 strands)
        const angles = [-45, -25, -8, 12, 33];
        const leafColors = [0x1b5e20, 0x2e7d32, 0x388e3c, 0x43a047, 0x4caf50];
        angles.forEach((a, i) => {
          const rad = (a * Math.PI) / 180;
          const len = 19 + (i === 2 ? 5 : 0);
          const ex = cx + Math.sin(rad) * len;
          const ey = cy - Math.cos(rad) * len;
          g.lineStyle(2, leafColors[i]);
          g.lineBetween(cx, cy, ex, ey);
          // Leaflet forks
          const mx = cx + Math.sin(rad) * len * 0.55;
          const my = cy - Math.cos(rad) * len * 0.55;
          g.lineStyle(1, 0x66bb6a);
          g.lineBetween(mx, my, mx + Math.sin(rad + 0.55) * 7, my - Math.cos(rad + 0.55) * 7);
          g.lineBetween(mx, my, mx + Math.sin(rad - 0.55) * 7, my - Math.cos(rad - 0.55) * 7);
        });
      }

      g.generateTexture('crop-carrot', 96, 96);
      g.destroy();
    }

    // ═══════════════════════════════════════════════════════════
    //  CROP CORN — stalks with husked ears, silk, top tassels
    // ═══════════════════════════════════════════════════════════
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      this.plotBase(g);

      const cxs = [22, 48, 74];
      for (const cx of cxs) {
        // Stalk
        g.lineStyle(3, 0x33691e);
        g.lineBetween(cx, 86, cx, 20);
        // Broad leaves
        g.fillStyle(0x388e3c);
        g.fillEllipse(cx - 16, 62, 28, 9);
        g.fillEllipse(cx + 16, 47, 28, 9);
        // Husk (outer green)
        g.fillStyle(0x558b2f);
        g.fillEllipse(cx + 10, 52, 16, 30);
        // Corn kernels peeking out
        g.fillStyle(0xfdd835);
        g.fillEllipse(cx + 12, 52, 10, 22);
        // Kernel rows
        g.lineStyle(1, 0xf9a825, 0.5);
        for (let ky = 42; ky < 64; ky += 4) {
          g.lineBetween(cx + 8, ky, cx + 19, ky);
        }
        // Silk strands
        g.lineStyle(1.5, 0xfff9c4);
        g.lineBetween(cx + 11, 37, cx + 8, 25);
        g.lineBetween(cx + 13, 37, cx + 15, 24);
        g.lineBetween(cx + 15, 39, cx + 20, 27);
        // Tassel
        g.fillStyle(0x1b5e20);
        g.fillRect(cx - 2, 16, 4, 8);
        g.lineStyle(1, 0x33691e);
        g.lineBetween(cx, 16, cx - 10, 8);
        g.lineBetween(cx, 16, cx, 7);
        g.lineBetween(cx, 16, cx + 10, 8);
      }

      g.generateTexture('crop-corn', 96, 96);
      g.destroy();
    }

    // ═══════════════════════════════════════════════════════════
    //  CROP TOMATO — vine with 5 round red tomatoes + calyx
    // ═══════════════════════════════════════════════════════════
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      this.plotBase(g);

      // Main vine
      g.lineStyle(2, 0x2e7d32);
      g.lineBetween(48, 86, 48, 22);
      g.lineBetween(48, 52, 26, 40);
      g.lineBetween(48, 52, 70, 40);
      g.lineBetween(48, 68, 28, 60);
      g.lineBetween(48, 68, 70, 62);
      // Tendrils
      g.lineStyle(1, 0x4caf50);
      g.lineBetween(48, 30, 38, 18);
      g.lineBetween(48, 30, 58, 18);
      // Leaves
      g.fillStyle(0x388e3c);
      g.fillEllipse(16, 42, 18, 10);
      g.fillEllipse(80, 40, 18, 10);
      g.fillEllipse(18, 63, 16, 9);
      g.fillEllipse(78, 65, 16, 9);

      // Tomatoes (5 × varying sizes)
      const toms = [
        { x: 26, y: 56, r: 12 },
        { x: 70, y: 54, r: 12 },
        { x: 48, y: 40, r: 13 },
        { x: 28, y: 76, r: 9 },
        { x: 68, y: 76, r: 9 },
      ];
      for (const t of toms) {
        // Drop shadow
        g.fillStyle(0x7f0000, 0.3);
        g.fillCircle(t.x + 2, t.y + 3, t.r);
        // Body
        g.fillStyle(0xe53935);
        g.fillCircle(t.x, t.y, t.r);
        // Specular highlight
        g.fillStyle(0xffcdd2, 0.7);
        g.fillCircle(t.x - t.r * 0.32, t.y - t.r * 0.32, t.r * 0.32);
        // 5-point calyx
        g.fillStyle(0x1b5e20);
        for (let p = 0; p < 5; p++) {
          const a = (p * 72 - 90) * (Math.PI / 180);
          g.fillCircle(
            t.x + Math.cos(a) * t.r * 0.55,
            t.y - t.r + Math.sin(a) * t.r * 0.3 + t.r * 0.1,
            1.8,
          );
        }
        g.lineStyle(1.5, 0x1b5e20);
        g.lineBetween(t.x, t.y - t.r, t.x, t.y - t.r - 5);
      }

      g.generateTexture('crop-tomato', 96, 96);
      g.destroy();
    }

    // ═══════════════════════════════════════════════════════════
    //  CROP PUMPKIN — ribbed orange body, brown stem, vine
    // ═══════════════════════════════════════════════════════════
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      this.plotBase(g);

      // Vine
      g.lineStyle(2, 0x33691e);
      g.lineBetween(48, 26, 48, 18);
      g.lineBetween(48, 22, 78, 14);
      g.lineBetween(48, 22, 18, 16);
      // Leaves
      g.fillStyle(0x388e3c);
      g.fillEllipse(84, 14, 22, 13);
      g.fillEllipse(14, 16, 20, 13);

      // Pumpkin drop shadow
      g.fillStyle(0xa63200, 0.3);
      g.fillEllipse(51, 61, 72, 54);

      // 5 ribs (overlapping ellipses, dark → mid → bright → mid → dark)
      const ribX = [27, 37, 48, 59, 69];
      const ribC = [0xbf360c, 0xe64a19, 0xff7043, 0xe64a19, 0xbf360c];
      for (let i = 0; i < 5; i++) {
        g.fillStyle(ribC[i]);
        g.fillEllipse(ribX[i], 58, 23, 48);
      }

      // Center specular glow
      g.fillStyle(0xff8a65, 0.4);
      g.fillEllipse(48, 48, 11, 24);

      // Rib dividers
      g.lineStyle(1.5, 0x8d1a00, 0.55);
      g.lineBetween(37, 34, 34, 84);
      g.lineBetween(43, 30, 41, 85);
      g.lineBetween(53, 30, 55, 85);
      g.lineBetween(59, 34, 62, 84);

      // Stem
      g.fillStyle(0x4e342e);
      g.fillRect(44, 20, 8, 12);
      g.fillStyle(0x6d4c41);
      g.fillRect(45, 20, 4, 10);
      // Curl tendril
      g.lineStyle(1.5, 0x558b2f);
      g.lineBetween(52, 23, 65, 14);
      g.lineBetween(65, 14, 72, 21);

      g.generateTexture('crop-pumpkin', 96, 96);
      g.destroy();
    }

    // ═══════════════════════════════════════════════════════════
    //  CROP TURNIP — round white/purple roots with leafy tops
    // ═══════════════════════════════════════════════════════════
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      this.plotBase(g);
      for (const [tx, ty] of [[22, 66], [50, 61], [74, 68]] as [number,number][]) {
        g.fillStyle(0xf3e5f5); g.fillCircle(tx, ty, 14);
        g.fillStyle(0xce93d8, 0.7); g.fillEllipse(tx, ty + 6, 22, 14);
        g.fillStyle(0xffffff, 0.6); g.fillCircle(tx - 5, ty - 5, 5);
        g.lineStyle(1.5, 0x9c27b0); g.lineBetween(tx, ty + 13, tx, ty + 20);
        g.fillStyle(0x388e3c);
        g.fillEllipse(tx - 7, ty - 14, 9, 5);
        g.fillEllipse(tx + 7, ty - 14, 9, 5);
        g.fillEllipse(tx, ty - 17, 9, 5);
        g.lineStyle(1.5, 0x2e7d32);
        g.lineBetween(tx, ty - 14, tx - 7, ty - 14);
        g.lineBetween(tx, ty - 14, tx + 7, ty - 14);
        g.lineBetween(tx, ty - 14, tx, ty - 17);
      }
      g.generateTexture('crop-turnip', 96, 96); g.destroy();
    }

    // ═══════════════════════════════════════════════════════════
    //  CROP POTATO — brown ovals in soil with green sprouts
    // ═══════════════════════════════════════════════════════════
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      this.plotBase(g);
      for (const [px, py, r] of [[24, 62, 13], [50, 58, 15], [74, 64, 12]] as [number,number,number][]) {
        g.fillStyle(0x3d1f08, 0.4); g.fillEllipse(px + 3, py + 4, r * 2 + 4, r + 6);
        g.fillStyle(0x8d6e63); g.fillEllipse(px, py, r * 2 + 4, r * 1.4 + 4);
        g.fillStyle(0xa1887f, 0.8); g.fillEllipse(px - r * 0.3, py - r * 0.2, r, r * 0.6);
        g.fillStyle(0x5d4037); g.fillCircle(px - 4, py + 2, 2); g.fillCircle(px + 5, py - 1, 2);
        g.lineStyle(2, 0x33691e); g.lineBetween(px, py - r * 0.7, px - 3, py - r * 0.7 - 14);
        g.fillStyle(0x4caf50); g.fillEllipse(px - 6, py - r * 0.7 - 18, 10, 6);
        g.fillEllipse(px + 3, py - r * 0.7 - 12, 8, 5);
      }
      g.generateTexture('crop-potato', 96, 96); g.destroy();
    }

    // ═══════════════════════════════════════════════════════════
    //  CROP EGGPLANT — deep purple elongated, green cap & vine
    // ═══════════════════════════════════════════════════════════
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      this.plotBase(g);
      g.lineStyle(2, 0x33691e);
      g.lineBetween(30, 86, 30, 20); g.lineBetween(66, 86, 66, 18); g.lineBetween(30, 45, 66, 30);
      g.fillStyle(0x388e3c);
      g.fillEllipse(12, 38, 18, 9); g.fillEllipse(84, 32, 18, 9); g.fillEllipse(48, 20, 20, 9);
      for (const [ex, ey] of [[30, 58], [66, 52]] as [number,number][]) {
        g.fillStyle(0x2e7d32); g.fillEllipse(ex, ey - 16, 18, 8);
        g.lineStyle(1.5, 0x1b5e20);
        g.lineBetween(ex - 6, ey - 16, ex - 10, ey - 22);
        g.lineBetween(ex, ey - 18, ex, ey - 24);
        g.lineBetween(ex + 6, ey - 16, ex + 10, ey - 22);
        g.fillStyle(0x6a1b9a); g.fillEllipse(ex, ey + 4, 22, 38);
        g.fillStyle(0x9c27b0, 0.6); g.fillEllipse(ex - 5, ey - 4, 8, 18);
        g.fillStyle(0xce93d8, 0.4); g.fillEllipse(ex - 6, ey - 8, 5, 10);
      }
      g.generateTexture('crop-eggplant', 96, 96); g.destroy();
    }

    // ═══════════════════════════════════════════════════════════
    //  CROP PEA — plump green pods with bumps, curling tendrils
    // ═══════════════════════════════════════════════════════════
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      this.plotBase(g);
      g.lineStyle(2, 0x2e7d32);
      g.lineBetween(48, 86, 48, 22); g.lineBetween(48, 65, 22, 52); g.lineBetween(48, 45, 74, 35);
      g.lineStyle(1, 0x66bb6a); g.lineBetween(48, 30, 36, 16); g.lineBetween(48, 30, 62, 16);
      g.fillStyle(0x388e3c); g.fillEllipse(10, 53, 18, 10); g.fillEllipse(82, 38, 18, 10);
      for (const [podX, podY] of [[22, 62], [48, 42], [74, 52]] as [number,number][]) {
        g.fillStyle(0x43a047); g.fillEllipse(podX, podY, 30, 13);
        g.fillStyle(0x66bb6a);
        g.fillCircle(podX - 9, podY, 4); g.fillCircle(podX, podY, 4); g.fillCircle(podX + 9, podY, 4);
        g.lineStyle(1, 0x2e7d32); g.strokeEllipse(podX, podY, 30, 13);
        g.lineStyle(1.5, 0x2e7d32); g.lineBetween(podX + 14, podY, podX + 20, podY - 4);
      }
      g.generateTexture('crop-pea', 96, 96); g.destroy();
    }

    // ═══════════════════════════════════════════════════════════
    //  CROP WATERMELON — large round striped green melon
    // ═══════════════════════════════════════════════════════════
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      this.plotBase(g);
      g.lineStyle(2, 0x33691e); g.lineBetween(48, 86, 48, 22); g.lineBetween(48, 60, 26, 20);
      g.lineStyle(1.5, 0x66bb6a); g.lineBetween(48, 40, 70, 20);
      g.fillStyle(0x388e3c); g.fillEllipse(24, 20, 22, 13); g.fillEllipse(70, 22, 20, 11);
      g.fillStyle(0x1a3e1a, 0.3); g.fillEllipse(51, 63, 64, 46);
      g.fillStyle(0x1b5e20); g.fillEllipse(48, 60, 60, 44);
      g.fillStyle(0x4caf50);
      for (let i = 0; i < 5; i++) g.fillRect(23 + i * 12, 40, 5, 38);
      g.fillStyle(0x2e7d32, 0.5); g.fillEllipse(48, 60, 62, 46);
      g.fillStyle(0x81c784, 0.4); g.fillEllipse(36, 50, 20, 12);
      g.fillStyle(0x4e342e); g.fillRect(46, 39, 5, 8);
      g.lineStyle(1.5, 0x558b2f); g.lineBetween(50, 40, 62, 28);
      g.generateTexture('crop-watermelon', 96, 96); g.destroy();
    }

    // ═══════════════════════════════════════════════════════════
    //  CROP STRAWBERRY — red heart-shaped berries, seed dots
    // ═══════════════════════════════════════════════════════════
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      this.plotBase(g);
      g.lineStyle(2, 0x2e7d32);
      g.lineBetween(30, 86, 30, 45); g.lineBetween(66, 86, 66, 42); g.lineBetween(48, 86, 48, 30);
      for (const [bx, by, r] of [[28, 68, 11], [48, 55, 13], [68, 66, 10]] as [number,number,number][]) {
        g.fillStyle(0x2e7d32); g.fillEllipse(bx, by - r - 3, r * 2, 7);
        for (let p = -2; p <= 2; p++) {
          g.lineStyle(1.5, 0x1b5e20);
          g.lineBetween(bx + p * (r / 2.5), by - r - 2, bx + p * (r / 1.8), by - r - 8);
        }
        g.fillStyle(0x7f0000, 0.25); g.fillCircle(bx + 2, by + 3, r);
        g.fillStyle(0xe53935);
        g.fillCircle(bx - r * 0.33, by - r * 0.2, r * 0.72);
        g.fillCircle(bx + r * 0.33, by - r * 0.2, r * 0.72);
        g.fillTriangle(bx - r, by, bx + r, by, bx, by + r + 2);
        g.fillStyle(0xffcdd2, 0.6); g.fillCircle(bx - r * 0.3, by - r * 0.3, r * 0.3);
        g.fillStyle(0xffee58);
        for (const [sx, sy] of [[-3,-3],[4,-5],[0,1],[-5,3],[4,2],[0,-7]] as [number,number][]) {
          g.fillEllipse(bx + sx * r / 8, by + sy * r / 8, 2.5, 3.5);
        }
      }
      g.generateTexture('crop-strawberry', 96, 96); g.destroy();
    }

    // ═══════════════════════════════════════════════════════════
    //  CROP GRAPE — purple clusters hanging from vine + leaves
    // ═══════════════════════════════════════════════════════════
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      this.plotBase(g);
      g.lineStyle(3, 0x33691e);
      g.lineBetween(48, 86, 48, 18); g.lineBetween(48, 55, 22, 40); g.lineBetween(48, 38, 74, 26);
      g.lineStyle(1, 0x66bb6a); g.lineBetween(48, 25, 36, 12); g.lineBetween(48, 25, 62, 10);
      g.fillStyle(0x388e3c);
      g.fillCircle(12, 41, 10); g.fillCircle(20, 36, 8); g.fillCircle(22, 46, 8);
      g.fillStyle(0x2e7d32); g.fillCircle(16, 41, 6);
      g.fillStyle(0x388e3c);
      g.fillCircle(80, 28, 10); g.fillCircle(72, 24, 8); g.fillCircle(74, 34, 8);
      g.fillStyle(0x2e7d32); g.fillCircle(76, 29, 6);
      const clusters: { cx: number; cy: number; pts: [number,number][] }[] = [
        { cx: 28, cy: 56, pts: [[-10,0],[-3,0],[4,0],[11,0],[-7,8],[0,8],[7,8],[-4,16],[3,16],[0,23]] },
        { cx: 68, cy: 48, pts: [[-8,0],[-1,0],[6,0],[-5,8],[2,8],[-1,16]] },
      ];
      for (const { cx, cy, pts } of clusters) {
        g.lineStyle(2, 0x4e342e); g.lineBetween(cx, cy - 10, cx, cy - 18);
        for (const [gx, gy] of pts) {
          g.fillStyle(0x311b92, 0.3); g.fillCircle(cx + gx + 1, cy + gy + 2, 7);
          g.fillStyle(0x7b1fa2); g.fillCircle(cx + gx, cy + gy, 7);
          g.fillStyle(0xce93d8, 0.5); g.fillCircle(cx + gx - 2, cy + gy - 2, 3);
        }
      }
      g.generateTexture('crop-grape', 96, 96); g.destroy();
    }

    // ═══════════════════════════════════════════════════════════
    //  CROP SUNFLOWER — tall stalk, yellow petals, brown center
    // ═══════════════════════════════════════════════════════════
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      this.plotBase(g);
      g.lineStyle(4, 0x33691e); g.lineBetween(48, 86, 48, 14);
      g.lineStyle(2, 0x388e3c); g.lineBetween(48, 58, 28, 44); g.lineBetween(48, 42, 68, 30);
      g.fillStyle(0x388e3c);
      g.fillEllipse(18, 44, 22, 12); g.fillEllipse(78, 30, 22, 11); g.fillEllipse(20, 62, 18, 10);
      const fx = 48, fy = 20;
      g.fillStyle(0xfdd835);
      for (let p = 0; p < 16; p++) {
        const a = p * 22.5 * Math.PI / 180;
        g.fillEllipse(fx + Math.cos(a) * 18, fy + Math.sin(a) * 18, 10, 7);
      }
      g.fillStyle(0xffee58, 0.5);
      for (let p = 0; p < 8; p++) {
        const a = (p * 45 + 10) * Math.PI / 180;
        g.fillEllipse(fx + Math.cos(a) * 17, fy + Math.sin(a) * 17, 6, 4);
      }
      g.fillStyle(0x4e342e); g.fillCircle(fx, fy, 12);
      g.fillStyle(0x6d4c41); g.fillCircle(fx, fy, 10);
      g.fillStyle(0x3e2723);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
        const dx = i * 4 - 8, dy = j * 4 - 8;
        if (dx * dx + dy * dy < 80) g.fillCircle(fx + dx, fy + dy, 1.5);
      }
      g.fillStyle(0x8d6e63, 0.4); g.fillCircle(fx - 3, fy - 3, 4);
      g.generateTexture('crop-sunflower', 96, 96); g.destroy();
    }

    // ═══════════════════════════════════════════════════════════
    //  CROP ROSE — red layered roses with thorny green stems
    // ═══════════════════════════════════════════════════════════
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      this.plotBase(g);
      const stems: [number,number,number,number][] = [[26,80,26,38],[50,82,50,28],[72,78,72,36]];
      for (const [sx,sy,rx,ry] of stems) {
        g.lineStyle(2.5, 0x2e7d32); g.lineBetween(sx, sy, rx, ry);
        const mx = sx + (rx-sx)*0.45, my = sy + (ry-sy)*0.45;
        g.lineStyle(1.5, 0x1b5e20); g.lineBetween(mx, my, mx + 6, my + 5);
        g.fillStyle(0x388e3c); g.fillEllipse(mx + 10, my - 2, 14, 7);
        g.fillStyle(0xb71c1c);
        for (let p = 0; p < 7; p++) {
          const a = p * 51.4 * Math.PI / 180;
          g.fillEllipse(rx + Math.cos(a) * 9, ry + Math.sin(a) * 9, 11, 8);
        }
        g.fillStyle(0xd32f2f);
        for (let p = 0; p < 6; p++) {
          const a = (p * 60 + 30) * Math.PI / 180;
          g.fillEllipse(rx + Math.cos(a) * 5, ry + Math.sin(a) * 5, 10, 7);
        }
        g.fillStyle(0xef5350); g.fillCircle(rx, ry, 5);
        g.fillStyle(0xffcdd2, 0.4); g.fillCircle(rx - 1, ry - 1, 3);
        g.fillStyle(0x1b5e20);
        for (let p = 0; p < 4; p++) {
          const a = (p * 90 + 45) * Math.PI / 180;
          g.fillEllipse(rx + Math.cos(a) * 8, ry + 9, 5, 10);
        }
      }
      g.generateTexture('crop-rose', 96, 96); g.destroy();
    }

    // ─── Generic ripe fallback (wheat-like glow) ──────────────
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      this.plotBase(g);
      g.lineStyle(3, 0xffd700, 1);
      g.strokeRoundedRect(5, 5, 86, 86, 7);
      g.fillStyle(0xffc107);
      g.fillTriangle(48, 18, 26, 64, 70, 64);
      g.fillRect(44, 60, 8, 20);
      g.fillStyle(0xffeb3b);
      g.fillCircle(48, 16, 10);
      g.generateTexture('crop-ripe', 96, 96);
      g.destroy();
    }

    // ═══════════════════════════════════════════════════════════
    //  GUARD DOG — Border Collie with red bandit bandana
    // ═══════════════════════════════════════════════════════════
    {
      const g = this.make.graphics({ x: 0, y: 0 });

      // Ground shadow
      g.fillStyle(0x000000, 0.18);
      g.fillEllipse(37, 61, 60, 9);

      // Tail (upright, wagging)
      g.fillStyle(0x212121);
      g.fillEllipse(10, 28, 10, 22);
      g.fillStyle(0xfafafa, 0.6);
      g.fillEllipse(10, 28, 5, 14);

      // Body — black and white Border Collie
      g.fillStyle(0x212121);
      g.fillEllipse(37, 40, 52, 28);
      // White saddle/belly
      g.fillStyle(0xfafafa);
      g.fillEllipse(37, 44, 30, 16);

      // Legs
      g.fillStyle(0x212121);
      g.fillRect(17, 50, 9, 14);
      g.fillRect(28, 52, 9, 12);
      g.fillRect(40, 52, 9, 12);
      g.fillRect(52, 50, 9, 14);
      // White socks on front legs
      g.fillStyle(0xfafafa);
      g.fillRect(17, 57, 9, 7);
      g.fillRect(52, 57, 9, 7);

      // Neck
      g.fillStyle(0x212121);
      g.fillRect(50, 28, 14, 16);

      // Head (rounder, collie-shaped)
      g.fillStyle(0x212121);
      g.fillCircle(57, 24, 18);
      // White blaze on forehead
      g.fillStyle(0xfafafa);
      g.fillEllipse(57, 16, 8, 12);
      // White muzzle
      g.fillEllipse(60, 30, 12, 9);

      // Folded ears (pointing slightly forward)
      g.fillStyle(0x212121);
      g.fillEllipse(47, 10, 12, 16);
      g.fillEllipse(67, 9, 12, 15);
      g.fillStyle(0x4a3728, 0.5);
      g.fillEllipse(47, 11, 7, 10);
      g.fillEllipse(67, 10, 7, 10);

      // Eyes — alert, intelligent
      g.fillStyle(0xffffff);
      g.fillCircle(52, 22, 5.5);
      g.fillCircle(63, 22, 5.5);
      g.fillStyle(0x795548);
      g.fillCircle(53, 22, 4);
      g.fillCircle(64, 22, 4);
      g.fillStyle(0x111111);
      g.fillCircle(53, 22, 2.5);
      g.fillCircle(64, 22, 2.5);
      // Eye shine
      g.fillStyle(0xffffff);
      g.fillCircle(54, 21, 1.2);
      g.fillCircle(65, 21, 1.2);

      // Nose
      g.fillStyle(0x1a1a1a);
      g.fillEllipse(60, 29, 8, 5);

      // Mouth
      g.lineStyle(1.5, 0x4e342e);
      g.lineBetween(57, 32, 60, 35);
      g.lineBetween(63, 32, 60, 35);
      // Tongue panting
      g.fillStyle(0xff8a80);
      g.fillEllipse(60, 37, 7, 5);

      // Red bandit bandana
      g.fillStyle(0xc62828);
      g.fillTriangle(44, 38, 74, 38, 59, 52);
      g.fillRect(44, 35, 30, 5);
      g.lineStyle(1, 0xb71c1c);
      g.lineBetween(44, 35, 74, 35);
      // Bandana knot (side bow)
      g.fillStyle(0xb71c1c);
      g.fillCircle(74, 37, 4);
      g.fillTriangle(74, 34, 78, 30, 80, 37);
      g.fillTriangle(74, 40, 78, 44, 80, 37);
      // Bandana dots pattern
      g.fillStyle(0xef9a9a, 0.5);
      g.fillCircle(52, 38, 1.5);
      g.fillCircle(60, 41, 1.5);
      g.fillCircle(68, 38, 1.5);

      // Gold name tag on collar
      g.fillStyle(0xffd700);
      g.fillCircle(59, 43, 3.5);
      g.fillStyle(0xe65100);
      g.fillCircle(59, 43, 1.5);

      g.generateTexture('guard-dog', 90, 68);
      g.destroy();
    }

    // ─── Gold coin ────────────────────────────────────────────
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xffa000);
      g.fillCircle(16, 16, 14);
      g.fillStyle(0xffd700);
      g.fillCircle(16, 16, 11);
      g.fillStyle(0xffee58);
      g.fillCircle(13, 13, 5);
      g.lineStyle(1.5, 0xff8f00);
      g.strokeCircle(16, 16, 13);
      g.generateTexture('coin', 32, 32);
      g.destroy();
    }

    // ─── Steal icon ───────────────────────────────────────────
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xff5722, 0.9);
      g.fillCircle(20, 20, 18);
      g.lineStyle(3, 0xffffff);
      g.strokeCircle(20, 20, 18);
      g.generateTexture('steal-icon', 40, 40);
      g.destroy();
    }

    // ─── Particles ────────────────────────────────────────────
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xffd700);
      g.fillCircle(5, 5, 5);
      g.fillStyle(0xffffff, 0.6);
      g.fillCircle(3, 3, 2);
      g.generateTexture('spark', 10, 10);
      g.destroy();
    }
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xff1744);
      g.fillCircle(5, 5, 5);
      g.fillStyle(0xff8a80, 0.6);
      g.fillCircle(3, 3, 2);
      g.generateTexture('bite-particle', 10, 10);
      g.destroy();
    }
    {
      // Soil chunk particle (brown)
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x6b4226);
      g.fillCircle(5, 5, 5);
      g.fillStyle(0x8b5e3c, 0.6);
      g.fillCircle(3, 3, 2.5);
      g.generateTexture('soil-particle', 10, 10);
      g.destroy();
    }
    {
      // Water drop particle (blue)
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x29b6f6);
      g.fillCircle(5, 5, 5);
      g.fillStyle(0xb3e5fc, 0.7);
      g.fillCircle(3, 3, 2);
      g.generateTexture('water-drop', 10, 10);
      g.destroy();
    }
    {
      // Water ring for ripple effect
      const g = this.make.graphics({ x: 0, y: 0 });
      g.lineStyle(2, 0x29b6f6, 1);
      g.strokeCircle(16, 16, 13);
      g.generateTexture('water-ring', 32, 32);
      g.destroy();
    }
  }
}
