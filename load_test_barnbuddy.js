/**
 * k6 Load Test — Bandit Buddy (NestJS + PostgreSQL + Redis)
 * =========================================================
 *
 * ĐỌC TRƯỚC KHI CHẠY:
 *   1. KHÔNG chạy vào https://flappyx.com. Script này tạo user thật trong DB
 *      (telegram_id = 900_000_000 + __VU) và gọi /api/action/* lên dữ liệu thật.
 *      Chốt ALLOW_PROD=true ở dưới buộc bạn phải xác nhận có maintenance window.
 *   2. BOT_TOKEN phải KHỚP TELEGRAM_BOT_TOKEN của backend đích, nếu không guard
 *      trả 401 cho mọi request (HMAC sai).
 *   3. ThrottlerGuard (nếu bật) đếm theo req.ip. K6 chạy 1 IP nguồn ⇒ 200 VUs
 *      chia sẻ budget 100/phút và 3/giây cho steal. Không xử lý chỗ này thì
 *      kết quả chỉ phản ánh rate limiter, không phải DB/Redis.
 *   4. http_req_failed được ép về 5xx/timeout: 4xx là kết quả nghiệp vụ hợp lệ
 *      ("crop not ripe", "daily steal limit"). Lỗi nghiệp vụ đo bằng business_errors.
 *
 * Profiles:
 *   PROFILE=smoke   — 2 VUs / 30s, sanity check
 *   PROFILE=load    — ramp VUS → hold HOLD
 *   PROFILE=stress  — ramp VUS → 2×VUS → 4×VUS
 *   PROFILE=soak    — VUS hằng định trong HOLD (test rò rỉ connection pool)
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
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
const THINK     = Number(__ENV.THINK || 1); // giây think-time giữa các thao tác

if (BASE_URL.includes('flappyx.com') && __ENV.ALLOW_PROD !== 'true') {
  throw new Error(
    'Từ chối chạy load test vào production. Chỉ set ALLOW_PROD=true khi có ' +
      'sự cho phép bằng văn bản và maintenance window.',
  );
}
if (!BOT_TOKEN) {
  throw new Error(
    'Thiếu BOT_TOKEN. Phải bằng đúng TELEGRAM_BOT_TOKEN của backend đích, ' +
      'nếu không mọi request sẽ nhận 401 (HMAC sai).',
  );
}

// Chỉ 5xx / timeout tính là lỗi hạ tầng. 4xx = kết quả nghiệp vụ hợp lệ.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 499 }));

// ─────────────────────────────────────────────────────────────────
// 1. CUSTOM METRICS
// ─────────────────────────────────────────────────────────────────
const businessErrors = new Rate('business_errors');
const stealWins      = new Counter('steal_wins');
const stealBites     = new Counter('steal_dog_bites');
const plantsPlanted  = new Counter('plants_planted');
const reads          = new Counter('reads_completed');

// ─────────────────────────────────────────────────────────────────
// 2. PROFILES
// ─────────────────────────────────────────────────────────────────
const THRESHOLDS_COMMON = {
  http_req_failed:                    ['rate<0.01'],
  http_req_duration:                  ['p(95)<500', 'p(99)<1500'],
  'http_req_duration{name:steal}':    ['p(95)<200'], // API tranh chấp cao
  'http_req_duration{name:harvest}':  ['p(95)<200'],
  'http_req_duration{name:plant}':    ['p(95)<300'],
  'http_req_duration{name:auth}':     ['p(95)<500'],
  business_errors:                    ['rate<0.05'],
};

const PROFILES = {
  smoke: {
    scenarios: {
      smoke: { executor: 'constant-vus', vus: 2, duration: '30s', exec: 'fullFlow' },
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
          { duration: RAMP,       target: VUS },
          { duration: HOLD,       target: VUS },
          { duration: '30s',      target: 0   },
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
        startVUs: 0,
        stages: [
          { duration: '30s', target: VUS       },
          { duration: '2m',  target: VUS       },
          { duration: '30s', target: VUS * 2   },
          { duration: '2m',  target: VUS * 2   },
          { duration: '30s', target: VUS * 4   },
          { duration: '2m',  target: VUS * 4   },
          { duration: '30s', target: 0         },
        ],
        exec: 'fullFlow',
      },
    },
    thresholds: {
      ...THRESHOLDS_COMMON,
      http_req_duration: ['p(95)<1000', 'p(99)<3000'],
    },
  },

  soak: {
    scenarios: {
      soak: { executor: 'constant-vus', vus: VUS, duration: HOLD, exec: 'fullFlow' },
    },
    thresholds: THRESHOLDS_COMMON,
  },
};

export const options = PROFILES[PROFILE] || PROFILES.smoke;

// ─────────────────────────────────────────────────────────────────
// 3. AUTH — Telegram initData HMAC
// ─────────────────────────────────────────────────────────────────
//
// TelegramAuthGuard dựng lại data-check-string bằng URLSearchParams.entries()
// (tức giá trị ĐÃ decode), bỏ `hash`, sort theo key, join "\n", rồi
// HMAC-SHA256 với key = HMAC-SHA256("WebAppData", botToken).
// Sai bất kỳ bước nào ⇒ 401 hàng loạt.
//
// Session cache ở cấp module — mỗi VU là một JS VM riêng, nên biến này
// được khởi tạo đúng 1 lần cho mỗi VU.

let session = null;

function buildInitData(telegramId, username) {
  const userJson = JSON.stringify({
    id: telegramId,
    first_name: 'LoadTest',
    username,
    language_code: 'en',
  });

  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id:  `AA${telegramId}`,
    user:      userJson,
  };

  // HMAC trên giá trị CHƯA encode — guard decode trước khi băm.
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');

  const secretKey = crypto.hmac('sha256', 'WebAppData', BOT_TOKEN, 'binary');
  const hash      = crypto.hmac('sha256', secretKey, dataCheckString, 'hex');

  // Wire format: giá trị đã encode + hash (hex, không cần encode).
  return Object.keys(fields)
    .map((k) => `${k}=${encodeURIComponent(fields[k])}`)
    .concat(`hash=${hash}`)
    .join('&');
}

function ensureSession() {
  if (session) return session;
  const telegramId = 900_000_000 + __VU;
  session = { telegramId, initData: buildInitData(telegramId, `lt_vu${__VU}`) };
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
// 4. FLOWS
// ─────────────────────────────────────────────────────────────────

export function fullFlow() {
  ensureSession();

  readFlow();
  sleep(THINK * (0.5 + Math.random()));

  writeFlow();
  sleep(THINK * (0.5 + Math.random()));

  if (Math.random() < 0.4) marketplaceFlow();
}

function readFlow() {
  group('read', () => {
    const h = headers();
    const endpoints = [
      ['read_profile',     `${BASE_URL}/api/user/profile`],
      ['read_farm',        `${BASE_URL}/api/farm/my`],
      ['read_seeds',       `${BASE_URL}/api/farm/seeds`],
      ['read_quests',      `${BASE_URL}/api/quest/daily`],
      ['read_shop',        `${BASE_URL}/api/shop/items`],
      ['read_leaderboard', `${BASE_URL}/api/user/leaderboard`],
      ['read_listings',    `${BASE_URL}/api/marketplace/listings?limit=20&offset=0`],
    ];

    for (const [name, url] of endpoints) {
      const res = http.get(url, { headers: h, tags: { name } });
      check(res, { [`${name} 200`]: (r) => r.status === 200 });
      reads.add(1);
    }
  });
}

function writeFlow() {
  const h = headers();

  // Cần plotId + seedId thực — lấy lại mỗi iteration để phản ánh DB thật.
  const farmRes = http.get(`${BASE_URL}/api/farm/my`, { headers: h });
  if (farmRes.status !== 200) {
    businessErrors.add(true);
    return;
  }
  let farm;
  try { farm = JSON.parse(farmRes.body); } catch { businessErrors.add(true); return; }

  const seedsRes = http.get(`${BASE_URL}/api/farm/seeds`, { headers: h });
  let seeds = [];
  try { seeds = JSON.parse(seedsRes.body); } catch { /* ignore */ }
  const seed = seeds[0];

  group('write', () => {
    // PLANT — 201 thành công; 400 khi hết GOLD / đất kiệt / plot đã có cây.
    // Cả hai đều là outcome hợp lệ — business_errors chỉ tăng khi có gì đó bất thường.
    const emptyPlot = (farm.plots || []).find((p) => p.isEmpty);
    if (emptyPlot && seed) {
      const plant = http.post(
        `${BASE_URL}/api/action/plant`,
        JSON.stringify({ plotId: emptyPlot.id, seedId: seed.id }),
        { headers: h, tags: { name: 'plant' } },
      );
      const planted = plant.status === 201;
      if (planted) plantsPlanted.add(1);
      check(plant, { 'plant 201/400': (r) => r.status === 201 || r.status === 400 });
      // 5xx hoặc 403 (auth) là lỗi thực; 400 không tính.
      if (plant.status >= 500 || plant.status === 401 || plant.status === 403) {
        businessErrors.add(true);
      } else {
        businessErrors.add(false);
      }
    }

    // WATER — luôn có cây đang trồng sau plant; nếu không thì 400.
    const anyPlanted = (farm.plots || []).find((p) => !p.isEmpty);
    if (anyPlanted) {
      const water = http.post(
        `${BASE_URL}/api/action/water`,
        JSON.stringify({ plotId: anyPlotId(anyPlanted) }),
        { headers: h, tags: { name: 'water' } },
      );
      check(water, { 'water 201/400': (r) => r.status === 201 || r.status === 400 });
    }

    // STEAL — chỉ chạy khi có victim đã seed (xem load_test_seed.sql).
    // Không seed ⇒ 400 "Crop is not ripe yet" hàng loạt, vô nghĩa.
    if (__ENV.VICTIM_USER_ID && __ENV.VICTIM_PLOT_IDS) {
      const plotIds = __ENV.VICTIM_PLOT_IDS.split(',');
      const plotId  = plotIds[Math.floor(Math.random() * plotIds.length)];
      const steal   = http.post(
        `${BASE_URL}/api/action/steal`,
        JSON.stringify({ targetUserId: __ENV.VICTIM_USER_ID, plotId }),
        { headers: h, tags: { name: 'steal' } },
      );
      let body = null;
      try { body = JSON.parse(steal.body); } catch { /* ignore */ }
      if (body && body.success === true)  stealWins.add(1);
      if (body && body.success === false) stealBites.add(1);
      // 201 = ok; 400 = hết energy / limit / không chín; 404 = plot biến mất
      check(steal, {
        'steal 201/400/404': (r) => r.status === 201 || r.status === 400 || r.status === 404,
      });
    }
  });
}

