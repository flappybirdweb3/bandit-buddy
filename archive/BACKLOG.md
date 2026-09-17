# Bandit Buddy — Product Backlog

**Repository:** https://github.com/dongprotocol/bandit-buddy  
**Total Issues:** 55  
**Export date:** 2026-09-10  
**Tech Stack:** NestJS · PostgreSQL · Redis · Phaser 3 · React · Ethers.js v6 · BSC  

---

## Sprint Summary

| Sprint | Total Issues | 🔴 High | 🟡 Medium | 🟢 Low |
|--------|:------------:|:-------:|:---------:|:------:|
| Sprint 1: Foundation & Core Infrastructure | 14 | 9 | 4 | 1 |
| Sprint 2: Core Game APIs & Economy Layer | 21 | 8 | 11 | 2 |
| Sprint 3: Smart Contracts & Blockchain Layer | 10 | 8 | 2 | 0 |
| Sprint 4: QA, Polish & MVP Launch | 10 | 5 | 2 | 3 |

---

## Sprint 1 — Foundation & Core Infrastructure (Days 1–7)

| # | Task Title | Area | Priority | Epic | Link |
|:-:|-----------|------|:--------:|:----:|:----:|
| #1 | Set up NestJS monorepo with TypeScript, Docker, and CI/CD pipeline | `backend, infra` | 🔴 High | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/1) |
| #2 | PostgreSQL schema migrations (TypeORM) — all core tables | `backend` | 🔴 High | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/2) |
| #3 | Telegram initData JWT authentication middleware | `backend` | 🔴 High | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/3) |
| #4 | Phaser 3 MainFarmScene — plot grid, crop sprites, and animation system | `frontend` | 🔴 High | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/4) |
| #5 | React HUD, BottomBar, and EventBus integration layer | `frontend` | 🔴 High | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/5) |
| #6 | Redis caching layer and rate limiting (Throttler) | `backend, infra` | 🔴 High | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/6) |
| #32 | Energy regen system — 6-min tick, max cap, and regen timer UI | `backend, frontend` | 🔴 High | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/32) |
| #33 | Plot upgrade system — unlock additional plots and upgrade yield multiplier | `backend, frontend` | 🔴 High | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/33) |
| #40 | Wallet setup flow — auto-generate wallet or connect existing via WalletConnect | `backend, frontend` | 🔴 High | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/40) |
| #35 | Weather system — daily conditions affecting crop yields | `backend, frontend` | 🟡 Medium | Core-game | [#](https://github.com/dongprotocol/bandit-buddy/issues/35) |
| #44 | Friends bar — online friends panel with quick visit and steal status | `backend, frontend` | 🟡 Medium | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/44) |
| #45 | Tutorial overlay — first-time user guide with interactive steps | `frontend` | 🟡 Medium | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/45) |
| #47 | Level and XP system — trust score → level gating for seeds and features | `backend, frontend` | 🟡 Medium | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/47) |
| #43 | Sound system — SoundManager with Web Audio API unlock for iOS/Telegram | `frontend` | 🟢 Low | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/43) |

## Sprint 2 — Core Game APIs & Economy Layer (Days 8–14)

| # | Task Title | Area | Priority | Epic | Link |
|:-:|-----------|------|:--------:|:----:|:----:|
| #7 | Farm CRUD API — plant, harvest, dig, water, bug-spray, weed-kill | `backend` | 🔴 High | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/7) |
| #8 | STEAL endpoint — PostgreSQL transaction, guard dog defense, RNG outcome | `backend` | 🔴 High | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/8) |
| #9 | ECDSA claim signature — GOLD to \$FARM on-chain redemption | `backend, smart-contract` | 🔴 High | Economy | [#](https://github.com/dongprotocol/bandit-buddy/issues/9) |
| #10 | GOLD↔\$FARM dynamic exchange rate engine | `backend` | 🔴 High | Economy | [#](https://github.com/dongprotocol/bandit-buddy/issues/10) |
| #11 | P2P Marketplace backend — listing creation, EIP-712 off-chain orders | `backend` | 🔴 High | Marketplace | [#](https://github.com/dongprotocol/bandit-buddy/issues/11) |
| #31 | Shop modal — seed shop, fertilizer, items, and consumables | `backend, frontend` | 🔴 High | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/31) |
| #41 | Anti-cheat and bot detection — trust score system and fraud signals | `backend` | 🔴 High | Security | [#](https://github.com/dongprotocol/bandit-buddy/issues/41) |
| #50 | Claim \$FARM modal — wallet validation, amount input, signature display | `frontend` | 🔴 High | Economy | [#](https://github.com/dongprotocol/bandit-buddy/issues/50) |
| #12 | PancakeSwap V2 DEX swap UI — BNB/FARM/USDT routing | `frontend, smart-contract` | 🟡 Medium | Marketplace | [#](https://github.com/dongprotocol/bandit-buddy/issues/12) |
| #13 | Daily quest system — quest generation, tracking, and reward claim | `backend, frontend` | 🟡 Medium | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/13) |
| #14 | Notification system — in-app inbox and push via Telegram Bot API | `backend, frontend` | 🟡 Medium | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/14) |
| #29 | Viral referral system — invite link tracking and reward distribution | `backend, frontend` | 🟡 Medium | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/29) |
| #30 | Leaderboard system — weekly and all-time rankings by gold and trust score | `backend, frontend` | 🟡 Medium | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/30) |
| #36 | Weed and bug infestation mechanics — spread risk and penalty system | `backend, frontend` | 🟡 Medium | Core-game | [#](https://github.com/dongprotocol/bandit-buddy/issues/36) |
| #37 | Daily reward streak system — login bonuses and milestone rewards | `backend, frontend` | 🟡 Medium | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/37) |
| #38 | Explore / Raid Map — discover raidable farms with live crop data | `backend, frontend` | 🟡 Medium | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/38) |
| #42 | Harvest All and Plant All batch action buttons | `backend, frontend` | 🟡 Medium | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/42) |
| #48 | Attack mechanic — targeted farm sabotage with scarecrow defense item | `backend, frontend` | 🟡 Medium | Core-game | [#](https://github.com/dongprotocol/bandit-buddy/issues/48) |
| #55 | Fertilizer (crop boost) UI — select and apply to growing crops | `backend, frontend` | 🟡 Medium | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/55) |
| #34 | Achievement system — unlock badges and bonus rewards for milestones | `backend, frontend` | 🟢 Low | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/34) |
| #46 | Settings modal — sound, notifications, wallet info, account management | `backend, frontend` | 🟢 Low | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/46) |

