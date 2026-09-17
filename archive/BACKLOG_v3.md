# Bandit Buddy — Product Backlog v3

**Repository:** https://github.com/flappybirdweb3/bandit-buddy
**Total Issues:** 59
**Export date:** 2026-09-10
**Tech Stack:** NestJS · PostgreSQL · Redis · Phaser 3 · React · Ethers.js v6 · BSC
**Audit Status:** v1 fix (5 issues) + v2 fix (4 issues updated) — Score 95/100

---

## Audit Changelog

| Audit | Score | Issues affected |
|-------|-------|-----------------|
| v1 (initial) | 85/100 | Created #36, #37, #38 (Sprint 2), #48, #49 (Sprint 3) |
| v2 (2026-09-10) | 95/100 | Updated #46, #49, #50, #51 — added GuildStaking.sol + $FARM routing |

### v2 Changes detail
- **#46 Hardhat Setup**: added `GuildStaking.sol` to compile/test/deploy list
- **#49 Premium Subscriptions**: added explicit `$FARM → TreasuryBuyBack.sol` routing (prevent token stranding)
- **#50 Security Audit**: added `GuildStaking.sol` to audit scope with 4 specific risk vectors
- **#51 Mainnet Deploy**: added deployment step #5 for `GuildStaking.sol`, multisig handover, indexer config

---

## Sprint Summary

| Sprint | Total | 🔴 High | 🟡 Medium | 🟢 Low |
|--------|:-----:|:-------:|:---------:|:------:|
| Sprint 1: Foundation & Core Infrastructure | 14 | 9 | 4 | 1 |
| Sprint 2: Core Game APIs & Economy Layer | 24 | 11 | 11 | 2 |
| Sprint 3: Smart Contracts & Blockchain Layer | 11 | 9 | 2 | 0 |
| Sprint 4: QA, Polish & MVP Launch | 10 | 5 | 2 | 3 |

---

## Sprint 1: Foundation & Core Infrastructure

