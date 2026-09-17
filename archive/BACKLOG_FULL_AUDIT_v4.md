# Bandit Buddy — Full Backlog Audit Export v4

| Field | Value |
|-------|-------|
| **Repository** | https://github.com/flappybirdweb3/bandit-buddy |
| **Total Issues** | 59 |
| **Export date** | 2026-09-10 |
| **Final Audit Score** | **99/100** — Sẵn sàng thực thi (GO-LIVE) |
| **Tech Stack** | NestJS · PostgreSQL · Redis · Phaser 3 · React · Ethers.js v6 · BSC |

---

## Audit Changelog

| Vòng | Điểm | Issues thay đổi | Nội dung |
|------|------|-----------------|---------|
| **v1** (ban đầu) | 85/100 | Tạo mới #36 #37 #38 (Sprint 2), #48 #49 (Sprint 3) | 5 tính năng kinh tế & tâm lý bị bỏ sót từ PRD 2 |
| **v2** | 95/100 | Cập nhật #46 #49 #50 #51 | Thêm GuildStaking.sol + định tuyến $FARM → TreasuryBuyBack |
| **v3** | 99/100 | Cập nhật #39 #40 #59 | ERC-1155 safeTransferFrom · Tiered fusion cost · Oracle gas alert |

### Badge legend
- ⭐ **AUDIT FIX v1** — Issue được *tạo mới* do audit v1 phát hiện thiếu
- 🔧 **AUDIT FIX v2** — Issue được *cập nhật* do audit v2 (cross-module mismatch)
- 🔧 **AUDIT FIX v3** — Issue được *cập nhật* do audit v3 (senior production tips)

---

## Sprint Summary

| Sprint | Issues | 🔴 High | 🟡 Medium | 🟢 Low |
|--------|:------:|:-------:|:---------:|:------:|
| Sprint 1: Foundation & Core Infrastructure | 14 | 9 | 4 | 1 |
| Sprint 2: Core Game APIs & Economy Layer | 24 | 11 | 11 | 2 |
| Sprint 3: Smart Contracts & Blockchain Layer | 11 | 9 | 2 | 0 |
| Sprint 4: QA, Polish & MVP Launch | 10 | 5 | 2 | 3 |
| **TOTAL** | **59** | **34** | **19** | **6** |

---

# Sprint 1: Foundation & Core Infrastructure
**14 issues** · 🔴 High: 9 · 🟡 Medium: 4 · 🟢 Low: 1

---

## Issue #1: Set up NestJS monorepo with TypeScript, Docker, and CI/CD pipeline

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | backend, infra |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/1](https://github.com/flappybirdweb3/bandit-buddy/issues/1) |
| **Status** | OPEN |

## Overview
Initialise the project repository with a production-ready NestJS monorepo, Docker Compose stack, and GitHub Actions CI pipeline.

## Monorepo structure
```
bandit-buddy/
├── apps/backend/          # NestJS application
├── contracts/             # Hardhat project (Sprint 3)
├── frontend/              # Phaser 3 + React
├── docker-compose.yml
├── .env.example
└── .github/workflows/ci.yml
```

## docker-compose.yml
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: banditbuddy
      POSTGRES_USER: banditbuddy
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports: ["5432:5432"]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  backend:
    build: ./apps/backend
    env_file: .env
    depends_on: [postgres, redis]
    ports: ["3000:3000"]
```

## GitHub Actions CI
```yaml
name: CI
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci && npm run lint && npm run build && npm run test:unit
```

## NestJS bootstrap
- `AppModule` imports: `TypeOrmModule`, `ThrottlerModule`, `CacheModule` (Redis)
- Swagger enabled on `/api/docs`
- `ValidationPipe` global with `whitelist: true`, `forbidNonWhitelisted: true`

## Acceptance Criteria
- [ ] `docker compose up` starts all 3 services without errors
- [ ] `GET /health` returns `{ status: "ok" }`
- [ ] GitHub Actions passes on every PR
- [ ] `.env.example` documents all required vars
- [ ] Swagger UI accessible at `/api/docs`

---

## Issue #2: PostgreSQL schema migrations (TypeORM) — all core tables

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | backend |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/2](https://github.com/flappybirdweb3/bandit-buddy/issues/2) |
| **Status** | OPEN |

## Overview
TypeORM migration files for all core database tables — single source of truth for the data model.

## Core tables
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  wallet_address VARCHAR(42),
  gold_balance DECIMAL(20,2) NOT NULL DEFAULT 0,
  energy INTEGER NOT NULL DEFAULT 100,
  trust_score INTEGER NOT NULL DEFAULT 50,
  nonce INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE seed_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  cost_gold DECIMAL(10,2) NOT NULL,
  grow_time_sec INTEGER NOT NULL,
  base_yield DECIMAL(10,2) NOT NULL,
  icon_key VARCHAR(100)
);

CREATE TABLE farm_plots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  plot_index INTEGER NOT NULL,
  seed_id UUID REFERENCES seed_configs(id),
  planted_at TIMESTAMP,
  harvestable_at TIMESTAMP,
  total_stolen DECIMAL(10,2) NOT NULL DEFAULT 0,
  last_stolen_at TIMESTAMP,
  soil_fertility INTEGER NOT NULL DEFAULT 100,
  yield_multiplier DECIMAL(3,1) NOT NULL DEFAULT 1.0,
  UNIQUE(user_id, plot_index)
);

CREATE TABLE steal_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thief_id UUID NOT NULL REFERENCES users(id),
  victim_id UUID NOT NULL REFERENCES users(id),
  plot_id UUID NOT NULL REFERENCES farm_plots(id),
  amount DECIMAL(10,2) NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  is_anonymous BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE nft_guard_dogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id),
  token_id INTEGER NOT NULL,
  dog_type VARCHAR(50) NOT NULL,
  defense_power INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_fed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE farm_buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
  fence_durability INTEGER NOT NULL DEFAULT 100,
  barn_durability INTEGER NOT NULL DEFAULT 100,
  last_repaired_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  sub_type VARCHAR(50) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  item_type VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, item_type)
);

CREATE TABLE guilds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES users(id),
  tier VARCHAR(20) NOT NULL DEFAULT 'free',
  staked_farm DECIMAL(20,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(4,2) NOT NULL DEFAULT 0,
  world_tree_hp INTEGER NOT NULL DEFAULT 1000,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE guild_members (
  user_id UUID NOT NULL REFERENCES users(id),
  guild_id UUID NOT NULL REFERENCES guilds(id),
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, guild_id)
);

CREATE TABLE processed_onchain_txs (
  tx_hash VARCHAR(66) PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  processed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sync_state (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Seed data
```sql
INSERT INTO seed_configs (name, cost_gold, grow_time_sec, base_yield, icon_key) VALUES
  ('Wheat', 10, 300, 15, 'wheat'),
  ('Carrot', 25, 900, 40, 'carrot'),
  ('Corn', 50, 3600, 100, 'corn'),
  ('Tomato', 100, 7200, 220, 'tomato'),
  ('Pumpkin', 200, 14400, 480, 'pumpkin');
```

## Acceptance Criteria
- [ ] All tables created via TypeORM migration (not sync)
- [ ] `npm run migration:run` succeeds on clean DB
- [ ] `npm run migration:revert` cleanly removes all tables
- [ ] Seed data for seed_configs inserted

---

## Issue #3: Telegram initData JWT authentication middleware

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | backend |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/3](https://github.com/flappybirdweb3/bandit-buddy/issues/3) |
| **Status** | OPEN |

## Overview
Server-authoritative authentication using Telegram initData HMAC-SHA256 verification.

## Validation algorithm
```typescript
// src/auth/telegram-auth.guard.ts
export function validateTelegramInitData(initData: string, botToken: string): TelegramUser {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) throw new UnauthorizedException('Invalid signature');
  const authDate = parseInt(params.get('auth_date') ?? '0');
  if (Date.now() / 1000 - authDate > 86400) throw new UnauthorizedException('initData expired');
  return JSON.parse(params.get('user') ?? '{}');
}
```

## JWT issuance
```typescript
const payload = { sub: user.id, telegramId: telegramUser.id };
const token = this.jwtService.sign(payload, { expiresIn: '24h' });
```

## Acceptance Criteria
- [ ] Rejects requests with invalid/tampered initData (401)
- [ ] Rejects initData older than 24 hours
- [ ] First-time users auto-created in users table
- [ ] JWT issued with 24h expiry
- [ ] `@CurrentUser()` decorator works in all controllers

---

## Issue #4: Phaser 3 MainFarmScene — plot grid, crop sprites, and animation system

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | frontend |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/4](https://github.com/flappybirdweb3/bandit-buddy/issues/4) |
| **Status** | OPEN |

## Overview
Core Phaser 3 game scene rendering the farm grid, crop growth states, and handling touch/click interactions.

## Scene structure
```typescript
export class MainFarmScene extends Phaser.Scene {
  private plots: FarmPlot[] = [];
  private uiBlocked = false;

  create() {
    this.createPlotGrid();
    this.setupEventBus();
    this.startCropUpdateLoop();
  }

  private createPlotGrid() {
    const COLS = 3, ROWS = 3;
    for (let i = 0; i < COLS * ROWS; i++) {
      const x = (i % COLS) * 120 + 60;
      const y = Math.floor(i / COLS) * 100 + 80;
      this.plots[i] = new FarmPlot(this, x, y, i);
    }
  }
}
```

## Crop growth states
| State | Sprite | Description |
|-------|--------|-------------|
| 0 | `plot_empty` | Tilled soil |
| 1 | `crop_sprout` | 0–33% grown |
| 2 | `crop_growing` | 33–66% grown |
| 3 | `crop_ready` | 100% — pulsing glow |
| 4 | `crop_stolen` | Withered, dark tint |

## EventBus integration
```typescript
EventBus.on('modal-open', () => { this.uiBlocked = true; });
EventBus.on('modal-close', () => {
  this.time.delayedCall(200, () => { this.uiBlocked = false; });
});
```

## Acceptance Criteria
- [ ] Farm grid renders correctly at 390x844 viewport
- [ ] Tapping plot opens correct action sheet based on state
- [ ] `uiBlocked` prevents interaction when modal is open
- [ ] 60fps on mid-range Android

---

## Issue #5: React HUD, BottomBar, and EventBus integration layer

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | frontend |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/5](https://github.com/flappybirdweb3/bandit-buddy/issues/5) |
| **Status** | OPEN |

## Overview
React UI overlay on top of Phaser canvas — resource bar, bottom navigation, EventBus bridge.

## Component tree
```
App
├── GameCanvas (Phaser 3)
└── ReactOverlay
    ├── TopHUD (gold, energy, level)
    ├── BottomBar (Farm | Explore | Shop | Guild | Profile)
    └── ModalHost (lazy-loaded modals)
