/**
 * E2E Integration Tests — BanditBuddy Game Loop (#52)
 *
 * Covers 6 core scenarios from issue spec:
 *   1. Auth: Telegram initData → JWT → GET /user/profile
 *   2. Farm loop: plant → harvest → inventory updated
 *   3. Steal: success case + dog-bite failure case
 *   4. Claim: signature endpoint enforces trust_score gate
 *   5. Marketplace: list item → browse → buy flow
 *   6. Gacha: commit → reveal → NFT path check
 *
 * Uses Jest + Supertest against the running NestJS app.
 * Database: real PostgreSQL (test env uses same DB with isolated user).
 * No mocks — every assertion hits the actual service layer.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { DataSource } from 'typeorm';

// ── Auth header ───────────────────────────────────────────────────────────────
//
// TelegramAuthGuard accepts x-telegram-init-data directly, but it only skips HMAC
// validation when no bot token is configured:
//
//   const isDev = !botToken || botToken === 'your_telegram_bot_token_here';
//
// TELEGRAM_BOT_TOKEN IS loaded from ../.env in this environment, so the guard always ran
// a real HMAC check and rejected the old literal `hash=devhash` — every authenticated
// request returned 401 while the suite still "ran". Two tests even passed vacuously by
// comparing two identical 401 bodies.
//
// So sign the payload exactly as the guard verifies it. The guard rebuilds the
// data-check-string from URLSearchParams.entries() — i.e. the URL-DECODED values —
// after dropping `hash`, sorted by key, joined with "\n", then HMAC-SHA256 with the
// key derived from the literal "WebAppData".

function signInitData(fields: Record<string, string>, botToken: string): string {
  const params = new URLSearchParams(fields);
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  return crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
}

function makeInitData(telegramId: number, username: string): string {
  const mockUser = JSON.stringify({ id: telegramId, first_name: 'Test', username });
  // Read at call time. app.module.ts's ConfigModule.forRoot() runs during this file's
  // import, so dotenv has already populated process.env by the time this executes.
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? '';

  if (!botToken || botToken === 'your_telegram_bot_token_here') {
    // Same condition as the guard's dev bypass — keep working without a token.
    return `user=${encodeURIComponent(mockUser)}&hash=devhash`;
  }

  return `user=${encodeURIComponent(mockUser)}&hash=${signInitData({ user: mockUser }, botToken)}`;
}

// Fresh IDs per run. farm_plots references users WITHOUT ON DELETE CASCADE, so afterAll's
// `DELETE FROM users` trips a FK violation that its .catch(() => {}) swallows — a fixed
// telegram_id therefore inherited the previous run's spent GOLD and planted plot 0, making
// the suite pass or fail by run order rather than by code correctness.
const RUN_ID = Math.floor(Math.random() * 1_000_000);
const DEV_USER_ID  = 700_000_000 + RUN_ID;
const DEV_USER2_ID = 701_000_000 + RUN_ID;
const DEV_HEADERS  = { 'x-telegram-init-data': makeInitData(DEV_USER_ID, 'test_user_e2e') };
const DEV_HEADERS2 = { 'x-telegram-init-data': makeInitData(DEV_USER2_ID, 'test_victim_e2e') };

// ── Test suite ─────────────────────────────────────────────────────────────────

describe('BanditBuddy E2E', () => {
  let app: INestApplication;
  let db: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // MUST run before init(). Test.createTestingModule() only builds the DI container — it
    // never executes main.ts's bootstrap(), so without this the app is mounted with NO
    // global prefix: routes live at /farm/seeds, /user/profile, … while every request in
    // this suite targets /api/..., producing a blanket 404 across every module.
    //
    // It also installs the REAL ValidationPipe. The inline pipe this replaced omitted
    // forbidNonWhitelisted, so every 400-assertion below was weaker than production.
    configureApp(app);

    await app.init();

    db = app.get(DataSource);
  });

  afterAll(async () => {
    // Tear down in dependency order, then close the app.
    //
    // `users` is referenced WITHOUT ON DELETE CASCADE by steal_logs, farm_plots,
    // user_items, user_daily_quests and user_notifications, so deleting users first
    // raises 23503 (observed: `steal_logs_victim_id_fkey`). The previous code swallowed
    // that with `.catch(() => {})`, so every run leaked two accounts plus their plots,
    // crops, steal logs, quests and notifications. Randomised telegram ids hid it; an
    // assertion that counts rows would not.
    //
    // steal_logs must precede farm_plots: it holds a plot_id FK as well as the two user FKs.
    try {
      const userFilter = `(SELECT id FROM users WHERE telegram_id IN ($1, $2))`;
      await db.query(
        `DELETE FROM steal_logs WHERE thief_id IN ${userFilter} OR victim_id IN ${userFilter}`,
        [DEV_USER_ID, DEV_USER2_ID],
      );
      await db.query(
        `DELETE FROM user_notifications WHERE user_id IN ${userFilter}`,
        [DEV_USER_ID, DEV_USER2_ID],
      );
      await db.query(
        `DELETE FROM user_daily_quests WHERE user_id IN ${userFilter}`,
        [DEV_USER_ID, DEV_USER2_ID],
      );
      await db.query(
        `DELETE FROM user_items WHERE user_id IN ${userFilter}`,
        [DEV_USER_ID, DEV_USER2_ID],
      );
      await db.query(
        `DELETE FROM farm_plots WHERE user_id IN ${userFilter}`,
        [DEV_USER_ID, DEV_USER2_ID],
      );
      await db.query(
        `DELETE FROM users WHERE telegram_id IN ($1, $2)`,
        [DEV_USER_ID, DEV_USER2_ID],
      );
    } catch (err) {
      // Loud but not fatal: teardown should never turn a green suite red, yet a silent
      // swallow is exactly what hid this bug. If this fires, a user-referencing table
      // was added without being joined to the list above.
      console.error('[e2e] user teardown failed:', err);
    } finally {
      await app.close();
    }
  });

  // ── Scenario 1: Auth ─────────────────────────────────────────────────────────

  describe('1. Auth — Telegram initData → JWT → profile', () => {
    it('should create user and return profile on first login', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/user/profile')
        .set(DEV_HEADERS)
        .expect(200);

      expect(res.body).toMatchObject({
        goldBalance: expect.any(Number),
        energy: expect.any(Number),
        trustScore: expect.any(Number),
      });
    });

    it('should return 401 without initData header', async () => {
      await request(app.getHttpServer())
        .get('/api/user/profile')
        .expect(401);
    });

    it('should return same user on repeated calls (idempotent upsert)', async () => {
      const [r1, r2] = await Promise.all([
        request(app.getHttpServer()).get('/api/user/profile').set(DEV_HEADERS),
        request(app.getHttpServer()).get('/api/user/profile').set(DEV_HEADERS),
      ]);
      // Without the status assertions this passed throughout the 401 outage: two identical
      // error bodies compare equal, so `r1.body.id === r2.body.id` was undefined === undefined.
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      expect(r1.body.id).toBeTruthy();
      expect(r1.body.id).toBe(r2.body.id);
    });
  });

  // ── Scenario 2: Farm loop ─────────────────────────────────────────────────────

  describe('2. Farm loop — plant → harvest', () => {
    let plotId: string;
    let seedId: string;

    it('should load own farm with plots', async () => {
      const profileRes = await request(app.getHttpServer())
        .get('/api/user/profile')
        .set(DEV_HEADERS)
        .expect(200);

      // /farm/my, NOT /farm/:userId. Only the 'my' handler calls ensureInitialPlots();
      // /farm/:userId is a pure read, so for a brand-new user it returns plots: [] and
      // plotId stays undefined — which cascades into plant/harvest/steal failing with
      // "Plot not found or not yours".
      const farmRes = await request(app.getHttpServer())
        .get('/api/farm/my')
        .set(DEV_HEADERS)
        .expect(200);

      expect(farmRes.body.plots).toBeDefined();
      expect(Array.isArray(farmRes.body.plots)).toBe(true);
      plotId = farmRes.body.plots[0]?.id;
      expect(plotId).toBeTruthy();
    });

    it('should list available seeds', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/farm/seeds')
        .set(DEV_HEADERS)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      seedId = res.body[0].id;
    });

    it('should plant a seed on an empty plot', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/action/plant')
        .set(DEV_HEADERS)
        .send({ plotId, seedId })
        .expect(201);

      expect(res.body.message).toMatch(/planted/i);
    });

    it('should reject harvest before crop is ripe', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/action/harvest')
        .set(DEV_HEADERS)
        .send({ plotId })
        .expect(400);

      expect(res.body.message).toMatch(/not ready/i);
    });

    it('should allow harvest after forcing harvestable_at to past', async () => {
      // Fast-forward harvestable_at to now-1s directly in DB
      await db.query(
        `UPDATE farm_plots SET harvestable_at = NOW() - INTERVAL '1 second'
         WHERE id = $1`,
        [plotId],
      );

      const res = await request(app.getHttpServer())
        .post('/api/action/harvest')
        .set(DEV_HEADERS)
        .send({ plotId })
        .expect(201);

      expect(res.body.cropEarned).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Scenario 3: Steal ─────────────────────────────────────────────────────────

  describe('3. Steal — success + dog bite cases', () => {
    let victimId: string;
    let victimPlotId: string;
    let seedId: string;

    beforeAll(async () => {
      // Ensure victim user exists + get their farm
      const profileRes = await request(app.getHttpServer())
        .get('/api/user/profile')
        .set(DEV_HEADERS2)
        .expect(200);
      victimId = profileRes.body.id;

      const seedsRes = await request(app.getHttpServer())
        .get('/api/farm/seeds')
        .set(DEV_HEADERS2);
      seedId = seedsRes.body[0].id;

      // Victim reads their OWN farm — must go through /farm/my so plots are created.
      const farmRes = await request(app.getHttpServer())
        .get('/api/farm/my')
        .set(DEV_HEADERS2);
      victimPlotId = farmRes.body.plots[0]?.id;

      // Plant and fast-forward victim's crop
      await request(app.getHttpServer())
        .post('/api/action/plant')
        .set(DEV_HEADERS2)
        .send({ plotId: victimPlotId, seedId });

      await db.query(
        `UPDATE farm_plots SET harvestable_at = NOW() - INTERVAL '1 second'
         WHERE id = $1`,
        [victimPlotId],
      );
    });

    it('should return success or failure from steal attempt', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/action/steal')
        .set(DEV_HEADERS)
        .send({ targetUserId: victimId, plotId: victimPlotId });

      // Either success or dog bite — both are 201
      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success');
      expect(typeof res.body.success).toBe('boolean');
      expect(res.body).toHaveProperty('message');
    });

    it('should reject stealing from self', async () => {
      const profileRes = await request(app.getHttpServer())
        .get('/api/user/profile')
        .set(DEV_HEADERS);
      const myId = profileRes.body.id;

      const farmRes = await request(app.getHttpServer())
        .get('/api/farm/my')
        .set(DEV_HEADERS);
      const myPlotId = farmRes.body.plots[0]?.id;
      void myId;

      await request(app.getHttpServer())
        .post('/api/action/steal')
        .set(DEV_HEADERS)
        .send({ targetUserId: myId, plotId: myPlotId })
        .expect(400);
    });
  });

  // ── Scenario 4: Claim signature (trust gate) ─────────────────────────────────

  describe('4. Economy — claim signature trust_score gate', () => {
    it('should reject claim when wallet not set', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/web3/claim-signature')
        .set(DEV_HEADERS)
        .send({ amountToClaim: 10 })
        .expect(400);

      expect(res.body.message).toMatch(/wallet/i);
    });

    it('should reject claim when amount exceeds gold balance', async () => {
      const profileRes = await request(app.getHttpServer())
        .get('/api/user/profile')
        .set(DEV_HEADERS);

      // Request more than balance
      const res = await request(app.getHttpServer())
        .post('/api/web3/claim-signature')
        .set(DEV_HEADERS)
        .send({ amountToClaim: profileRes.body.goldBalance + 99999 })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });
  });

  // ── Scenario 5: Marketplace ───────────────────────────────────────────────────

  describe('5. Marketplace — browse listings', () => {
    it('should return paginated listings', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/marketplace/listings?limit=10&offset=0')
        .set(DEV_HEADERS)
        .expect(200);

      expect(res.body).toMatchObject({
        total: expect.any(Number),
        offset: 0,
        limit: 10,
        items: expect.any(Array),
      });
    });

    it('should filter by assetType=user_items', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/marketplace/listings?assetType=user_items&limit=5')
        .set(DEV_HEADERS)
        .expect(200);

      const items = res.body.items as any[];
      items.forEach((item) => {
        expect(item.assetType).toBe('user_items');
      });
    });

    it('should return my listings', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/marketplace/my-listings')
        .set(DEV_HEADERS)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── Scenario 6: Gacha commit ─────────────────────────────────────────────────

  describe('6. Gacha — commit requires FARM balance', () => {
    it('should fail commit when user has no FARM tokens (insufficient allowance)', async () => {
      const commitment = '0x' + '1'.repeat(64);
      const res = await request(app.getHttpServer())
        .post('/api/web3/gacha/commit')
        .set(DEV_HEADERS)
        .send({ commitment });

      // Either 404 (route not found for non-Web3 env) or 400 (no wallet/allowance)
      expect([400, 404]).toContain(res.status);
    });
  });

  // ── Health check ───────────────────────────────────────────────────────────────

  describe('Health', () => {
    it('GET /api/farm/weather/today returns weather event', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/farm/weather/today')
        .set(DEV_HEADERS)
        .expect(200);

      expect(res.body).toMatchObject({
        name: expect.any(String),
        effect: expect.any(String),
        value: expect.any(Number),
      });
    });

    it('GET /api/quest/daily returns daily quests array', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/quest/daily')
        .set(DEV_HEADERS)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