| # | Task Title | Area | Priority | Epic |
|:-:|-----------|------|:--------:|:----:|
| [#1](https://github.com/flappybirdweb3/bandit-buddy/issues/1) | Set up NestJS monorepo with TypeScript, Docker, and CI/CD pipeline | `backend`, `infra` | 🔴 High | - |
| [#2](https://github.com/flappybirdweb3/bandit-buddy/issues/2) | PostgreSQL schema migrations (TypeORM) — all core tables | `backend` | 🔴 High | - |
| [#3](https://github.com/flappybirdweb3/bandit-buddy/issues/3) | Telegram initData JWT authentication middleware | `backend` | 🔴 High | - |
| [#4](https://github.com/flappybirdweb3/bandit-buddy/issues/4) | Phaser 3 MainFarmScene — plot grid, crop sprites, and animation system | `frontend` | 🔴 High | - |
| [#5](https://github.com/flappybirdweb3/bandit-buddy/issues/5) | React HUD, BottomBar, and EventBus integration layer | `frontend` | 🔴 High | - |
| [#6](https://github.com/flappybirdweb3/bandit-buddy/issues/6) | Redis caching layer and rate limiting (Throttler) | `backend`, `infra` | 🔴 High | - |
| [#7](https://github.com/flappybirdweb3/bandit-buddy/issues/7) | Energy regen system — 6-min tick, max cap, and regen timer UI | `backend`, `frontend` | 🔴 High | - |
| [#8](https://github.com/flappybirdweb3/bandit-buddy/issues/8) | Plot upgrade system — unlock additional plots and upgrade yield multiplier | `backend`, `frontend` | 🔴 High | - |
| [#9](https://github.com/flappybirdweb3/bandit-buddy/issues/9) | Wallet setup flow — auto-generate wallet or connect existing via WalletConnect | `backend`, `frontend` | 🔴 High | - |
| [#10](https://github.com/flappybirdweb3/bandit-buddy/issues/10) | Weather system — daily conditions affecting crop yields | `backend`, `frontend` | 🟡 Medium | core-game |
| [#11](https://github.com/flappybirdweb3/bandit-buddy/issues/11) | Friends bar — online friends panel with quick visit and steal status | `backend`, `frontend` | 🟡 Medium | - |
| [#12](https://github.com/flappybirdweb3/bandit-buddy/issues/12) | Tutorial overlay — first-time user guide with interactive steps | `frontend` | 🟡 Medium | - |
| [#13](https://github.com/flappybirdweb3/bandit-buddy/issues/13) | Level and XP system — trust score gating for seeds and features | `backend`, `frontend` | 🟡 Medium | - |
| [#14](https://github.com/flappybirdweb3/bandit-buddy/issues/14) | Sound system — SoundManager with Web Audio API unlock for iOS/Telegram | `frontend` | 🟢 Low | - |

## Sprint 2: Core Game APIs & Economy Layer

| # | Task Title | Area | Priority | Epic |
|:-:|-----------|------|:--------:|:----:|
| [#15](https://github.com/flappybirdweb3/bandit-buddy/issues/15) | Farm CRUD API — plant, harvest, dig, water, bug-spray, weed-kill | `backend` | 🔴 High | - |
| [#16](https://github.com/flappybirdweb3/bandit-buddy/issues/16) | STEAL endpoint — PostgreSQL transaction, guard dog defense, RNG outcome | `backend` | 🔴 High | - |
| [#17](https://github.com/flappybirdweb3/bandit-buddy/issues/17) | ECDSA claim signature — GOLD to $FARM on-chain redemption | `backend`, `smart-contract` | 🔴 High | economy |
| [#18](https://github.com/flappybirdweb3/bandit-buddy/issues/18) | GOLD↔$FARM dynamic exchange rate engine | `backend` | 🔴 High | economy |
| [#19](https://github.com/flappybirdweb3/bandit-buddy/issues/19) | P2P Marketplace backend — listing creation, EIP-712 off-chain orders | `backend` | 🔴 High | marketplace |
| [#20](https://github.com/flappybirdweb3/bandit-buddy/issues/20) | Shop modal — seed shop, fertilizer, items, and consumables | `backend`, `frontend` | 🔴 High | - |
| [#21](https://github.com/flappybirdweb3/bandit-buddy/issues/21) | Anti-cheat and bot detection — trust score system and fraud signals | `backend` | 🔴 High | security |
| [#22](https://github.com/flappybirdweb3/bandit-buddy/issues/22) | Claim $FARM modal — wallet validation, amount input, signature display | `frontend` | 🔴 High | economy |
| [#23](https://github.com/flappybirdweb3/bandit-buddy/issues/23) | PancakeSwap V2 DEX swap UI — BNB/FARM/USDT routing | `frontend`, `smart-contract` | 🟡 Medium | marketplace |
| [#24](https://github.com/flappybirdweb3/bandit-buddy/issues/24) | Daily quest system — quest generation, tracking, and reward claim | `backend`, `frontend` | 🟡 Medium | - |
| [#25](https://github.com/flappybirdweb3/bandit-buddy/issues/25) | Notification system — in-app inbox and push via Telegram Bot API | `backend`, `frontend` | 🟡 Medium | - |
| [#26](https://github.com/flappybirdweb3/bandit-buddy/issues/26) | Viral referral system — invite link, Magnifying Glass, Master Key mechanic | `backend`, `frontend` | 🟡 Medium | - |
| [#27](https://github.com/flappybirdweb3/bandit-buddy/issues/27) | Leaderboard system — weekly and all-time rankings | `backend`, `frontend` | 🟡 Medium | - |
| [#28](https://github.com/flappybirdweb3/bandit-buddy/issues/28) | Weed and bug infestation mechanics — spread risk and penalty system | `backend`, `frontend` | 🟡 Medium | core-game |
| [#29](https://github.com/flappybirdweb3/bandit-buddy/issues/29) | Daily reward streak system — login bonuses and milestone rewards | `backend`, `frontend` | 🟡 Medium | - |
| [#30](https://github.com/flappybirdweb3/bandit-buddy/issues/30) | Explore / Raid Map — discover raidable farms with live crop data | `backend`, `frontend` | 🟡 Medium | - |
| [#31](https://github.com/flappybirdweb3/bandit-buddy/issues/31) | Harvest All and Plant All batch action buttons | `backend`, `frontend` | 🟡 Medium | - |
| [#32](https://github.com/flappybirdweb3/bandit-buddy/issues/32) | Attack mechanic — targeted farm sabotage with scarecrow defense | `backend`, `frontend` | 🟡 Medium | core-game |
| [#33](https://github.com/flappybirdweb3/bandit-buddy/issues/33) | Fertilizer (crop boost) UI — select and apply to growing crops | `backend`, `frontend` | 🟡 Medium | - |
| [#34](https://github.com/flappybirdweb3/bandit-buddy/issues/34) | Achievement system — unlock badges and bonus rewards for milestones | `backend`, `frontend` | 🟢 Low | - |
| [#35](https://github.com/flappybirdweb3/bandit-buddy/issues/35) | Settings modal — sound, notifications, wallet info, account management | `backend`, `frontend` | 🟢 Low | - |
| [#36](https://github.com/flappybirdweb3/bandit-buddy/issues/36) | Farm Maintenance System — durability decay, repair cost, steal penalty ⭐ **AUDIT FIX v1** | `backend`, `frontend` | 🔴 High | core-game |
| [#37](https://github.com/flappybirdweb3/bandit-buddy/issues/37) | Soil Fertility Decay — -20% per harvest, fertilizer recovery mechanic ⭐ **AUDIT FIX v1** | `backend`, `frontend` | 🔴 High | core-game |
| [#38](https://github.com/flappybirdweb3/bandit-buddy/issues/38) | Revenge & Viral Mechanic — anonymous theft, Magnifying Glass, Master Key ⭐ **AUDIT FIX v1** | `backend`, `frontend` | 🔴 High | core-game |

## Sprint 3: Smart Contracts & Blockchain Layer

| # | Task Title | Area | Priority | Epic |
|:-:|-----------|------|:--------:|:----:|
| [#39](https://github.com/flappybirdweb3/bandit-buddy/issues/39) | [SC] BanditMarket.sol — P2P NFT Marketplace with EIP-712 order book | `smart-contract` | 🔴 High | marketplace |
| [#40](https://github.com/flappybirdweb3/bandit-buddy/issues/40) | [SC] BanditDogFusion.sol — Guard Dog Gacha with Commit-Reveal Oracle RNG | `smart-contract` | 🔴 High | gacha |
| [#41](https://github.com/flappybirdweb3/bandit-buddy/issues/41) | [SC] TreasuryBuyBack.sol — auto buy-back and burn mechanism | `smart-contract` | 🔴 High | treasury |
| [#42](https://github.com/flappybirdweb3/bandit-buddy/issues/42) | Blockchain event indexer — startMarketplaceListener with fallback cronjob | `backend`, `infra` | 🔴 High | blockchain-infra |
| [#43](https://github.com/flappybirdweb3/bandit-buddy/issues/43) | Guard Dog Gacha UI — pull animation, tier reveal, pity tracker | `frontend` | 🔴 High | gacha |
| [#44](https://github.com/flappybirdweb3/bandit-buddy/issues/44) | Dedicated RPC provider setup with Ethers.js v6 fallback chain | `infra` | 🔴 High | blockchain-infra |
| [#45](https://github.com/flappybirdweb3/bandit-buddy/issues/45) | FarmToken.sol — ERC-20 with mint, burn, and claim gating | `smart-contract` | 🔴 High | economy |
| [#46](https://github.com/flappybirdweb3/bandit-buddy/issues/46) | Hardhat project setup — compile, test, deploy scripts for all contracts 🔧 **AUDIT FIX v2 (GuildStaking.sol added)** | `smart-contract`, `infra` | 🔴 High | - |
| [#47](https://github.com/flappybirdweb3/bandit-buddy/issues/47) | Marketplace UI — listing browser, buy flow, and my listings management | `frontend` | 🟡 Medium | marketplace |
| [#48](https://github.com/flappybirdweb3/bandit-buddy/issues/48) | Guild system — create/join, Bang Tinh Anh tier, World Tree, harvest tax ⭐ **AUDIT FIX v1** 🔧 **AUDIT FIX v2 (GuildStaking.sol added)** | `backend`, `frontend` | 🟡 Medium | guild |
| [#49](https://github.com/flappybirdweb3/bandit-buddy/issues/49) | Premium Subscriptions — Butler auto-harvest and Crop Insurance ⭐ **AUDIT FIX v1** 🔧 **AUDIT FIX v2 ($FARM routing added)** | `backend`, `frontend` | 🔴 High | economy |

## Sprint 4: QA, Polish & MVP Launch

| # | Task Title | Area | Priority | Epic |
|:-:|-----------|------|:--------:|:----:|
| [#50](https://github.com/flappybirdweb3/bandit-buddy/issues/50) | Smart contract security audit — BanditMarket, BanditDogFusion, TreasuryBuyBack 🔧 **AUDIT FIX v2 (GuildStaking.sol added)** | `smart-contract` | 🔴 High | security |
| [#51](https://github.com/flappybirdweb3/bandit-buddy/issues/51) | BSC Mainnet deployment — FarmToken, BanditMarket, BanditDogFusion, TreasuryBuyBack 🔧 **AUDIT FIX v2 (GuildStaking.sol added)** | `smart-contract`, `infra` | 🔴 High | security |
| [#52](https://github.com/flappybirdweb3/bandit-buddy/issues/52) | End-to-end integration test suite — full game flow on BSC Testnet | `backend`, `smart-contract`, `infra` | 🔴 High | - |
| [#53](https://github.com/flappybirdweb3/bandit-buddy/issues/53) | Performance optimization — Phaser bundle, React lazy loading, API response times | `backend`, `frontend`, `infra` | 🔴 High | - |
| [#54](https://github.com/flappybirdweb3/bandit-buddy/issues/54) | Nginx + SSL production deployment — frontend CDN, backend reverse proxy | `infra` | 🔴 High | - |
| [#55](https://github.com/flappybirdweb3/bandit-buddy/issues/55) | NFT Guard Dog feeding subscription system | `backend`, `frontend` | 🟡 Medium | core-game |
| [#56](https://github.com/flappybirdweb3/bandit-buddy/issues/56) | Telegram Mini App polish — safe area, viewport, haptic feedback, back button | `frontend` | 🟡 Medium | - |
| [#57](https://github.com/flappybirdweb3/bandit-buddy/issues/57) | Seasonal events system — Halloween, Christmas, Lunar New Year crops | `backend`, `frontend` | 🟢 Low | core-game |
| [#58](https://github.com/flappybirdweb3/bandit-buddy/issues/58) | World Tree GvG — weekly guild war event with resource capture | `backend`, `frontend` | 🟢 Low | guild |
| [#59](https://github.com/flappybirdweb3/bandit-buddy/issues/59) | Admin dashboard — farm stats, user management, economy monitoring | `backend`, `frontend`, `infra` | 🟢 Low | - |