```

## EventBus
```typescript
import mitt from 'mitt';
type Events = {
  'plot-tap': { plotIndex: number; state: PlotState };
  'modal-open': { name: string };
  'modal-close': void;
  'gold-update': { amount: number };
  'energy-update': { amount: number };
};
export const EventBus = mitt<Events>();
```

## BottomBar
- 5 icons with active state indicator
- Haptic feedback: `window.Telegram.WebApp.HapticFeedback.impactOccurred('light')`

## Acceptance Criteria
- [ ] TopHUD values update instantly after API responses (no polling)
- [ ] BottomBar navigates 5 tabs without page reload
- [ ] No z-index conflicts between canvas and React overlay
- [ ] Safe area insets applied for iPhone notch

---

## Issue #6: Redis caching layer and rate limiting (Throttler)

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | backend, infra |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/6](https://github.com/flappybirdweb3/bandit-buddy/issues/6) |
| **Status** | OPEN |

## Overview
Redis-backed caching for hot read paths and per-user rate limiting.

## Cache TTLs
| Endpoint | TTL | Invalidation |
|----------|-----|-------------|
| `GET /farm/:userId` | 30s | Any farm mutation |
| `GET /user/profile` | 10s | Gold/energy change |
| `GET /seeds` | 1hr | Deploy |

## Throttler config
```typescript
ThrottlerModule.forRoot([
  { name: 'steal', ttl: 1000, limit: 3 },     // 3 steal/sec/user
  { name: 'global', ttl: 60000, limit: 200 }, // 200 req/min/user
])
```

## Acceptance Criteria
- [ ] Redis caches farm data (verify with MONITOR)
- [ ] 4th steal request in 1 second returns 429
- [ ] Cache invalidated on harvest/plant/steal
- [ ] Redis down -> app degrades gracefully

---

## Issue #7: Energy regen system — 6-min tick, max cap, and regen timer UI

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | backend, frontend |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/7](https://github.com/flappybirdweb3/bandit-buddy/issues/7) |
| **Status** | OPEN |

## Overview
Server-side energy regeneration (1 energy per 6 min, max 100) with HUD countdown timer.

## Lazy calculation (no cron)
```typescript
function getCurrentEnergy(user: User): number {
  const minutesSinceUpdate = (Date.now() - user.updatedAt.getTime()) / 60000;
  const regenAmount = Math.floor(minutesSinceUpdate / 6);
  return Math.min(100, user.energy + regenAmount);
}
```

## Frontend timer
```typescript
function getSecondsToNextRegen(updatedAt: Date, energy: number): number {
  if (energy >= 100) return 0;
  const elapsed = (Date.now() - updatedAt.getTime()) / 1000;
  return 360 - (elapsed % 360);
}
```

## Acceptance Criteria
- [ ] Energy HUD updates via local countdown every second
- [ ] At 0 energy, steal/attack disabled with tooltip
- [ ] Energy never exceeds 100
- [ ] Regen resumes after energy consumption

---

## Issue #8: Plot upgrade system — unlock additional plots and upgrade yield multiplier

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | backend, frontend |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/8](https://github.com/flappybirdweb3/bandit-buddy/issues/8) |
| **Status** | OPEN |

## Overview
Unlock new farm plots and upgrade existing plots for higher yield, paid in GOLD.

## Upgrade tiers
| Tier | Plots | Cost GOLD | Yield |
|------|-------|-----------|-------|
| 1 (default) | 3x3 = 9 | free | 1.0x |
| 2 | 3x4 = 12 | 500 | 1.2x |
| 3 | 4x4 = 16 | 2,000 | 1.5x |

## Individual plot upgrade
```typescript
// POST /plot/:plotId/upgrade
// 100 GOLD, +0.1x yield multiplier (max 2x)
```

## Acceptance Criteria
- [ ] GOLD deduction atomic
- [ ] New plots appear in farm grid immediately
- [ ] Yield uses plot-level multiplier
- [ ] Cannot downgrade

---

## Issue #9: Wallet setup flow — auto-generate wallet or connect existing via WalletConnect

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | backend, frontend |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/9](https://github.com/flappybirdweb3/bandit-buddy/issues/9) |
| **Status** | OPEN |

## Overview
On first login: auto-generate BSC wallet (server-side encrypted) or connect via WalletConnect v2.

## Option A: Auto-generated wallet
```typescript
const wallet = ethers.Wallet.createRandom();
const encryptedKey = encrypt(wallet.privateKey, userSecret);
await this.usersRepo.update(userId, {
  wallet_address: wallet.address,
  encrypted_pk: encryptedKey,
});
```

## Option B: WalletConnect
```typescript
const web3Modal = new Web3Modal({ projectId: process.env.WC_PROJECT_ID });
const provider = await web3Modal.connect();
const address = await new ethers.BrowserProvider(provider).getSigner().then(s => s.getAddress());
// POST /user/wallet { address }
```

## Security
- Private keys stored AES-256-GCM encrypted, never logged
- Rotation endpoint: `POST /user/wallet/rotate`

## Acceptance Criteria
- [ ] First-time user sees wallet setup modal before farm
- [ ] Auto-wallet address saved to users.wallet_address
- [ ] WalletConnect session persists across restarts
- [ ] Address shown truncated in Settings

---

## Issue #10: Weather system — daily conditions affecting crop yields

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | backend, frontend |
| **Priority** | 🟡 Medium |
| **Epic** | core-game |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/10](https://github.com/flappybirdweb3/bandit-buddy/issues/10) |
| **Status** | OPEN |

## Overview
Daily weather system applying yield bonuses/penalties to crops.

## Weather types
| Weather | Prob | Yield modifier |
|---------|------|---------------|
| Sunny | 40% | +20% |
| Cloudy | 30% | 0% |
| Rainy | 20% | +10% |
| Drought | 7% | -30% |
| Storm | 3% | -50% |

## Implementation
```typescript
@Cron('0 0 * * *')
async rollWeather() {
  const weather = weightedRandom(WEATHER_TABLE);
  await this.cacheManager.set('current_weather', weather, 86400);
}
```

## Acceptance Criteria
- [ ] Weather changes once per day at UTC midnight
- [ ] Weather icon shown in HUD
- [ ] Yield calculation applies weather modifier
- [ ] Persists across restarts (sync_state table)

---

## Issue #11: Friends bar — online friends panel with quick visit and steal status

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | backend, frontend |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/11](https://github.com/flappybirdweb3/bandit-buddy/issues/11) |
| **Status** | OPEN |

## Overview
Side panel showing Telegram friends who also play, with online status and one-tap farm visit.

## API
```
GET /friends        — list of friends
GET /friends/online — active in last 5 minutes
```

## Friend card data
```typescript
interface FriendCard {
  userId: string;
  username: string;
  isOnline: boolean;
  hasRipeCrops: boolean;
  guardDogCount: number;
}
```

## Acceptance Criteria
- [ ] Online indicator updates within 60 seconds
- [ ] `hasRipeCrops` badge shown correctly
- [ ] Tapping navigates to Explore view filtered to that user

---

## Issue #12: Tutorial overlay — first-time user guide with interactive steps

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | frontend |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/12](https://github.com/flappybirdweb3/bandit-buddy/issues/12) |
| **Status** | OPEN |

## Overview
Linear tutorial guiding new users through planting, harvesting, and stealing.

## Steps
1. Welcome screen with mascot
2. Tap plot -> plant Wheat (free seed)
3. Skip growth timer (tutorial only)
4. Harvest -> gold coins animation
5. Visit friend farm -> steal
6. Show Gold balance
7. Complete: reward 50 GOLD + 1 Carrot seed

## Acceptance Criteria
- [ ] Auto-triggers on first login only
- [ ] Cannot skip on first session
- [ ] Reward granted exactly once
- [ ] State survives app restart

---

## Issue #13: Level and XP system — trust score gating for seeds and features

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | backend, frontend |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/13](https://github.com/flappybirdweb3/bandit-buddy/issues/13) |
| **Status** | OPEN |

## Overview
XP-based levelling unlocking premium seeds, plots, and features.

## XP sources
| Action | XP |
|--------|----|
| Harvest | 10 |
| Steal success | 25 |
| Quest complete | 50-200 |
| Daily login | 20 |

## Level gates
| Level | Unlocks |
|-------|---------|
| 1 | Wheat, Carrot |
| 5 | Corn, 2nd plot row |
| 10 | Tomato, Marketplace |
| 15 | Pumpkin, Guard Dog gacha |
| 20 | Guild creation |

## Acceptance Criteria
- [ ] XP awarded correctly per action
- [ ] Level-up notification with animation
- [ ] Level-gated features show lock icon
- [ ] trust_score >= 30 required for claim

---

## Issue #14: Sound system — SoundManager with Web Audio API unlock for iOS/Telegram

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | frontend |
| **Priority** | 🟢 Low |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/14](https://github.com/flappybirdweb3/bandit-buddy/issues/14) |
| **Status** | OPEN |

## Overview
Web Audio API unlock pattern for iOS/Telegram. Defers AudioContext creation until first user tap.

## Implementation
```typescript
class SoundManager {
  private ctx: AudioContext | null = null;

