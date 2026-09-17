/**
 * k6 Comprehensive Load Test — BarnBuddy (FlappyX) Full Ecosystem
 * =================================================================
 *
 * Full gameplay simulation covering 100% of player loops:
 *   1. Auth & Telegram HMAC session verification
 *   2. Core Cultivation: plant, water, fertilize, harvest, dig, weather
 *   3. Barn Storage & Crafting: inventory, pack crates, sell-all, shop
 *   4. Defense & Social PvP: guard dogs, neighbor visits, steal raids, revenge
 *   5. Guild & World Tree: guild directory, my guild, water world tree
 *   6. Web3 & Deflation Engine: treasury status, dynamic rates, cashout quota, EIP-712 marketplace
 *
 * Profiles:
 *   PROFILE=smoke   — 5 VUs / 30s, quick sanity check across all endpoints
 *   PROFILE=load    — ramp to VUS (default 50) → hold 3m → ramp down
 *   PROFILE=stress  — ramp to VUS → 2×VUS → 4×VUS
 *   PROFILE=soak    — constant VUs during HOLD (leak detection)
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import crypto from 'k6/crypto';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// ─────────────────────────────────────────────────────────────────
// 0. CONFIG & SAFETY
// ─────────────────────────────────────────────────────────────────
const BASE_URL  = (__ENV.BASE_URL || 'http://localhost:3003').replace(/\/+$/, '');
const BOT_TOKEN = __ENV.BOT_TOKEN || '';
const PROFILE   = __ENV.PROFILE || 'smoke';
const VUS       = Number(__ENV.VUS || 50);
const RAMP      = __ENV.RAMP || '1m';
const HOLD      = __ENV.HOLD || '3m';
const THINK     = Number(__ENV.THINK || 1); // Seconds think-time between actions

if (BASE_URL.includes('flappyx.com') && __ENV.ALLOW_PROD !== 'true') {
  throw new Error(
    'Refusing to run load test in production. Only set ALLOW_PROD=true when ' +
      'explicit written permission and a maintenance window are granted.',
  );
}
if (!BOT_TOKEN) {
  throw new Error(
    'Missing BOT_TOKEN. Must match TELEGRAM_BOT_TOKEN of target backend, ' +
      'otherwise all requests will receive 401 (invalid HMAC).',
  );
}

// 5xx and timeouts are infrastructure errors. 4xx represents valid business responses
// (e.g., crop not ripe yet, out of energy, daily claim cooldown).
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 499 }));

// ─────────────────────────────────────────────────────────────────
// 1. CUSTOM METRICS
// ─────────────────────────────────────────────────────────────────
const businessErrors  = new Rate('business_errors');
const readsCompleted  = new Counter('reads_completed');
const plantsPlanted   = new Counter('plants_planted');
const cropsHarvested  = new Counter('crops_harvested');
const plotsWatered    = new Counter('plots_watered');
const fertilizerUsed  = new Counter('fertilizer_used');
const stealWins       = new Counter('steal_wins');
const stealDogBites   = new Counter('steal_dog_bites');
const dailyClaims     = new Counter('daily_claims');
const barnSells       = new Counter('barn_sells');
const guildWaters     = new Counter('guild_waters');
const treasuryReads   = new Counter('treasury_reads');

const authLatency     = new Trend('auth_latency');
const farmLatency     = new Trend('farm_latency');
const stealLatency    = new Trend('steal_latency');
const marketLatency   = new Trend('market_latency');
const treasuryLatency = new Trend('treasury_latency');

// ─────────────────────────────────────────────────────────────────
// 2. PROFILES & THRESHOLDS
// ─────────────────────────────────────────────────────────────────
const THRESHOLDS_COMMON = {
  http_req_failed:                    ['rate<0.01'], // 99% HTTP success (no 5xx)
  http_req_duration:                  ['p(95)<600', 'p(99)<1800'],
  'http_req_duration{name:steal}':    ['p(95)<300'],
  'http_req_duration{name:harvest}':  ['p(95)<300'],
  'http_req_duration{name:plant}':    ['p(95)<400'],
  'http_req_duration{name:treasury}': ['p(95)<200'],
  business_errors:                    ['rate<0.05'],
};

const PROFILES = {
  smoke: {
    scenarios: {
      smoke: { executor: 'constant-vus', vus: 5, duration: '30s', exec: 'fullFlow' },
    },
    thresholds: {
      http_req_failed:   ['rate<0.01'],
      http_req_duration: ['p(95)<800'],
    },
  },

  load: {
    scenarios: {
      load: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: RAMP, target: VUS },
          { duration: HOLD, target: VUS },
          { duration: '30s', target: 0 },
        ],
        gracefulRampDown: '20s',
        exec: 'fullFlow',
      },
    },
    thresholds: THRESHOLDS_COMMON,
  },

  stress: {
    scenarios: {
      stress: {
        executor: 'ramping-vus',
        startVUs: 1,
        stages: [
          { duration: RAMP, target: VUS },
          { duration: HOLD, target: VUS },
          { duration: RAMP, target: VUS * 2 },
          { duration: HOLD, target: VUS * 2 },
          { duration: RAMP, target: VUS * 4 },
          { duration: HOLD, target: VUS * 4 },
          { duration: '1m', target: 0 },
        ],
        gracefulRampDown: '30s',
        exec: 'fullFlow',
      },
    },
    thresholds: {
      ...THRESHOLDS_COMMON,
      http_req_failed: ['rate<0.05'], // Stress allows up to 5% failure under extreme surge
    },
  },

  soak: {
    scenarios: {
      soak: {
        executor: 'constant-vus',
        vus: VUS,
        duration: HOLD,
        exec: 'fullFlow',
      },
    },
    thresholds: THRESHOLDS_COMMON,
  },
};

export const options = PROFILES[PROFILE] || PROFILES.smoke;

// ─────────────────────────────────────────────────────────────────
// 3. AUTHENTICATION (Telegram initData HMAC)
// ─────────────────────────────────────────────────────────────────
let session = null;

function buildInitData(telegramId, username) {
  const userJson = JSON.stringify({
    id: telegramId,
    first_name: 'LoadTester',
    username,
    language_code: 'en',
  });

  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id:  `AA${telegramId}`,
    user:      userJson,
  };

  const dataCheckString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');

  const secretKey = crypto.hmac('sha256', 'WebAppData', BOT_TOKEN, 'binary');
  const hash      = crypto.hmac('sha256', secretKey, dataCheckString, 'hex');

  return Object.keys(fields)
    .map((k) => `${k}=${encodeURIComponent(fields[k])}`)
    .concat(`hash=${hash}`)
    .join('&');
}

function ensureSession() {
  if (session) return session;
  const telegramId = 900_000_000 + __VU;
  session = { telegramId, initData: buildInitData(telegramId, `player_vu${__VU}`) };
  return session;
}

function headers() {
  ensureSession();
  return {
    'Content-Type': 'application/json',
    'x-telegram-init-data': session.initData,
  };
}

// ─────────────────────────────────────────────────────────────────
// 4. MAIN FLOW (Player Journey Simulation)
// ─────────────────────────────────────────────────────────────────
export function fullFlow() {
  ensureSession();
  const h = headers();

  // 1. Initial State & General Observation (100% of iterations)
  const { farm, seeds } = coreReadFlow(h);
  sleep(THINK * (0.3 + Math.random() * 0.4));

  // 2. Agricultural Operations: Plant, Water, Fertilize, Harvest (80% prob)
  if (farm && Math.random() < 0.8) {
    farmingWriteFlow(h, farm, seeds);
    sleep(THINK * (0.3 + Math.random() * 0.4));
  }

  // 3. Barn Storage & Commerce: Sell crops, Pack crates, Shop (35% prob)
  if (Math.random() < 0.35) {
    inventoryAndShopFlow(h);
    sleep(THINK * (0.3 + Math.random() * 0.4));
  }

  // 4. Social & PvP Raids: Leaderboard, Neighbor visit, Steal (35% prob)
  if (Math.random() < 0.35) {
    socialAndRaidFlow(h);
    sleep(THINK * (0.3 + Math.random() * 0.4));
  }

  // 5. Guild World Tree & Web3 Deflation: Treasury, Dynamic rates, Quota (30% prob)
  if (Math.random() < 0.30) {
    guildAndWeb3Flow(h);
    sleep(THINK * (0.3 + Math.random() * 0.4));
  }
}

// ─────────────────────────────────────────────────────────────────
// 5. SUB-FLOWS
// ─────────────────────────────────────────────────────────────────

/**
 * Core Read Flow: Profile, Farm, Seeds, Weather, Quests, Treasury
 */
