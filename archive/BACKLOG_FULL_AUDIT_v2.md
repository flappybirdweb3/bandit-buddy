# Bandit Buddy — Full Product Backlog v2.0 (Post-Audit)

> **Repository:** https://github.com/dongprotocol/bandit-buddy  
> **Export date:** 2026-09-10  
> **Version:** v2.0 — After Independent Audit (score: 85/100)  
> **Total Issues:** 60 (55 original + 5 audit fixes)  
> **Tech Stack:** NestJS 10 · PostgreSQL 16 · Redis 7 · Phaser 3 · React 18 · Ethers.js v6 · BSC · ERC-20/ERC-1155 · Hardhat  

---

## Audit Findings Summary

> Score: **85/100** — Kiến trúc kỹ thuật xuất sắc. 5 tính năng gameplay/economy bị sót đã được bổ sung.

| Finding | Issue | Sprint | GitHub |
|---------|-------|--------|--------|
| Farm Maintenance System (Durability Decay) | #56 | Sprint 2 | [#56](https://github.com/dongprotocol/bandit-buddy/issues/56) |
| Soil Fertility Decay (GOLD sink thụ động) | #57 | Sprint 2 | [#57](https://github.com/dongprotocol/bandit-buddy/issues/57) |
| Premium Subscriptions (Butler + Insurance) | #58 | Sprint 3 | [#58](https://github.com/dongprotocol/bandit-buddy/issues/58) |
| Guild Tier & Taxation (Stake + Cờ Xanh) | #59 | Sprint 3 | [#59](https://github.com/dongprotocol/bandit-buddy/issues/59) |
| Revenge Viral Mechanic (Kính Lúp + Master Key) | #60 | Sprint 2 | ⚠️ PENDING — tạo thủ công |

---

## Sprint Summary

| Sprint | Issues | 🔴 High | 🟡 Medium | 🟢 Low |
|--------|:------:|:-------:|:---------:|:------:|
| **Sprint 1 — Foundation & Core Infrastructure** (Days 1–7) | 14 | 9 | 4 | 1 |
| **Sprint 2 — Core Game APIs & Economy Layer** (Days 8–14) | 24 | 11 | 11 | 2 |
| **Sprint 3 — Smart Contracts & Blockchain Layer** (Days 15–21) | 12 | 10 | 2 | 0 |
| **Sprint 4 — QA, Polish & MVP Launch** (Days 22–30) | 10 | 5 | 2 | 3 |

---

## Table of Contents

