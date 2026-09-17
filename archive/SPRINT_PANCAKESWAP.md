# Sprint Plan: PancakeSwap DEX Integration
**Project:** BanditBuddy Web3 Telegram Game  
**Prepared by:** Claude (AI PM)  
**Date:** 2026-09-11  
**Status:** PENDING TECH LEAD REVIEW — DO NOT START CODING UNTIL APPROVED

---

## Executive Summary

This sprint integrates $FARM token with PancakeSwap V2 DEX on BSC. Based on full codebase audit:

- `FarmToken.sol` (55 lines) is plain ERC20 — **zero tax logic exists**, requires full upgrade
- `TreasuryBuyBack.sol` (141 lines) **already has** PancakeSwap V2 router + buyback infrastructure — reuse interfaces
- `web3.service.ts` exchange rate uses treasury balance ratio only — **no DEX price oracle exists**
- No PancakeSwap price reading anywhere in backend codebase

**Sprint Goal:** Add fee-on-transfer dynamic tiered tax to $FARM, build live price oracle, wire kill switch, add "Get $FARM" UI.

---

## Tax Structure (confirmed per PRD)

| Tier | Condition (24h Volume) | Buy Tax | Sell Tax |
|------|------------------------|---------|----------|
| Tier 1 | New wallet / low volume | 3% | 5% |
| Tier 2 | Medium volume | 2% | 3% |
| Tier 3 | High volume / whale | 1% | 1.5% |

**Volume thresholds** (to be finalized by Tech Lead — suggest Tier 2 at ≥10,000 $FARM/24h, Tier 3 at ≥100,000 $FARM/24h)

**Tax-exempt whitelist:**
- Treasury wallet (`TREASURY_ADDRESS`)
- `BanditMarket.sol` (in-game marketplace)
- `BanditDogFusion.sol` (NFT minting)
- `FarmTokenClaim.sol` (claim contract)
- PancakeSwap LP pair address itself (auto-detected)

**Tax destination:** All collected $FARM tax → `treasuryBuybackPool` address (already has buyback logic in `TreasuryBuyBack.sol`)

---

## Tasks

---

### SC-1 — Upgrade FarmToken.sol: Fee-on-Transfer + Dynamic Tiered Tax
**Type:** Smart Contract  
**Estimate:** 5 days  
**Assignee:** Smart Contract Dev  
**Priority:** Critical (blocks SC-3, BE-4)

**Current state:** `FarmToken.sol` overrides `_update()` with only `whenNotPaused` check.

**Required changes:**

1. Add state variables:
```solidity
// Volume tracking
mapping(address => uint256) public userVolume24h;
mapping(address => uint256) public lastTradeTimestamp;

// Tier thresholds (owner-adjustable)
uint256 public tier2Volume = 10_000 * 1e18;   // 10,000 FARM
uint256 public tier3Volume = 100_000 * 1e18;  // 100,000 FARM

// Tax rates in basis points (100 = 1%)
uint16 public buyTax1 = 300;   // Tier 1: 3%
uint16 public buyTax2 = 200;   // Tier 2: 2%
uint16 public buyTax3 = 100;   // Tier 3: 1%
uint16 public sellTax1 = 500;  // Tier 1: 5%
uint16 public sellTax2 = 300;  // Tier 2: 3%
uint16 public sellTax3 = 150;  // Tier 3: 1.5%

// Destination
address public treasuryBuybackPool;

// PancakeSwap LP pair (set after pool creation)
address public pancakePair;

// Whitelist
mapping(address => bool) public isExcludedFromFee;
```

2. Add `_getTaxRate(address from, address to, uint256 amount) → uint256 taxAmount`:
   - Identify buy: `from == pancakePair`
   - Identify sell: `to == pancakePair`
   - If neither → no tax
   - Fetch current user volume, reset if `block.timestamp - lastTradeTimestamp[user] > 86400`
   - Determine tier from cumulative `userVolume24h`
   - Apply appropriate buy/sell rate
   - Update `userVolume24h[user] += amount`, `lastTradeTimestamp[user] = block.timestamp`