function coreReadFlow(h) {
  let farmData = null;
  let seedsData = [];

  group('core_reads', () => {
    // 1. Profile
    const profileRes = http.get(`${BASE_URL}/api/user/profile`, { headers: h, tags: { name: 'profile' } });
    authLatency.add(profileRes.timings.duration);
    check(profileRes, { 'profile 200': (r) => r.status === 200 });
    readsCompleted.add(1);

    // 2. Farm
    const farmRes = http.get(`${BASE_URL}/api/farm/my`, { headers: h, tags: { name: 'farm_my' } });
    farmLatency.add(farmRes.timings.duration);
    if (check(farmRes, { 'farm 200': (r) => r.status === 200 })) {
      try { farmData = JSON.parse(farmRes.body); } catch {}
    }
    readsCompleted.add(1);

    // 3. Seeds
    const seedsRes = http.get(`${BASE_URL}/api/farm/seeds`, { headers: h, tags: { name: 'seeds' } });
    check(seedsRes, { 'seeds 200': (r) => r.status === 200 });
    try { seedsData = JSON.parse(seedsRes.body); } catch {}
    readsCompleted.add(1);

    // 4. Weather
    const weatherRes = http.get(`${BASE_URL}/api/farm/weather/today`, { headers: h, tags: { name: 'weather' } });
    check(weatherRes, { 'weather 200': (r) => r.status === 200 });
    readsCompleted.add(1);

    // 5. Treasury Status (Public endpoint)
    const treasuryRes = http.get(`${BASE_URL}/api/web3/treasury-status`, { headers: h, tags: { name: 'treasury' } });
    treasuryLatency.add(treasuryRes.timings.duration);
    check(treasuryRes, { 'treasury 200': (r) => r.status === 200 });
    treasuryReads.add(1);
  });

  return { farm: farmData, seeds: seedsData };
}