  unlock() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    const buf = this.ctx.createBuffer(1, 1, 22050);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    src.start(0);
  }

  play(key: string) {
    if (!this.ctx) return;
    // load and play audio buffer
  }
}
```

## Sound effects: harvest.ogg, steal_success.ogg, dog_bite.ogg, level_up.ogg, plant.ogg

## Acceptance Criteria
- [ ] Audio plays after first tap on iOS Telegram
- [ ] Settings toggle mutes/unmutes all sounds
- [ ] Audio files < 50KB each (compressed ogg)


# Sprint 2: Core Game APIs & Economy Layer
**24 issues** · 🔴 High: 11 · 🟡 Medium: 11 · 🟢 Low: 2

---

## Issue #15: Farm CRUD API — plant, harvest, dig, water, bug-spray, weed-kill

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/15](https://github.com/flappybirdweb3/bandit-buddy/issues/15) |
| **Status** | OPEN |

## Overview
All farm plot mutation endpoints. Server-authoritative, atomic.

## POST /action/plant
```
1. Check energy >= 5
2. Check plot empty
3. Check soil_fertility > 0
4. Deduct gold_balance >= seed.cost_gold atomically
5. SET planted_at = NOW(), harvestable_at = NOW() + grow_time_sec
6. Deduct 5 energy
```

## POST /action/harvest
```
1. Check Date.now() >= harvestable_at
2. BEGIN TRANSACTION
3. yield = seed.base_yield * plot.yield_multiplier * (soil_fertility/100) * weather_modifier
4. Apply guild tax if elite guild member
5. gold_balance += yield
6. soil_fertility = MAX(0, soil_fertility - 20)
7. Reset plot (seed_id = null, planted_at = null)
8. COMMIT
```

## POST /action/water
- Reduces grow time by 10% (min 50% of original)
- 0 energy cost, 1 action/plot/hour

## Acceptance Criteria
- [ ] Plant fails if plot has growing crop
- [ ] Harvest fails if crop not ripe (400)
- [ ] Gold/yield atomic in single transaction
- [ ] Soil fertility decrements on each harvest
- [ ] Cannot plant on 0% fertility (returns 400)

---

## Issue #16: STEAL endpoint — PostgreSQL transaction, guard dog defense, RNG outcome

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/16](https://github.com/flappybirdweb3/bandit-buddy/issues/16) |
| **Status** | OPEN |

## Overview
Critical endpoint. ACID-compliant, race-condition safe, anonymous theft.

## Exact implementation
```typescript
// POST /action/steal { targetUserId, plotId, useMasterKey?: boolean }
async steal(thiefId, targetUserId, plotId, useMasterKey = false) {
  const thief = await this.usersRepo.findOne(thiefId);
  if (thief.energy < 10) throw new BadRequestException('Not enough energy');

  return this.dataSource.transaction(async (em) => {
    // Row-level lock on plot
    const plot = await em.findOne(FarmPlot, {
      where: { id: plotId },
      lock: { mode: 'pessimistic_write' },
    });
    if (Date.now() < plot.harvestable_at.getTime())
      throw new BadRequestException('Crop not ripe');

    const seed = await em.findOne(SeedConfig, plot.seed_id);
    const maxSteal = seed.base_yield * 0.20;
    if (plot.total_stolen >= maxSteal)
      throw new BadRequestException('Steal cap reached');

    // Guard dog defense
    let defenseBonus = 0;
    if (!useMasterKey) {
      const dogs = await em.find(NftGuardDog, { where: { owner_id: targetUserId, is_active: true } });
      const building = await em.findOne(FarmBuilding, { where: { user_id: targetUserId } });
      const durabilityPct = calculateDurability(building);
      const buildingBonus = durabilityPct <= 0 ? -80 : 0;
      defenseBonus = Math.max(0, dogs.reduce((s, d) => s + getEffectiveDefense(d), 0) + buildingBonus);
    }

    const successRate = Math.max(0, 80 - defenseBonus);
    const success = Math.random() * 100 <= successRate;

    const victim = await em.findOne(User, { where: { id: targetUserId }, lock: { mode: 'pessimistic_write' } });
    const thiefLocked = await em.findOne(User, { where: { id: thiefId }, lock: { mode: 'pessimistic_write' } });

    if (success) {
      const stealAmount = Math.min(seed.base_yield * 0.05, maxSteal - plot.total_stolen);
      await em.update(FarmPlot, plotId, { total_stolen: () => `total_stolen + ${stealAmount}`, last_stolen_at: new Date() });
      await em.update(User, thiefId, { gold_balance: () => `gold_balance + ${stealAmount}`, energy: () => 'energy - 10' });
      await em.update(User, targetUserId, { gold_balance: () => `gold_balance - ${stealAmount}` });
      await em.save(StealLog, { thief_id: thiefId, victim_id: targetUserId, plot_id: plotId, amount: stealAmount, success: true, is_anonymous: true });
      return { success: true, goldChange: stealAmount, message: 'Heist successful!' };
    } else {
      const penalty = Number(thiefLocked.gold_balance) * 0.05;
      await em.update(User, thiefId, { energy: () => 'energy - 20', gold_balance: () => `gold_balance - ${penalty}` });
      await em.update(User, targetUserId, { gold_balance: () => `gold_balance + ${penalty}` });
      await em.save(StealLog, { thief_id: thiefId, victim_id: targetUserId, plot_id: plotId, amount: penalty, success: false, is_anonymous: true });
      return { success: false, goldChange: -penalty, message: 'Dog bite! Lost gold.' };
    }
  });
}
```

## Acceptance Criteria
- [ ] Concurrent steal on same plot: exactly one wins (test 10 concurrent)
- [ ] 20% steal cap enforced atomically
- [ ] StealLog always inserted
- [ ] Rate limited: 3 req/sec/user
- [ ] `is_anonymous = true` always — victim cannot see thief

---

## Issue #17: ECDSA claim signature — GOLD to $FARM on-chain redemption

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend, smart-contract |
| **Priority** | 🔴 High |
| **Epic** | economy |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/17](https://github.com/flappybirdweb3/bandit-buddy/issues/17) |
| **Status** | OPEN |

## Overview
Server signs ECDSA message authorising FarmToken.claim() to mint tokens.

## Implementation
```typescript
// POST /web3/claim-signature { amountToClaim: number }
async generateClaimSignature(userId, amountToClaim) {
  const user = await this.dataSource.transaction(async (em) => {
    const u = await em.findOne(User, { where: { id: userId }, lock: { mode: 'pessimistic_write' } });
    if (u.trust_score < 30) throw new ForbiddenException('Trust score too low');
    if (Number(u.gold_balance) < amountToClaim) throw new BadRequestException('Insufficient gold');
    await em.update(User, userId, {
      gold_balance: () => `gold_balance - ${amountToClaim}`,
      nonce: () => 'nonce + 1',
    });
    return em.findOne(User, userId);
  });

  const rate = await this.economyService.getExchangeRate();
  const amountWei = ethers.parseEther((amountToClaim / rate).toString());
  const messageHash = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'uint256'],
    [user.wallet_address, amountWei, user.nonce]
  );
  const signature = await this.adminWallet.signMessage(ethers.getBytes(messageHash));
  return { userAddress: user.wallet_address, amountWei: amountWei.toString(), nonce: user.nonce, signature };
}
```

## Acceptance Criteria
- [ ] Signature verifiable on-chain via ecrecover
- [ ] Nonce increments atomically
- [ ] Gold deducted in same transaction as nonce increment
- [ ] Returns 403 if trust_score < 30

---

## Issue #18: GOLD↔$FARM dynamic exchange rate engine

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend |
| **Priority** | 🔴 High |
| **Epic** | economy |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/18](https://github.com/flappybirdweb3/bandit-buddy/issues/18) |
| **Status** | OPEN |

## Overview
Dynamic exchange rate between off-chain GOLD and on-chain $FARM.

## Formula
```
rate = totalGoldCirculating / totalFarmInTreasury
```

## Implementation
```typescript
@Cron('*/5 * * * *')
async syncExchangeRate() {
  const [goldCirc, farmBalance] = await Promise.all([
    this.usersRepo.sum('gold_balance'),
    this.farmTokenContract.balanceOf(TREASURY_ADDRESS),
  ]);
  const rate = Number(goldCirc) / Number(ethers.formatEther(farmBalance));
  await this.cacheManager.set('exchange_rate', rate, 300);
}
```

## Price bounds
- Minimum: 100 GOLD = 1 FARM
- Maximum: 10,000 GOLD = 1 FARM

## Acceptance Criteria
- [ ] Rate updates every 5 minutes
- [ ] Used in claim signature calculation
- [ ] Displayed in Claim modal and Swap UI
- [ ] Falls back to last known rate if RPC down

---

## Issue #19: P2P Marketplace backend — listing creation, EIP-712 off-chain orders

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend |
| **Priority** | 🔴 High |
| **Epic** | marketplace |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/19](https://github.com/flappybirdweb3/bandit-buddy/issues/19) |
| **Status** | OPEN |

## Overview
Off-chain order book for P2P NFT marketplace using EIP-712 typed structured data.

## Order typehash
```typescript
const ORDER_TYPEHASH = ethers.keccak256(ethers.toUtf8Bytes(
  'Order(address seller,address nftContract,uint256 tokenId,uint256 price,uint256 deadline,uint256 nonce)'
));
```

## Endpoints
```
POST   /marketplace/list
GET    /marketplace/listings
GET    /marketplace/my-listings
DELETE /marketplace/cancel/:id
POST   /marketplace/buy/:id
```

## Listings table
```sql
CREATE TABLE marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id),
  token_id INTEGER NOT NULL,
  nft_contract VARCHAR(42) NOT NULL,
  price_bnb DECIMAL(18,8) NOT NULL,
  eip712_signature TEXT NOT NULL,
  deadline TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Acceptance Criteria
- [ ] EIP-712 signature validated server-side before storing
- [ ] Expired listings excluded from browse results
- [ ] processed_onchain_txs prevents double-processing
- [ ] Seller cannot buy own listing

---