3. Override `_update(address from, address to, uint256 value)`:
   - Check `whenNotPaused` (preserve existing)
   - If `from` or `to` in `isExcludedFromFee` → call `super._update()` directly
   - Otherwise: compute tax, transfer `value - tax` to recipient, transfer `tax` to `treasuryBuybackPool`

4. Owner functions:
   - `setPancakePair(address pair)` — set after pool creation
   - `setTreasuryBuybackPool(address pool)`
   - `excludeFromFee(address account, bool excluded)`
   - `setTierThresholds(uint256 tier2, uint256 tier3)`
   - `setTaxRates(uint16 b1, uint16 b2, uint16 b3, uint16 s1, uint16 s2, uint16 s3)` — max 1000bps each

**Acceptance criteria:**
- [ ] Tier 1 wallet buying → 3% deducted, lands in treasury
- [ ] Same wallet accumulates volume → transitions to Tier 3 → only 1% deducted
- [ ] Volume resets after 24h → returns to Tier 1
- [ ] Transfer between two non-DEX wallets → 0% tax
- [ ] Whitelisted address → 0% tax regardless
- [ ] `whenNotPaused` still blocks all transfers when paused

**Risk:** Fee-on-transfer tokens can cause issues with contracts that expect exact transfer amounts. Ensure `BanditMarket.sol` and `FarmTokenClaim.sol` are on whitelist before deploying.

---

### SC-2 — New Contract: LiquidityLocker.sol
**Type:** Smart Contract  
**Estimate:** 2 days  
**Assignee:** Smart Contract Dev  
**Priority:** High (required before adding liquidity)

**Purpose:** Lock LP tokens after creating the $FARM/BNB pool to prevent rug-pull. Required for user trust.

**Spec:**

```solidity
contract LiquidityLocker is Ownable {
    struct LockRecord {
        address token;          // LP token address
        uint256 amount;
        uint256 unlockTime;     // block.timestamp + lockDuration
        address beneficiary;    // Treasury wallet
        bool withdrawn;
    }
    
    LockRecord[] public locks;
    
    function lockTokens(address lpToken, uint256 amount, uint256 durationSec) external onlyOwner
    function withdraw(uint256 lockId) external   // only after unlockTime, only beneficiary
    function getLock(uint256 id) external view returns (LockRecord memory)
    function getActiveLocks() external view returns (LockRecord[] memory)
}
```

**Parameters:**
- Lock duration: minimum 6 months (`15_552_000` seconds), recommended 12 months
- Beneficiary: Treasury multi-sig wallet
- Emit events: `TokensLocked(id, token, amount, unlockTime)`, `TokensWithdrawn(id, amount)`

**Acceptance criteria:**
- [ ] Cannot withdraw before `unlockTime`
- [ ] Only beneficiary can call `withdraw`
- [ ] Lock record marked `withdrawn = true` after claim (prevent double-withdraw)
- [ ] View functions return correct data for frontend display

---

### SC-3 — Hardhat Scripts + Test Suite
**Type:** DevOps / Testing  
**Estimate:** 3 days  
**Assignee:** Smart Contract Dev  
**Priority:** High (gates mainnet deploy)

**Deploy scripts to write:**

1. `scripts/deployFarmTokenV2.ts`:
   - Deploy upgraded `FarmToken.sol`
   - Set `treasuryBuybackPool` address
   - Exclude BanditMarket, BanditDogFusion, FarmTokenClaim, Treasury from fee
   - Verify on BscScan

2. `scripts/deployLiquidityLocker.ts`:
   - Deploy `LiquidityLocker.sol`
   - Verify on BscScan

3. `scripts/addLiquidityAndLock.ts`:
   - Approve PancakeRouter to spend $FARM
   - Call `addLiquidityETH(farmToken, farmAmount, farmMin, bnbMin, liquidityLocker, deadline)`
   - LP tokens land in `LiquidityLocker`
   - Call `liquidityLocker.lockTokens(lpToken, amount, 31_536_000)` (12 months)
   - Call `farmToken.setPancakePair(pairAddress)` — enable tax routing

4. `scripts/postDeployWhitelist.ts`:
   - Batch-exclude all in-game contracts from fee after deploy
   - Parameterized from `.env` addresses