function anyPlotId(plot) {
  return plot.id;
}

function marketplaceFlow() {
  group('marketplace', () => {
    const h = headers();

    const listings = http.get(
      `${BASE_URL}/api/marketplace/listings?limit=20`,
      { headers: h, tags: { name: 'marketplace_listings' } },
    );
    check(listings, { 'listings 200': (r) => r.status === 200 });

    const mine = http.get(
      `${BASE_URL}/api/marketplace/my-listings`,
      { headers: h, tags: { name: 'marketplace_mine' } },
    );
    check(mine, { 'my-listings 200': (r) => r.status === 200 });

    // sync-nft trả 201 (NestJS mặc định cho POST) kể cả khi chưa link ví
    // (message: "No wallet linked"). Check cũ chỉ nhận 200/400 nên LUÔN fail
    // với 201 — đó là false negative của kịch bản, không phải lỗi endpoint.
    const sync = http.post(
      `${BASE_URL}/api/web3/sync-nft`,
      null,
      { headers: h, tags: { name: 'web3_sync' } },
    );
    check(sync, { 'sync-nft 200/201/400': (r) => r.status === 200 || r.status === 201 || r.status === 400 });

    const rate = http.get(
      `${BASE_URL}/api/web3/exchange-rate`,
      { headers: h, tags: { name: 'web3_exchange_rate' } },
    );
    check(rate, { 'exchange-rate 200': (r) => r.status === 200 });
  });
}