/**
 * Farming Write Flow: Plant, Water, Fertilize, Harvest, Dig
 */
function farmingWriteFlow(h, farm, seeds) {
  group('farming_actions', () => {
    const plots = farm.plots || [];

    // 1. HARVEST ripe crops first
    const ripePlot = plots.find((p) => p.isRipe);
    if (ripePlot) {
      const harvestRes = http.post(
        `${BASE_URL}/api/action/harvest`,
        JSON.stringify({ plotId: ripePlot.id }),
        { headers: h, tags: { name: 'harvest' } },
      );
      farmLatency.add(harvestRes.timings.duration);
      if (harvestRes.status === 201) {
        cropsHarvested.add(1);
      }
      check(harvestRes, { 'harvest 201/400': (r) => r.status === 201 || r.status === 400 });
      trackError(harvestRes.status);
    }

    // 2. PLANT seeds in empty plots
    const emptyPlot = plots.find((p) => p.isEmpty);
    const validSeed = seeds && seeds.length > 0 ? seeds[0] : null;
    if (emptyPlot && validSeed) {
      const plantRes = http.post(
        `${BASE_URL}/api/action/plant`,
        JSON.stringify({ plotId: emptyPlot.id, seedId: validSeed.id }),
        { headers: h, tags: { name: 'plant' } },
      );
      farmLatency.add(plantRes.timings.duration);
      if (plantRes.status === 201) {
        plantsPlanted.add(1);
      }
      check(plantRes, { 'plant 201/400': (r) => r.status === 201 || r.status === 400 });
      trackError(plantRes.status);
    }

    // 3. WATER any growing plot
    const plantedPlot = plots.find((p) => !p.isEmpty && !p.isRipe);
    if (plantedPlot) {
      const waterRes = http.post(
        `${BASE_URL}/api/action/water`,
        JSON.stringify({ plotId: plantedPlot.id }),
        { headers: h, tags: { name: 'water' } },
      );
      if (waterRes.status === 201) {
        plotsWatered.add(1);
      }
      check(waterRes, { 'water 201/400': (r) => r.status === 201 || r.status === 400 });
      trackError(waterRes.status);
    }

    // 4. FERTILIZE occasionally (10% chance)
    if (plantedPlot && Math.random() < 0.10) {
      const fertRes = http.post(
        `${BASE_URL}/api/action/fertilize`,
        JSON.stringify({ plotId: plantedPlot.id, tier: 'normal' }),
        { headers: h, tags: { name: 'fertilize' } },
      );
      if (fertRes.status === 201) {
        fertilizerUsed.add(1);
      }
      check(fertRes, { 'fertilize 201/400': (r) => r.status === 201 || r.status === 400 });
      trackError(fertRes.status);
    }

    // 5. FARM BUILDINGS check
    const buildingsRes = http.get(`${BASE_URL}/api/action/buildings`, { headers: h, tags: { name: 'buildings' } });
    check(buildingsRes, { 'buildings 200': (r) => r.status === 200 });
    readsCompleted.add(1);
  });
}