**Unit tests (Hardhat + ethers):**

- `test/FarmToken.tax.test.ts`:
  - [ ] Non-DEX transfer → 0% tax
  - [ ] DEX buy at Tier 1 → exactly 3% deducted, treasury receives 3%
  - [ ] DEX sell at Tier 1 → exactly 5% deducted
  - [ ] Volume accumulation → tier upgrade → reduced tax
  - [ ] 24h timestamp reset → volume clears → back to Tier 1
  - [ ] Whitelisted buyer → 0% tax
  - [ ] Paused → all transfers revert

- `test/LiquidityLocker.test.ts`:
  - [ ] Lock tokens
  - [ ] Early withdraw reverts
  - [ ] Withdraw after unlock succeeds
  - [ ] Double withdraw reverts

---

### BE-1 — DEX Price Oracle: PancakeSwap Pair Price Cron
**Type:** Backend (NestJS)  
**Estimate:** 2 days  
**Assignee:** Backend Dev  
**Priority:** Critical (blocks BE-2, BE-3)

**Current state:** `web3.service.ts` → `syncExchangeRate()` runs every 5 min, reads treasury balance ratio. NO DEX price.

**New module:** `src/modules/web3/dex-oracle.service.ts`

**Implementation:**

```typescript
// Cron: every 3 minutes
@Cron('0 */3 * * * *')
async syncDexPrice(): Promise<void> {
  // 1. Get pair contract address from PancakeFactory
  //    factory.getPair(FARM_TOKEN_ADDRESS, WBNB_ADDRESS)
  
  // 2. Call pair.getReserves() → [reserve0, reserve1, blockTimestampLast]
  //    Determine which reserve is FARM vs WBNB by comparing token addresses
  
  // 3. Calculate price:
  //    priceInBnb = reserveWBNB / reserveFARM   (FARM price in BNB)
  //    Get BNB/USD from Chainlink or CoinGecko API as secondary
  //    priceInUsd = priceInBnb * bnbUsdPrice
  
  // 4. Store in Redis:
  //    SET dex:farm:price:bnb <value> EX 300      (5 min TTL)
  //    SET dex:farm:price:usd <value> EX 300
  //    RPUSH dex:farm:price:history <timestamp:price> (keep last 10 readings = 30min)
  //    LTRIM dex:farm:price:history 0 9
  
  // 5. Trigger kill switch check (BE-2)
}
```

**Required env vars:**
```env
PANCAKE_FACTORY_ADDRESS=0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73  # BSC Mainnet V2
PANCAKE_ROUTER_ADDRESS=0x10ED43C718714eb63d5aA57B78B54704E256024E
WBNB_ADDRESS=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
FARM_TOKEN_ADDRESS=<deployed address>
CHAINLINK_BNB_USD=0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE  # BSC Mainnet
```

**Acceptance criteria:**
- [ ] Redis `dex:farm:price:bnb` updated every 3 min
- [ ] Price history array maintained (last 10 readings)
- [ ] Handles pair not yet deployed (pool not yet created): logs warning, skips
- [ ] Handles RPC timeout gracefully (retry once, then skip cycle)
- [ ] Logs price on each successful sync (info level)

---

### BE-2 — Kill Switch: Price Volatility Guard
**Type:** Backend (NestJS)  
**Estimate:** 1.5 days  
**Assignee:** Backend Dev  
**Priority:** High (anti-manipulation)  
**Depends on:** BE-1

**Spec:**

Called by BE-1 after each price update.

```typescript
async checkKillSwitch(): Promise<void> {
  // 1. Read last 10 price history entries from Redis
  // 2. Find oldest entry within last 5 minutes
  // 3. Compute % change: (currentPrice - oldestPrice5min) / oldestPrice5min * 100
  // 4. If abs(change) > 15%:
  //    SET kill_switch:active "1" EX 1800     (auto-expire after 30 min)
  //    SET kill_switch:reason "<direction> <pct>% in 5min" EX 1800
  //    Log: warn('Kill switch ACTIVATED: $FARM price moved X% in 5 min')
  // 5. If change <= 15% AND kill switch was active:
  //    DEL kill_switch:active
  //    Log: info('Kill switch DEACTIVATED: price stabilized')
}
```