## Sprint 3 — Smart Contracts & Blockchain Layer (Days 15–21)

| # | Task Title | Area | Priority | Epic | Link |
|:-:|-----------|------|:--------:|:----:|:----:|
| #15 | [SC] BanditMarket.sol — P2P NFT Marketplace with EIP-712 order book | `smart-contract` | 🔴 High | Marketplace | [#](https://github.com/dongprotocol/bandit-buddy/issues/15) |
| #16 | [SC] BanditDogFusion.sol — Guard Dog Gacha with Commit-Reveal Oracle RNG | `smart-contract` | 🔴 High | Gacha | [#](https://github.com/dongprotocol/bandit-buddy/issues/16) |
| #17 | [SC] TreasuryBuyBack.sol — auto buy-back and burn mechanism | `smart-contract` | 🔴 High | Treasury | [#](https://github.com/dongprotocol/bandit-buddy/issues/17) |
| #18 | Blockchain event indexer — startMarketplaceListener with fallback cronjob | `backend, infra` | 🔴 High | Blockchain-infra | [#](https://github.com/dongprotocol/bandit-buddy/issues/18) |
| #19 | Guard Dog Gacha UI — pull animation, tier reveal, pity tracker | `frontend` | 🔴 High | Gacha | [#](https://github.com/dongprotocol/bandit-buddy/issues/19) |
| #22 | Dedicated RPC provider setup with Ethers.js v6 fallback chain | `infra` | 🔴 High | Blockchain-infra | [#](https://github.com/dongprotocol/bandit-buddy/issues/22) |
| #52 | FarmToken.sol — ERC-20 with mint, burn, and claim gating | `smart-contract` | 🔴 High | Economy | [#](https://github.com/dongprotocol/bandit-buddy/issues/52) |
| #53 | Hardhat project setup — compile, test, deploy scripts for all contracts | `smart-contract, infra` | 🔴 High | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/53) |
| #20 | Marketplace UI — listing browser, buy flow, and my listings management | `frontend` | 🟡 Medium | Marketplace | [#](https://github.com/dongprotocol/bandit-buddy/issues/20) |
| #21 | Guild system — create/join guilds, World Tree, and contribution tracking | `backend, frontend` | 🟡 Medium | Guild | [#](https://github.com/dongprotocol/bandit-buddy/issues/21) |

## Sprint 4 — QA, Polish & MVP Launch (Days 22–30)

| # | Task Title | Area | Priority | Epic | Link |
|:-:|-----------|------|:--------:|:----:|:----:|
| #23 | Smart contract security audit — BanditMarket, BanditDogFusion, TreasuryBuyBack | `smart-contract` | 🔴 High | Security | [#](https://github.com/dongprotocol/bandit-buddy/issues/23) |
| #24 | BSC Mainnet deployment — FarmToken, BanditMarket, BanditDogFusion, TreasuryBuyBack | `smart-contract, infra` | 🔴 High | Security | [#](https://github.com/dongprotocol/bandit-buddy/issues/24) |
| #25 | End-to-end integration test suite — full game flow on BSC Testnet | `backend, smart-contract, infra` | 🔴 High | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/25) |
| #26 | Performance optimization — Phaser bundle, React lazy loading, API response times | `backend, frontend, infra` | 🔴 High | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/26) |
| #49 | Nginx + SSL production deployment — frontend CDN, backend reverse proxy | `infra` | 🔴 High | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/49) |
| #27 | NFT Guard Dog feeding subscription system | `backend, frontend` | 🟡 Medium | Core-game | [#](https://github.com/dongprotocol/bandit-buddy/issues/27) |
| #39 | Telegram Mini App polish — safe area, viewport, haptic feedback, back button | `frontend` | 🟡 Medium | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/39) |
| #28 | Seasonal events system — Halloween, Christmas, Lunar New Year crops | `backend, frontend` | 🟢 Low | Core-game | [#](https://github.com/dongprotocol/bandit-buddy/issues/28) |
| #51 | World Tree GvG — weekly guild war event with resource capture | `backend, frontend` | 🟢 Low | Guild | [#](https://github.com/dongprotocol/bandit-buddy/issues/51) |
| #54 | Admin dashboard — farm stats, user management, economy monitoring | `backend, frontend, infra` | 🟢 Low | - | [#](https://github.com/dongprotocol/bandit-buddy/issues/54) |