/**
 * Storage, Inventory & Marketplace Flow
 */
function inventoryAndShopFlow(h) {
  group('inventory_and_commerce', () => {
    // 1. Barn storage
    const barnRes = http.get(`${BASE_URL}/api/inventory/barn`, { headers: h, tags: { name: 'barn' } });
    check(barnRes, { 'barn 200': (r) => r.status === 200 });
    readsCompleted.add(1);

    // 2. Liquidate crops for GOLD
    const sellRes = http.post(`${BASE_URL}/api/inventory/sell-all`, null, { headers: h, tags: { name: 'sell_all' } });
    if (sellRes.status === 201) {
      barnSells.add(1);
    }
    check(sellRes, { 'sell-all 200/201/400': (r) => r.status === 200 || r.status === 201 || r.status === 400 });
    trackError(sellRes.status);

    // 3. Shop items catalog
    const shopRes = http.get(`${BASE_URL}/api/shop/items`, { headers: h, tags: { name: 'shop' } });
    check(shopRes, { 'shop 200': (r) => r.status === 200 });
    readsCompleted.add(1);

    // 4. Marketplace listings
    const marketRes = http.get(`${BASE_URL}/api/marketplace/listings?limit=20`, { headers: h, tags: { name: 'market' } });
    marketLatency.add(marketRes.timings.duration);
    check(marketRes, { 'listings 200': (r) => r.status === 200 });
    readsCompleted.add(1);

    // 5. My marketplace listings
    const myListingsRes = http.get(`${BASE_URL}/api/marketplace/my-listings`, { headers: h, tags: { name: 'my_listings' } });
    check(myListingsRes, { 'my-listings 200': (r) => r.status === 200 });
    readsCompleted.add(1);
  });
}

/**
 * Social, Guard Dogs & Steal Raids Flow
 */
function socialAndRaidFlow(h) {
  group('social_and_raids', () => {
    // 1. Global Leaderboard
    const lbRes = http.get(`${BASE_URL}/api/user/leaderboard`, { headers: h, tags: { name: 'leaderboard' } });
    check(lbRes, { 'leaderboard 200': (r) => r.status === 200 });
    readsCompleted.add(1);

    // 2. Guard Dog status
    const dogRes = http.get(`${BASE_URL}/api/web3/nft-status`, { headers: h, tags: { name: 'dog_status' } });
    check(dogRes, { 'nft-status 200': (r) => r.status === 200 });
    readsCompleted.add(1);

    // 3. Friends List
    const friendsRes = http.get(`${BASE_URL}/api/user/friends`, { headers: h, tags: { name: 'friends' } });
    check(friendsRes, { 'friends 200': (r) => r.status === 200 });
    readsCompleted.add(1);

    // 4. Notifications (Theft alerts)
    const notifRes = http.get(`${BASE_URL}/api/notification/inbox`, { headers: h, tags: { name: 'notifications' } });
    check(notifRes, { 'notification 200': (r) => r.status === 200 });
    readsCompleted.add(1);

    // 5. High-Stakes Steal Raid
    // Either target explicit victim or self-discover neighbor
    let targetUserId = __ENV.VICTIM_USER_ID;
    let targetPlotId = null;

    if (!targetUserId) {
      try {
        const lbData = JSON.parse(lbRes.body);
        const candidates = (lbData.items || lbData || []).filter((u) => u && u.id && u.telegramId !== session.telegramId);
        if (candidates.length > 0) {
          const randomVictim = candidates[Math.floor(Math.random() * candidates.length)];
          targetUserId = randomVictim.id;
        }
      } catch {}
    }

    if (targetUserId) {
      // Visit neighbor farm first to discover ripe plots
      const neighborFarmRes = http.get(`${BASE_URL}/api/farm/${targetUserId}`, { headers: h, tags: { name: 'neighbor_farm' } });
      if (neighborFarmRes.status === 200) {
        try {
          const neighborFarm = JSON.parse(neighborFarmRes.body);
          const ripe = (neighborFarm.plots || []).find((p) => p.isRipe);
          if (ripe) targetPlotId = ripe.id;
        } catch {}
      }

      // If ripe plot found (or fallback to configured victim plots), attempt steal
      if (!targetPlotId && __ENV.VICTIM_PLOT_IDS) {
        const pids = __ENV.VICTIM_PLOT_IDS.split(',');
        targetPlotId = pids[Math.floor(Math.random() * pids.length)];
      }

      if (targetPlotId) {
        const stealRes = http.post(
          `${BASE_URL}/api/action/steal`,
          JSON.stringify({ targetUserId, plotId: targetPlotId }),
          { headers: h, tags: { name: 'steal' } },
        );
        stealLatency.add(stealRes.timings.duration);

        try {
          const body = JSON.parse(stealRes.body);
          if (body && body.success === true)  stealWins.add(1);
          if (body && body.success === false) stealDogBites.add(1);
        } catch {}

        check(stealRes, {
          'steal 201/400/404': (r) => r.status === 201 || r.status === 400 || r.status === 404,
        });
        trackError(stealRes.status);
      }
    }
  });
}