**Wire into existing conversion endpoint** (`/web3/exchange-rate` or `/web3/claim-signature`):

```typescript
// In web3.service.ts — before processing GOLD→FARM claim:
const killSwitchActive = await this.redis.get('kill_switch:active');
if (killSwitchActive) {
  throw new ServiceUnavailableException(
    'Conversion temporarily paused due to high market volatility. Try again in 30 minutes.'
  );
}
```

**Admin override:** `POST /admin/kill-switch/toggle { active: boolean }` — manual enable/disable for treasury team.

**Acceptance criteria:**
- [ ] Price moves >15% in 5 min → kill switch activates → GOLD→FARM claims rejected with clear error
- [ ] Price stabilizes → kill switch auto-deactivates after 30 min
- [ ] Admin can manually toggle kill switch
- [ ] Kill switch state visible on admin dashboard (BE-5)

---

### BE-3 — Update Exchange Rate: Use DEX Price for Dynamic Peg
**Type:** Backend (NestJS)  
**Estimate:** 1.5 days  
**Assignee:** Backend Dev  
**Priority:** Medium  
**Depends on:** BE-1

**Current state:** `syncExchangeRate()` in `web3.service.ts` calculates rate as `goldCirculating / farmInTreasury`. Does NOT use DEX price.

**Required change:**

When DEX pair exists and price is available:
- Read `dex:farm:price:usd` from Redis
- Compute `goldToFarmRate = GOLD_PEG_USD / farmPriceUsd` (e.g., if 1 GOLD = $0.001 and FARM = $0.01 → rate = 0.1 FARM per GOLD)
- Store as `cachedRate` (existing field, same Redis key)
- If DEX price unavailable (pool not created, RPC error): fall back to treasury ratio (existing logic)

**New field in `GET /web3/exchange-rate` response:**
```json
{
  "rate": 0.1,
  "farmPriceUsd": 0.01,
  "farmPriceBnb": 0.000005,
  "source": "dex",         // "dex" | "treasury_ratio"
  "inflationWarning": false,
  "killSwitchActive": false,
  "updatedAt": "2026-09-11T10:00:00Z"
}
```

**Acceptance criteria:**
- [ ] When pool exists: rate derived from DEX price
- [ ] When pool doesn't exist / RPC error: falls back to treasury ratio, `source: "treasury_ratio"`
- [ ] `killSwitchActive` field exposed in response
- [ ] `inflationWarning` threshold recalibrated for DEX-based rate

---

### BE-4 — Swap Event Indexer: Sync Volume to DB
**Type:** Backend (NestJS)  
**Estimate:** 3 days  
**Assignee:** Backend Dev  
**Priority:** Medium (required for FE-2 tier display)  
**Depends on:** BE-1 (need pair address)

**Purpose:** Smart contract tracks `userVolume24h` on-chain, but it costs gas to read for every user on every page load. The indexer keeps a synced copy in Redis/PostgreSQL for fast display.

**Implementation options (discuss with Tech Lead):**

Option A — Event Listener (preferred):
- Listen to PancakeSwap pair `Swap(sender, amount0In, amount1In, amount0Out, amount1Out, to)` events via `ethers.provider.on(filter, handler)`
- For each swap: compute FARM amount (from amount0In/Out depending on token ordering)
- Map `sender` address → lookup user in DB by `wallet_address`
- Update `dex_volume` in Redis: `INCRBY dex:vol:24h:{walletAddr} {amount}` (TTL 86400s)

Option B — Polling (simpler, higher RPC cost):
- Cron every 5 min: `pair.queryFilter(pair.filters.Swap(), fromBlock, latestBlock)`
- Process events, same logic as Option A

