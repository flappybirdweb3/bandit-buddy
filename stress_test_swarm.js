/**
 * ============================================================================
 * STRESS TEST SWARM — BanditBuddy GameFi Multi-Agent Load Engine
 * File: /home/ubuntu/barnbuddy/stress_test_swarm.js
 * ============================================================================
 *
 * Implements the 4-Stage Tiered Ramp-up & 3 Personas defined in STRESS_TEST.MD:
 *   - Persona 1: F2P Grinders (80%) — Farm loop, Steal raids, Gold->FARM withdrawals
 *   - Persona 2: Web3 Farmers (15%) — Marketplace trading, Inventory packing/selling
 *   - Persona 3: Whale Degens  (5%)  — Plot upgrades, Treasury buyback, Guild tree, Dog fusion
 *
 * Execution Profiles:
 *   PROFILE=smoke          — 10 VUs / 30s quick sanity check
 *   PROFILE=warmup         — Stage 1: 500 CCU (~200 RPS) baseline latency
 *   PROFILE=peak           — Stage 2: 1,500 CCU (~800 RPS) peak production load
 *   PROFILE=saturation     — Stage 3: 3,000 CCU (~1,500 RPS) lock contention & deadlocks
 *   PROFILE=breaking_point — Stage 4: 5,000 -> 10,000 CCU (~3,500 RPS) push CPU 100% & Kill Switch
 *   PROFILE=ladder         — Full 40-minute phased ladder across all 4 stages
 *
 * Usage:
 *   BOT_TOKEN=<real_telegram_bot_token> k6 run stress_test_swarm.js
 *   BOT_TOKEN=<token> PROFILE=warmup k6 run stress_test_swarm.js
 *   BOT_TOKEN=<token> PROFILE=breaking_point BASE_URL=http://localhost:3003 k6 run stress_test_swarm.js
 *
 * REQUIRED: BOT_TOKEN env var must be the real Telegram bot token.
 *   After the QA audit removed the isDev HMAC bypass, the server FAILS CLOSED
 *   when the token is wrong — all VUs will receive 401 with a fake token.
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import crypto from 'k6/crypto';
import encoding from 'k6/encoding';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// 0. CONFIGURATION & ENVIRONMENT
// ─────────────────────────────────────────────────────────────────────────────
const BASE_URL  = (__ENV.BASE_URL || 'http://localhost:3003').replace(/\/+$/, '');
const BOT_TOKEN = __ENV.BOT_TOKEN || __ENV.TELEGRAM_BOT_TOKEN || '';
const PROFILE   = __ENV.PROFILE || 'smoke';
const THINK     = Number(__ENV.THINK || 1); // Think time between actions in seconds

if (!BOT_TOKEN) {
  console.warn('[WARN] BOT_TOKEN not set — auth will fail (server rejects unknown tokens). Pass BOT_TOKEN=<real_token>');
}

// Accept 200..499 as valid HTTP responses (business rejections like cooldown/dry soil are not 5xx)
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 499 }));

// ─────────────────────────────────────────────────────────────────────────────
// 1. CUSTOM METRICS & TELEMETRY
// ─────────────────────────────────────────────────────────────────────────────
const f2pActionsCompleted    = new Counter('f2p_actions_completed');
const stealAttemptsTotal     = new Counter('steal_attempts_total');
const stealSuccesses         = new Counter('steal_successes');
const stealBlockedByDog      = new Counter('steal_blocked_by_dog');
const stealBlockedByShield   = new Counter('steal_blocked_by_shield');
const plotsWatered           = new Counter('plots_watered');
const cropsHarvested         = new Counter('crops_harvested');

const marketTradesTotal      = new Counter('market_trades_total');
const inventoryPacksTotal    = new Counter('inventory_packs_total');

const whalePlotUpgrades      = new Counter('whale_plot_upgrades');
const whaleTreasuryTriggers  = new Counter('whale_treasury_triggers');
const whaleGuildWaters       = new Counter('whale_guild_waters');

const killSwitchTriggered503 = new Counter('kill_switch_triggered_503');
const rateLimitThrottled429  = new Counter('rate_limit_throttled_429');
const internalServerErrors500 = new Counter('internal_server_errors_500');

const responseTimeTrend      = new Trend('custom_req_duration');
const stealLatencyTrend      = new Trend('steal_req_duration');
const claimLatencyTrend      = new Trend('claim_req_duration');

// ─────────────────────────────────────────────────────────────────────────────
// 2. SCENARIOS & PROFILES SETUP
// ─────────────────────────────────────────────────────────────────────────────
function buildScenarios(targetVUs, rampTime, holdTime) {
  const f2pVUs    = Math.max(1, Math.floor(targetVUs * 0.80));
  const farmerVUs = Math.max(1, Math.floor(targetVUs * 0.15));
  const whaleVUs  = Math.max(1, Math.floor(targetVUs * 0.05));

  return {
    f2p_grinders: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: rampTime, target: f2pVUs },
        { duration: holdTime, target: f2pVUs },
        { duration: '30s', target: 0 },
      ],
      exec: 'personaF2PGrinder',
      gracefulRampDown: '15s',
    },
    web3_farmers: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: rampTime, target: farmerVUs },
        { duration: holdTime, target: farmerVUs },
        { duration: '30s', target: 0 },
      ],
      exec: 'personaWeb3Farmer',
      gracefulRampDown: '15s',
    },
    whale_degens: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: rampTime, target: whaleVUs },
        { duration: holdTime, target: whaleVUs },
        { duration: '30s', target: 0 },
      ],
      exec: 'personaWhaleDegen',
      gracefulRampDown: '15s',
    },
  };
}

const STAGE_CONFIGS = {
  // Quick smoke test: 10 VUs / 30s
  smoke: {
    scenarios: {
      f2p:    { executor: 'constant-vus', vus: 8, duration: '30s', exec: 'personaF2PGrinder' },
      farmer: { executor: 'constant-vus', vus: 2, duration: '30s', exec: 'personaWeb3Farmer' },
    },
    thresholds: {
      http_req_failed: ['rate<0.02'],
      http_req_duration: ['p(95)<800'],
    },
  },

  // Stage 1: Warm-up (500 CCU)
  warmup: {
    scenarios: buildScenarios(500, '1m', '4m'),
    thresholds: {
      http_req_failed: ['rate<0.01'],
      http_req_duration: ['p(95)<250', 'p(99)<600'],
      internal_server_errors_500: ['count==0'],
    },
  },

  // Stage 2: Normal Peak (1,500 CCU)
  peak: {
    scenarios: buildScenarios(1500, '2m', '8m'),
    thresholds: {
      http_req_failed: ['rate<0.02'],
      http_req_duration: ['p(95)<500', 'p(99)<1200'],
      internal_server_errors_500: ['count<10'],
    },
  },

  // Stage 3: High Saturation & Concurrency Contention (3,000 CCU)
  saturation: {
    scenarios: buildScenarios(3000, '3m', '7m'),
    thresholds: {
      http_req_failed: ['rate<0.05'],
      http_req_duration: ['p(95)<1500'],
      internal_server_errors_500: ['count<50'],
    },
  },

  // Stage 4: Breaking Point & Kill Switch Trigger (5,000 -> 10,000 CCU)
  breaking_point: {
    scenarios: {
      f2p_surge: {
        executor: 'ramping-vus',
        startVUs: 100,
        stages: [
          { duration: '2m', target: 4000 },
          { duration: '3m', target: 8000 },
          { duration: '3m', target: 8000 },
          { duration: '1m', target: 0 },
        ],
        exec: 'personaF2PGrinder',
      },
      farmer_surge: {
        executor: 'ramping-vus',
        startVUs: 20,
        stages: [
          { duration: '2m', target: 1000 },
          { duration: '3m', target: 1500 },
          { duration: '3m', target: 1500 },
          { duration: '1m', target: 0 },
        ],
        exec: 'personaWeb3Farmer',
      },
      whale_surge: {
        executor: 'ramping-vus',
        startVUs: 10,
        stages: [
          { duration: '2m', target: 200 },
          { duration: '3m', target: 500 },
          { duration: '3m', target: 500 },
          { duration: '1m', target: 0 },
        ],
        exec: 'personaWhaleDegen',
      },
    },
    thresholds: {
      // Breaking point deliberately expects Throttler 429 and 503 circuit breakers.
      // p(99) < 15000ms guards against full collapse (> 15s = server is dead, not just slow).
      internal_server_errors_500: ['count<200'],
      http_req_duration: ['p(99)<15000'],
    },
  },

  // Full Ladder: Phased run across all 4 stages
  ladder: {
    scenarios: {
      f2p_ladder: {
        executor: 'ramping-vus',
        startVUs: 50,
        stages: [
          { duration: '3m', target: 400 },   // Warm-up (400 F2P)
          { duration: '5m', target: 1200 },  // Peak (1200 F2P)
          { duration: '6m', target: 2400 },  // Saturation (2400 F2P)
          { duration: '6m', target: 4000 },  // Breaking (4000 F2P)
          { duration: '2m', target: 0 },
        ],
        exec: 'personaF2PGrinder',
      },
      farmer_ladder: {
        executor: 'ramping-vus',
        startVUs: 10,
        stages: [
          { duration: '3m', target: 75 },
          { duration: '5m', target: 225 },
          { duration: '6m', target: 450 },
          { duration: '6m', target: 750 },
          { duration: '2m', target: 0 },
        ],
        exec: 'personaWeb3Farmer',
      },
      whale_ladder: {
        executor: 'ramping-vus',
        startVUs: 5,
        stages: [
          { duration: '3m', target: 25 },
          { duration: '5m', target: 75 },
          { duration: '6m', target: 150 },
          { duration: '6m', target: 250 },
          { duration: '2m', target: 0 },
        ],
        exec: 'personaWhaleDegen',
      },
    },
    thresholds: {
      internal_server_errors_500: ['count<50'],
      http_req_duration: ['p(95)<3000', 'p(99)<8000'],
    },
  },
};

export const options = STAGE_CONFIGS[PROFILE] || STAGE_CONFIGS.smoke;

// ─────────────────────────────────────────────────────────────────────────────
// 3. AUTHENTICATION (Telegram HMAC + Session Token Bearer)
// ─────────────────────────────────────────────────────────────────────────────
function createTelegramInitData(telegramId, username) {
  const userJson = JSON.stringify({
    id: telegramId,
    first_name: 'SwarmBot',
    username: username,
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

// Thread-local session cache per VU (each VU has its own JS context in k6)
const vuSessions = {};

// Persona-specific telegram ID ranges — prevents F2P VU #N and Farmer VU #N
// sharing the same telegram account and contending on the same farm row.
//   F2P:    800_000_001 – 800_050_000
//   Farmer: 900_000_001 – 900_010_000
//   Whale:  910_000_001 – 910_002_500
const PERSONA_ID_BASE = {
  f2p:    800_000_000,
  farmer: 900_000_000,
  whale:  910_000_000,
};

function getAuthHeaders(vuId, rolePrefix) {
  const cacheKey = `${rolePrefix}_${vuId}`;
  if (vuSessions[cacheKey]) {
    return vuSessions[cacheKey].headers;
  }

  const telegramId = PERSONA_ID_BASE[rolePrefix] + vuId;
  const username = `${rolePrefix}_bot_${vuId}`;
  const initData = createTelegramInitData(telegramId, username);

  // Exchange for standard Bearer session token via simple GET (no custom headers).
  // This is the proxy-safe auth flow introduced in the QA audit.
  let bearerToken = null;
  try {
    const b64 = encoding.b64encode(initData);
    const sessionRes = http.get(`${BASE_URL}/api/auth/session?d=${encodeURIComponent(b64)}`, {
      tags: { name: 'auth_session' },
      timeout: '5s',
    });

    if (sessionRes.status === 200) {
      const data = sessionRes.json();
      if (data && data.token) bearerToken = data.token;
    }
  } catch (e) {}

  const headers = { 'Content-Type': 'application/json' };

  if (bearerToken) {
    headers['Authorization'] = `Bearer ${bearerToken}`;
  } else {
    // Fallback: direct initData header (non-proxy environments)
    headers['x-telegram-init-data'] = initData;
  }

  vuSessions[cacheKey] = { telegramId, username, headers };
  return headers;
}

// Track status codes helper
function recordTelemetry(res, name = 'generic') {
  responseTimeTrend.add(res.timings.duration, { endpoint: name });

  if (res.status === 429) {
    rateLimitThrottled429.add(1);
  } else if (res.status === 503) {
    killSwitchTriggered503.add(1);
  } else if (res.status >= 500) {
    internalServerErrors500.add(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.5 DEFAULT EXPORT FALLBACK (for CLI overrides like --vus / --duration)
// ─────────────────────────────────────────────────────────────────────────────
export default function () {
  personaF2PGrinder();
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SEED CATALOG CACHE — fetched once per VU on first use
//    plant-all requires a real UUID from seed_configs, not a name/iconKey string.
// ─────────────────────────────────────────────────────────────────────────────
let _seedCache = null;

function getWheatSeedId(headers) {
  if (_seedCache) return _seedCache;
  const res = http.get(`${BASE_URL}/api/farm/seeds`, { headers, tags: { name: 'seeds_catalog' } });
  if (res.status === 200) {
    const seeds = res.json();
    if (Array.isArray(seeds)) {
      const wheat = seeds.find((s) => s.iconKey === 'wheat' || s.name === 'Wheat');
      if (wheat) {
        _seedCache = wheat.id;
        return _seedCache;
      }
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. PERSONA 1: 80% F2P GRINDERS (Farm loop, Steal, Withdraw)
// ─────────────────────────────────────────────────────────────────────────────
export function personaF2PGrinder() {
  const headers = getAuthHeaders(__VU, 'f2p');

  // 1. Profile & Farm Status Check
  const farmRes = http.get(`${BASE_URL}/api/farm/my`, { headers, tags: { name: 'f2p_farm_my' } });
  recordTelemetry(farmRes, 'farm_my');

  if (farmRes.status === 200) {
    f2pActionsCompleted.add(1);

    // 2. Daily Claim
    const claimRes = http.post(`${BASE_URL}/api/user/daily-claim`, null, { headers, tags: { name: 'daily_claim' } });
    recordTelemetry(claimRes, 'daily_claim');

    // 3. Harvest All
    const harvestRes = http.post(`${BASE_URL}/api/action/harvest-all`, null, { headers, tags: { name: 'harvest_all' } });
    recordTelemetry(harvestRes, 'harvest_all');
    if (harvestRes.status === 200) cropsHarvested.add(1);

    // 4. Plant All — requires real UUID from seed_configs, not the name/iconKey string.
    //    getWheatSeedId() fetches /farm/seeds once and caches the UUID per VU.
    const wheatId = getWheatSeedId(headers);
    if (wheatId) {
      const plantRes = http.post(
        `${BASE_URL}/api/action/plant-all`,
        JSON.stringify({ seedId: wheatId }),
        { headers, tags: { name: 'plant_all' } },
      );
      recordTelemetry(plantRes, 'plant_all');
    }

    // 5. Water first unwatered plot
    const farmData = farmRes.json();
    if (farmData && farmData.plots && farmData.plots.length > 0) {
      const firstPlot = farmData.plots[0];
      const waterRes = http.post(
        `${BASE_URL}/api/action/water`,
        JSON.stringify({ plotId: firstPlot.id }),
        { headers, tags: { name: 'water' } },
      );
      recordTelemetry(waterRes, 'water');
      if (waterRes.status === 200) plotsWatered.add(1);
    }

    // 6. Steal Raid on Neighbor
    //    Step A: find a target via /user/explore (returns { userId, ripePlots, ... })
    //    Step B: GET /farm/:userId to get a real ripe plotId (server expects UUID, not plotIndex)
    //    Step C: POST /action/steal with { targetUserId, plotId }
    const exploreRes = http.get(`${BASE_URL}/api/user/explore`, { headers, tags: { name: 'explore' } });
    recordTelemetry(exploreRes, 'explore');

    if (exploreRes.status === 200) {
      const targets = exploreRes.json();
      if (Array.isArray(targets) && targets.length > 0) {
        const victim = targets[Math.floor(Math.random() * targets.length)];
        if (victim && victim.userId && Number(victim.ripePlots) > 0) {
          // Fetch victim farm to get a real ripe plotId
          const victimFarmRes = http.get(
            `${BASE_URL}/api/farm/${victim.userId}`,
            { headers, tags: { name: 'victim_farm' } },
          );
          recordTelemetry(victimFarmRes, 'victim_farm');

          if (victimFarmRes.status === 200) {
            const vFarm = victimFarmRes.json();
            const ripePlots = (vFarm.plots || []).filter(
              (p) => p.isRipe && p.stealableRemaining > 0,
            );
            if (ripePlots.length > 0) {
              const targetPlot = ripePlots[Math.floor(Math.random() * ripePlots.length)];
              stealAttemptsTotal.add(1);
              const stealStart = Date.now();
              const stealRes = http.post(
                `${BASE_URL}/api/action/steal`,
                JSON.stringify({ targetUserId: victim.userId, plotId: targetPlot.id }),
                { headers, tags: { name: 'steal' } },
              );
              stealLatencyTrend.add(Date.now() - stealStart);
              recordTelemetry(stealRes, 'steal');

              if (stealRes.status === 200) {
                const stealData = stealRes.json();
                if (stealData.success) {
                  stealSuccesses.add(1);
                } else if (stealData.message && stealData.message.toLowerCase().includes('dog')) {
                  stealBlockedByDog.add(1);
                }
              } else if (stealRes.status === 400) {
                const body = stealRes.body || '';
                if (body.includes('protected') || body.includes('shield')) {
                  stealBlockedByShield.add(1);
                }
              }
            }
          }
        }
      }
    }

    // 7. Test Soft Kill Switch — claim-signature withdrawal
    const claimStart = Date.now();
    const withdrawRes = http.post(
      `${BASE_URL}/api/web3/claim-signature`,
      JSON.stringify({ amountToClaim: 50 }),
      { headers, tags: { name: 'claim_signature' } },
    );
    claimLatencyTrend.add(Date.now() - claimStart);
    recordTelemetry(withdrawRes, 'claim_signature');
  }

  sleep(THINK);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. PERSONA 2: 15% WEB3 FARMERS (Marketplace Trading & Inventory)
// ─────────────────────────────────────────────────────────────────────────────
export function personaWeb3Farmer() {
  const headers = getAuthHeaders(__VU, 'farmer');

  // 1. Inventory View & Sell-all
  //    Endpoint is GET /inventory (no /my suffix — controller is @Get() with no path)
  const invRes = http.get(`${BASE_URL}/api/inventory`, { headers, tags: { name: 'inventory' } });
  recordTelemetry(invRes, 'inventory');

  if (invRes.status === 200) {
    // Sell crops to Gold
    const sellRes = http.post(`${BASE_URL}/api/inventory/sell-all`, null, { headers, tags: { name: 'sell_all' } });
    recordTelemetry(sellRes, 'sell_all');

    // Pack crate
    const packRes = http.post(
      `${BASE_URL}/api/inventory/pack-crate`,
      JSON.stringify({ cropKey: 'wheat', crateCount: 1 }),
      { headers, tags: { name: 'pack_crate' } },
    );
    recordTelemetry(packRes, 'pack_crate');
    if (packRes.status === 200) inventoryPacksTotal.add(1);
  }

  // 2. Marketplace Browsing
  const marketRes = http.get(`${BASE_URL}/api/marketplace/listings?limit=20`, {
    headers,
    tags: { name: 'market_listings' },
  });
  recordTelemetry(marketRes, 'market_listings');
  if (marketRes.status === 200) marketTradesTotal.add(1);

  // 3. Rate Engine & Quota Check
  const rateRes = http.get(`${BASE_URL}/api/web3/dynamic-rates`, { headers, tags: { name: 'dynamic_rates' } });
  recordTelemetry(rateRes, 'dynamic_rates');

  const quotaRes = http.get(`${BASE_URL}/api/web3/cashout-quota`, { headers, tags: { name: 'cashout_quota' } });
  recordTelemetry(quotaRes, 'cashout_quota');

  sleep(THINK * 1.5);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. PERSONA 3: 5% WHALE DEGENS (Upgrades, Buyback & High-Value Locks)
// ─────────────────────────────────────────────────────────────────────────────
export function personaWhaleDegen() {
  const headers = getAuthHeaders(__VU, 'whale');

  // 1. Monitor Treasury Buyback Vault Status
  const treasuryRes = http.get(`${BASE_URL}/api/web3/treasury-status`, { headers, tags: { name: 'treasury_status' } });
  recordTelemetry(treasuryRes, 'treasury_status');

  // 2. Trigger Treasury Auto-Buyback
  const triggerRes = http.post(`${BASE_URL}/api/web3/treasury-trigger`, null, {
    headers,
    tags: { name: 'treasury_trigger' },
  });
  recordTelemetry(triggerRes, 'treasury_trigger');
  if (triggerRes.status === 200) whaleTreasuryTriggers.add(1);

  // 3. Farm Plots: Test Pessimistic Lock on Plot Upgrade & Buy Plot
  const farmRes = http.get(`${BASE_URL}/api/farm/my`, { headers, tags: { name: 'whale_farm' } });
  recordTelemetry(farmRes, 'whale_farm');

  if (farmRes.status === 200) {
    const data = farmRes.json();
    if (data && data.plots && data.plots.length > 0) {
      const targetPlot = data.plots[0];

      // Concurrent upgradePlot test (verifies pessimistic_write row lock)
      const upgradeRes = http.post(
        `${BASE_URL}/api/farm/upgrade-plot`,
        JSON.stringify({ plotId: targetPlot.id }),
        { headers, tags: { name: 'upgrade_plot' } },
      );
      recordTelemetry(upgradeRes, 'upgrade_plot');
      if (upgradeRes.status === 200) whalePlotUpgrades.add(1);

      // Concurrent buyPlot test (verifies pessimistic_write row lock)
      const buyPlotRes = http.post(`${BASE_URL}/api/farm/buy-plot`, null, {
        headers,
        tags: { name: 'buy_plot' },
      });
      recordTelemetry(buyPlotRes, 'buy_plot');
    }
  }

  // 4. Guild World Tree Social-Fi watering
  const guildRes = http.get(`${BASE_URL}/api/guild/my`, { headers, tags: { name: 'guild_my' } });
  recordTelemetry(guildRes, 'guild_my');

  if (guildRes.status === 200 && guildRes.body && guildRes.body !== 'null') {
    const waterTreeRes = http.post(`${BASE_URL}/api/guild/water`, JSON.stringify({}), {
      headers,
      tags: { name: 'guild_water' },
    });
    recordTelemetry(waterTreeRes, 'guild_water');
    if (waterTreeRes.status === 200) whaleGuildWaters.add(1);
  }

  // 5. Check Dog Fusion Eligibility
  const fusionRes = http.post(
    `${BASE_URL}/api/web3/fusion/eligibility`,
    JSON.stringify({ baseTierId: 1 }),
    { headers, tags: { name: 'fusion_eligibility' } },
  );
  recordTelemetry(fusionRes, 'fusion_eligibility');

  sleep(THINK * 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. SUMMARY REPORT GENERATOR (Outputs to console & JSON)
// ─────────────────────────────────────────────────────────────────────────────
export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'stress_test_summary.json': JSON.stringify(data, null, 2),
  };
}