// ─────────────────────────────────────────────────────────────────
// 5. SUMMARY — xuất JSON để so sánh giữa các lần chạy
// ─────────────────────────────────────────────────────────────────
// k6 accepts exactly ONE export of this name. The script previously carried two
// (one for JSON + colored stdout, one for the Markdown report), which made k6
// refuse to parse the file at all — "Duplicate export name handleSummary" — so
// no run ever produced a report. This is the merged single implementation, doing
// all three jobs the report pipeline needs:
//   1. colored textSummary -> stdout
//   2. load_test_summary.json -> metrics for run-over-run comparison
//   3. /home/ubuntu/barnbuddy/load_test.md -> plain-text report
export function handleSummary(data) {
  // Threshold verdict first, so a failing run is obvious even after the long
  // metric tables scroll past.
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
      ? '\n✅ K6 THRESHOLDS PASSED\n'
      : `\n❌ K6 THRESHOLDS FAILED: ${failures.join(', ')}\n`,
  );

  // enableColors:false strips ANSI escapes. Without it load_test.md receives raw
  // escape bytes that render as noise in editors and pollute git diffs.
  const plain = textSummary(data, { indent: ' ', enableColors: false });

  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'load_test_summary.json': JSON.stringify(data, null, 2),
    '/home/ubuntu/barnbuddy/load_test.md': plain,
  };
}