**New DB table (migration required):**
```sql
CREATE TABLE dex_trade_volume (
  wallet_address VARCHAR(42) PRIMARY KEY,
  volume_24h DECIMAL(30, 18) NOT NULL DEFAULT 0,
  last_trade_at TIMESTAMP,
  tier INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**New endpoint:**
```
GET /web3/dex-tier
Response: { walletAddress: string; volume24h: number; tier: 1|2|3; buyTax: number; sellTax: number }
```

Reads from Redis first (fast), falls back to DB.

**Acceptance criteria:**
- [ ] Swap events processed within 1 minute of occurring
- [ ] Redis cache updated per wallet address
- [ ] Tier computed correctly from volume thresholds
- [ ] API returns correct tier/tax info for linked wallet
- [ ] Handles wallets not linked to any game user (just skip)

---

### BE-5 — Admin Dashboard: DEX Metrics Panel
**Type:** Backend (NestJS)  
**Estimate:** 1 day  
**Assignee:** Backend Dev  
**Priority:** Low  
**Depends on:** BE-1, BE-2

**New endpoint:** `GET /admin/dex-status`

```json
{
  "farmPriceUsd": 0.01,
  "farmPriceBnb": 0.000005,
  "priceSource": "dex",
  "lastPriceUpdate": "2026-09-11T10:00:00Z",
  "killSwitchActive": false,
  "killSwitchReason": null,
  "treasuryFarmBalance": 5000000,
  "treasuryBnbBalance": 12.5,
  "totalTaxCollected24h": 1250.5,
  "lpLockExpiry": "2027-09-11T00:00:00Z",
  "lpTokensLocked": 1000000
}
```

**Treasury tax balance tracking:**
- Listen to `Transfer` events TO `treasuryBuybackPool` where `from == pancakePair`
- Accumulate in Redis key `treasury:tax:collected:24h` with rolling 24h window
- Store lifetime total in DB

**Acceptance criteria:**
- [ ] Endpoint returns all fields above
- [ ] `killSwitchActive` matches Redis state
- [ ] `totalTaxCollected24h` accurate to within one sync cycle
- [ ] Only accessible to admin role

---

### FE-1 — "Get $FARM" Popup with Deep Link
**Type:** Frontend (React/TypeScript)  
**Estimate:** 2 days  
**Assignee:** Frontend Dev  
**Priority:** High (core UX requirement per PRD)

**Trigger points:**
- Button in NFT mint modal (when user has insufficient $FARM)
- Button in ClaimModal withdraw tab header
- Optionally: Profile screen wallet section

**New component:** `src/components/modals/GetFarmModal.tsx`

**UI spec:**

```
┌─────────────────────────────────┐
│  Get $FARM Token                │
│  ───────────────────────────── │
│                                 │
│  Live Price                     │
│  $0.0100 USD / 0.000005 BNB    │
│  [source: PancakeSwap DEX]      │
│                                 │
│  Your Balance: 250 $FARM        │
│                                 │
│  ┌──────────────────────────┐   │
│  │  Your Current Tax Tier   │   │
│  │  ⭐ Tier 2 — Medium Trader│   │
│  │  Buy: 2% · Sell: 3%      │   │
│  │  24h Volume: 12,500 FARM │   │
│  └──────────────────────────┘   │
│                                 │
│  [Buy $FARM on PancakeSwap]     │  ← deep link
│                                 │
│  How to buy:                    │
│  1. Open TrustWallet/MetaMask   │
│  2. Switch to BSC Mainnet       │
│  3. Swap BNB → $FARM            │
│  Contract: 0x...xxxx [copy]     │
│                                 │
└─────────────────────────────────┘
```

**Deep link format:**
```
https://pancakeswap.finance/swap?outputCurrency={FARM_TOKEN_ADDRESS}&inputCurrency=BNB
```

In Telegram Mini App context: use `WebApp.openLink(url)` to open in external browser.

**Data sources:**
- `GET /web3/exchange-rate` → `farmPriceUsd`, `farmPriceBnb`
- `GET /web3/dex-tier` → `tier`, `buyTax`, `sellTax`, `volume24h`
- `GET /user/profile` → FARM balance (existing)

**Acceptance criteria:**
- [ ] Live price displayed with last update timestamp
- [ ] User's current tier and tax rates shown
- [ ] Deep link opens PancakeSwap swap page with $FARM pre-selected
- [ ] Contract address copyable
- [ ] Falls back gracefully if DEX price unavailable ("Price loading…")
- [ ] Accessible from ClaimModal and NFT mint modal

---

### FE-2 — Tax Tier Badge in Profile / ClaimModal
**Type:** Frontend (React/TypeScript)  
**Estimate:** 1 day  
**Assignee:** Frontend Dev  
**Priority:** Low  
**Depends on:** BE-4, FE-1

**Add to ClaimModal withdraw tab:**

Below wallet address, add a small badge:
```
🏅 Tier 2 · Buy 2% / Sell 3%  [Trade more to reach Tier 3 →]
```

**Add to user profile (if profile screen exists):**
- DEX trading tier badge
- 24h volume traded
- Tax rate at current tier

**Acceptance criteria:**
- [ ] Badge shows correct tier (1/2/3)
- [ ] Badge shows correct tax rates for that tier
- [ ] Clicking badge opens GetFarmModal (FE-1) for context
- [ ] If wallet not linked → badge hidden

---

## Sprint Summary

| ID | Name | Type | Estimate | Priority | Depends On |
|----|------|------|----------|----------|------------|
| SC-1 | Upgrade FarmToken.sol: Dynamic Tax | Smart Contract | 5d | Critical | - |
| SC-2 | New LiquidityLocker.sol | Smart Contract | 2d | High | - |
| SC-3 | Hardhat Scripts + Test Suite | DevOps/Test | 3d | High | SC-1, SC-2 |
| BE-1 | DEX Price Oracle Cron | Backend | 2d | Critical | SC-1 deployed |
| BE-2 | Kill Switch: Volatility Guard | Backend | 1.5d | High | BE-1 |
| BE-3 | Exchange Rate: Use DEX Price | Backend | 1.5d | Medium | BE-1 |
| BE-4 | Swap Event Indexer: Volume Sync | Backend | 3d | Medium | BE-1 |
| BE-5 | Admin Dashboard: DEX Metrics | Backend | 1d | Low | BE-1, BE-2 |
| FE-1 | "Get $FARM" Popup + Deep Link | Frontend | 2d | High | BE-1, BE-3 |
| FE-2 | Tax Tier Badge in UI | Frontend | 1d | Low | BE-4, FE-1 |

**Total estimate:** ~22 developer-days

**Critical path:** SC-1 → SC-3 (testnet deploy) → BE-1 → BE-2 + BE-3 → FE-1

---

## Open Questions for Tech Lead Review

1. **Volume tier thresholds:** Tier 2 at ≥10,000 FARM/24h and Tier 3 at ≥100,000 FARM/24h — confirm or adjust?
2. **Gas optimization for on-chain volume tracking:** Storing `userVolume24h` on-chain costs gas on every DEX swap. Alternative: use Backend Indexer (BE-4) as source of truth and remove on-chain mapping. Which approach?
3. **BE-4 Option A vs B:** Event listener (real-time, more complex) vs polling cron (simpler, +5min delay). Prefer which?
4. **Kill switch auto-re-enable:** Currently 30-min auto-expire. Should it require manual admin re-enable instead?
5. **LP lock duration:** 6 months or 12 months?
6. **FarmToken upgrade strategy:** Deploy new contract (users need to migrate token) or use proxy upgrade pattern (OpenZeppelin Upgradeable)? Major decision — existing FarmToken is non-upgradeable.
7. **Testnet vs Mainnet:** Will SC-1 be deployed to BSC Testnet first for validation before mainnet?
8. **Tax exempt wallet list:** Confirm all contract addresses that need whitelisting before SC-1 goes live.

---

## Pre-requisites (must complete before sprint starts)

- [ ] Tech Lead reviews and approves this document
- [ ] Volume tier thresholds confirmed (Q1)
- [ ] On-chain vs off-chain volume tracking decision made (Q2)
- [ ] FarmToken upgrade strategy decided (Q6)
- [ ] BSC Mainnet or Testnet confirmed for initial deploy (Q7)
- [ ] All contract addresses for whitelist gathered and documented

---

*DO NOT START CODING UNTIL USER/TECH LEAD APPROVES THIS DOCUMENT*