- [Sprint 1 — Foundation & Core Infrastructure (Days 1–7)](#sprint-1)
  - [#1 — Set up NestJS monorepo with TypeScript, Docker, and CI/CD pipeline](#issue-1)
  - [#2 — PostgreSQL schema migrations (TypeORM) — all core tables](#issue-2)
  - [#3 — Telegram initData JWT authentication middleware](#issue-3)
  - [#4 — Phaser 3 MainFarmScene — plot grid, crop sprites, and animation system](#issue-4)
  - [#5 — React HUD, BottomBar, and EventBus integration layer](#issue-5)
  - [#6 — Redis caching layer and rate limiting (Throttler)](#issue-6)
  - [#32 — Energy regen system — 6-min tick, max cap, and regen timer UI](#issue-32)
  - [#33 — Plot upgrade system — unlock additional plots and upgrade yield multiplier](#issue-33)
  - [#40 — Wallet setup flow — auto-generate wallet or connect existing via WalletConnect](#issue-40)
  - [#35 — Weather system — daily conditions affecting crop yields](#issue-35)
  - [#44 — Friends bar — online friends panel with quick visit and steal status](#issue-44)
  - [#45 — Tutorial overlay — first-time user guide with interactive steps](#issue-45)
  - [#47 — Level and XP system — trust score → level gating for seeds and features](#issue-47)
  - [#43 — Sound system — SoundManager with Web Audio API unlock for iOS/Telegram](#issue-43)
- [Sprint 2 — Core Game APIs & Economy Layer (Days 8–14)](#sprint-2)
  - [#7 — Farm CRUD API — plant, harvest, dig, water, bug-spray, weed-kill](#issue-7)
  - [#8 — STEAL endpoint — PostgreSQL transaction, guard dog defense, RNG outcome](#issue-8)
  - [#9 — ECDSA claim signature — GOLD to $FARM on-chain redemption](#issue-9)
  - [#10 — GOLD↔$FARM dynamic exchange rate engine](#issue-10)
  - [#11 — P2P Marketplace backend — listing creation, EIP-712 off-chain orders](#issue-11)
  - [#31 — Shop modal — seed shop, fertilizer, items, and consumables](#issue-31)
  - [#41 — Anti-cheat and bot detection — trust score system and fraud signals](#issue-41)
  - [#50 — Claim $FARM modal — wallet validation, amount input, signature display](#issue-50)
  - [#56 — Farm Maintenance System — hàng rào/nhà kho mục nát và penalty tăng tỷ lệ trộm](#issue-56) ⭐ **AUDIT FIX**
  - [#57 — Soil Fertility Decay — đất bạc màu giảm 20% năng suất, ép mua phân phục hồi](#issue-57) ⭐ **AUDIT FIX**
  - [#60 — Revenge & Viral Mechanic — Trộm ẩn danh, Kính Lúp soi kẻ trộm, Master Key bypass Guard Dog](#issue-60) ⭐ **AUDIT FIX**
  - [#12 — PancakeSwap V2 DEX swap UI — BNB/FARM/USDT routing](#issue-12)
  - [#13 — Daily quest system — quest generation, tracking, and reward claim](#issue-13)
  - [#14 — Notification system — in-app inbox and push via Telegram Bot API](#issue-14)
  - [#29 — Viral referral system — invite link tracking and reward distribution](#issue-29)
  - [#30 — Leaderboard system — weekly and all-time rankings by gold and trust score](#issue-30)
  - [#36 — Weed and bug infestation mechanics — spread risk and penalty system](#issue-36)
  - [#37 — Daily reward streak system — login bonuses and milestone rewards](#issue-37)
  - [#38 — Explore / Raid Map — discover raidable farms with live crop data](#issue-38)
  - [#42 — Harvest All and Plant All batch action buttons](#issue-42)
  - [#48 — Attack mechanic — targeted farm sabotage with scarecrow defense item](#issue-48)
  - [#55 — Fertilizer (crop boost) UI — select and apply to growing crops](#issue-55)
  - [#34 — Achievement system — unlock badges and bonus rewards for milestones](#issue-34)
  - [#46 — Settings modal — sound, notifications, wallet info, account management](#issue-46)
- [Sprint 3 — Smart Contracts & Blockchain Layer (Days 15–21)](#sprint-3)
  - [#15 — [SC] BanditMarket.sol — P2P NFT Marketplace with EIP-712 order book](#issue-15)
  - [#16 — [SC] BanditDogFusion.sol — Guard Dog Gacha with Commit-Reveal Oracle RNG](#issue-16)
  - [#17 — [SC] TreasuryBuyBack.sol — auto buy-back and burn mechanism](#issue-17)
  - [#18 — Blockchain event indexer — startMarketplaceListener with fallback cronjob](#issue-18)
  - [#19 — Guard Dog Gacha UI — pull animation, tier reveal, pity tracker](#issue-19)
  - [#22 — Dedicated RPC provider setup with Ethers.js v6 fallback chain](#issue-22)
  - [#52 — FarmToken.sol — ERC-20 with mint, burn, and claim gating](#issue-52)
  - [#53 — Hardhat project setup — compile, test, deploy scripts for all contracts](#issue-53)
  - [#58 — Premium Subscriptions — Quản gia tự động (Auto-harvest) và Bảo hiểm Nông sản (DeFi Insurance)](#issue-58) ⭐ **AUDIT FIX**
  - [#59 — Guild Tier & Taxation — Bang Tinh Anh (Stake $FARM + Cờ Xanh) và thu thuế harvest member](#issue-59) ⭐ **AUDIT FIX**
  - [#20 — Marketplace UI — listing browser, buy flow, and my listings management](#issue-20)
  - [#21 — Guild system — create/join guilds, World Tree, and contribution tracking](#issue-21)
- [Sprint 4 — QA, Polish & MVP Launch (Days 22–30)](#sprint-4)
  - [#23 — Smart contract security audit — BanditMarket, BanditDogFusion, TreasuryBuyBack](#issue-23)
  - [#24 — BSC Mainnet deployment — FarmToken, BanditMarket, BanditDogFusion, TreasuryBuyBack](#issue-24)
  - [#25 — End-to-end integration test suite — full game flow on BSC Testnet](#issue-25)
  - [#26 — Performance optimization — Phaser bundle, React lazy loading, API response times](#issue-26)
  - [#49 — Nginx + SSL production deployment — frontend CDN, backend reverse proxy](#issue-49)
  - [#27 — NFT Guard Dog feeding subscription system](#issue-27)
  - [#39 — Telegram Mini App polish — safe area, viewport, haptic feedback, back button](#issue-39)
  - [#28 — Seasonal events system — Halloween, Christmas, Lunar New Year crops](#issue-28)
  - [#51 — World Tree GvG — weekly guild war event with resource capture](#issue-51)
  - [#54 — Admin dashboard — farm stats, user management, economy monitoring](#issue-54)

---

<a name="sprint-1"></a>
# Sprint 1 — Foundation & Core Infrastructure (Days 1–7)

**Due:** 2026-09-17  
**Goal:** Dựng toàn bộ nền tảng kỹ thuật: NestJS, PostgreSQL schema, Phaser 3 canvas, Telegram Mini App auth, Redis caching, CI/CD.  
**Issues:** 14 total — 9 High / 4 Medium / 1 Low  

| # | Title | Area | Priority | Epic | Note |
|:-:|-------|------|:--------:|:----:|:----:|
| #1 | Set up NestJS monorepo with TypeScript, Docker, and CI/CD pipeline | `backend, infra` | 🔴 High | - |  |
| #2 | PostgreSQL schema migrations (TypeORM) — all core tables | `backend` | 🔴 High | - |  |
| #3 | Telegram initData JWT authentication middleware | `backend` | 🔴 High | - |  |
| #4 | Phaser 3 MainFarmScene — plot grid, crop sprites, and animation system | `frontend` | 🔴 High | - |  |
| #5 | React HUD, BottomBar, and EventBus integration layer | `frontend` | 🔴 High | - |  |
| #6 | Redis caching layer and rate limiting (Throttler) | `backend, infra` | 🔴 High | - |  |
| #32 | Energy regen system — 6-min tick, max cap, and regen timer UI | `backend, frontend` | 🔴 High | - |  |
| #33 | Plot upgrade system — unlock additional plots and upgrade yield multiplier | `backend, frontend` | 🔴 High | - |  |
| #40 | Wallet setup flow — auto-generate wallet or connect existing via WalletConnect | `backend, frontend` | 🔴 High | - |  |
| #35 | Weather system — daily conditions affecting crop yields | `backend, frontend` | 🟡 Medium | Core-game |  |
| #44 | Friends bar — online friends panel with quick visit and steal status | `backend, frontend` | 🟡 Medium | - |  |
| #45 | Tutorial overlay — first-time user guide with interactive steps | `frontend` | 🟡 Medium | - |  |
| #47 | Level and XP system — trust score → level gating for seeds and features | `backend, frontend` | 🟡 Medium | - |  |
| #43 | Sound system — SoundManager with Web Audio API unlock for iOS/Telegram | `frontend` | 🟢 Low | - |  |

---

<a name="issue-1"></a>
## Issue #1: Set up NestJS monorepo with TypeScript, Docker, and CI/CD pipeline

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | `backend, infra` |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [#1](https://github.com/dongprotocol/bandit-buddy/issues/1) |

## Overview
Bootstrap the production-ready NestJS backend with all required tooling.

## Acceptance Criteria
- [ ] NestJS project scaffolded with TypeScript strict mode
- [ ] Docker Compose: postgres:16, redis:7, backend service
- [ ] `.env.example` covers all required vars (DB, Redis, JWT, SIGNER_PRIVATE_KEY, RPC_URL)
- [ ] GitHub Actions CI: lint + build on every PR
- [ ] Health check endpoint `GET /health` returns `{status: 'ok'}`
- [ ] `.gitignore` excludes `.env`, `secret.md`, private keys

---

<a name="issue-2"></a>
## Issue #2: PostgreSQL schema migrations (TypeORM) — all core tables

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | `backend` |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [#2](https://github.com/dongprotocol/bandit-buddy/issues/2) |

## Overview
Create TypeORM migrations for the complete database schema.

## Tables Required
- `users` (telegram_id, wallet_address, gold_balance, energy, trust_score, nonce, guard_dog fields)
- `seed_configs` (static seed data seeded on migration)
- `farm_plots` (user_id FK, plot_index, seed_id, planted_at, harvestable_at, water/weed/bug states)
- `steal_logs` (thief_id, victim_id, plot_id, amount, success)
- `nft_guard_dogs` (owner_id, token_id, dog_type, defense_power, is_active)
- `notifications` (user_id, title, body, is_read)
- `quests` & `user_quests` (daily quest system)
- `achievements` & `user_achievements`

## Acceptance Criteria
- [ ] All migrations run via `npm run migration:run` without error
- [ ] Seed migration populates 5 base seed types (Wheat, Carrot, Corn, Tomato, Pumpkin)
- [ ] Indexes on: `farm_plots(user_id)`, `steal_logs(victim_id, created_at)`, `users(telegram_id)`
- [ ] Rollback migration tested (`migration:revert`)

---

<a name="issue-3"></a>
## Issue #3: Telegram initData JWT authentication middleware

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | `backend` |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [#3](https://github.com/dongprotocol/bandit-buddy/issues/3) |

## Overview
Implement server-authoritative auth via Telegram WebApp initData validation.

## Implementation Details
- HMAC-SHA256 validation of Telegram `initData` string using `BOT_TOKEN`
- On success: upsert user in DB, issue JWT (30-day expiry)
- NestJS Guard applied globally; whitelist `/health` and webhook routes
- Rate limit auth endpoint: max 10 req/min per IP

## Acceptance Criteria
- [ ] `POST /auth/telegram` accepts `{ initData: string }`, returns `{ token, user }`
- [ ] Invalid initData returns 401 with error code `INVALID_INIT_DATA`
- [ ] Tampered initData (hash mismatch) returns 401
- [ ] JWT guard rejects expired tokens with 401
- [ ] New users auto-created with 3 starter plots and 100 gold
- [ ] Unit tests cover valid/invalid/expired cases

---

<a name="issue-4"></a>
## Issue #4: Phaser 3 MainFarmScene — plot grid, crop sprites, and animation system

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | `frontend` |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [#4](https://github.com/dongprotocol/bandit-buddy/issues/4) |

## Overview
Core Phaser 3 scene rendering the interactive farm grid.

## Requirements
- Isometric or top-down grid layout supporting 3–12 plot slots
- Crop sprites per growth stage (seed → sprout → mature → harvestable)
- Plot state rendering: empty, planted, watered, dry, weedy, buggy, harvestable
- Smooth growth-stage transitions (no pop-in)
- `uiBlocked` flag prevents all plot interactions when React modal is open
- `plot-clicked` event emitted with `{ plotId, plotIndex, action }`

## Acceptance Criteria
- [ ] Grid renders correctly on 375px–430px viewport (iPhone SE to Pro Max)
- [ ] Tapping a plot emits correct event with correct action ('plant'/'harvest'/'upgrade')
- [ ] Crop sprites cycle through growth stages based on server time
- [ ] `ui-overlay: true` event blocks all Phaser pointer events
- [ ] 200ms debounce on `ui-overlay: false` prevents touch bleedthrough
- [ ] FPS ≥ 55 on mid-tier Android (Snapdragon 665)

---

<a name="issue-5"></a>
## Issue #5: React HUD, BottomBar, and EventBus integration layer

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | `frontend` |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [#5](https://github.com/dongprotocol/bandit-buddy/issues/5) |

## Overview
Complete HUD system bridging React UI with Phaser 3 via EventBus.

## Components
- `HUD.tsx`: energy bar, gold balance, XP/level, notifications bell, settings
- `BottomBar.tsx`: tool dock (cursor/dig/seed/water/spray/weed-kill/steal), nav bar (Daily/Shop/Ranks/Claim/Quests/Explore)
- `FriendsBar.tsx`: online friends with visit-farm functionality
- `EventBus.ts`: typed event map (plot-clicked, farm-updated, ui-overlay, play-sound, etc.)

## Acceptance Criteria
- [ ] All tool buttons emit `tool-changed` event to Phaser scene
- [ ] Energy bar animates on change, shows regen timer popup on tap
- [ ] Gold balance shows abbreviated (1.2k, 3.5k) for values ≥ 1000
- [ ] Bell badge shows unread notification count (max display: 9+)
- [ ] All modals opened from BottomBar set `ui-overlay: true`
- [ ] `show-claim` event from HUD Claim badge opens ClaimModal in BottomBar

---

<a name="issue-6"></a>
## Issue #6: Redis caching layer and rate limiting (Throttler)

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | `backend, infra` |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [#6](https://github.com/dongprotocol/bandit-buddy/issues/6) |

## Overview
Implement Redis-backed caching and per-user rate limiting for all action endpoints.

## Rate Limits
- `POST /action/steal`: max 3 req/sec per user (hard limit, 429 on exceed)
- `POST /action/harvest`: max 10 req/min per user
- `POST /action/plant`: max 20 req/min per user
- Auth endpoint: max 10 req/min per IP

## Caching Strategy
- `GET /farm/:userId` cached 30s in Redis (invalidated on any plot mutation)
- `GET /user/profile` cached 10s (invalidated on gold/energy change)
- `GET /seeds` (seed catalog) cached 1hr (static data)

## Acceptance Criteria
- [ ] `@nestjs/throttler` configured with Redis store
- [ ] Exceeded rate limit returns 429 with `Retry-After` header
- [ ] Cache invalidation tested: plant/harvest/steal clear farm cache
- [ ] Redis connection failure falls back gracefully (no crash)

---

<a name="issue-32"></a>
## Issue #32: Energy regen system — 6-min tick, max cap, and regen timer UI

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | `backend, frontend` |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [#32](https://github.com/dongprotocol/bandit-buddy/issues/32) |

## Overview
Server-side energy regeneration: +1 energy every 6 minutes up to max (100 base + level bonus).

## Backend
- Energy stored as integer in `users.energy`
- `users.last_energy_update` tracks last regen calculation timestamp
- On every profile fetch: calculate elapsed time, add earned energy ticks, clamp to max
- No cronjob needed — lazy calculation on read

## Formula
```typescript
const elapsedMs = Date.now() - new Date(lastEnergyUpdate).getTime();
const ticksEarned = Math.floor(elapsedMs / (6 * 60 * 1000));
const newEnergy = Math.min(maxEnergy, currentEnergy + ticksEarned);
```

## Frontend
- `useEnergyRegen` hook: live countdown to next +1 tick (client-side interpolation)
- EnergyPopup: shows current/max, color-coded bar, next tick timer, full recharge timer
- Toast when energy hits max (already implemented — preserve)

## Acceptance Criteria
- [ ] Regen calculation is idempotent (calling profile 100x doesn't grant 100x energy)
- [ ] Energy capped at maxEnergy (never exceeds)
- [ ] `last_energy_update` set to now after each regen calculation
- [ ] Client-side timer matches server-side remaining ticks (< 5s drift)

---

<a name="issue-33"></a>
## Issue #33: Plot upgrade system — unlock additional plots and upgrade yield multiplier

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | `backend, frontend` |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [#33](https://github.com/dongprotocol/bandit-buddy/issues/33) |

## Overview
Progression mechanic allowing players to expand their farm and improve plot efficiency.

## Plot Slots
- Starter: 3 plots (free)
- Slot 4-6: unlock for 500/1000/2000 GOLD each
- Slot 7-9: unlock for 5000/8000/12000 GOLD each
- Max plots: 9 per farm

## Plot Upgrades (per plot)
- Level 1 (base): 1x yield
- Level 2: 1.25x yield — costs 200 GOLD
- Level 3: 1.5x yield — costs 500 GOLD
- Level 4: 2x yield — costs 1000 GOLD

## Backend
- `buy-plot` event → `POST /farm/buy-plot` — creates new farm_plots row
- `POST /farm/upgrade-plot { plotId }` — upgrade plot level, deduct gold
- `farm_plots.level` column added in migration

## UI
- Empty plot slot shows "+" button with cost
- Existing plot shows upgrade option in PlotUpgradeModal
- Gold cost and yield multiplier clearly displayed

## Acceptance Criteria
- [ ] Max 9 plots enforced server-side
- [ ] Upgrade multiplier applied during harvest calculation
- [ ] Buying/upgrading while farm cache is stale returns consistent state
- [ ] BuyPlotModal and PlotUpgradeModal both wired to correct events

---

<a name="issue-40"></a>
## Issue #40: Wallet setup flow — auto-generate wallet or connect existing via WalletConnect

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | `backend, frontend` |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [#40](https://github.com/dongprotocol/bandit-buddy/issues/40) |

## Overview
Onboarding flow for connecting a BSC wallet, required before claiming $FARM or trading.

## Auto-Wallet Path (recommended for new users)
1. User taps "Setup Wallet" (shown if wallet_address is null)
2. Backend generates keypair: `ethers.Wallet.createRandom()`
3. Private key shown ONCE, user prompted to save it
4. `users.wallet_address` set to derived address
5. WalletSetupModal dismissed

## Connect Existing Wallet Path
- WalletConnect v2 modal (optional, for advanced users)
- User signs a challenge message to prove ownership
- `wallet_address` updated in DB

## Security Rules
- Private key NEVER stored server-side (show once, forget)
- `secret.md` and `.env` already in `.gitignore` (do not change)
- Challenge message includes nonce to prevent replay

## Acceptance Criteria
- [ ] Auto-wallet: private key shown in monospace, copy button, warning to save
- [ ] Wallet address persisted to DB after setup
- [ ] Claim/Trade endpoints return 400 `WALLET_NOT_SETUP` if address is null
- [ ] WalletSetupModal auto-shown after first harvest if wallet not set up

---

<a name="issue-35"></a>
## Issue #35: Weather system — daily conditions affecting crop yields

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | `backend, frontend` |
| **Priority** | 🟡 Medium |
| **Epic** | Core-game |
| **GitHub** | [#35](https://github.com/dongprotocol/bandit-buddy/issues/35) |

## Overview
Daily weather system that modifies crop yield and growth rates, adding strategic depth.

## Weather Types
| Type | Yield Effect | Growth Effect | Duration |
|------|-------------|---------------|----------|
| Sunny ☀️ | +0% | +0% | 24h |
| Rainy 🌧️ | +25% yield | -10% time | 24h |
| Drought 🌵 | -20% yield | +20% time | 24h |
| Stormy ⛈️ | -30% yield | -0% | 12h |
| Golden Hour 🌟 | +50% yield | -0% | 6h |

## Backend
- Weather determined server-side (seeded daily, same for all players)
- `GET /weather` returns current + next 3 weather periods
- Harvest endpoint applies active weather modifier to yield calculation

## Frontend (WeatherBanner — partially done)
- Compact emoji in HUD top bar
- Tap to expand: show effect description, time remaining, upcoming weather
- stopPropagation on backdrop click (already fixed — preserve)

## Acceptance Criteria
- [ ] Same weather for all players at same time (no per-user RNG)
- [ ] Weather modifier applied server-side during harvest (never client)
- [ ] WeatherBanner popup does NOT trigger Phaser plot click (stopPropagation fixed)
- [ ] Upcoming weather preview helps players plan planting timing

---

<a name="issue-44"></a>
## Issue #44: Friends bar — online friends panel with quick visit and steal status

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | `backend, frontend` |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [#44](https://github.com/dongprotocol/bandit-buddy/issues/44) |

## Overview
Horizontal friend strip above the BottomBar showing online Telegram friends playing BanditBuddy.

## Data Source
- `GET /friends` — list of user's Telegram contacts who are also BanditBuddy players
- Telegram `initData` contains contact list (if permission granted)
- Show: avatar initial, username, online status (active in last 10 min), harvestable crop count

## UI
- Horizontal scroll strip (3-5 friends visible, swipe for more)
- Each friend avatar: tap → visit-farm event
- Online dot: green (active < 10 min), yellow (active < 1h), grey (inactive)
- Crop ready badge: show harvestable count on friend's avatar (steal opportunity hint)

## Interactions
- Tap friend avatar → `eventBus.emit('visit-farm', { userId, username })`
- Long-press → friend options: Visit | Challenge (future)

## Acceptance Criteria
- [ ] Friend list updates on FriendsBar mount (React Query, staleTime: 60s)
- [ ] Visiting friend switches Phaser canvas to display their farm
- [ ] Return banner: "Raiding @username" with back button (already in App.tsx)
- [ ] Empty state: "Invite friends to see them here" with invite button

---

<a name="issue-45"></a>
## Issue #45: Tutorial overlay — first-time user guide with interactive steps

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | `frontend` |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [#45](https://github.com/dongprotocol/bandit-buddy/issues/45) |

## Overview
Guided tutorial for new players covering the core game loop in 5 interactive steps.

## Tutorial Steps
1. **Welcome**: game introduction, meet the raccoon mascot
2. **Plant**: highlight empty plot, prompt to select a seed and plant
3. **Wait / Speed-up**: explain grow timer, show skip option (or just explain patience)
4. **Harvest**: highlight ready crop, prompt to harvest
5. **Invite Friends**: explain steal mechanic, show invite link

## Implementation Notes
- `TUTORIAL_KEY = 'bb_tutorial_done'` in localStorage
- Only shown to new users on first Enter Farm (not returning users)
- Each step: spotlight overlay (dim background, highlight target element)
- Skip button always visible
- `TutorialOverlay` component (already wired in App.tsx)

## Acceptance Criteria
- [ ] Tutorial only shows once (localStorage key set on completion)
- [ ] Skip works from any step
- [ ] Tutorial blocks Phaser input during display (ui-overlay: true)
- [ ] Spotlight position adapts to actual DOM element position (not hardcoded px)
- [ ] Step 2 (plant) waits for actual plant action before advancing

---

<a name="issue-47"></a>
## Issue #47: Level and XP system — trust score → level gating for seeds and features

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | `backend, frontend` |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [#47](https://github.com/dongprotocol/bandit-buddy/issues/47) |

## Overview
Player progression system based on trust score, unlocking higher-tier seeds and features at each level.

## Level Gates
| Level | trust_score | Unlocks |
|-------|------------|---------|
| 1 | 0-9 | Wheat, Carrot |
| 2 | 10-19 | Corn, 4th plot slot available |
| 3 | 20-29 | Tomato |
| 4 | 30-39 | Pumpkin, Claim $FARM unlocked |
| 5 | 40-49 | Grape |
| 6 | 50-59 | Watermelon, Sunflower |
| 7 | 60-69 | T3 Guard Dog gacha |
| 8 | 70-79 | Guild creation |
| 9 | 80-89 | T4/T5 Guard Dogs |
| 10 | 90+ | All features |

## trust_score Gains
- Harvest: +1 per crop
- Successful steal: +2
- Daily login: +1
- Friend referral joined: +5
- Telegram Premium: +10 (one-time)

## Events
- Level-up: `eventBus.emit('level-up', { newLevel })` → toast + sound
- `GET /user/profile` includes level (derived: `floor(trust_score / 10)`) + xpPct

## Acceptance Criteria
- [ ] Planting gated seed returns 403 with `LEVEL_REQUIRED: X` error
- [ ] Level-up toast fires exactly once when trust_score crosses threshold
- [ ] XP bar in HUD reflects `(trust_score % 10) * 10` percentage
- [ ] Level badge on avatar updates immediately after level-up event

---

<a name="issue-43"></a>
## Issue #43: Sound system — SoundManager with Web Audio API unlock for iOS/Telegram

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 1: Foundation & Core Infrastructure |
| **Area** | `frontend` |
| **Priority** | 🟢 Low |
| **Epic** | - |
| **GitHub** | [#43](https://github.com/dongprotocol/bandit-buddy/issues/43) |

## Overview
Game audio system that works within Telegram WebView's restricted audio context.

## Sounds Required
| ID | Event | File |
|----|-------|------|
| plant | Crop planted | short pop |
| harvest | Crop harvested | coin chime |
| steal_win | Steal successful | sneak + coin |
| steal_fail | Dog bite | bark + ouch |
| click | Generic UI click | click |
| water | Water applied | splash |
| weed_kill | Weed/bug removed | swoosh |
| upgrade | Plot upgraded | level-up ding |
| level_up | Player leveled up | fanfare |
| quest | Quest completed | chime |
| daily | Daily reward claimed | jingle |
| error | Error state | buzz |
| attack | Attack action | whoosh |
| coin | Gold earned | clink |

## iOS/Telegram Unlock
```typescript
// soundManager.unlock() called on first touchstart/click (already in App.tsx)
audioContext.resume()  // Required by iOS WebAudio policy
```

## Acceptance Criteria
- [ ] All sounds play on iOS Telegram WebView after first user gesture
- [ ] Volume control in Settings modal (0-100%, saved to localStorage)
- [ ] Mute toggle persists across sessions
- [ ] No audio context error spam in console
- [ ] Total audio bundle < 500KB (use .ogg + .mp3 fallback)

---

<a name="sprint-2"></a>
# Sprint 2 — Core Game APIs & Economy Layer (Days 8–14)

**Due:** 2026-09-24  
**Goal:** Game action APIs, farm maintenance, soil fertility, revenge viral mechanic, dual-token economy, marketplace backend.  
**Issues:** 24 total — 11 High / 11 Medium / 2 Low  

| # | Title | Area | Priority | Epic | Note |
|:-:|-------|------|:--------:|:----:|:----:|
| #7 | Farm CRUD API — plant, harvest, dig, water, bug-spray, weed-kill | `backend` | 🔴 High | - |  |
| #8 | STEAL endpoint — PostgreSQL transaction, guard dog defense, RNG outcome | `backend` | 🔴 High | - |  |
| #9 | ECDSA claim signature — GOLD to \$FARM on-chain redemption | `backend, smart-contract` | 🔴 High | Economy |  |
| #10 | GOLD↔\$FARM dynamic exchange rate engine | `backend` | 🔴 High | Economy |  |
| #11 | P2P Marketplace backend — listing creation, EIP-712 off-chain orders | `backend` | 🔴 High | Marketplace |  |
| #31 | Shop modal — seed shop, fertilizer, items, and consumables | `backend, frontend` | 🔴 High | - |  |
| #41 | Anti-cheat and bot detection — trust score system and fraud signals | `backend` | 🔴 High | Security |  |
| #50 | Claim \$FARM modal — wallet validation, amount input, signature display | `frontend` | 🔴 High | Economy |  |
| #56 | Farm Maintenance System — hàng rào/nhà kho mục nát và penalty tăng tỷ lệ trộm | `backend, frontend` | 🔴 High | Core-game | ⭐ Audit Fix |
| #57 | Soil Fertility Decay — đất bạc màu giảm 20% năng suất, ép mua phân phục hồi | `backend, frontend` | 🔴 High | Core-game | ⭐ Audit Fix |
| #60 | Revenge & Viral Mechanic — Trộm ẩn danh, Kính Lúp soi kẻ trộm, Master Key bypass Guard Dog | `backend, frontend` | 🔴 High | Core-game | ⭐ Audit Fix |
| #12 | PancakeSwap V2 DEX swap UI — BNB/FARM/USDT routing | `frontend, smart-contract` | 🟡 Medium | Marketplace |  |
| #13 | Daily quest system — quest generation, tracking, and reward claim | `backend, frontend` | 🟡 Medium | - |  |
| #14 | Notification system — in-app inbox and push via Telegram Bot API | `backend, frontend` | 🟡 Medium | - |  |
| #29 | Viral referral system — invite link tracking and reward distribution | `backend, frontend` | 🟡 Medium | - |  |
| #30 | Leaderboard system — weekly and all-time rankings by gold and trust score | `backend, frontend` | 🟡 Medium | - |  |
| #36 | Weed and bug infestation mechanics — spread risk and penalty system | `backend, frontend` | 🟡 Medium | Core-game |  |
| #37 | Daily reward streak system — login bonuses and milestone rewards | `backend, frontend` | 🟡 Medium | - |  |
| #38 | Explore / Raid Map — discover raidable farms with live crop data | `backend, frontend` | 🟡 Medium | - |  |
| #42 | Harvest All and Plant All batch action buttons | `backend, frontend` | 🟡 Medium | - |  |
| #48 | Attack mechanic — targeted farm sabotage with scarecrow defense item | `backend, frontend` | 🟡 Medium | Core-game |  |
| #55 | Fertilizer (crop boost) UI — select and apply to growing crops | `backend, frontend` | 🟡 Medium | - |  |
| #34 | Achievement system — unlock badges and bonus rewards for milestones | `backend, frontend` | 🟢 Low | - |  |
| #46 | Settings modal — sound, notifications, wallet info, account management | `backend, frontend` | 🟢 Low | - |  |

---

<a name="issue-7"></a>
## Issue #7: Farm CRUD API — plant, harvest, dig, water, bug-spray, weed-kill

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend` |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [#7](https://github.com/dongprotocol/bandit-buddy/issues/7) |

## Overview
All plot action endpoints with server-authoritative validation and PostgreSQL row-level locking.

## Endpoints
- `POST /action/plant { plotId, seedId }` — deduct gold, set planted_at + harvestable_at
- `POST /action/harvest { plotId }` — validate Date.now() >= harvestable_at, credit gold
- `POST /action/dig { plotId }` — remove crop, reset plot
- `POST /action/water { plotId }` — remove dry soil penalty flag, −5 energy
- `POST /action/bug-spray { plotId }` — consume fertilizer charge, remove bugs
- `POST /action/weed-kill { plotId }` — remove weeds, −5 energy

## Critical Rules
- All mutations use `SELECT ... FOR UPDATE` to prevent race conditions
- Harvest validates server-side timestamp (never trust client time)
- Energy check before every action; return 400 `INSUFFICIENT_ENERGY` if depleted
- Gold check before plant; return 400 `INSUFFICIENT_GOLD`

## Acceptance Criteria
- [ ] Concurrent harvest requests don't double-credit gold (race condition tested)
- [ ] Planting wrong seed tier for current level returns 403
- [ ] All endpoints return consistent `{ success, goldChange, message }` shape
- [ ] Farm cache invalidated on every mutation

---

<a name="issue-8"></a>
## Issue #8: STEAL endpoint — PostgreSQL transaction, guard dog defense, RNG outcome

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend` |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [#8](https://github.com/dongprotocol/bandit-buddy/issues/8) |

## Overview
The most critical game endpoint. Full transactional integrity with row-level locking.

## Logic (implement exactly)
```
POST /action/steal { targetUserId, plotId }
1. Check thief energy >= 10
2. BEGIN TRANSACTION
3. SELECT farm_plots WHERE id=plotId FOR UPDATE
4. Validate: plot is ripe (now >= harvestable_at)
5. Validate: total_stolen < base_yield * 0.20 (20% cap)
6. Get victim guard dog defense_power (SUM active dogs)
7. success_rate = max(0, 80 - defense_power)
8. Math.random() * 100 <= success_rate ?
   SUCCESS: steal 5% of base_yield, update balances, log
   FAILURE: 5% gold penalty to thief, transfer to victim
9. COMMIT
```

## Acceptance Criteria
- [ ] Concurrent steals on same plot are serialized (FOR UPDATE lock tested)
- [ ] 20% steal cap enforced per plot per harvest cycle
- [ ] Guard dog T5 (defense_power=80) makes success_rate=0%
- [ ] Daily steal limit (5/day) enforced via steal_logs count
- [ ] Energy −10 on success, −20 on failure (dog bite)
- [ ] steal_logs entry created for both success and failure
- [ ] Return `{ success, goldChange, message, newEnergy }`

---

<a name="issue-9"></a>
## Issue #9: ECDSA claim signature — GOLD to $FARM on-chain redemption

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend, smart-contract` |
| **Priority** | 🔴 High |
| **Epic** | Economy |
| **GitHub** | [#9](https://github.com/dongprotocol/bandit-buddy/issues/9) |

## Overview
Generate a cryptographic claim signature so users can redeem off-chain GOLD for on-chain $FARM tokens.

## Flow
1. Check trust_score >= 30 (anti-bot gate)
2. Check gold_balance >= amountToClaim
3. SELECT users FOR UPDATE (prevent double-claim race)
4. Deduct gold_balance, increment nonce
5. Generate: `ethers.solidityPackedKeccak256(["address","uint256","uint256"], [walletAddress, amountWei, nonce])`
6. Sign: `adminWallet.signMessage(ethers.getBytes(messageHash))`
7. COMMIT
8. Return `{ userAddress, amountWei, nonce, signature }`

## Smart Contract Interface
- `FarmToken.sol` `claim(address user, uint256 amount, uint256 nonce, bytes sig)` validates this signature
- Nonce is monotonic — signature replay impossible

## Acceptance Criteria
- [ ] trust_score < 30 returns 403 `INSUFFICIENT_TRUST`
- [ ] Signature verified by ethers.js in unit test
- [ ] Double-claim attempt with same nonce rejected on-chain
- [ ] SIGNER_PRIVATE_KEY never logged or exposed in error messages
- [ ] Minimum claim amount: 100 GOLD (configurable via env)

---

<a name="issue-10"></a>
## Issue #10: GOLD↔$FARM dynamic exchange rate engine

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend` |
| **Priority** | 🔴 High |
| **Epic** | Economy |
| **GitHub** | [#10](https://github.com/dongprotocol/bandit-buddy/issues/10) |

## Overview
Implement the dual-token economy engine with dynamic conversion rate based on circulating supply.

## Formula
```
conversionRate = totalFarmInTreasury / totalGoldCirculating
// Clamp: min 0.001, max 10 FARM per GOLD
```

## Endpoints
- `GET /economy/rate` — current conversion rate + 24h change
- `POST /economy/deposit { goldAmount }` — convert GOLD to locked $FARM (pending on-chain)
- `POST /economy/withdraw { farmAmount }` — burn $FARM, credit GOLD off-chain

## Storage
- `treasury_snapshots` table: rate, totalGold, totalFarm, timestamp (hourly snapshots)
- Redis cache for current rate (TTL 60s)

## Acceptance Criteria
- [ ] Rate updates when treasury balance changes (via on-chain event or admin API)
- [ ] Deposit/withdraw transactions atomic (no partial state)
- [ ] Rate history chart data available via `GET /economy/rate/history?period=7d`
- [ ] Display rate in UI: 1 GOLD = X $FARM with trend arrow

---

<a name="issue-11"></a>
## Issue #11: P2P Marketplace backend — listing creation, EIP-712 off-chain orders

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend` |
| **Priority** | 🔴 High |
| **Epic** | Marketplace |
| **GitHub** | [#11](https://github.com/dongprotocol/bandit-buddy/issues/11) |

## Overview
Backend for the P2P NFT Marketplace using EIP-712 typed structured data for off-chain order signatures.

## Order Structure (EIP-712)
```solidity
Order {
  address seller;
  uint256 tokenId;
  uint256 amount;      // ERC-1155 quantity
  uint256 price;       // in $FARM wei
  uint256 expiry;      // unix timestamp
  uint256 nonce;
}
```

## Endpoints
- `POST /marketplace/list { tokenId, amount, price, expiry }` — store signed order
- `GET /marketplace/listings` — paginated open listings (filter by type, price range)
- `DELETE /marketplace/listings/:id` — cancel listing (invalidate order)
- `GET /marketplace/my-listings` — user's active listings

## Database
- `marketplace_listings` table: seller_id, token_id, amount, price_farm, expiry, signature, status (open/filled/cancelled)

## Acceptance Criteria
- [ ] Order signature stored and verifiable via `ethers.verifyTypedData()`
- [ ] Expired listings auto-excluded from results (server-side filter + cronjob cleanup)
- [ ] Pagination: cursor-based, max 50 per page
- [ ] Price indexed for sort efficiency

---

<a name="issue-31"></a>
## Issue #31: Shop modal — seed shop, fertilizer, items, and consumables

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend, frontend` |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [#31](https://github.com/dongprotocol/bandit-buddy/issues/31) |

## Overview
In-game shop for purchasing seeds, fertilizer charges, and consumable items.

## Shop Categories
### Seeds
- All seed types with cost, grow time, yield, required level
- Seasonal seeds shown during event window only

### Fertilizer
- Normal Fert (🌿): +15% yield, costs 50 GOLD, stacks up to 10 charges
- Super Fert (🚀): +35% yield, costs 150 GOLD, stacks up to 5 charges
- Advanced Fert (💎): +60% yield, costs 300 GOLD, stacks up to 3 charges

### Items
- Lucky Bone: +10% gacha rate for next pull, 200 GOLD
- Protection Collar: dog immune to steal for 24h, 300 GOLD
- Water Can x5: auto-water 5 plots, 100 GOLD

## Endpoints
- `POST /shop/buy { itemType, itemId, quantity }`
- `GET /shop/inventory` — user's consumable stocks

## Acceptance Criteria
- [ ] Insufficient gold shows error (not just UI disable)
- [ ] Fertilizer charge count shown on spray tool badge (BottomBar)
- [ ] Items purchased appear in inventory immediately (cache invalidation)
- [ ] Level-gated seeds show lock icon with required level

---

<a name="issue-41"></a>
## Issue #41: Anti-cheat and bot detection — trust score system and fraud signals

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend` |
| **Priority** | 🔴 High |
| **Epic** | Security |
| **GitHub** | [#41](https://github.com/dongprotocol/bandit-buddy/issues/41) |

## Overview
Server-side protection against automated farming bots and coordinated gold farming.

## Trust Score System
- New users start at trust_score = 50
- Score increases: verify Telegram premium (+10), wallet linked (+5), play 7 consecutive days (+5/day)
- Score decreases: rapid sequential API calls pattern (-5), claim denied by on-chain fail (-10)
- Minimum trust_score for claim: 30 (enforced in claim endpoint)

## Bot Detection Signals
- Request interval: human tap interval is typically 300ms-3s; < 100ms = bot flag
- Energy consumption rate: energy depletion in < 1 min = impossible by hand
- IP velocity: > 3 unique Telegram IDs from same IP in 1 hour = investigate

## Rate Limiting Enforcement
- `POST /action/*`: max 10 req/5s per user (global action throttle)
- `POST /action/steal`: max 3 req/sec (already planned in issue #6, ensure consistency)
- Throttler uses Redis store, not in-memory (survives restart)

## Acceptance Criteria
- [ ] Trust score column exists and is updated by relevant events
- [ ] Claim endpoint checks trust_score >= 30
- [ ] Suspicious patterns logged to `fraud_signals` table (user_id, signal_type, timestamp)
- [ ] No false positives for normal human play patterns (manual test: 10 harvests in a row)

---

<a name="issue-50"></a>
## Issue #50: Claim $FARM modal — wallet validation, amount input, signature display

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `frontend` |
| **Priority** | 🔴 High |
| **Epic** | Economy |
| **GitHub** | [#50](https://github.com/dongprotocol/bandit-buddy/issues/50) |

## Overview
UI flow for claiming off-chain GOLD as on-chain $FARM tokens.

## Flow
1. User opens Claim modal (from HUD badge or BottomBar)
2. Shows current GOLD balance + estimated $FARM at current rate
3. Amount input: default = all available, min = 100 GOLD
4. Wallet address shown (must be set; if not, show setup prompt)
5. Confirm → calls `POST /web3/claim-signature`
6. Receives `{ userAddress, amountWei, nonce, signature }`
7. Calls `FarmToken.claim()` on-chain via wallet
8. Success: tx hash shown, balance updated

## UI States
- Loading: spinner while waiting for signature
- Pending: tx submitted, waiting for confirmation (with tx hash link to BscScan)
- Success: confetti animation, GOLD deducted, $FARM received
- Error: insufficient trust score, wallet not linked, network error

## Acceptance Criteria
- [ ] Minimum 100 GOLD enforced in UI and server
- [ ] trust_score < 30 shows 'Trust score too low' with explanation
- [ ] Wallet not set: redirects to WalletSetupModal first
- [ ] Transaction hash shown with BscScan link after submission
- [ ] GOLD balance in HUD updates immediately after successful claim

---

<a name="issue-56"></a>
## Issue #56: Farm Maintenance System — hàng rào/nhà kho mục nát và penalty tăng tỷ lệ trộm

> ⭐ **AUDIT FIX #1** — Được thêm sau Independent Audit (audit.md).

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend, frontend` |
| **Priority** | 🔴 High |
| **Epic** | Core-game |
| **GitHub** | [#56](https://github.com/dongprotocol/bandit-buddy/issues/56) |

## Overview
Cơ chế hao mòn vật lý trang trại tạo ra GOLD sink thụ động và buộc người chơi phải đăng nhập định kỳ để bảo trì.

## Mechanics (từ PRD 2)
- **Hàng rào (Fence)** và **Nhà kho (Barn)** có durability 100%
- Giảm 14.3% mỗi ngày (hỏng hoàn toàn sau 7 ngày không sửa)

## Penalty theo durability

| Durability | Steal Success Rate | Yield Penalty |
|------------|-------------------|---------------|
| 100–80% | +0% (bình thường) | 0% |
| 79–60% | +10% | −5% |
| 59–40% | +25% | −10% |
| 39–20% | +50% | −20% |
| 19–1% | +75% | −30% |
| 0% (hỏng) | **100% steal rate** | −50% |

## GOLD Sink
- Sửa chữa 1%: 5 GOLD (Fence) / 10 GOLD (Barn)
- Sửa đầy 100%: 500 GOLD (Fence) / 1,000 GOLD (Barn)

## Backend
- `users.fence_durability` INTEGER (0–100), `users.barn_durability` INTEGER (0–100)
- `users.last_maintenance_check` TIMESTAMP
- Lazy calculation trên mỗi lần read profile
- `POST /farm/repair { structure: 'fence'|'barn', amount }` — deduct GOLD, restore durability
- Steal endpoint: apply durability modifier khi tính `success_rate`
- Harvest endpoint: apply yield penalty từ `barn_durability`

## Acceptance Criteria
- [ ] Durability tính lazy — gọi profile 100x không trừ 100x
- [ ] Steal endpoint đọc `fence_durability` → điều chỉnh `success_rate` trước khi RNG
- [ ] Harvest endpoint đọc `barn_durability` → nhân yield multiplier
- [ ] 0% durability → steal success_rate = 100% (không phụ thuộc guard dog)
- [ ] Repair deduct GOLD atomically (SELECT FOR UPDATE)
- [ ] Push notification khi durability < 20%

---

<a name="issue-57"></a>
## Issue #57: Soil Fertility Decay — đất bạc màu giảm 20% năng suất, ép mua phân phục hồi

> ⭐ **AUDIT FIX #2** — Được thêm sau Independent Audit (audit.md).

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend, frontend` |
| **Priority** | 🔴 High |
| **Epic** | Core-game |
| **GitHub** | [#57](https://github.com/dongprotocol/bandit-buddy/issues/57) |

## Overview
Cơ chế đất bạc màu tạo GOLD/\$FARM sink thụ động — mỗi lần harvest giảm 20% fertility, buộc mua phân phục hồi.

## Mechanics

| Soil Fertility | Yield Modifier | Example: Corn (100G base) |
|---------------|----------------|--------------------------|
| 100% | 1.00x | 100G |
| 80% | 0.80x | 80G |
| 60% | 0.60x | 60G |
| 40% | 0.40x | 40G |
| 20% | 0.20x | 20G |
| 0% | 0.05x | 5G (minimum) |

## Recovery Items
| Item | Phục hồi | Giá |
|------|----------|-----|
| Compost Bag | +20% fertility | 30 GOLD |
| Bio Fertilizer | +40% fertility | 80 GOLD |
| Miracle Soil | +100% (full) | 200 GOLD / 2 \$FARM |

## Backend
- `farm_plots.soil_fertility` INTEGER DEFAULT 100
- Harvest: sau credit gold, trừ 20 từ soil_fertility (min 0)
- Yield: `finalYield = baseYield * (soil_fertility / 100)` (min 5%)
- `POST /action/restore-soil { plotId, itemId }`

## Acceptance Criteria
- [ ] Harvest giảm fertility đúng 20 (không giảm khi plot rỗng)
- [ ] Fertility không âm (clamp tại 0)
- [ ] Yield calculation: fertility modifier áp trước weather + fertilizer
- [ ] Miracle Soil restore về đúng 100 (không overflow)
- [ ] GET /farm/:userId trả về soil_fertility cho từng plot

---

<a name="issue-60"></a>
## Issue #60: Revenge & Viral Mechanic — Trộm ẩn danh, Kính Lúp soi kẻ trộm, Master Key bypass Guard Dog

> ⭐ **AUDIT FIX #5** — Được thêm sau Independent Audit (audit.md).

> ⚠️ **PENDING GITHUB** — Chưa tạo được trên GitHub do account bị suspended. Tạo thủ công khi khôi phục.

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend, frontend` |
| **Priority** | 🔴 High |
| **Epic** | Core-game |
| **GitHub** | #60 (pending) |

## Overview
Thay thế referral Web2 truyền thống bằng cơ chế viral "cay cú và trả thù": nạn nhân bị trộm ẩn danh MUỐN mời bạn bè để reveal kẻ trộm.

## Viral Loop
```
Bị trộm ẩn danh
  → Notification: "Kẻ trộm ẩn danh lấy X GOLD. Invite bạn để soi kẻ trộm!"
  → Invite 1 bạn → nhận Kính Lúp 🔍 → reveal username kẻ trộm
  → Kẻ trộm có chó T5? Invite thêm 2 bạn → nhận Master Key 🗝️
  → Dùng Master Key → bypass hoàn toàn guard dog → trả thù
  → Bạn mới cũng bị trộm → cycle lặp lại
```

## Items
| Item | Cách nhận | Tác dụng | Max stack |
|------|-----------|----------|-----------|
| Kính Lúp 🔍 | Invite 1 người mới | Reveal 1 theft log ẩn danh | 5 |
| Master Key 🗝️ | Invite 3 người mới (cumulative) | Bypass guard dog hoàn toàn (1 lần) | 2 |

## Backend Changes

### steal_logs
```sql
ALTER TABLE steal_logs ADD COLUMN is_anonymous BOOLEAN DEFAULT true;
ALTER TABLE steal_logs ADD COLUMN revealed_at TIMESTAMP;
```

### user_items table
```sql
CREATE TABLE user_items (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  item_type VARCHAR(50), -- 'magnifying_glass' | 'master_key'
  quantity INTEGER DEFAULT 1
);
```

### Steal notification (anonymous)
```
title: "Trang trại của bạn bị đột nhập!"
body: "Kẻ trộm ẩn danh đã lấy {X} GOLD. Mời bạn bè để lấy Kính Lúp soi kẻ trộm!"
// KHÔNG có thief username
```

### New endpoints
- `GET /revenge/status` — danh sách theft ẩn danh chưa reveal + số Kính Lúp
- `POST /revenge/reveal { stealLogId }` — dùng 1 Kính Lúp, reveal 1 theft
- `POST /action/steal { ..., useMasterKey: true }` — bypass guard dog

### Referral reward logic
```typescript
if (referralCount === 1) grantItem(referrerId, 'magnifying_glass');
if (referralCount === 3) grantItem(referrerId, 'master_key');
if (referralCount % 5 === 0) grantItem(referrerId, 'magnifying_glass'); // bonus
// Vẫn giữ +25 GOLD bonus cho cả 2
```

## Acceptance Criteria
- [ ] Steal notification KHÔNG hiện username kẻ trộm
- [ ] 1 invite (completed onboarding) → 1 Kính Lúp (atomic grant)
- [ ] 3 invites cumulative → 1 Master Key
- [ ] Reveal: dùng 1 Kính Lúp → reveal oldest unrevealed theft log
- [ ] Master Key: successRate = 100% bất kể guard dog tier
- [ ] Master Key consumed trong cùng transaction với steal
- [ ] Max 5 Kính Lúp và 2 Master Key tại một thời điểm (chống stack spam)
- [ ] ⚠️ **Note:** Issue này cần tạo thủ công trên GitHub khi account được khôi phục

---

<a name="issue-12"></a>
## Issue #12: PancakeSwap V2 DEX swap UI — BNB/FARM/USDT routing

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `frontend, smart-contract` |
| **Priority** | 🟡 Medium |
| **Epic** | Marketplace |
| **GitHub** | [#12](https://github.com/dongprotocol/bandit-buddy/issues/12) |

## Overview
In-app DEX swap widget powered by PancakeSwap V2 Router on BSC.

## Supported Pairs
- BNB → $FARM
- $FARM → BNB
- $FARM → USDT
- USDT → $FARM

## UI Components
- Token selector (BNB/FARM/USDT) with logos
- Amount input with live price preview (USD equivalent)
- Slippage tolerance setting (0.5%, 1%, 2%, custom)
- Price impact warning if >2%
- Swap confirmation modal with estimated output + gas fee
- Transaction status: pending → confirmed → failed

## Acceptance Criteria
- [ ] Quote fetched from PancakeSwap V2 Router `getAmountsOut()`
- [ ] Swap executes via Router `swapExactTokensForTokens()` / `swapExactETHForTokens()`
- [ ] Slippage applied to `amountOutMin` calculation
- [ ] Failed transactions show user-friendly error (insufficient balance, slippage exceeded)
- [ ] Works on BSC Testnet and Mainnet (switchable via env)

---

<a name="issue-13"></a>
## Issue #13: Daily quest system — quest generation, tracking, and reward claim

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend, frontend` |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [#13](https://github.com/dongprotocol/bandit-buddy/issues/13) |

## Overview
Daily quests reset at UTC midnight and provide GOLD + XP rewards for completing game actions.

## Quest Types
- Plant N crops today
- Harvest N crops
- Water N plots
- Steal from N neighbors
- Login 3 days in a row (streak quest)
- Spend N GOLD at shop

## Endpoints
- `GET /quests/daily` — today's quests with progress
- `POST /quests/claim/:questId` — claim completed quest reward

## Acceptance Criteria
- [ ] 5 quests generated per user per day (seeded from daily date + user_id for consistency)
- [ ] Quest progress auto-increments when related action API is called (side-effect hook)
- [ ] Claim endpoint validates quest is completed and not already claimed
- [ ] Streak bonus: day 7 = 2x rewards, day 30 = 5x rewards
- [ ] Quests expire at UTC midnight (not claimable after reset)

---

<a name="issue-14"></a>
## Issue #14: Notification system — in-app inbox and push via Telegram Bot API

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend, frontend` |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [#14](https://github.com/dongprotocol/bandit-buddy/issues/14) |

## Overview
Two-tier notification system: in-app inbox + Telegram push notifications for important events.

## Trigger Events
- Crop ready to harvest (push + inbox)
- You were raided — stole X GOLD (inbox)
- Guard dog repelled an attack (inbox)
- Friend joined via your referral (inbox + push)
- Daily quest completed (inbox)
- Level up (inbox + push)

## Endpoints
- `GET /notifications` — paginated inbox (unread count in header)
- `POST /notifications/read-all` — mark all read
- `DELETE /notifications/:id` — dismiss

## Acceptance Criteria
- [ ] Telegram Bot `sendMessage` fired for push events (async queue via Bull)
- [ ] Harvest-ready push fires exactly once per plot per cycle
- [ ] Unread count badge updates via React Query polling (30s interval)
- [ ] Notifications older than 30 days auto-deleted via cronjob

---

<a name="issue-29"></a>
## Issue #29: Viral referral system — invite link tracking and reward distribution

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend, frontend` |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [#29](https://github.com/dongprotocol/bandit-buddy/issues/29) |

## Overview
Referral system that rewards both referrer and new user to drive viral growth.

## Mechanics
- Each user gets unique invite link: `https://t.me/BanditBuddyBot?start=ref_{userId}`
- New user joins via link → both get +25 GOLD (one-time bonus)
- Tier 2 referral bonus: referrer gets 5% of referred user's harvest for 7 days
- Leaderboard: top 10 referrers shown in Friends modal

## Backend
- `referrals` table: referrer_id, referred_id, created_at, bonus_paid
- `start_param` parsed from Telegram initData on first auth
- Harvest endpoint: check if referred user has active T2 referral, credit 5% to referrer
- Daily referral stats: `GET /referrals/stats` (count, total earned)

## Frontend (already partially done)
- FriendsModal: Share button uses `WebApp.openTelegramLink` with `https://t.me/share/url`
- Welcome toast for new referred users: "🎉 Welcome bonus! +25G added to your farm"
- Referral stats in Friends modal: "You've invited N friends, earned X GOLD"

## Acceptance Criteria
- [ ] start_param parsed on auth; referral bonus credited once only
- [ ] T2 harvest bonus: 5% credited to referrer, not deducted from referred
- [ ] Referral prevents self-referral (same telegram_id)
- [ ] Share button works in Telegram iOS + Android (openTelegramLink verified)

---

<a name="issue-30"></a>
## Issue #30: Leaderboard system — weekly and all-time rankings by gold and trust score

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend, frontend` |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [#30](https://github.com/dongprotocol/bandit-buddy/issues/30) |

## Overview
Competitive leaderboard showing top farmers globally and among friends.

## Leaderboard Types
- **All-time**: top 100 by total gold earned (lifetime harvest)
- **Weekly**: top 100 by gold earned in current week (resets Monday UTC 00:00)
- **Friends**: ranked among connected Telegram friends

## Endpoints
- `GET /leaderboard?type=weekly|alltime&page=1` — paginated top 100
- `GET /leaderboard/me` — user's own rank + surrounding 5 players

## Database
- `leaderboard_snapshots` materialized every 15 min via cronjob
- Avoid real-time ranking queries on main users table (performance)

## Frontend
- Tabbed: Weekly | All-time | Friends
- My rank pinned to bottom if not in top 100
- Avatar, username, level badge, gold amount per row
- Top 3: gold/silver/bronze crown icon

## Acceptance Criteria
- [ ] Leaderboard snapshot cronjob runs every 15 min
- [ ] My rank calculation correct even outside top 100
- [ ] Weekly leaderboard resets Monday 00:00 UTC (verified with unit test)
- [ ] p99 latency < 100ms (Redis-cached snapshot)

---

<a name="issue-36"></a>
## Issue #36: Weed and bug infestation mechanics — spread risk and penalty system

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend, frontend` |
| **Priority** | 🟡 Medium |
| **Epic** | Core-game |
| **GitHub** | [#36](https://github.com/dongprotocol/bandit-buddy/issues/36) |

## Overview
Crops can develop weeds and bug infestations over time, reducing harvest yield if not treated.

## Mechanics
- Weed infestation: 10% chance per hour if not watered
- Bug infestation: 5% chance per hour, independent of water status
- Untreated weeds: -25% yield at harvest
- Untreated bugs: -40% yield at harvest (stacks with weed penalty)
- Treat: weed-kill tool (−5 energy), bug-spray tool (consumes fertilizer charge)

## Backend
- `farm_plots.has_weeds`, `farm_plots.has_bugs` boolean columns
- `farm_plots.has_dry_soil` boolean (set if not watered within 24h of planting)
- Infestation flags set lazily on plot read (not cronjob) based on elapsed time
- Harvest: apply penalty multipliers, then clear all flags

## Frontend
- Plot sprite overlay: weeds (green squiggles), bugs (red dots), dry soil (cracked earth)
- Badge counts on weed-kill and spray tool buttons (BottomBar)
- Tool hint bar: shows affected plot count when tool selected

## Acceptance Criteria
- [ ] Infestation calculated server-side based on planted_at + elapsed time
- [ ] Penalties stack: both weeds + bugs = -65% yield total (0.75 × 0.60)
- [ ] Plot state visible in farm JSON returned by `GET /farm/:userId`
- [ ] Badge count on tools updates when farm data refreshes

---

<a name="issue-37"></a>
## Issue #37: Daily reward streak system — login bonuses and milestone rewards

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend, frontend` |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [#37](https://github.com/dongprotocol/bandit-buddy/issues/37) |

## Overview
Daily login reward with compounding streak bonuses to drive retention.

## Reward Schedule
| Day | Base Reward | Streak Multiplier |
|-----|-------------|-------------------|
| 1 | 20 GOLD | 1x |
| 2 | 25 GOLD | 1.1x |
| 3 | 30 GOLD | 1.2x |
| 7 | 50 GOLD | 2x |
| 14 | 75 GOLD | 2.5x |
| 30 | 100 GOLD | 5x |
| 30+ | 100 GOLD | 5x (sustained) |

## Milestone Bonuses (on top)
- Day 7: Lucky Bone item
- Day 14: 50 $FARM airdrop
- Day 30: T2 Guard Dog NFT

## Backend
- `users.daily_streak`, `users.last_claimed_at`, `users.next_claim_at`
- `POST /daily/claim` — validate cooldown, credit reward, increment streak
- Streak resets if gap > 48h (grace period)

## Frontend (DailyRewardModal — partially implemented)
- Calendar view showing streak progress
- Current streak flame icon with number
- Next milestone preview

## Acceptance Criteria
- [ ] Claim blocked if next_claim_at is in future
- [ ] Streak resets after 48h gap (not 24h — grace period)
- [ ] Day 7/14/30 milestones deliver item/NFT as well as GOLD
- [ ] Clock skew: validate server-side, never trust client timestamp

---

<a name="issue-38"></a>
## Issue #38: Explore / Raid Map — discover raidable farms with live crop data

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend, frontend` |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [#38](https://github.com/dongprotocol/bandit-buddy/issues/38) |

## Overview
Explore tab showing a curated list of farms the player can visit and steal from.

## Functionality
- Shows 6-10 nearby farms with harvestable crops (stealable targets)
- Sorted by steal potential (most gold available first)
- Each entry: username, crop type, estimated steal amount, guard dog tier
- Tap: visit farm (EventBus 'visit-farm'), switch canvas to target farm

## Backend
```
GET /explore
- Exclude: current user's farm, farms already stolen today (from steal_logs)
- Include only: farms with ripe crops that have remaining steal capacity
- Return: userId, username, hasGuardDog, guardDogTier, crops[{type, estimatedSteal}]
- Limit: 10 results, randomized from pool of eligible targets
```

## Stealable Count Badge
- Red badge on Explore nav button showing count of valid targets
- Refreshes every 3 min (React Query refetchInterval)

## Acceptance Criteria
- [ ] Only returns farms with genuinely stealable crops (server validation)
- [ ] Guard dog tier shown as deterrent info (not hidden)
- [ ] Visit-farm transition: canvas loads target farm without page reload
- [ ] Daily steal limit (5) reflected: already-raided farms shown as 'raided today'

---

<a name="issue-42"></a>
## Issue #42: Harvest All and Plant All batch action buttons

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend, frontend` |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [#42](https://github.com/dongprotocol/bandit-buddy/issues/42) |

## Overview
Batch action buttons above the tool dock for harvesting all ready crops or planting a pre-selected seed on all empty plots.

## Harvest All
- Button visible only when ≥ 1 plot is harvestable
- Shows count: "Harvest All (N)"
- Calls harvest endpoint sequentially (not parallel — avoid DB lock contention)
- Shows progress toast: "Harvested 3/5 plots"

## Plant All
- Button visible when seed tool active + seed pre-selected + ≥ 1 empty plot
- Shows count: "Plant All (N)"  
- Pre-selected seed passed from BottomBar state
- Calls plant endpoint for each empty plot
- Deducts gold incrementally; stops if gold runs out

## Components (already scaffolded)
- `HarvestAllButton.tsx` and `PlantAllButton.tsx` in `/src/components/hud/`
- EventBus integration via `farm-updated` event after batch completes

## Acceptance Criteria
- [ ] Harvest All processes plots sequentially (not Promise.all)
- [ ] Plant All stops cleanly if insufficient gold for next plot
- [ ] Both buttons disappear if no longer applicable after batch completion
- [ ] Farm cache invalidated and React Query refetch triggered after batch

---

<a name="issue-48"></a>
## Issue #48: Attack mechanic — targeted farm sabotage with scarecrow defense item

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend, frontend` |
| **Priority** | 🟡 Medium |
| **Epic** | Core-game |
| **GitHub** | [#48](https://github.com/dongprotocol/bandit-buddy/issues/48) |

## Overview
Offensive attack action (distinct from steal) that plants weeds or bugs on a target farm.

## Attack Types
- **Weed Attack**: plants weeds on target plot (causes -25% yield penalty for victim)
- **Bug Attack**: plants bugs on target plot (causes -40% yield penalty for victim)
- Costs 15 energy per attack
- Max 3 attacks per user per day

## Defense: Scarecrow
- Purchased from Shop (500 GOLD)
- Blocks next attack attempt on any plot
- Consumable: used up after blocking one attack
- Visible on farm as scarecrow sprite

## Backend
```
POST /action/attack { targetUserId, plotId, attackType }
1. Check attacker energy >= 15
2. Check daily attack count < 3
3. Check plot is planted (not empty)
4. Check for scarecrow defense (block attack, notify victim, return { blocked: true })
5. Set farm_plots.has_weeds or has_bugs = true
6. Deduct 15 energy
7. Log to attack_logs table
8. Send notification to victim
```

## Acceptance Criteria
- [ ] Attack modal accessible when visiting friend farm + attack tool selected
- [ ] Scarecrow blocks attack silently to attacker (no info leak about defense type)
- [ ] Victim receives in-app notification: "@attacker sabotaged your [crop] plot"
- [ ] Attack penalty reflected in next harvest calculation

---

<a name="issue-55"></a>
## Issue #55: Fertilizer (crop boost) UI — select and apply to growing crops

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend, frontend` |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [#55](https://github.com/dongprotocol/bandit-buddy/issues/55) |

## Overview
FertilizerModal and in-game spray tool interaction for applying fertilizer charges to plots.

## Types
- 🌿 Normal Fert: +15% yield
- 🚀 Super Fert: +35% yield
- 💎 Advanced Fert: +60% yield
- Only one fertilizer per plot per growth cycle
- Can only be applied to actively growing (not yet harvestable) crops

## UI Flow
1. Select spray tool in BottomBar
2. Hint bar shows fertilizer charge counts
3. Tap a plot with a growing crop → FertilizerModal opens
4. Modal shows 3 fert types with cost (charges consumed), boost preview
5. Confirm → `POST /action/fertilize { plotId, fertType }`
6. Plot sprite gets boost overlay (glow effect)

## Backend
- `farm_plots.fertilizer_type` column: null | 'normal' | 'super' | 'advanced'
- `POST /action/fertilize` — validate charges > 0, set plot fertilizer, deduct charge
- Harvest multiplier: apply fertilizer bonus if set

## Acceptance Criteria
- [ ] Cannot fertilize already-harvestable or empty plots (returns 400)
- [ ] Boost visible in harvest preview before confirming
- [ ] Charge counts in BottomBar badge update after applying
- [ ] Only one fert type per plot (second application overwrites, no refund)

---

<a name="issue-34"></a>
## Issue #34: Achievement system — unlock badges and bonus rewards for milestones

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend, frontend` |
| **Priority** | 🟢 Low |
| **Epic** | - |
| **GitHub** | [#34](https://github.com/dongprotocol/bandit-buddy/issues/34) |

## Overview
Achievement system to reward long-term engagement and showcase player progression.

## Achievement Categories
### Farming
- First Harvest (plant + harvest first crop)
- Master Farmer (harvest 100 crops)
- Golden Fields (earn 10,000 GOLD total)

### Combat
- First Raid (successful steal)
- Bandit King (50 successful steals)
- Untouchable (guard dog repels 10 attacks)

### Social
- Recruiter (invite 5 friends)
- Guild Founder (create a guild)
- Team Player (contribute 1000 GOLD to guild)

### Economy
- Diamond Hands (hold 100 $FARM for 7 days)
- Big Spender (spend 5000 GOLD in shop)

## Endpoints
- `GET /achievements` — all achievements with unlock status + progress
- Achievement unlocked → push notification + GOLD reward

## Acceptance Criteria
- [ ] Achievement check triggered as side-effect of relevant action APIs
- [ ] Each achievement grants one-time GOLD reward (stored in achievement config)
- [ ] AchievementModal shows locked achievements with progress bar
- [ ] New achievement unlock triggers toast + sound

---

<a name="issue-46"></a>
## Issue #46: Settings modal — sound, notifications, wallet info, account management

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 2: Core Game APIs & Economy Layer |
| **Area** | `backend, frontend` |
| **Priority** | 🟢 Low |
| **Epic** | - |
| **GitHub** | [#46](https://github.com/dongprotocol/bandit-buddy/issues/46) |

## Overview
Settings modal accessible from the HUD gear icon.

## Settings Sections
### Audio
- Master volume slider (0-100%)
- Music toggle (if background music added)
- SFX toggle (separate from music)

### Notifications
- Enable/disable Telegram push notifications
- Harvest ready notifications toggle
- Raid alert toggle

### Wallet
- Display wallet address (truncated, tap to copy full)
- Show QR code of wallet address
- Link/change wallet option
- Export private key (auto-wallet only, with password confirmation)

### Account
- Display Telegram username and user ID
- Account age, join date
- Delete account (with 7-day cooldown before permanent deletion)

## Acceptance Criteria
- [ ] Sound settings persisted to localStorage, respected by SoundManager
- [ ] Wallet address copy-to-clipboard with toast confirmation
- [ ] Export private key requires tap + confirmation (high friction intentional)
- [ ] Delete account creates deletion request (not immediate — 7-day grace)

---

<a name="sprint-3"></a>
# Sprint 3 — Smart Contracts & Blockchain Layer (Days 15–21)

**Due:** 2026-10-01  
**Goal:** FarmToken, BanditMarket, BanditDogFusion, TreasuryBuyBack, GuildStaking lên BSC Testnet. Premium subscription. Guild Tier.  
**Issues:** 12 total — 10 High / 2 Medium / 0 Low  

| # | Title | Area | Priority | Epic | Note |
|:-:|-------|------|:--------:|:----:|:----:|
| #15 | [SC] BanditMarket.sol — P2P NFT Marketplace with EIP-712 order book | `smart-contract` | 🔴 High | Marketplace |  |
| #16 | [SC] BanditDogFusion.sol — Guard Dog Gacha with Commit-Reveal Oracle RNG | `smart-contract` | 🔴 High | Gacha |  |
| #17 | [SC] TreasuryBuyBack.sol — auto buy-back and burn mechanism | `smart-contract` | 🔴 High | Treasury |  |
| #18 | Blockchain event indexer — startMarketplaceListener with fallback cronjob | `backend, infra` | 🔴 High | Blockchain-infra |  |
| #19 | Guard Dog Gacha UI — pull animation, tier reveal, pity tracker | `frontend` | 🔴 High | Gacha |  |
| #22 | Dedicated RPC provider setup with Ethers.js v6 fallback chain | `infra` | 🔴 High | Blockchain-infra |  |
| #52 | FarmToken.sol — ERC-20 with mint, burn, and claim gating | `smart-contract` | 🔴 High | Economy |  |
| #53 | Hardhat project setup — compile, test, deploy scripts for all contracts | `smart-contract, infra` | 🔴 High | - |  |
| #58 | Premium Subscriptions — Quản gia tự động (Auto-harvest) và Bảo hiểm Nông sản (DeFi Insurance) | `backend, frontend, smart-contract` | 🔴 High | Economy | ⭐ Audit Fix |
| #59 | Guild Tier & Taxation — Bang Tinh Anh (Stake \$FARM + Cờ Xanh) và thu thuế harvest member | `backend, frontend, smart-contract` | 🔴 High | Guild | ⭐ Audit Fix |
| #20 | Marketplace UI — listing browser, buy flow, and my listings management | `frontend` | 🟡 Medium | Marketplace |  |
| #21 | Guild system — create/join guilds, World Tree, and contribution tracking | `backend, frontend` | 🟡 Medium | Guild |  |

---

<a name="issue-15"></a>
## Issue #15: [SC] BanditMarket.sol — P2P NFT Marketplace with EIP-712 order book

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | `smart-contract` |
| **Priority** | 🔴 High |
| **Epic** | Marketplace |
| **GitHub** | [#15](https://github.com/dongprotocol/bandit-buddy/issues/15) |

## Overview
Core marketplace smart contract for buying/selling Guard Dog NFTs (ERC-1155).

## Contract Functions
```solidity
// Fill an off-chain signed order
function fillOrder(Order calldata order, bytes calldata signature) external payable;

// Cancel own orders by nonce
function cancelOrder(uint256 nonce) external;

// Batch cancel
function cancelOrders(uint256[] calldata nonces) external;

// Admin: pause/unpause
function pause() / function unpause() external onlyOwner;
```

## Fee Structure
- 5% trade tax on every fill (taken from buyer payment)
- 50% of fees → TreasuryBuyBack.sol (auto buy-back)
- 50% → team multisig

## Events
- `OrderFilled(address seller, address buyer, uint256 tokenId, uint256 amount, uint256 price)`
- `OrderCancelled(address seller, uint256 nonce)`

## Acceptance Criteria
- [ ] EIP-712 signature verification passes for all valid orders
- [ ] Replay attack impossible (nonce invalidated after fill)
- [ ] Seller must own tokenId+amount at fill time (checked via ERC-1155 balance)
- [ ] Reentrancy guard on fillOrder
- [ ] 100% branch coverage in tests (Hardhat + ethers.js v6)
- [ ] Deployed to BSC Testnet with verified source

---

<a name="issue-16"></a>
## Issue #16: [SC] BanditDogFusion.sol — Guard Dog Gacha with Commit-Reveal Oracle RNG

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | `smart-contract` |
| **Priority** | 🔴 High |
| **Epic** | Gacha |
| **GitHub** | [#16](https://github.com/dongprotocol/bandit-buddy/issues/16) |

## Overview
ERC-1155 NFT contract for Guard Dogs (T1-T5) with provably fair commit-reveal randomness.

## Dog Tiers
| Tier | Name | Defense Power | Base Rate |
|------|------|--------------|-----------|
| T1 | Chó Cỏ (Mutt) | 5 | 60% |
| T2 | Chó Săn (Hound) | 15 | 25% |
| T3 | Chó Chăn Cừu (Shepherd) | 30 | 10% |
| T4 | Chó Becgie (German Shepherd) | 50 | 4% |
| T5 | Bec-giê Elite | 80 | 1% |

## Commit-Reveal Flow
```
1. User calls commit(bytes32 commitment) — pays FARM fee
2. Block.number + 3 passes
3. User calls reveal(bytes32 secret) — RNG uses blockhash + secret + nonce
4. NFT minted to user at determined tier
```

## Fusion System
- 3x same tier → fuse to next tier (T1→T2, T2→T3, etc.)
- `fuseDogs(uint256[] calldata tokenIds)` burns 3 NFTs, mints 1 higher tier

## Pity System
- Every 10 failed T4+ attempts → guaranteed T3+
- Every 50 failed attempts → guaranteed T4+
- Pity counter stored per user on-chain

## Items
- Lucky Bone: +10% gacha rate (consumable)
- Protection Collar: make dog untargetable for 24h

## Acceptance Criteria
- [ ] Commit-reveal cannot be front-run (commitment hides secret)
- [ ] blockhash unavailable after 256 blocks → refund path
- [ ] Fusion burns exactly 3 NFTs of same tier
- [ ] Pity counter resets after T4+ pull
- [ ] Deployed to BSC Testnet, source verified on BscScan

---

<a name="issue-17"></a>
## Issue #17: [SC] TreasuryBuyBack.sol — auto buy-back and burn mechanism

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | `smart-contract` |
| **Priority** | 🔴 High |
| **Epic** | Treasury |
| **GitHub** | [#17](https://github.com/dongprotocol/bandit-buddy/issues/17) |

## Overview
Treasury contract that receives marketplace fees and executes automatic $FARM buy-back and burn.

## Architecture
```
Marketplace fees (50%) → TreasuryBuyBack
TreasuryBuyBack → PancakeSwap: swap BNB → $FARM
TreasuryBuyBack → FarmToken: burn(amount)
```

## Trigger Conditions
- Auto-execute when treasury BNB balance > threshold (e.g., 0.1 BNB)
- Admin manual trigger: `executeBuyBack(uint256 minAmountOut)`
- Max slippage 2% (reject if PancakeSwap returns less)

## Functions
```solidity
function receiveFees() external payable;  // called by BanditMarket
function executeBuyBack(uint256 minOut) external;  // permissioned
function setThreshold(uint256 newThreshold) external onlyOwner;
function emergencyWithdraw() external onlyOwner;  // safety escape
```

## Events
- `BuyBackExecuted(uint256 bnbSpent, uint256 farmBurned, uint256 timestamp)`

## Acceptance Criteria
- [ ] BNB received from marketplace correctly credited
- [ ] PancakeSwap call uses `swapExactETHForTokens` with deadline
- [ ] Burns tokens via `FarmToken.burn()` (not transfer to dead address)
- [ ] Slippage guard: revert if farmOut < minOut
- [ ] Event emitted on every buy-back execution
- [ ] BSC Testnet deployed with buy-back simulation test

---

<a name="issue-18"></a>
## Issue #18: Blockchain event indexer — startMarketplaceListener with fallback cronjob

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | `backend, infra` |
| **Priority** | 🔴 High |
| **Epic** | Blockchain-infra |
| **GitHub** | [#18](https://github.com/dongprotocol/bandit-buddy/issues/18) |

## Overview
Real-time on-chain event indexing to keep the backend DB in sync with smart contract state.

## Primary: WebSocket Event Listener
```typescript
// services/blockchain/marketplace.listener.ts
async function startMarketplaceListener() {
  const provider = new ethers.WebSocketProvider(process.env.WSS_RPC_URL);
  const contract = new ethers.Contract(MARKET_ADDR, ABI, provider);
  
  contract.on('OrderFilled', async (seller, buyer, tokenId, amount, price, event) => {
    await db.transaction(async (em) => {
      await em.update(MarketplaceListing, { ... }, { status: 'filled' });
      await em.insert(TradeHistory, { ... });
      await updateGuardDogOwnership(em, buyer, tokenId);
    });
  });
}
```

## Fallback: Polling Cronjob
```typescript
// services/blockchain/marketplace.indexer.ts — runs every 30s if WS disconnects
async function runMarketplaceIndexer() {
  const lastBlock = await getLastIndexedBlock();
  const events = await contract.queryFilter('OrderFilled', lastBlock, 'latest');
  // process events, update lastBlock
}
```

## Guard Dog NFT Sync
- On `Transfer` event: update `nft_guard_dogs.owner_id` in DB
- Detect NFT feeding subscription status

## Acceptance Criteria
- [ ] WS listener auto-reconnects on disconnect (exponential backoff, max 5 retries)
- [ ] Cronjob activates automatically when WS is unavailable
- [ ] No duplicate event processing (idempotent via tx hash dedup)
- [ ] lastBlock cursor persisted in Redis (survives restart)
- [ ] Logs every event with tx hash for audit trail

---

<a name="issue-19"></a>
## Issue #19: Guard Dog Gacha UI — pull animation, tier reveal, pity tracker

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | `frontend` |
| **Priority** | 🔴 High |
| **Epic** | Gacha |
| **GitHub** | [#19](https://github.com/dongprotocol/bandit-buddy/issues/19) |

## Overview
Full gacha experience UI for the Guard Dog system.

## UI Flow
1. Gacha tab in Shop modal
2. Select pull count (1x or 10x)
3. Confirm payment in $FARM
4. Loading animation (commit phase)
5. After block confirmation: animated tier reveal (envelope open → dog reveal)
6. Show pulled dog with tier badge + defense stat
7. Option to equip, sell, or fuse

## Visual Elements
- Dog tier card with rarity glow (Common/Uncommon/Rare/Epic/Legendary)
- Pity progress bar: "X pulls until guaranteed T3+"
- Inventory grid with all owned dogs + equip/unequip toggle
- Fusion UI: select 3 same-tier dogs → animate fusion → reveal higher tier

## Acceptance Criteria
- [ ] Reveal animation takes 2-3s (not skippable to prevent rapid clicking)
- [ ] Pity counter synced from on-chain state (via backend read)
- [ ] 10x pull shows all 10 cards sequentially then summary
- [ ] Dog equipped shows on farm (guard icon on plot area)
- [ ] Fusion: warns user 3 NFTs will be burned, requires confirmation

---

<a name="issue-22"></a>
## Issue #22: Dedicated RPC provider setup with Ethers.js v6 fallback chain

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | `infra` |
| **Priority** | 🔴 High |
| **Epic** | Blockchain-infra |
| **GitHub** | [#22](https://github.com/dongprotocol/bandit-buddy/issues/22) |

## Overview
Production-grade BSC RPC configuration with automatic fallback to prevent single-point-of-failure.

## Architecture
```typescript
// services/blockchain/provider.ts
const RPC_URLS = [
  process.env.PRIMARY_RPC_URL,    // dedicated node (e.g., QuickNode/Alchemy)
  process.env.FALLBACK_RPC_URL_1, // BSC public RPC 1
  process.env.FALLBACK_RPC_URL_2, // BSC public RPC 2
];

export async function getProvider(): Promise<ethers.JsonRpcProvider> {
  const fallback = new ethers.FallbackProvider(
    RPC_URLS.map((url, i) => ({ provider: new ethers.JsonRpcProvider(url), priority: i, stallTimeout: 2000 }))
  );
  return fallback;
}
```

## Configuration
- Primary: QuickNode or Alchemy BSC endpoint (env var)
- Fallback 1/2: public BSC RPCs
- WebSocket for event subscriptions (separate WSS_RPC_URL)
- Health check: call `eth_blockNumber` every 30s, log provider switches

## Acceptance Criteria
- [ ] Primary RPC failure automatically routes to fallback within 2s
- [ ] All 3 RPCs down → graceful error, no crash
- [ ] RPC switch event logged with timestamp and reason
- [ ] WS reconnect logic independent of HTTP fallback chain
- [ ] BSC block time monitoring: alert if last block > 30s old

---

<a name="issue-52"></a>
## Issue #52: FarmToken.sol — ERC-20 with mint, burn, and claim gating

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | `smart-contract` |
| **Priority** | 🔴 High |
| **Epic** | Economy |
| **GitHub** | [#52](https://github.com/dongprotocol/bandit-buddy/issues/52) |

## Overview
The core $FARM on-chain token contract.

## Specification
- Standard: ERC-20
- Name: Farm Token
- Symbol: FARM
- Decimals: 18
- Max supply: 1,000,000,000 FARM (1 billion)
- Mintable: only by designated minter (BanditDogFusion + claim backend wallet)
- Burnable: via `burn(amount)` and `burnFrom(address, amount)`

## Functions
```solidity
function mint(address to, uint256 amount) external onlyMinter;
function burn(uint256 amount) external;
function burnFrom(address account, uint256 amount) external;
function claim(address user, uint256 amount, uint256 nonce, bytes calldata signature) external;
function setMinter(address minter) external onlyOwner;
```

## Claim Validation
```solidity
bytes32 hash = keccak256(abi.encodePacked(user, amount, nonce));
bytes32 ethHash = hash.toEthSignedMessageHash();
address signer = ethHash.recover(signature);
require(signer == ADMIN_SIGNER, "invalid sig");
require(!usedNonces[user][nonce], "replayed");
usedNonces[user][nonce] = true;
_mint(user, amount);
```

## Acceptance Criteria
- [ ] Claim with valid ECDSA signature mints correct amount
- [ ] Replay attack with same nonce reverts with 'replayed'
- [ ] Total supply never exceeds MAX_SUPPLY
- [ ] Burns reduce total supply (verified on-chain)
- [ ] Deployed to BSC Testnet + Mainnet, source verified

---

<a name="issue-53"></a>
## Issue #53: Hardhat project setup — compile, test, deploy scripts for all contracts

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | `smart-contract, infra` |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [#53](https://github.com/dongprotocol/bandit-buddy/issues/53) |

## Overview
Hardhat development environment for all Solidity smart contracts.

## Project Structure
```
barnbuddy/contracts/
├── contracts/
│   ├── FarmToken.sol
│   ├── BanditMarket.sol
│   ├── BanditDogFusion.sol
│   └── TreasuryBuyBack.sol
├── test/
│   ├── FarmToken.test.ts
│   ├── BanditMarket.test.ts
│   ├── BanditDogFusion.test.ts
│   └── TreasuryBuyBack.test.ts
├── scripts/
│   ├── deploy.ts (sequence deploy script)
│   └── verify.ts (BscScan verification)
├── hardhat.config.ts
└── .env.example
```

## Networks Config
```typescript
networks: {
  bscTestnet: { url: 'https://data-seed-prebsc-1-s1.binance.org:8545', chainId: 97 },
  bsc: { url: process.env.BSC_RPC_URL, chainId: 56 },
}
```

## Acceptance Criteria
- [ ] `npx hardhat compile` — zero errors, zero warnings
- [ ] `npx hardhat test` — all tests green
- [ ] `npx hardhat run scripts/deploy.ts --network bscTestnet` — deploys all 4 contracts
- [ ] `npx hardhat verify --network bscTestnet <address>` — source verified
- [ ] CI: GitHub Actions runs `hardhat test` on every PR

---

<a name="issue-58"></a>
## Issue #58: Premium Subscriptions — Quản gia tự động (Auto-harvest) và Bảo hiểm Nông sản (DeFi Insurance)

> ⭐ **AUDIT FIX #3** — Được thêm sau Independent Audit (audit.md).

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | `backend, frontend, smart-contract` |
| **Priority** | 🔴 High |
| **Epic** | Economy |
| **GitHub** | [#58](https://github.com/dongprotocol/bandit-buddy/issues/58) |

## Overview
Hai gói dịch vụ Premium trả phí bằng \$FARM — tạo demand on-chain thực sự và FARM sink bền vững.

## Gói 1: Quản Gia Tự Động (Farm Butler)
Tự động harvest + trồng lại trong 30 phút kể từ khi cây chín, tự động tưới, tự động bón phân khi fertility < 50%.

| Gói | Thời hạn | Giá \$FARM |
|-----|----------|-----------|
| Basic Butler | 7 ngày | 10 \$FARM |
| Premium Butler | 30 ngày | 35 \$FARM |
| Ultimate Butler | 90 ngày | 90 \$FARM |

**Backend:** Cronjob mỗi 30 phút, quét `user_subscriptions` active, auto-harvest + auto-plant.

## Gói 2: Bảo Hiểm Nông Sản (Crop Insurance)
Khi bị trộm thành công → đền bù 80% GOLD stolen. Max 3 claims/ngày.

| Gói | Thời hạn | Giá \$FARM |
|-----|----------|-----------|
| Basic Insurance | 7 ngày | 5 \$FARM |
| Family Plan | 30 ngày | 18 \$FARM |

**Backend:** Steal endpoint kiểm tra active insurance của victim, credit `stolenAmount * 0.8`.

## Database
- `user_subscriptions`: user_id, sub_type, tier, expires_at
- `insurance_claims`: user_id, plot_id, stolen_amount, compensation, timestamp

## Acceptance Criteria
- [ ] Butler cronjob chạy mỗi 30 phút
- [ ] Auto-harvest áp đúng soil_fertility + weather modifier
- [ ] Insurance claim trong cùng transaction với steal
- [ ] Max 3 insurance claims/day enforced server-side
- [ ] \$FARM deducted on-chain khi mua subscription

---

<a name="issue-59"></a>
## Issue #59: Guild Tier & Taxation — Bang Tinh Anh (Stake $FARM + Cờ Xanh) và thu thuế harvest member

> ⭐ **AUDIT FIX #4** — Được thêm sau Independent Audit (audit.md).

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | `backend, frontend, smart-contract` |
| **Priority** | 🔴 High |
| **Epic** | Guild |
| **GitHub** | [#59](https://github.com/dongprotocol/bandit-buddy/issues/59) |

## Overview
Phân cấp guild: Bang Dân Dã (free, 20 members) vs Bang Tinh Anh (stake 1,000 \$FARM, 50 members, Cờ Xanh 🔵, thu thuế 1–5% harvest của thành viên).

## Guild Tiers

| | Bang Dân Dã | Bang Tinh Anh 🔵 |
|--|-------------|----------------|
| Chi phí | 500 GOLD | Stake 1,000 \$FARM |
| Max members | 20 | 50 |
| Blue Badge | ❌ | ✅ |
| Tax harvest | ❌ | 1–5% (tự set) |
| GvG priority | Normal | Elite bracket |

## Taxation Mechanic
```
POST /action/harvest
→ if guild.tier === 'elite' && guild.taxRate > 0:
    taxAmount = harvestYield * taxRate / 100
    deduct from member, credit to guild leader
    log to guild_tax_logs
```

## Smart Contract: GuildStaking.sol
- `stakeForElite(guildId)`: lock 1,000 FARM, set isElite = true
- `unstakeElite(guildId)`: 30-day cooldown, revoke Elite status

## Database Changes
- `guilds.tier` ENUM('free','elite'), `guilds.tax_rate` INTEGER 0–5
- New: `guild_tax_logs` (guild_id, member_id, harvest_amount, tax_amount)
- New: `guild_staking` (guild_id, staker_address, amount, staked_at)

## Acceptance Criteria
- [ ] Stake 1,000 \$FARM on-chain → guild.tier='elite' (via event indexer)
- [ ] Harvest tax deducted trong cùng DB transaction (atomic)
- [ ] Tax rate 0% khi tier='free'
- [ ] Unstake: 30-day cooldown on-chain, tier revoked ngay
- [ ] Member thấy tax rate trước khi confirm join

---

<a name="issue-20"></a>
## Issue #20: Marketplace UI — listing browser, buy flow, and my listings management

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | `frontend` |
| **Priority** | 🟡 Medium |
| **Epic** | Marketplace |
| **GitHub** | [#20](https://github.com/dongprotocol/bandit-buddy/issues/20) |

## Overview
Full marketplace interface for browsing, buying, and managing Guard Dog NFT listings.

## Pages / Views
- **Browse**: grid of dog cards with filter (tier, price, defense power), sort (price asc/desc, newest)
- **Listing Detail**: dog stats, seller info, price in $FARM, buy button
- **Create Listing**: select owned dog, set price, expiry, sign EIP-712 order
- **My Listings**: active listings with cancel option

## Buy Flow
1. Tap "Buy" → confirm modal (show price + 5% fee breakdown)
2. Approve $FARM spend (if allowance insufficient)
3. Call `BanditMarket.fillOrder()` with stored signature
4. Success: update DB via event indexer → refresh inventory

## Acceptance Criteria
- [ ] Filter + sort works client-side (cached listing data)
- [ ] Price displayed in both $FARM and USD equivalent (via rate API)
- [ ] Insufficient $FARM balance: show top-up option (redirect to swap)
- [ ] Expired listings hidden from browse (server-filtered)
- [ ] Create listing: preview fee deduction before signing

---

<a name="issue-21"></a>
## Issue #21: Guild system — create/join guilds, World Tree, and contribution tracking

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 3: Smart Contracts & Blockchain Layer |
| **Area** | `backend, frontend` |
| **Priority** | 🟡 Medium |
| **Epic** | Guild |
| **GitHub** | [#21](https://github.com/dongprotocol/bandit-buddy/issues/21) |

## Overview
Social-Fi guild system with cooperative gameplay around the World Tree resource.

## Core Concepts
- **Guild**: up to 50 members, has name, emblem, level, treasury (GOLD pool)
- **World Tree**: global resource that all guilds compete to nourish
- **Proof of Contribution (PoC)**: on-chain record of each member's contribution score
- **Guild Wars (GvG)**: weekly event where guilds compete for World Tree dominance

## Database Tables
- `guilds`: id, name, emblem, level, treasury_gold, created_by
- `guild_members`: guild_id, user_id, role (owner/officer/member), contribution_score, joined_at
- `world_tree_contributions`: guild_id, week, total_contribution, rank
- `gvg_battles`: attacker_guild, defender_guild, outcome, week

## Endpoints
- `POST /guilds` — create guild (costs 500 GOLD)
- `POST /guilds/:id/join` — join (invite or open)
- `GET /guilds/leaderboard` — top 50 guilds by World Tree score
- `POST /guilds/:id/contribute { goldAmount }` — contribute to guild treasury
- `GET /guilds/:id` — guild detail with member list + weekly rank

## Acceptance Criteria
- [ ] Guild owner can set open/invite-only
- [ ] Weekly GvG matchmaking pairs guilds of similar score
- [ ] Contribution score feeds into guild leaderboard
- [ ] Guild dissolution refunds treasury proportionally to members
- [ ] Member kick by owner removes contribution history

---

<a name="sprint-4"></a>
# Sprint 4 — QA, Polish & MVP Launch (Days 22–30)

**Due:** 2026-10-10  
**Goal:** Security audit, E2E tests, performance, BSC Mainnet deploy Gnosis Safe multisig, MVP demo.  
**Issues:** 10 total — 5 High / 2 Medium / 3 Low  

| # | Title | Area | Priority | Epic | Note |
|:-:|-------|------|:--------:|:----:|:----:|
| #23 | Smart contract security audit — BanditMarket, BanditDogFusion, TreasuryBuyBack | `smart-contract` | 🔴 High | Security |  |
| #24 | BSC Mainnet deployment — FarmToken, BanditMarket, BanditDogFusion, TreasuryBuyBack | `smart-contract, infra` | 🔴 High | Security |  |
| #25 | End-to-end integration test suite — full game flow on BSC Testnet | `backend, smart-contract, infra` | 🔴 High | - |  |
| #26 | Performance optimization — Phaser bundle, React lazy loading, API response times | `backend, frontend, infra` | 🔴 High | - |  |
| #49 | Nginx + SSL production deployment — frontend CDN, backend reverse proxy | `infra` | 🔴 High | - |  |
| #27 | NFT Guard Dog feeding subscription system | `backend, frontend` | 🟡 Medium | Core-game |  |
| #39 | Telegram Mini App polish — safe area, viewport, haptic feedback, back button | `frontend` | 🟡 Medium | - |  |
| #28 | Seasonal events system — Halloween, Christmas, Lunar New Year crops | `backend, frontend` | 🟢 Low | Core-game |  |
| #51 | World Tree GvG — weekly guild war event with resource capture | `backend, frontend` | 🟢 Low | Guild |  |
| #54 | Admin dashboard — farm stats, user management, economy monitoring | `backend, frontend, infra` | 🟢 Low | - |  |

---

<a name="issue-23"></a>
## Issue #23: Smart contract security audit — BanditMarket, BanditDogFusion, TreasuryBuyBack

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 4: QA, Polish & MVP Launch |
| **Area** | `smart-contract` |
| **Priority** | 🔴 High |
| **Epic** | Security |
| **GitHub** | [#23](https://github.com/dongprotocol/bandit-buddy/issues/23) |

## Overview
Pre-mainnet security review of all three core contracts.

## Audit Checklist
### BanditMarket.sol
- [ ] Reentrancy: fillOrder transfers before state update? (check CEI pattern)
- [ ] Signature malleability: use OpenZeppelin ECDSA library
- [ ] Order expiry: checked before execution, not after
- [ ] Integer overflow: Solidity 0.8+ safe math confirmed
- [ ] Access control: pause/unpause restricted to owner

### BanditDogFusion.sol
- [ ] Commit-Reveal: commitment hash can't be guessed before reveal
- [ ] Front-running: miners can't exploit blockhash selection
- [ ] Burn-on-fusion: exactly 3 NFTs burned (no off-by-one)
- [ ] Pity counter: can't be manipulated by user

### TreasuryBuyBack.sol
- [ ] PancakeSwap call: deadline set, not block.timestamp (flash loan risk)
- [ ] emergencyWithdraw: behind timelock, not instant

## External Tools
- Run Slither static analysis: `slither . --print human-summary`
- Run Mythril: `myth analyze contracts/*.sol`
- Manual review of all external calls

## Acceptance Criteria
- [ ] Zero high/critical findings
- [ ] All medium findings documented with accepted risk rationale
- [ ] Audit report committed to repo (`/audit/report.md`)

---

<a name="issue-24"></a>
## Issue #24: BSC Mainnet deployment — FarmToken, BanditMarket, BanditDogFusion, TreasuryBuyBack

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 4: QA, Polish & MVP Launch |
| **Area** | `smart-contract, infra` |
| **Priority** | 🔴 High |
| **Epic** | Security |
| **GitHub** | [#24](https://github.com/dongprotocol/bandit-buddy/issues/24) |

## Overview
Production deployment sequence for all smart contracts to BSC Mainnet.

## Deployment Order
1. `FarmToken.sol` (ERC-20, mintable by owner only)
2. `BanditDogFusion.sol` (ERC-1155, set FarmToken address)
3. `TreasuryBuyBack.sol` (set FarmToken + PancakeSwap Router)
4. `BanditMarket.sol` (set FarmToken + TreasuryBuyBack address)
5. `FarmToken.setMinter(BanditDogFusion address)` — grant minting rights
6. `BanditMarket.setFeeReceiver(TreasuryBuyBack address)` — route fees

## Post-Deployment
- Verify all contracts on BscScan (auto via Hardhat verify plugin)
- Transfer ownership to multisig (Gnosis Safe)
- Set initial treasury threshold: 0.1 BNB
- Add liquidity: seed PancakeSwap BNB/FARM pool

## Acceptance Criteria
- [ ] All contracts verified on BscScan with matching bytecode
- [ ] Owner transferred to 3-of-5 Gnosis Safe multisig
- [ ] PancakeSwap pair created with initial liquidity
- [ ] Backend env updated with mainnet contract addresses
- [ ] First buy-back executed and verified on-chain

---

<a name="issue-25"></a>
## Issue #25: End-to-end integration test suite — full game flow on BSC Testnet

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 4: QA, Polish & MVP Launch |
| **Area** | `backend, smart-contract, infra` |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [#25](https://github.com/dongprotocol/bandit-buddy/issues/25) |

## Overview
Comprehensive E2E tests covering the complete user journey from Telegram auth to on-chain claim.

## Test Scenarios
### Auth & Onboarding
- [ ] Fresh user: initData → JWT → 3 starter plots + 100 gold
- [ ] Returning user: JWT refresh, profile loads correctly

### Farm Lifecycle
- [ ] Plant → grow timer → harvest → gold credited
- [ ] Concurrent harvest (2 requests): only one succeeds
- [ ] Steal: success path + failure path (dog defense)
- [ ] Steal cap (>20%): correctly rejected

### Economy
- [ ] GOLD accumulation → claim signature → on-chain `FarmToken.claim()` succeeds
- [ ] Replay attack (same nonce): rejected on-chain
- [ ] Exchange rate updates when treasury changes

### Marketplace
- [ ] List Guard Dog → browse → buy → ownership transferred
- [ ] Cancel listing → order invalidated on-chain
- [ ] Fee routing: 50% reaches TreasuryBuyBack

### Gacha
- [ ] 10x pull: correct tier distribution over 1000 samples
- [ ] Pity: T4+ guaranteed at 50 pulls (simulated)
- [ ] Fusion: 3x T1 → 1x T2

## Acceptance Criteria
- [ ] All scenarios pass on BSC Testnet
- [ ] Tests run in CI (GitHub Actions) on every PR to main
- [ ] <5 min total runtime
- [ ] Coverage report attached to PR

---

<a name="issue-26"></a>
## Issue #26: Performance optimization — Phaser bundle, React lazy loading, API response times

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 4: QA, Polish & MVP Launch |
| **Area** | `backend, frontend, infra` |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [#26](https://github.com/dongprotocol/bandit-buddy/issues/26) |

## Overview
Production performance pass before MVP launch.

## Frontend Targets
- Initial JS load (gzip): < 100KB for main entry chunk
- Phaser chunk: lazy-loaded only after Enter Farm click
- LCP (Largest Contentful Paint): < 2s on 4G in Telegram WebView
- Steady FPS: ≥ 55 on mid-tier Android

## Backend Targets
- `GET /farm/:userId` (cached): < 50ms p99
- `POST /action/harvest`: < 200ms p99 (including DB write)
- `POST /action/steal`: < 300ms p99 (transaction + RNG)

## Tasks
- [ ] Audit Vite `manualChunks` — ensure no web3 code in eagerly-loaded chunks
- [ ] Add `modulePreload: { polyfill: false }` to vite.config.ts
- [ ] Profile Phaser scene: remove unused asset preloads
- [ ] Add DB connection pooling (TypeORM pool size: 10)
- [ ] Enable gzip on nginx (`gzip_types` includes application/javascript)
- [ ] Redis pipeline for multi-key invalidations

## Acceptance Criteria
- [ ] Lighthouse PWA score >= 85 in Telegram iOS WebView
- [ ] API p99 within targets (load test with 100 concurrent users for 60s)
- [ ] No layout shift (CLS < 0.1) during HUD render

---

<a name="issue-49"></a>
## Issue #49: Nginx + SSL production deployment — frontend CDN, backend reverse proxy

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 4: QA, Polish & MVP Launch |
| **Area** | `infra` |
| **Priority** | 🔴 High |
| **Epic** | - |
| **GitHub** | [#49](https://github.com/dongprotocol/bandit-buddy/issues/49) |

## Overview
Production server configuration for serving the Telegram Mini App over HTTPS.

## Architecture
```
Telegram → HTTPS → Nginx → /api/* → NestJS (port 3000)
                        → /* → React static files (dist/)
```

## Nginx Config Requirements
- SSL via Let's Encrypt (Certbot)
- HTTP → HTTPS redirect
- Gzip compression for JS/CSS/JSON
- `proxy_pass` for `/api` to NestJS
- Cache-Control headers for static assets (1 year for hashed filenames)
- `X-Frame-Options: ALLOW-FROM https://web.telegram.org` for TMA iframe

## Environment
- Server: Ubuntu 22.04 (existing VPS)
- Domain: registered, pointing to server IP
- Bot webhook: `POST /webhook` endpoint registered with Telegram

## Acceptance Criteria
- [ ] SSL A+ grade on SSL Labs
- [ ] Telegram can load the Mini App (no mixed content errors)
- [ ] Gzip delivers main JS < 100KB on wire
- [ ] Health check: `GET /api/health` returns 200 from outside server
- [ ] Webhook registered: `setWebhook` call confirmed with Telegram Bot API

---

<a name="issue-27"></a>
## Issue #27: NFT Guard Dog feeding subscription system

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 4: QA, Polish & MVP Launch |
| **Area** | `backend, frontend` |
| **Priority** | 🟡 Medium |
| **Epic** | Core-game |
| **GitHub** | [#27](https://github.com/dongprotocol/bandit-buddy/issues/27) |

## Overview
Guard Dogs require periodic feeding to stay active. Unpaid/unfed dogs go dormant and stop defending.

## Mechanics
- Each active Guard Dog costs 10 GOLD/day to feed
- Feeding window: 24h before expiry
- Dormant dog: defense_power = 0, visible but inactive
- Reactivate: pay back-feed (max 7 days arrears)

## Backend
- `POST /dogs/:dogId/feed { days }` — deduct GOLD, extend active_until
- `GET /user/dogs` — list all dogs with active_until timestamp
- Cronjob: daily check, deactivate expired dogs, send push notification

## UI
- Dog inventory shows active_until countdown
- Warning badge when < 24h remaining
- Feed button: select 1/7/30 days, confirm GOLD cost
- Dormant dog shown with grey overlay + \'Feed me\' prompt

## Acceptance Criteria
- [ ] Feed cost deducted atomically (no race condition)
- [ ] Dormant dog excluded from defense calculation in steal endpoint
- [ ] Push notification 24h before expiry (via Telegram Bot)
- [ ] Bulk feed all dogs option (cheapest UX path)

---

<a name="issue-39"></a>
## Issue #39: Telegram Mini App polish — safe area, viewport, haptic feedback, back button

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 4: QA, Polish & MVP Launch |
| **Area** | `frontend` |
| **Priority** | 🟡 Medium |
| **Epic** | - |
| **GitHub** | [#39](https://github.com/dongprotocol/bandit-buddy/issues/39) |

## Overview
Telegram-specific UX polish to make the game feel native inside the Telegram WebView.

## Required Integrations
- `WebApp.expand()` on game entry (already done — preserve)
- `WebApp.requestFullscreen()` on Telegram 10.0+ (Bot API 7.7)
- Safe area CSS vars: `--tg-safe-area-inset-top/bottom` applied to HUD + BottomBar
- `WebApp.HapticFeedback.impactOccurred('light')` on plot tap, button press
- `WebApp.HapticFeedback.notificationOccurred('success')` on harvest/steal
- `WebApp.BackButton` for native back navigation (when visiting friend farm)
- `WebApp.MainButton` as CTA on WelcomeScreen ("Enter Farm")

## Performance
- Disable iOS scroll bounce: `document.body.style.overscrollBehavior = 'none'`
- Prevent zoom: `<meta name='viewport' content='width=device-width, initial-scale=1, maximum-scale=1'>`
- Lock orientation to portrait

## Acceptance Criteria
- [ ] No content hidden under Telegram header bar (safe area working)
- [ ] Haptic fires on harvest and steal result (iOS + Android)
- [ ] BackButton appears when visiting friend farm, triggers return-to-own-farm
- [ ] Game doesn't zoom on double-tap (common iOS WebView issue)
- [ ] Memory usage < 150MB during normal gameplay (measured via Telegram devtools)

---

<a name="issue-28"></a>
## Issue #28: Seasonal events system — Halloween, Christmas, Lunar New Year crops

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 4: QA, Polish & MVP Launch |
| **Area** | `backend, frontend` |
| **Priority** | 🟢 Low |
| **Epic** | Core-game |
| **GitHub** | [#28](https://github.com/dongprotocol/bandit-buddy/issues/28) |

## Overview
Time-limited seasonal crop types that appear for 2-week windows with bonus yields.

## Seasonal Crops
| Season | Crop | Window | Bonus |
|--------|------|--------|-------|
| Halloween | Jack-o-Lantern | Oct 20 – Nov 5 | 2x yield |
| Halloween | Candy Corn | Oct 20 – Nov 5 | 1.5x |
| Christmas | Christmas Tree | Dec 15 – Jan 5 | 2x yield |
| Christmas | Snowdrop | Dec 15 – Jan 5 | 1.5x |
| Lunar New Year | Lucky Bamboo | Based on lunar calendar | 3x yield |

## Backend
- `seed_configs` gains `seasonal_start`, `seasonal_end` nullable columns
- `GET /seeds` filters out seeds outside their seasonal window
- Server-authoritative: planting outside window returns 400

## Frontend
- Seasonal crops marked with ✨ badge in seed shop
- Countdown timer on seasonal seeds: "Available for X days"
- Special crop sprites with seasonal theme

## Acceptance Criteria
- [ ] Seeds not purchasable outside their date window (server-side check)
- [ ] SEED_EMOJI map includes all seasonal keys (lowercase)
- [ ] Seasonal bonus applied on harvest (yield multiplier in harvest endpoint)
- [ ] Seasonal seeds visible in seed shop during window only

---

<a name="issue-51"></a>
## Issue #51: World Tree GvG — weekly guild war event with resource capture

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 4: QA, Polish & MVP Launch |
| **Area** | `backend, frontend` |
| **Priority** | 🟢 Low |
| **Epic** | Guild |
| **GitHub** | [#51](https://github.com/dongprotocol/bandit-buddy/issues/51) |

## Overview
Weekly Guild-vs-Guild event where guilds battle for control of the World Tree and earn multiplied rewards.

## Mechanics
- World Tree has 100 nodes; guilds compete to control the most nodes
- Each node controlled = +10% GOLD yield bonus for all guild members for that week
- Battles: guild member initiates attack on enemy-held node (costs 30 energy)
- Battle resolution: sum of all contributors' trust_scores vs defender's count

## Weekly Cycle
- Monday 00:00 UTC: new GvG week begins, nodes reset
- During week: guilds accumulate contribution points, battle for nodes
- Sunday 23:59 UTC: snapshot taken, rewards distributed
- Top guild: legendary Guard Dog NFT drop for all members

## Backend
- `world_tree_nodes` table: node_id (1-100), controlling_guild_id, last_captured_at
- `gvg_battles` table: node_id, attacker_guild, defender_guild, outcome, timestamp
- `POST /guilds/:id/gvg/attack { nodeId }` — battle for a node
- `GET /guilds/world-tree` — current node ownership map

## Acceptance Criteria
- [ ] Node capture requires guild quorum (>= 3 active members in last 24h)
- [ ] GOLD yield bonus applied in harvest calculation (check guild membership)
- [ ] Weekly reset cronjob fires Monday 00:00 UTC
- [ ] GvG battle log in guild detail page

---

<a name="issue-54"></a>
## Issue #54: Admin dashboard — farm stats, user management, economy monitoring

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 4: QA, Polish & MVP Launch |
| **Area** | `backend, frontend, infra` |
| **Priority** | 🟢 Low |
| **Epic** | - |
| **GitHub** | [#54](https://github.com/dongprotocol/bandit-buddy/issues/54) |

## Overview
Internal admin panel for monitoring game health and managing the economy.

## Key Views
### Economy Monitor
- Real-time GOLD in circulation vs FARM treasury
- Current conversion rate + 7d trend chart
- Total claim volume (daily/weekly)
- Buy-back events history with BNB spent / FARM burned

### User Management
- Search user by Telegram ID or username
- View user profile: gold, energy, trust score, plots, wallet
- Actions: adjust trust_score, credit/deduct gold (audit-logged), ban user

### Farm Health
- Active users (DAU/MAU)
- Harvest volume (crops/hour)
- Steal success rate (should be ~80% baseline)
- Top 10 earners this week

## Access Control
- Admin JWT separate from player JWT (different secret)
- All admin actions logged to `admin_audit_logs` table

## Acceptance Criteria
- [ ] Economy monitor updates every 5 min (websocket or polling)
- [ ] All admin actions create audit log entry with admin_id, action, timestamp
- [ ] Admin cannot transfer their own gold (conflict of interest guard)
- [ ] Rate limit: 1 admin action per second to prevent accidental bulk changes

---