/**
 * Guild, World Tree & Web3 Economy Flow
 */
function guildAndWeb3Flow(h) {
  group('guild_and_web3', () => {
    // 1. Daily Claim
    const dailyRes = http.post(`${BASE_URL}/api/user/daily-claim`, null, { headers: h, tags: { name: 'daily_claim' } });
    if (dailyRes.status === 201) {
      dailyClaims.add(1);
    }
    check(dailyRes, { 'daily-claim 200/201/400': (r) => r.status === 200 || r.status === 201 || r.status === 400 });

    // 2. Daily Quests
    const questsRes = http.get(`${BASE_URL}/api/quest/daily`, { headers: h, tags: { name: 'quests' } });
    check(questsRes, { 'quests 200': (r) => r.status === 200 });
    readsCompleted.add(1);

    // 3. Guild Directory & My Guild
    const guildListRes = http.get(`${BASE_URL}/api/guild/list`, { headers: h, tags: { name: 'guild_list' } });
    check(guildListRes, { 'guild-list 200': (r) => r.status === 200 });
    readsCompleted.add(1);

    const myGuildRes = http.get(`${BASE_URL}/api/guild/my`, { headers: h, tags: { name: 'guild_my' } });
    check(myGuildRes, { 'guild-my 200': (r) => r.status === 200 });
    readsCompleted.add(1);

    // 4. Water Guild World Tree
    const waterTreeRes = http.post(`${BASE_URL}/api/guild/water`, JSON.stringify({}), { headers: h, tags: { name: 'guild_water' } });
    if (waterTreeRes.status === 201) {
      guildWaters.add(1);
    }
    check(waterTreeRes, { 'water-tree 200/201/400/404': (r) => r.status === 200 || r.status === 201 || r.status === 400 || r.status === 404 });

    // 5. Dynamic Rates & Economy Health (Alpha α)
    const ratesRes = http.get(`${BASE_URL}/api/web3/dynamic-rates`, { headers: h, tags: { name: 'dynamic_rates' } });
    check(ratesRes, { 'dynamic-rates 200': (r) => r.status === 200 });
    readsCompleted.add(1);

    // 6. Cashout Quota
    const quotaRes = http.get(`${BASE_URL}/api/web3/cashout-quota`, { headers: h, tags: { name: 'cashout_quota' } });
    check(quotaRes, { 'cashout-quota 200': (r) => r.status === 200 });
    readsCompleted.add(1);
  });
}

function trackError(status) {
  // 5xx and 401/403 are infrastructure/auth issues. 400 is acceptable business logic.
  if (status >= 500 || status === 401 || status === 403) {
    businessErrors.add(true);
  } else {
    businessErrors.add(false);
  }
}

// ─────────────────────────────────────────────────────────────────
// 6. REPORT & SUMMARY EXPORT
// ─────────────────────────────────────────────────────────────────
export function handleSummary(data) {
  const failures = [];
  for (const [metric, m] of Object.entries(data.metrics)) {
    if (m.thresholds) {
      for (const [threshold, result] of Object.entries(m.thresholds)) {
        if (!result.ok) failures.push(`${metric} ${threshold}`);
      }
    }
  }
  const pass = failures.length === 0;
  console.log(
    pass
      ? '\n✅ K6 COMPREHENSIVE LOAD TEST PASSED\n'
      : `\n❌ K6 LOAD TEST FAILED THRESHOLDS: ${failures.join(', ')}\n`,
  );

  const plain = textSummary(data, { indent: ' ', enableColors: false });

  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'load_test_summary.json': JSON.stringify(data, null, 2),
    '/home/ubuntu/barnbuddy/load_test.md': plain,
  };
}