## Issue #20: Shop modal — seed shop, fertilizer, items, and consumables

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend, frontend |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/20](https://github.com/flappybirdweb3/bandit-buddy/issues/20) |
| **Status** | OPEN |

## Overview
In-game shop where players spend GOLD on seeds, fertilizers, and consumables.

## Sections
1. **Seed Shop** — Wheat/Carrot/Corn/Tomato/Pumpkin (level-gated)
2. **Fertilizer** — Instant-grow (50G), Super Yield +50% (100G)
3. **Tools** — Scarecrow (150G), Sprinkler (200G)
4. **Premium** — paid in $FARM (see Premium Subscriptions issue)

## API
```
GET  /shop/items
POST /shop/buy { itemId, quantity }
```

## Acceptance Criteria
- [ ] Level-locked items show lock icon
- [ ] Purchase deducts GOLD atomically
- [ ] Inventory updated immediately
- [ ] Shop items cached 1hr

---

## Issue #21: Anti-cheat and bot detection — trust score system and fraud signals

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend |
| **Priority** | 🔴 High |
| **Epic** | security |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/21](https://github.com/flappybirdweb3/bandit-buddy/issues/21) |
| **Status** | OPEN |

## Overview
Server-side trust score system detecting and penalising bots/cheaters.

## Trust score rules
| Event | Delta |
|-------|-------|
| First login | +50 |
| Telegram account < 30 days | -20 |
| Harvest within 100ms of harvestable_at | -5/occurrence |
| Steal rate > 3/min sustained | -10 |
| 7-day login streak | +10 |
| Verified phone number | +20 |

## Enforcement
- < 30: cannot claim $FARM
- < 10: farm locked (read-only)
- < 0: flagged for manual review

## Acceptance Criteria
- [ ] Trust score updated asynchronously (Bull queue)
- [ ] Claim endpoint enforces trust_score >= 30
- [ ] Admin dashboard shows trust score distribution
- [ ] Appeals: POST /admin/trust/restore (admin-only)

---

## Issue #22: Claim $FARM modal — wallet validation, amount input, signature display

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | frontend |
| **Priority** | 🔴 High |
| **Epic** | economy |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/22](https://github.com/flappybirdweb3/bandit-buddy/issues/22) |
| **Status** | OPEN |

## Overview
Frontend modal for converting GOLD to $FARM tokens.

## UX flow
1. Open Claim modal from BottomBar
2. Show GOLD balance + live exchange rate
3. Input: amount of GOLD (min 100, max gold_balance)
4. Preview: "You will receive X $FARM"
5. Confirm -> POST /web3/claim-signature
6. Show deep-link to MetaMask/Trust Wallet with ABI-encoded tx data
7. Show tx hash + BscScan link after success

## Acceptance Criteria
- [ ] Correct FARM amount shown from dynamic rate
- [ ] Minimum claim 100 GOLD enforced
- [ ] Gold deducted immediately after signature generated
- [ ] Deep link works on iOS and Android Telegram

---

## Issue #23: PancakeSwap V2 DEX swap UI — BNB/FARM/USDT routing

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | frontend, smart-contract |
| **Priority** | 🟡 Medium |
| **Epic** | marketplace |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/23](https://github.com/flappybirdweb3/bandit-buddy/issues/23) |
| **Status** | OPEN |

## Overview
Simplified swap interface for BNB -> $FARM via PancakeSwap V2.

## Implementation
```typescript
const ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E'; // BSC Mainnet

async function getAmountOut(bnbAmount: bigint): Promise<bigint> {
  const path = [WBNB_ADDRESS, FARM_TOKEN_ADDRESS];
  const amounts = await routerContract.getAmountsOut(bnbAmount, path);
  return amounts[1];
}
```

## UI
- Input BNB amount, output estimated $FARM (live, debounced 500ms)
- Slippage: 0.5% / 1% / 2% / custom
- Price impact warning if > 2%

## Acceptance Criteria
- [ ] Live quote updates within 500ms
- [ ] Slippage persists in localStorage
- [ ] High impact (>5%) shows red warning
- [ ] Swap history in transaction list

---

## Issue #24: Daily quest system — quest generation, tracking, and reward claim

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend, frontend |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/24](https://github.com/flappybirdweb3/bandit-buddy/issues/24) |
| **Status** | OPEN |

## Overview
Daily quests driving engagement and providing structured GOLD faucet.

## Quest templates (3 per day per user)
| Quest | Reward |
|-------|--------|
| Harvest N crops | 50–200 GOLD |
| Steal N times | 75–300 GOLD |
| Water N plots | 30 GOLD |
| Visit N friends | 40 GOLD |
| Plant N seeds | 25 GOLD |

## API
```
GET  /quests/today
POST /quests/claim/:id
```

## Acceptance Criteria
- [ ] New quests generated at UTC midnight
- [ ] Progress tracked in real-time (event-driven)
- [ ] Reward claimable once per quest per day
- [ ] Unclaimed quests expire at next midnight

---

## Issue #25: Notification system — in-app inbox and push via Telegram Bot API

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend, frontend |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/25](https://github.com/flappybirdweb3/bandit-buddy/issues/25) |
| **Status** | OPEN |

## Overview
Notify users of crop-ready, theft, quest completion via Telegram Bot push + in-app inbox.

## Notification types
| Event | Channel |
|-------|---------|
| Crop ready | Push + In-app |
| Stolen from | Push + In-app |
| Quest completed | In-app |
| Daily reward | Push at 09:00 local |

## Telegram push
```typescript
await this.telegramBot.sendMessage(user.telegram_id, {
  text: 'Your Wheat is ready to harvest!',
  reply_markup: {
    inline_keyboard: [[{ text: 'Harvest Now', web_app: { url: MINI_APP_URL } }]]
  }
});
```

## Acceptance Criteria
- [ ] Push delivered within 30 seconds of event
- [ ] Users can disable push in Settings
- [ ] In-app inbox: last 50 notifications, paginated

---

## Issue #26: Viral referral system — invite link, Magnifying Glass, Master Key mechanic

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend, frontend |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/26](https://github.com/flappybirdweb3/bandit-buddy/issues/26) |
| **Status** | OPEN |

## Overview
Referral system tied to revenge viral mechanic: invite friends to earn items that reveal anonymous thieves.

## Mechanics
- All thefts anonymous (steal_logs.is_anonymous = true)
- **Magnifying Glass**: earned by inviting 1 new user -> reveal thief identity
- **Master Key**: earned by inviting 3 cumulative users -> bypass guard dogs on next steal

## API
```
GET  /referral/link
GET  /referral/stats
POST /revenge/reveal { stealLogId }       -- spends 1 Magnifying Glass
POST /action/steal { ..., useMasterKey: true }  -- consumes 1 Master Key
```

## Referral -> item flow
```typescript
async processReferral(referrerId, newUserId) {
  const total = await this.countReferrals(referrerId);
  if (total === 1) await this.giveItem(referrerId, 'magnifying_glass', 1);
  if (total === 3) await this.giveItem(referrerId, 'master_key', 1);
}
```

## Acceptance Criteria
- [ ] Victim API never exposes thief_id
- [ ] Reveal returns thief username + avatar
- [ ] Master Key: guard dog defense = 0 for that steal
- [ ] Items consumed on use
- [ ] Referral link unique per user

---

## Issue #27: Leaderboard system — weekly and all-time rankings

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend, frontend |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/27](https://github.com/flappybirdweb3/bandit-buddy/issues/27) |
| **Status** | OPEN |

## Overview
Competitive leaderboard driving engagement.

## Types
1. Weekly Gold Earned (resets Monday 00:00 UTC)
2. All-time Gold
3. Guild leaderboard (weekly harvest)
4. Trust Score top 100

## API
```
GET /leaderboard/weekly?type=gold&limit=100
GET /leaderboard/alltime
GET /leaderboard/guild
GET /leaderboard/my-rank?type=gold
```

## Performance
- Redis sorted sets (ZADD), updated every 60s
- `ZREVRANK` for instant personal rank

## Acceptance Criteria
- [ ] Top 100 loads < 200ms
- [ ] Own rank shown even if outside top 100
- [ ] Weekly resets correctly on Monday
- [ ] Guild leaderboard aggregates member contributions

---

## Issue #28: Weed and bug infestation mechanics — spread risk and penalty system

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend, frontend |
| **Priority** | 🟡 Medium |
| **Epic** | core-game |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/28](https://github.com/flappybirdweb3/bandit-buddy/issues/28) |
| **Status** | OPEN |

## Overview
Random events penalising neglected farms.

## Events
| Event | Trigger | Effect | Cure |
|-------|---------|--------|------|
| Weeds | 8hr since last action | -20% yield | weed-kill (2 energy) |
| Bugs | Random 5%/hr | Crop destroyed if 4hr untreated | bug-spray (2 energy) |
| Crow | Ripe crop 6hr+ | 10% stolen automatically | Scarecrow item |

## Spread: weeds spread to adjacent plots if untreated 12hr

## Acceptance Criteria
- [ ] State computed lazily on plot read (no cron)
- [ ] Crow attack logged in steal_logs
- [ ] HUD warning badge when active infestations

---

## Issue #29: Daily reward streak system — login bonuses and milestone rewards

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend, frontend |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/29](https://github.com/flappybirdweb3/bandit-buddy/issues/29) |
| **Status** | OPEN |

## Overview
Consecutive daily login bonuses to maximise retention.

## Streak rewards
| Day | Reward |
|-----|--------|
| 1 | 20 GOLD |
| 3 | 50 GOLD + 1 Carrot seed |
| 7 | 200 GOLD + Guard Dog food |
| 14 | 500 GOLD + 1 free Gacha pull |
| 30 | 2,000 GOLD + Special NFT frame |

## Rules
- Claim within 24h of previous claim
- Missing a day resets streak to 1

## Acceptance Criteria
- [ ] Claim button available once per 24h UTC window
- [ ] Missing day resets streak
- [ ] Day 7+ rewards include special animation

---

## Issue #30: Explore / Raid Map — discover raidable farms with live crop data

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend, frontend |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/30](https://github.com/flappybirdweb3/bandit-buddy/issues/30) |
| **Status** | OPEN |

## Overview
Browse friend and public farms to find ripe crops to steal.

## API
```
GET /explore/farms?filter=ripe&limit=20
```

## Response shape
```typescript
interface ExploreFarm {
  userId: string;
  username: string;
  ripePlotCount: number;
  totalStealableGold: number;
  guardDogTier: 'none' | 'low' | 'medium' | 'high';
  lastActive: string;
}
```

## Ranking: friends > guild > strangers, sorted by stealable gold

## Acceptance Criteria
- [ ] Loads < 300ms (Redis cache, 30s TTL)
- [ ] Guard dog tier as icon (no exact numbers)
- [ ] Own farm never appears
- [ ] 2hr cooldown per target enforced

---

## Issue #31: Harvest All and Plant All batch action buttons

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend, frontend |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/31](https://github.com/flappybirdweb3/bandit-buddy/issues/31) |
| **Status** | OPEN |

## Overview
One-tap batch actions to save time.

## Endpoints
```
POST /action/harvest-all
POST /action/plant-all { seedId }
```

## Implementation
- Single transaction per batch
- Returns per-plot result: `[{ plotId, success, goldEarned }]`
- Energy cost = N x individual cost

## UI
- "Harvest All" button when 2+ plots ripe
- "Plant All" shows seed selector first
- Sequential harvest pops with 100ms stagger

## Acceptance Criteria
- [ ] Batch harvest atomic per-plot (individual failures don't block others)
- [ ] Soil fertility decremented for each plot
- [ ] Energy check: if insufficient, harvests up to energy limit
- [ ] Total gold shown in summary toast

---

## Issue #32: Attack mechanic — targeted farm sabotage with scarecrow defense

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend, frontend |
| **Priority** | 🟡 Medium |
| **Epic** | core-game |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/32](https://github.com/flappybirdweb3/bandit-buddy/issues/32) |
| **Status** | OPEN |

## Overview
Active attack action to sabotage competitor's crops.

## Attack types
| Attack | Energy | Effect | Defense |
|--------|--------|--------|---------|
| Crow Bomb | 15 | Destroy 1 ripe crop | Scarecrow item |
| Pesticide | 20 | Infest 2 plots with bugs | Bug Shield |
| Salt Earth | 30 | -50% soil fertility | None |

## API
```
POST /action/attack { targetUserId, plotId, attackType }
```

## Cooldown
- Same target: 4hr
- Max 5 attacks per day

## Acceptance Criteria
- [ ] Attack fails gracefully with active defense
- [ ] Logged in steal_logs with type column
- [ ] Cooldown in Redis (TTL key)
- [ ] Victim receives push notification

---

## Issue #33: Fertilizer (crop boost) UI — select and apply to growing crops

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend, frontend |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/33](https://github.com/flappybirdweb3/bandit-buddy/issues/33) |
| **Status** | OPEN |

## Overview
Apply fertilizer items to boost yield on growing crops.

## Types
| Type | Effect | Cost |
|------|--------|------|
| Basic | +20% yield | 20 GOLD |
| Super | +50% yield | 50 GOLD |
| Speed Grow | -50% grow time | 80 GOLD |
| Organic | +30% yield + soil recovery | 40 GOLD |

## API
```
POST /action/fertilize { plotId, fertilizerType }
```

## Acceptance Criteria
- [ ] Cannot apply to empty plot or ripe crop
- [ ] Fertilizer consumed from inventory
- [ ] Fertilizer icon shown on plot sprite
- [ ] Max 1 fertilizer type per plot

---

## Issue #34: Achievement system — unlock badges and bonus rewards for milestones

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend, frontend |
| **Priority** | 🟢 Low |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/34](https://github.com/flappybirdweb3/bandit-buddy/issues/34) |
| **Status** | OPEN |

## Overview
One-time achievement badges rewarding significant milestones.

## Sample achievements
| Achievement | Condition | Reward |
|-------------|-----------|--------|
| First Harvest | Harvest 1 crop | 50 GOLD |
| Master Thief | Steal 100 times | 500 GOLD + badge |
| Green Thumb | Harvest 1,000 crops | 2,000 GOLD |
| Social Farmer | Invite 10 friends | 1,000 GOLD |
| Guild Master | Found elite guild | Cờ Xanh badge |

## Acceptance Criteria
- [ ] Achievement granted exactly once (idempotent)
- [ ] Badge displayed on user profile
- [ ] Unlock animation shown in-app
- [ ] Multi-step progress tracked

---

## Issue #35: Settings modal — sound, notifications, wallet info, account management

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend, frontend |
| **Priority** | 🟢 Low |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/35](https://github.com/flappybirdweb3/bandit-buddy/issues/35) |
| **Status** | OPEN |

## Overview
User settings panel.

## Sections
1. Audio — volume slider, toggle SFX/music
2. Notifications — toggle push types
3. Wallet — address (truncated), copy, rotate
4. Account — username, level, trust score
5. Language — EN / VI / ZH

## Acceptance Criteria
- [ ] Settings persisted server-side
- [ ] Notification toggle respected by Bot API push
- [ ] Language change applies without reload

---

## Issue #36: Farm Maintenance System — durability decay, repair cost, steal penalty — ⭐ AUDIT FIX v1

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend, frontend |
| **Priority** | 🔴 High |
| **Epic** | core-game |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/36](https://github.com/flappybirdweb3/bandit-buddy/issues/36) |
| **Status** | OPEN |

## Overview
AUDIT FIX: PRD 2 requirement — fence/barn degrade over time. At 0% durability, steal success = 100%.

## Mechanics
- `fence_durability` and `barn_durability` start at 100
- Decay rate: ~14.3% per day (100 -> 0 in 7 days)
- At 0% durability: steal success rate = 100% (guard dogs ignored)
- Repair cost: 50 GOLD per 10% durability restored

## Lazy calculation
```typescript
function calculateCurrentDurability(building: FarmBuilding): number {
  const daysSince = (Date.now() - building.last_repaired_at.getTime()) / 86400000;
  return Math.max(0, building.fence_durability - Math.floor(daysSince * 14.3));
}
```

## Integration with STEAL endpoint
```typescript
const durabilityPct = calculateCurrentDurability(building);
if (durabilityPct <= 0) successRate = 100; // no guard dog defense
```

## API
```
GET  /farm/buildings
POST /farm/buildings/repair { amount: number }
```

## Acceptance Criteria
- [ ] Durability shown with colour-coded indicator (green/yellow/red)
- [ ] Warning banner at 0% on victim farm
- [ ] Repair deducts GOLD atomically
- [ ] Steal endpoint reads live durability

---

## Issue #37: Soil Fertility Decay — -20% per harvest, fertilizer recovery mechanic — ⭐ AUDIT FIX v1

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend, frontend |
| **Priority** | 🔴 High |
| **Epic** | core-game |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/37](https://github.com/flappybirdweb3/bandit-buddy/issues/37) |
| **Status** | OPEN |

## Overview
AUDIT FIX: PRD 2 requirement — soil degrades 20% per harvest, forcing fertilizer purchase.

## Mechanics
- `farm_plots.soil_fertility` INTEGER (0-100), default 100
- Each harvest: `soil_fertility = MAX(0, soil_fertility - 20)`
- Yield formula: `actual_yield = base_yield * (soil_fertility / 100)`
- At 0%: yield = 0, cannot plant (must restore first)

## Restoration items
| Item | Fertility | Cost |
|------|-----------|------|
| Basic Compost | +20 | 30 GOLD |
| Rich Compost | +50 | 70 GOLD |
| Super Soil | +100 | 150 GOLD |

## API
```
POST /action/restore-soil { plotId, itemType }
```

## Acceptance Criteria
- [ ] Soil fertility shown as progress bar per plot
- [ ] Cannot plant on 0% fertility (400 error)
- [ ] Yield reduced proportionally
- [ ] Compost consumed from inventory

---

## Issue #38: Revenge & Viral Mechanic — anonymous theft, Magnifying Glass, Master Key — ⭐ AUDIT FIX v1

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | backend, frontend |
| **Priority** | 🔴 High |
| **Epic** | core-game |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/38](https://github.com/flappybirdweb3/bandit-buddy/issues/38) |
| **Status** | OPEN |

## Overview
AUDIT FIX: PRD 2 core viral mechanic — all thefts anonymous. Victims invite friends to reveal thieves.

## Anonymous theft
- `steal_logs.is_anonymous = true` always
- Victim sees "Unknown Thief stole X GOLD"
- Thief revealed only when Magnifying Glass used

## Item economy
| Item | Earn | Use |
|------|------|-----|
| Magnifying Glass | Invite 1 user | Reveal 1 thief |
| Master Key | Invite 3 cumulative users | Bypass guard dogs |

## API
```
POST /revenge/reveal { stealLogId }
  — Consumes 1 Magnifying Glass
  — Returns: { thiefUsername, thiefAvatarUrl, stolenAt }

POST /action/steal { targetUserId, plotId, useMasterKey: true }
  — Consumes 1 Master Key
  — guard dog defense = 0
```

## Referral -> item
```typescript
async processReferral(referrerId, newUserId) {
  const total = await this.countReferrals(referrerId);
  if (total === 1) await this.giveItem(referrerId, 'magnifying_glass', 1);
  if (total === 3) await this.giveItem(referrerId, 'master_key', 1);
}
```

## Acceptance Criteria
- [ ] Victim API never exposes thief_id
- [ ] Reveal fails with 400 if no Magnifying Glass
- [ ] Master Key consumed on successful steal only
- [ ] Items shown in inventory with usage instructions


# Sprint 3: Smart Contracts & Blockchain Layer
**11 issues** · 🔴 High: 9 · 🟡 Medium: 2 · 🟢 Low: 0

---

## Issue #39: [SC] BanditMarket.sol — P2P NFT Marketplace with EIP-712 order book — 🔧 AUDIT FIX v3

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | smart-contract |
| **Priority** | 🔴 High |
| **Epic** | marketplace |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/39](https://github.com/flappybirdweb3/bandit-buddy/issues/39) |
| **Status** | OPEN |

## Overview
Solidity contract for P2P NFT marketplace with EIP-712 signed orders.

## Interface
```solidity
contract BanditMarket {
    struct Order {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;      // BNB wei
        uint256 deadline;
        uint256 nonce;
    }

    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "Order(address seller,address nftContract,uint256 tokenId,uint256 price,uint256 deadline,uint256 nonce)"
    );

    function buyWithSignature(Order calldata order, bytes calldata signature) external payable {
        // 1. Verify deadline not passed
        // 2. Verify EIP-712 signature against seller address
        // 3. Verify msg.value == order.price
        // 4. Invalidate nonce (prevent replay)
        // 5. Transfer NFT: seller -> buyer  ← See ERC-1155 note below
        // 6. Send 97.5% BNB to seller, 2.5% to TreasuryBuyBack
    }

    function cancelOrder(bytes32 orderHash) external { ... }
}
```

## ⚠️ Critical: ERC-1155 Transfer (AUDIT FIX v3)

Guard Dogs are **ERC-1155** tokens (multi-edition, not ERC-721 single-edition).
The NFT transfer in step 5 **must** use `safeTransferFrom` with the ERC-1155 signature:

```solidity
// CORRECT — ERC-1155
IERC1155(order.nftContract).safeTransferFrom(
    order.seller,
    msg.sender,      // buyer
    order.tokenId,
    1,               // amount (quantity = 1 dog)
    ""               // data (empty bytes)
);
```

**Do NOT use** the ERC-721 pattern (missing the `amount` and `data` params):
```solidity
// WRONG — ERC-721 pattern, will REVERT on ERC-1155 contract
IERC721(order.nftContract).transferFrom(order.seller, msg.sender, order.tokenId);
```

The seller must also call `IERC1155.setApprovalForAll(BanditMarket, true)` before listing
(not `approve(tokenId)` as in ERC-721). The frontend listing flow must trigger this approval.

## Import required
```solidity
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

contract BanditMarket is ReentrancyGuard, EIP712, ERC1155Holder {
    // ERC1155Holder required if contract ever temporarily holds the NFT
}
```

## Acceptance Criteria
- [ ] EIP-712 domain separator for BSC (chainId: 56)
- [ ] Replay attack impossible (nonce + deadline)
- [ ] Fee split atomic (97.5% seller / 2.5% TreasuryBuyBack)
- [ ] **Uses `IERC1155.safeTransferFrom` with amount=1** ← Added (Audit v3)
- [ ] **Seller approval flow uses `setApprovalForAll`, not `approve(tokenId)`** ← Added (Audit v3)
- [ ] 100% Hardhat test coverage
- [ ] < 150,000 gas per buy

---

## Issue #40: [SC] BanditDogFusion.sol — Guard Dog Gacha with Commit-Reveal Oracle RNG — 🔧 AUDIT FIX v3

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | smart-contract |
| **Priority** | 🔴 High |
| **Epic** | gacha |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/40](https://github.com/flappybirdweb3/bandit-buddy/issues/40) |
| **Status** | OPEN |

## Overview
ERC-1155 Guard Dog NFTs with provably fair commit-reveal gacha.

## Commit-Reveal
```solidity
function commitPull(bytes32 commitment) external {
    commits[msg.sender] = Commit({ hash: commitment, block: block.number });
    farmToken.transferFrom(msg.sender, address(this), PULL_PRICE);
}

function revealPull(bytes32 secret) external {
    Commit memory c = commits[msg.sender];
    require(block.number > c.block + 1, "Too early");
    require(block.number < c.block + 256, "Expired");
    require(keccak256(abi.encodePacked(secret, msg.sender, c.block)) == c.hash, "Invalid");
    uint256 rand = uint256(keccak256(abi.encodePacked(secret, blockhash(c.block + 1))));
    _mintDogByRarity(msg.sender, rand);
    delete commits[msg.sender];
}
```

## Dog tiers
| Tier | Defense | Pull Rate |
|------|---------|-----------|
| 1 — Common Mutt | 10 | 60% |
| 2 — Guard Hound | 25 | 25% |
| 3 — War Dog | 50 | 12% |
| 4 — Shadow Wolf | 100 | 3% |

## Pity system
- Guaranteed Tier 3 (War Dog) or higher at 90 pulls without Tier 3+
- Guaranteed Tier 4 (Shadow Wolf) at 300 pulls without Tier 4

## ⚠️ Tiered Fusion (Burn-Upgrade) Cost — AUDIT FIX v3

The fusion cost is **NOT a flat 1,000 $FARM**. It follows a banded pricing table from PRD:

| Upgrade | Input | $FARM Burn Cost |
|---------|-------|----------------|
| Tier 1 → Tier 2 | 3× Tier 1 NFTs | 20 $FARM |
| Tier 2 → Tier 3 | 3× Tier 2 NFTs | 100 $FARM |
| Tier 3 → Tier 4 | 3× Tier 3 NFTs | 800 $FARM |

Implementation:
```solidity
// Tiered cost mapping
mapping(uint256 => uint256) public fusionCost; // tierFrom => FARM amount (wei)

constructor() {
    fusionCost[1] = 20 * 1e18;    // Tier 1 -> 2: 20 FARM
    fusionCost[2] = 100 * 1e18;   // Tier 2 -> 3: 100 FARM
    fusionCost[3] = 800 * 1e18;   // Tier 3 -> 4: 800 FARM
}

function fuseDogs(uint256 tier, uint256[3] calldata tokenIds) external {
    uint256 cost = fusionCost[tier];
    require(cost > 0, "Invalid tier");

    // Burn 3 NFTs of the given tier
    for (uint i = 0; i < 3; i++) {
        require(ownerOf(tokenIds[i]) == msg.sender, "Not owner");
        require(dogTier[tokenIds[i]] == tier, "Wrong tier");
        _burn(tokenIds[i]);
    }

    // Burn $FARM at tiered cost
    farmToken.transferFrom(msg.sender, address(0xdead), cost);

    // Mint 1 NFT of tier+1 (RNG for sub-stats within tier)
    uint256 rand = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)));
    _mintDogAtTier(msg.sender, tier + 1, rand);
}
```

> **Note for Dev team:** Always refer back to the PRD for the exact cost table before deploying. The table above reflects PRD v2 as of 2026-09-10 — if PRD is updated, this contract constant must be redeployed or made configurable via `owner`.

## Acceptance Criteria
- [ ] Commit-reveal prevents miner manipulation
- [ ] Pity counter on-chain per address
- [ ] **Fusion uses tiered cost: 20 / 100 / 800 $FARM per tier** ← Fixed (Audit v3, was incorrectly "1000 FARM flat")
- [ ] **fusionCost mapping configurable by owner (for future PRD updates)** ← Added (Audit v3)
- [ ] 100% Hardhat test coverage

---

## Issue #41: [SC] TreasuryBuyBack.sol — auto buy-back and burn mechanism

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | smart-contract |
| **Priority** | 🔴 High |
| **Epic** | treasury |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/41](https://github.com/flappybirdweb3/bandit-buddy/issues/41) |
| **Status** | OPEN |

## Overview
Treasury contract converting BNB fees to $FARM burns via PancakeSwap.

## Contract
```solidity
contract TreasuryBuyBack {
    IPancakeRouter public router;
    IERC20 public farmToken;
    uint256 public constant BUY_BACK_THRESHOLD = 0.1 ether;

    receive() external payable {
        if (address(this).balance >= BUY_BACK_THRESHOLD) _buyBackAndBurn();
    }

    function _buyBackAndBurn() internal {
        address[] memory path = new address[](2);
        path[0] = router.WETH();
        path[1] = address(farmToken);
        router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: address(this).balance}(
            0, path, address(this), block.timestamp + 300
        );
        farmToken.burn(farmToken.balanceOf(address(this)));
        emit BuyBackExecuted(...);
    }
}
```

## Fee routing: BanditMarket 2.5% + BanditDogFusion 50% pull fee -> TreasuryBuyBack

## Acceptance Criteria
- [ ] Buy-back triggered at 0.1 BNB threshold
- [ ] FARM burned (sent to 0x000...dead)
- [ ] BuyBackExecuted event emitted
- [ ] 90% min slippage protection

---

## Issue #42: Blockchain event indexer — startMarketplaceListener with fallback cronjob

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | backend, infra |
| **Priority** | 🔴 High |
| **Epic** | blockchain-infra |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/42](https://github.com/flappybirdweb3/bandit-buddy/issues/42) |
| **Status** | OPEN |

## Overview
Real-time event indexer: WebSocket primary, polling fallback.

## Architecture
```typescript
async startMarketplaceListener() {
  const wsProvider = new ethers.WebSocketProvider(process.env.BSC_WSS_URL);
  const market = new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, wsProvider);
  market.on('OrderFilled', async (buyer, seller, tokenId, price, txHash) => {
    await this.processOrderFilled({ buyer, seller, tokenId, price, txHash });
  });
  wsProvider.on('error', () => this.startFallbackIndexer());
}

@Cron('*/30 * * * *')
async runMarketplaceIndexer() {
  const lastBlock = await this.getLastProcessedBlock();
  const logs = await this.provider.getLogs({ address: MARKET_ADDRESS, fromBlock: lastBlock + 1, toBlock: 'latest' });
  for (const log of logs) await this.processLog(log);
}
```

## Idempotency
```typescript
async processOrderFilled(event) {
  const exists = await this.txRepo.findOne({ tx_hash: event.txHash });
  if (exists) return;
  await this.txRepo.save({ tx_hash: event.txHash, event_type: 'OrderFilled' });
}
```

## Acceptance Criteria
- [ ] WebSocket auto-reconnects on disconnect
- [ ] Fallback activates within 60s of WSS failure
- [ ] No duplicate event processing
- [ ] Events processed within 15s of on-chain confirmation

---

## Issue #43: Guard Dog Gacha UI — pull animation, tier reveal, pity tracker

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | frontend |
| **Priority** | 🔴 High |
| **Epic** | gacha |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/43](https://github.com/flappybirdweb3/bandit-buddy/issues/43) |
| **Status** | OPEN |

## Overview
Frontend gacha experience for minting Guard Dog NFTs.

## UX flow
1. Open Gacha modal from BottomBar
2. Show $FARM balance, pull cost, pity counter
3. Single Pull or 10-Pull (10% discount)
4. Commit tx -> "Waiting for blockchain..."
5. Reveal after 2 blocks: spin animation + card flip
6. Tier reveal: rarity glow colour-coded
7. "Add to Farm" or "List on Marketplace"

## Pity tracker
```
[████████░░] 80/90 pulls until guaranteed Rare
```

## Acceptance Criteria
- [ ] Reveal animation cannot be skipped
- [ ] Pity matches on-chain state
- [ ] Soul shards shown if burn-upgrade available

---

## Issue #44: Dedicated RPC provider setup with Ethers.js v6 fallback chain

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | infra |
| **Priority** | 🔴 High |
| **Epic** | blockchain-infra |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/44](https://github.com/flappybirdweb3/bandit-buddy/issues/44) |
| **Status** | OPEN |

## Overview
Production-grade BSC RPC with automatic failover.

## Implementation
```typescript
const RPC_URLS = [
  process.env.PRIMARY_RPC_URL,  // Paid: QuickNode/Alchemy
  'https://bsc-dataseed1.binance.org',
  'https://bsc-dataseed2.binance.org',
  'https://bsc-dataseed3.ninicoin.io',
];

export const bscProvider = new ethers.FallbackProvider(
  RPC_URLS.map((url, i) => ({
    provider: new ethers.JsonRpcProvider(url),
    priority: i + 1,
    stallTimeout: 2000,
    weight: i === 0 ? 3 : 1,
  })),
  "Sprint 1: Foundation & Core Infrastructure"
);
```

## Acceptance Criteria
- [ ] Primary failure -> failover within 2 seconds
- [ ] All 3 fallbacks tested with integration test
- [ ] WebSocket URL separate for event listener
- [ ] Provider is shared singleton

---

## Issue #45: FarmToken.sol — ERC-20 with mint, burn, and claim gating

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | smart-contract |
| **Priority** | 🔴 High |
| **Epic** | economy |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/45](https://github.com/flappybirdweb3/bandit-buddy/issues/45) |
| **Status** | OPEN |

## Overview
$FARM ERC-20 token contract on BSC.

## Contract
```solidity
contract FarmToken is ERC20, ERC20Burnable, Ownable {
    address public adminSigner;
    mapping(uint256 => bool) public usedNonces;

    function claim(address to, uint256 amount, uint256 nonce, bytes calldata signature) external {
        require(!usedNonces[nonce], "Nonce used");
        bytes32 hash = keccak256(abi.encodePacked(to, amount, nonce));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        require(recoverSigner(ethHash, signature) == adminSigner, "Invalid signature");
        usedNonces[nonce] = true;
        _mint(to, amount);
    }
}
```

## Tokenomics
- Max supply: 1,000,000,000 FARM
- 100% earned in-game (no pre-mine)
- Burn via TreasuryBuyBack + fusion cost

## Acceptance Criteria
- [ ] claim() verifies ECDSA from admin signer
- [ ] Nonce replay prevented
- [ ] burn() callable by TreasuryBuyBack and BanditDogFusion
- [ ] Owner can update adminSigner
- [ ] 100% Hardhat test coverage

---

## Issue #46: Hardhat project setup — compile, test, deploy scripts for all contracts — 🔧 AUDIT FIX v2

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | smart-contract, infra |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/46](https://github.com/flappybirdweb3/bandit-buddy/issues/46) |
| **Status** | OPEN |

## Overview
Hardhat dev environment for all Solidity contracts.

## Structure
```
contracts/
├── hardhat.config.ts
├── contracts/
│   ├── FarmToken.sol
│   ├── BanditMarket.sol
│   ├── BanditDogFusion.sol
│   ├── TreasuryBuyBack.sol
│   └── GuildStaking.sol          ← Added: required by Issue #48 (Guild Tier)
├── test/
│   ├── FarmToken.test.ts
│   ├── BanditMarket.test.ts
│   ├── BanditDogFusion.test.ts
│   ├── TreasuryBuyBack.test.ts
│   └── GuildStaking.test.ts      ← Added
└── scripts/
    ├── deploy-testnet.ts
    └── deploy-mainnet.ts
```

## GuildStaking.sol (brief spec)
```solidity
// Allows guild owners to stake 1,000  to unlock Bang Tinh Anh (Elite) tier
contract GuildStaking {
    IERC20 public farmToken;
    uint256 public constant ELITE_STAKE = 1000 * 1e18;

    mapping(address => uint256) public stakedAmount;

    function stake(uint256 amount) external {
        require(amount >= ELITE_STAKE, "Minimum 1000 FARM");
        farmToken.transferFrom(msg.sender, address(this), amount);
        stakedAmount[msg.sender] += amount;
        emit Staked(msg.sender, amount);
    }

    function unstake() external {
        uint256 amount = stakedAmount[msg.sender];
        require(amount > 0, "Nothing staked");
        stakedAmount[msg.sender] = 0;
        farmToken.transfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
        // Backend listens for Unstaked event -> downgrade guild to 'free'
    }
}
```

## hardhat.config.ts
```typescript
networks: {
  bscTestnet: { url: process.env.BSC_TESTNET_RPC, chainId: 97 },
  bscMainnet: { url: process.env.BSC_MAINNET_RPC, chainId: 56 },
},
etherscan: { apiKey: { bsc: process.env.BSCSCAN_KEY } }
```

## Acceptance Criteria
- [ ] npx hardhat compile -- 0 errors (all 5 contracts)
- [ ] npx hardhat test -- all tests pass including GuildStaking.test.ts
- [ ] npx hardhat run scripts/deploy-testnet.ts deploys all 5 contracts
- [ ] Contracts verified on BscScan testnet
- [ ] GitHub Actions runs Hardhat tests on SC PRs

---

## Issue #47: Marketplace UI — listing browser, buy flow, and my listings management

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | frontend |
| **Priority** | 🟡 Medium |
| **Epic** | marketplace |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/47](https://github.com/flappybirdweb3/bandit-buddy/issues/47) |
| **Status** | OPEN |

## Overview
Frontend marketplace to browse, buy, and manage Guard Dog NFT listings.

## Screens
1. Browse — NFT grid (dog image, tier, defense, price BNB)
2. Filters — by tier, price range, defense
3. Buy flow — confirm -> wallet tx -> wait 2 confirmations
4. My Listings — active/sold/cancelled

## Buy flow
```typescript
async function buyNFT(listing, signature) {
  const market = new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, signer);
  const tx = await market.buyWithSignature(listing.order, signature, {
    value: ethers.parseEther(listing.price_bnb.toString()),
  });
  await tx.wait(2);
}
```

## Acceptance Criteria
- [ ] Browse 20 listings < 300ms
- [ ] Buy tx shown as "pending" until 2 confirmations
- [ ] My Listings shows sold/cancelled correctly

---

## Issue #48: Guild system — create/join, Bang Tinh Anh tier, World Tree, harvest tax — ⭐ AUDIT FIX v1

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | backend, frontend |
| **Priority** | 🟡 Medium |
| **Epic** | guild |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/48](https://github.com/flappybirdweb3/bandit-buddy/issues/48) |
| **Status** | OPEN |

## Overview
AUDIT FIX (enhanced): Full guild system with two tiers, on-chain staking for Elite badge, harvest tax.

## Guild tiers
| Tier | Cost | Members | Features |
|------|------|---------|----------|
| Bang Dan Da (Free) | 0 | max 20 | No tax, no Cờ Xanh |
| Bang Tinh Anh (Elite) | Stake 1,000 $FARM | max 50 | Cờ Xanh badge, 1-5% harvest tax |

## Harvest tax (Elite only)
```typescript
// In harvest endpoint:
if (user.guild?.tier === 'elite') {
  const tax = yield * (user.guild.tax_rate / 100);
  guildOwnerGold += tax;
  actualYield = yield - tax;
}
```

## World Tree
- Shared resource: 1,000 HP, +10 HP/day regen
- Members donate crops to restore HP
- 100 HP = +5% XP bonus for all members

## API
```
POST /guild/create { name, tier }
POST /guild/join { guildId }
POST /guild/upgrade-elite
GET  /guild/:id
PATCH /guild/tax-rate { rate: 1-5 }  -- owner only
```

## Acceptance Criteria
- [ ] Elite guild requires 1,000 $FARM staked (verified on-chain)
- [ ] Cờ Xanh badge in leaderboard
- [ ] Tax deducted from harvest and credited to owner atomically
- [ ] World Tree HP shown with donate button

---

## Issue #49: Premium Subscriptions — Butler auto-harvest and Crop Insurance — ⭐ AUDIT FIX v1 + 🔧 AUDIT FIX v2

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | backend, frontend |
| **Priority** | 🔴 High |
| **Epic** | economy |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/49](https://github.com/flappybirdweb3/bandit-buddy/issues/49) |
| **Status** | OPEN |

## Overview
AUDIT FIX: PRD 2 requirement — two premium $FARM-paid services.

## Plans

### Quản gia (Butler) — Auto-harvest
- Price: 100 $FARM / month
- Effect: auto-harvest all ripe crops every 30 minutes

### Bảo hiểm Nông sản (Crop Insurance)
- Price: 50 $FARM / month
- Effect: if stolen from, compensate 80% of stolen amount

## $FARM Revenue Routing (AUDIT FIX v2)
All subscription fees collected in $FARM **must be routed** to TreasuryBuyBack.sol for auto buy-back & burn. Without this, tokens accumulate in the backend wallet and disrupt tokenomics.

```typescript
// src/subscriptions/subscriptions.service.ts
async subscribe(userId: string, subType: 'butler' | 'insurance') {
  const price = subType === 'butler' ? BUTLER_PRICE_FARM : INSURANCE_PRICE_FARM;

  // Step 1: Collect  from user via ECDSA-signed off-chain deduction
  //         (same pattern as claim signature, but in reverse — user signs spend approval)
  await this.collectFarmPayment(userId, price);

  // Step 2: Route collected  to TreasuryBuyBack.sol for burn
  //         This is CRITICAL — do not leave tokens sitting in admin wallet
  const tx = await this.farmTokenContract.transfer(
    TREASURY_BUYBACK_ADDRESS,
    ethers.parseEther(price.toString())
  );
  await tx.wait(1);

  // Step 3: Activate subscription in DB
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await this.subRepo.save({ user_id: userId, sub_type: subType, expires_at: expiresAt });
}
```

> **Why route to Treasury?** TreasuryBuyBack.sol auto-swaps BNB/FARM fee income and burns FARM, creating deflationary pressure. Subscription revenue in FARM can be burned directly — even more deflationary than the buy-back route.

**Alternative (simpler & more deflationary):** Call `farmToken.burn(price)` directly instead of transferring to Treasury. Confirm with tokenomics team which is preferred.

## API
```
GET  /subscriptions/available
POST /subscriptions/subscribe { subType }
POST /subscriptions/cancel { subType }
```

## Butler cron
```typescript
@Cron('*/30 * * * *')
async autoHarvestForSubscribers() {
  const subs = await this.subRepo.findActiveByType('butler');
  for (const sub of subs) {
    await this.farmService.harvestAllRipe(sub.user_id, { isAutomatic: true });
  }
}
```

## Insurance on steal
```typescript
// In steal success handler (Issue #16):
const insurance = await this.subRepo.findActive(victim.id, 'insurance');
if (insurance) {
  await em.update(User, victimId, {
    gold_balance: () => `gold_balance + ${stealAmount * 0.8}`
  });
}
```

## Acceptance Criteria
- [ ] Butler harvests all ripe plots within 30 minutes of becoming ripe
- [ ] Insurance compensation credited in same transaction as theft
- [ ] **$FARM collected routed to TreasuryBuyBack or burned — verified on BscScan** ← Added
- [ ] Subscription status shown in Settings modal
- [ ] Expired subscription auto-deactivated (not silently renewed)
- [ ] Zero $FARM stranded in admin wallet after subscription payment


# Sprint 4: QA, Polish & MVP Launch
**10 issues** · 🔴 High: 5 · 🟡 Medium: 2 · 🟢 Low: 3

---

## Issue #50: Smart contract security audit — BanditMarket, BanditDogFusion, TreasuryBuyBack — 🔧 AUDIT FIX v2

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 4: QA, Polish & MVP Launch |
| **Area** | smart-contract |
| **Priority** | 🔴 High |
| **Epic** | security |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/50](https://github.com/flappybirdweb3/bandit-buddy/issues/50) |
| **Status** | OPEN |

## Overview
External security audit of all Solidity contracts before BSC Mainnet deployment.

## Audit scope
1. **FarmToken.sol** — mint authority, nonce replay, supply cap
2. **BanditMarket.sol** — EIP-712 replay, reentrancy, fee manipulation
3. **BanditDogFusion.sol** — RNG manipulation, pity counter overflow, reentrancy
4. **TreasuryBuyBack.sol** — sandwich attacks, slippage exploitation, admin key risks
5. **GuildStaking.sol** — stake lock bypass, unstake reentrancy, elite-tier privilege escalation ← Added (Issue #48)

## GuildStaking.sol specific risks to audit
- Can a user unstake and retain Elite status? (server must listen for Unstaked event)
- Reentrancy on `unstake()` before internal state reset
- Integer overflow on staked amount accumulation
- Front-running stake to claim Elite badge without sufficient tokens

## Pre-audit checklist
- [ ] Slither: 0 High/Medium findings across all 5 contracts
- [ ] Mythril: 0 findings
- [ ] 100% branch + line coverage
- [ ] No tx.origin usage
- [ ] ReentrancyGuard on all payable/external state-changing functions
- [ ] Events emitted for all state changes

## Acceptance Criteria
- [ ] Audit report: no Critical/High findings across all 5 contracts
- [ ] All Medium findings addressed or formally accepted with written rationale
- [ ] Audit report published publicly (transparency)
- [ ] All 5 contracts deployed only after audit sign-off

---

## Issue #51: BSC Mainnet deployment — FarmToken, BanditMarket, BanditDogFusion, TreasuryBuyBack — 🔧 AUDIT FIX v2

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 4: QA, Polish & MVP Launch |
| **Area** | smart-contract, infra |
| **Priority** | 🔴 High |
| **Epic** | security |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/51](https://github.com/flappybirdweb3/bandit-buddy/issues/51) |
| **Status** | OPEN |

## Overview
Production deployment of all 5 smart contracts to BSC Mainnet.

## Deployment order (dependency chain)
1. **FarmToken.sol** — deploy first, note address
2. **TreasuryBuyBack.sol** — needs FarmToken + PancakeRouter address
3. **BanditMarket.sol** — needs TreasuryBuyBack address
4. **BanditDogFusion.sol** — needs FarmToken address
5. **GuildStaking.sol** — needs FarmToken address ← Added (Issue #48)

## Post-deploy steps
- [ ] Verify all 5 contracts on BscScan Mainnet
- [ ] Update backend `.env` with all 5 mainnet contract addresses
- [ ] Set `adminSigner` in FarmToken to server wallet
- [ ] Transfer TreasuryBuyBack ownership to multisig
- [ ] Transfer GuildStaking ownership to multisig ← Added
- [ ] Add initial PancakeSwap FARM/BNB liquidity
- [ ] Configure blockchain event indexer to listen for `GuildStaking.Staked` and `GuildStaking.Unstaked` events ← Added

## Backend event handling for GuildStaking
```typescript
// When Staked event received: upgrade guild to 'elite' tier
guildStaking.on('Staked', async (owner, amount) => {
  await guildService.upgradeToElite(owner);
});

// When Unstaked event received: downgrade guild back to 'free'
guildStaking.on('Unstaked', async (owner) => {
  await guildService.downgradeToFree(owner);
});
```

## Acceptance Criteria
- [ ] All 5 contracts deployed and verified on BscScan Mainnet
- [ ] Backend .env updated with all 5 contract addresses
- [ ] Smoke test: claim flow end-to-end on Mainnet
- [ ] Smoke test: stake 1,000 FARM -> guild upgrades to Elite
- [ ] Multisig holds ownership of TreasuryBuyBack and GuildStaking

---

## Issue #52: End-to-end integration test suite — full game flow on BSC Testnet

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 4: QA, Polish & MVP Launch |
| **Area** | backend, smart-contract, infra |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/52](https://github.com/flappybirdweb3/bandit-buddy/issues/52) |
| **Status** | OPEN |

## Overview
Full integration test covering complete game loop from Telegram auth to on-chain claim.

## Test scenarios
1. Auth: Telegram initData -> JWT -> GET /user/profile
2. Farm loop: plant -> wait -> harvest -> gold update
3. Steal: steal -> success case + dog bite case
4. Economy: claim signature -> FarmToken.claim() on testnet
5. Marketplace: list NFT -> browse -> buy -> ownership transfer
6. Gacha: commit -> reveal -> NFT minted -> added to farm

## Tech
- Jest + Supertest for API
- Hardhat local fork for contracts
- Docker Compose test env

## Acceptance Criteria
- [ ] All 6 scenarios pass on BSC Testnet
- [ ] Tests run < 5 minutes in CI
- [ ] Flaky test rate < 1%

---

## Issue #53: Performance optimization — Phaser bundle, React lazy loading, API response times

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 4: QA, Polish & MVP Launch |
| **Area** | backend, frontend, infra |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/53](https://github.com/flappybirdweb3/bandit-buddy/issues/53) |
| **Status** | OPEN |

## Overview
Optimise to meet Telegram Mini App < 3s initial load on 4G.

## Frontend
- Phaser 3 custom build < 400KB gzipped (exclude unused modules)
- React.lazy() for all 6 modal components
- Preload critical assets during splash screen
- WebP format, max 50KB per sprite sheet

## Backend indexes
```sql
CREATE INDEX idx_farm_plots_user_harvestable ON farm_plots(user_id, harvestable_at);
CREATE INDEX idx_steal_logs_victim ON steal_logs(victim_id, created_at);
CREATE INDEX idx_nft_dogs_owner_active ON nft_guard_dogs(owner_id, is_active);
```

## Targets
| Metric | Target |
|--------|--------|
| Initial load (4G) | < 3s |
| API p95 | < 200ms |
| Steal p99 (100 concurrent) | < 500ms |
| Phaser FPS | 60fps mid-range Android |

## Acceptance Criteria
- [ ] Lighthouse mobile score > 80
- [ ] 100 concurrent steal requests p99 < 500ms
- [ ] Phaser bundle < 400KB gzipped
- [ ] No memory leaks after 30 min gameplay

---

## Issue #54: Nginx + SSL production deployment — frontend CDN, backend reverse proxy

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 4: QA, Polish & MVP Launch |
| **Area** | infra |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/54](https://github.com/flappybirdweb3/bandit-buddy/issues/54) |
| **Status** | OPEN |

## Overview
Production Nginx with SSL termination, static frontend serving, backend proxy.

## Nginx config
```nginx
server {
    listen 443 ssl http2;
    server_name banditbuddy.app;
    ssl_certificate /etc/letsencrypt/live/banditbuddy.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/banditbuddy.app/privkey.pem;

    location / {
        root /var/www/banditbuddy/dist;
        try_files $uri $uri/ /index.html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
server { listen 80; return 301 https://$host$request_uri; }
```

## SSL: Let's Encrypt via Certbot, auto-renewal systemd timer

## Acceptance Criteria
- [ ] HTTPS enforced (HTTP -> HTTPS redirect)
- [ ] SSL Labs grade A or higher
- [ ] Static assets cached 1-year
- [ ] Zero-downtime deploy via `nginx -s reload`

---

## Issue #55: NFT Guard Dog feeding subscription system

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 4: QA, Polish & MVP Launch |
| **Area** | backend, frontend |
| **Priority** | 🟡 Medium |
| **Epic** | core-game |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/55](https://github.com/flappybirdweb3/bandit-buddy/issues/55) |
| **Status** | OPEN |

## Overview
Guard Dogs require daily feeding to maintain defense power.

## Mechanics
- Feed every 24 hours: 10 GOLD per dog
- Unfed 24h: defense_power -50%
- Unfed 48h: defense_power = 0
- Auto-feed subscription: 200 GOLD/month

## Effective defense calculation
```typescript
function getEffectiveDefense(dog: NftGuardDog): number {
  const hoursSince = (Date.now() - dog.last_fed_at.getTime()) / 3600000;
  if (hoursSince < 24) return dog.defense_power;
  if (hoursSince < 48) return Math.floor(dog.defense_power * 0.5);
  return 0;
}
```

## API
```
POST /dogs/:dogId/feed
GET  /dogs
```

## Acceptance Criteria
- [ ] Hunger timer shown in dog inventory UI
- [ ] Steal uses effective (hunger-adjusted) defense power
- [ ] Auto-feed cron feeds all dogs at 00:00 UTC
- [ ] Dog shows "hungry" visual state

---

## Issue #56: Telegram Mini App polish — safe area, viewport, haptic feedback, back button

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 4: QA, Polish & MVP Launch |
| **Area** | frontend |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/56](https://github.com/flappybirdweb3/bandit-buddy/issues/56) |
| **Status** | OPEN |

## Overview
Final Telegram-specific polish for native-quality UX.

## Safe areas
```css
.app-container {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```

## Viewport lock
```typescript
window.Telegram.WebApp.expand();
window.Telegram.WebApp.disableVerticalSwipes();
```

## Haptic feedback
```typescript
const haptic = window.Telegram.WebApp.HapticFeedback;
haptic.impactOccurred('light');          // button tap
haptic.impactOccurred('medium');         // harvest
haptic.notificationOccurred('success');  // steal success
haptic.notificationOccurred('error');    // dog bite
```

## Back button
```typescript
window.Telegram.WebApp.BackButton.onClick(() => {
  if (currentModal) closeModal();
  else if (currentTab !== 'farm') navigateTo('farm');
  else window.Telegram.WebApp.close();
});
```

## Acceptance Criteria
- [ ] No content hidden by notch/nav bar
- [ ] Back button correct in all navigation states
- [ ] Haptic on: plant, harvest, steal, level-up, purchase
- [ ] No bounce on pull-down gesture
- [ ] Tested: iPhone 14 iOS 17 + Pixel 7 Android 13

---

## Issue #57: Seasonal events system — Halloween, Christmas, Lunar New Year crops

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 4: QA, Polish & MVP Launch |
| **Area** | backend, frontend |
| **Priority** | 🟢 Low |
| **Epic** | core-game |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/57](https://github.com/flappybirdweb3/bandit-buddy/issues/57) |
| **Status** | OPEN |

## Overview
Time-limited seasonal events with exclusive crops and cosmetic rewards.

## Calendar
| Event | Period | Crop | Yield bonus |
|-------|--------|------|------------|
| Halloween | Oct 15-31 | Pumpkin Demon | +100% |
| Christmas | Dec 20-Jan 1 | Frost Berry | +80% |
| Lunar New Year | Jan 28-Feb 7 | Lucky Peach | +150% |
| Summer | Jul 1-15 | Sunflower | +60% |

## Implementation
```typescript
function getCurrentEvent(now: Date): SeasonalEvent | null {
  return EVENTS.find(e => now >= e.startDate && now <= e.endDate) ?? null;
}
```

## Acceptance Criteria
- [ ] Seasonal seeds in shop only during event period
- [ ] Farm scene has seasonal overlay (snow/leaves/lanterns)
- [ ] Event countdown timer in HUD
- [ ] Special achievement for completing event

---

## Issue #58: World Tree GvG — weekly guild war event with resource capture

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 4: QA, Polish & MVP Launch |
| **Area** | backend, frontend |
| **Priority** | 🟢 Low |
| **Epic** | guild |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/58](https://github.com/flappybirdweb3/bandit-buddy/issues/58) |
| **Status** | OPEN |

## Overview
Weekly GvG: guilds compete to damage the World Tree node for reward pool.

## Mechanics
- Every Monday 00:00 UTC: World Tree spawns with 10,000 HP
- Guilds attack using Raid Tokens (earned from guild contributions)
- Each token: 100 damage
- Top 3 at weekly reset share reward pool (40% / 30% / 20%, 10% burned)
- Reward pool: 5% of all guild harvest taxes this week

## API
```
POST /guild/gvg/attack { raidTokens: number }
GET  /guild/gvg/leaderboard
```

## Acceptance Criteria
- [ ] World Tree HP real-time in Guild screen
- [ ] Attack requires Raid Tokens
- [ ] Weekly reset distributes rewards atomically
- [ ] Top 3 guilds shown with crown badges

---

## Issue #59: Admin dashboard — farm stats, user management, economy monitoring — 🔧 AUDIT FIX v3

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 4: QA, Polish & MVP Launch |
| **Area** | backend, frontend, infra |
| **Priority** | 🟢 Low |
| **Epic** | - |
| **GitHub** | [https://github.com/flappybirdweb3/bandit-buddy/issues/59](https://github.com/flappybirdweb3/bandit-buddy/issues/59) |
| **Status** | OPEN |

## Overview
Internal admin panel for game health monitoring and user management.

## Sections
1. Economy Monitor — GOLD circulation, GOLD/FARM rate chart, daily mint/burn, treasury balance
2. User Management — search by Telegram/wallet, trust score, ban/unban
3. Farm Stats — crops harvested, steal success rate, active players (24h/7d/30d)
4. Smart Contract Monitor — last block, indexer queue, RPC health

## Oracle Wallet Gas Monitor 🔧 AUDIT FIX v3
The backend `adminSigner` wallet calls `revealPull()` on-chain for every Gacha reveal, paying BNB gas. If this wallet runs dry, the **entire Gacha system halts for all users**.

Add the following to the Smart Contract Monitor section:

```typescript
// src/admin/admin.service.ts
@Cron("*/10 * * * *")  // every 10 minutes
async checkOracleWalletBalance() {
  const balance = await this.provider.getBalance(ORACLE_WALLET_ADDRESS);
  const bnbBalance = parseFloat(ethers.formatEther(balance));

  if (bnbBalance < 0.05) {
    // Alert via Telegram Bot to admin chat
    await this.telegramBot.sendMessage(ADMIN_CHAT_ID, {
      text: `⚠️ ORACLE WALLET LOW GAS ALERT\n\nWallet: ${ORACLE_WALLET_ADDRESS}\nBalance: ${bnbBalance.toFixed(4)} BNB\n\nAction required: Top up immediately to prevent Gacha downtime.`,
    });
    this.logger.error(`Oracle wallet balance critical: ${bnbBalance} BNB`);
  }
}
```

Dashboard UI: Add a "Oracle Wallet BNB Balance" card in Smart Contract Monitor section with:
- Live BNB balance (updated every 10 min)
- Red indicator if < 0.05 BNB
- Yellow indicator if < 0.1 BNB
- "Top Up" button linking to BscScan address page

## Security
- Admin routes: separate JWT with role: `admin`
- All actions logged to audit_logs table
- Nginx IP allowlist for /admin/* routes

## Acceptance Criteria
- [ ] Economy metrics update within 60 seconds
- [ ] User search < 200ms
- [ ] Trust score adjustment requires reason (audit log)
- [ ] Dashboard not accessible without admin JWT
- [ ] **Oracle wallet gas alert fires via Telegram when BNB < 0.05** ← Added (Audit v3)
- [ ] Oracle balance widget shows live BNB balance with colour-coded status ← Added (Audit v3)

