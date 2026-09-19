# Bandit Buddy — Master Financial & Fee-Routing Audit Report
**Classification:** Confidential — For Independent Auditors & QA/QC Team Only
**Code Freeze Date:** 2026-09-19
**Prepared by:** Principal Web3 System Architect / Tech Lead

---

## Executive Summary

Bandit Buddy ($FARM) implements a fully deflationary tokenomics model with three independent burn/sink pipelines:

1. **BNB Revenue Engine** — Game fees collected in BNB → TreasuryBuyBack vault → Auto-buyback $FARM → DEAD address burn
2. **USDT Conversion Pipeline** — FARM→USDT cashout 1% tax → Vault → Batch USDT→BNB → Feeds Pipeline 1
3. **$FARM Direct Sinks** — Gacha/Fusion/Tokenize/DEX-Tax burn FARM via ERC20 `burn()` or DEAD address send

All three pipelines converge on the same permanent deflation destination: `0x000000000000000000000000000000000000dEaD`.

---

## PILLAR 1 — BNB Revenue Engine & Auto-Buyback

### 1.1 BNB Collection Points (All Routes Into Vault)

| User Action | Contract | Function | BNB Amount | Routing |
|---|---|---|---|---|
| Golden Lucky Pull | BanditDogFusion | `commitGolden()` | 0.002 BNB | 75% → Vault, 15% → Referral, 10% → Jackpot |
| Mega Bulk Pull x10 | BanditDogFusion | `commitBulk10()` | 0.015 BNB | 75% → Vault, 15% → Referral, 10% → Jackpot |
| Forge Insurance T1→T2 | BanditDogFusion | `requestFusion()` | 0.002 BNB | 75% → Vault, 15% → Referral, 10% → Jackpot |
| Forge Insurance T2→T3 | BanditDogFusion | `requestFusion()` | 0.004 BNB | 75% → Vault, 15% → Referral, 10% → Jackpot |
| Forge Insurance T3→T4 | BanditDogFusion | `requestFusion()` | 0.008 BNB | 75% → Vault, 15% → Referral, 10% → Jackpot |
| Forge Insurance T4→T5 | BanditDogFusion | `requestFusion()` | 0.015 BNB | 75% → Vault, 15% → Referral, 10% → Jackpot |
| Tokenize Dog (x1) | BanditDogFusion | `tokenizeDog()` | 0.002 BNB | 100% → Vault |
| Tokenize Dog (x3 bulk) | BanditDogFusion | `tokenizeDog()` | 0.005 BNB | 100% → Vault |
| Subscription 7-Day | BarnServices | `purchasePremiumSubscription(1)` | 0.005 BNB | 100% → Vault |
| Subscription 30-Day | BarnServices | `purchasePremiumSubscription(2)` | 0.015 BNB | 100% → Vault |
| P2P BNB Transfer | WalletGateway | `routeBNBTransfer()` | 0.3% of transfer | fee → Vault, net → recipient |
| NFT Marketplace (BNB) | BanditMarket | `buyNFTWithBNB()` | 3% of sale price | 3% fee → Vault, 97% → seller |

### 1.2 BNB Revenue Distribution Logic (BanditDogFusion internal)

```
function _routeBnbRevenue(uint256 totalBnb, address referrer) internal:

  vaultShare   = totalBnb * 7500 / 10000  (75%)
  refShare     = totalBnb * 1500 / 10000  (15%)
  jackpotShare = totalBnb - vaultShare - refShare  (10%)

  if (referrer == address(0)):
    vaultShare += refShare  → vault gets 90%

  treasuryAddress.call{value: vaultShare}("")  → TreasuryBuyBack
  referralBalances[referrer] += refShare        → claimable by referrer
  jackpotPoolBnb += jackpotShare                → in-contract jackpot
```

### 1.3 Auto-Buyback & Burn Mechanism

```
TRIGGER: TreasuryMonitorService (NestJS) — Cron every 1 minute

Step 1: provider.getBalance(treasuryAddress)
Step 2: if (bnbBalance >= buyBackThreshold [2.0 BNB]):
          call POST /api/web3/treasury-trigger
          → treasuryMonitor.checkAndExecuteBuyBack()

Step 3: On-chain: TreasuryBuyBack.triggerBuyBack()
          bnbToSpend = address(this).balance
          _executeSwapAndBurn(bnbToSpend, 0)

Step 4: _executeSwapAndBurn():
          path = [WBNB, FARM]
          quote = PancakeRouter.getAmountsOut(bnbToSpend, path)
          effectiveMinOut = quote[1] * (10000 - slippageBps[600]) / 10000
          PancakeRouter.swapExactETHForTokensSupportingFeeOnTransferTokens(
            effectiveMinOut, path, DEAD_ADDRESS, deadline
          )
          farmBurned = FARM.balanceOf(DEAD_ADDRESS) - deadBalBefore
          totalBurned += farmBurned
          emit BuyBackAndBurned(bnbToSpend, farmBurned)
```

**Critical Detail:** `swapExactETHForTokensSupportingFeeOnTransferTokens` MUST be used (not `swapExactETHForTokens`) because FarmToken has dynamic fee-on-transfer tax. FARM goes directly to DEAD_ADDRESS in the swap — never lands in the contract.

---

## PILLAR 2 — USDT Integration & Batch Conversion

### 2.1 USDT Collection Source

| User Action | Contract | Function | USDT Collected | Routing |
|---|---|---|---|---|
| FARM → USDT Cashout (SA ADR-01) | WalletGateway | `cashoutFarmToUSDT()` | 1% of gross USDT received | fee → TreasuryBuyBack USDT balance |

### 2.2 FARM → USDT Cashout Flow (Atomic, Anti-Bypass)

```
User calls: WalletGateway.cashoutFarmToUSDT(farmAmount, minUsdtOut)

1. FARM pulled from user → WalletGateway
2. Approve PancakeRouter to spend FARM (forceApprove resets stale allowance)
3. Swap: FARM → WBNB → USDT (path length 3, via PancakeRouter V2)
   MUST use swapExactTokensForTokensSupportingFeeOnTransferTokens
   (FARM has fee-on-transfer tax)
4. usdtReceived = USDT.balanceOf(gateway) AFTER - BEFORE (balance delta)
5. fee = usdtReceived * 100 / 10000  (1%)
   netUsdt = usdtReceived - fee
6. fee → TreasuryBuyBack (USDT accumulates there)
7. netUsdt → user
emit FarmCashedOut(seller, farmIn, usdtReceived, fee, netUsdt)
```

**Why atomic:** Prevents client-side bypass where user could split approve+swap+tax into separate txs and skip the fee (SA ADR-01 Option B mandatory).

### 2.3 USDT → BNB Batch Conversion

```
TRIGGER: TreasuryMonitorService — same 1-minute cron

Check: USDT.balanceOf(treasuryAddress) >= usdtConversionThreshold [$50 USDT]

If triggered:
  TreasuryBuyBack.convertUSDTtoBNB(minBnbOut)
    path = [USDT, WBNB]
    usdtToken.forceApprove(pancakeRouter, usdtBalance)
    PancakeRouter.swapExactTokensForETH(usdtBalance, minBnbOut, path, address(this), deadline)
    bnbReceived = address(this).balance AFTER - BEFORE
    totalUsdtConverted += usdtBalance
    emit USDTConvertedToBNB(usdtBalance, bnbReceived)

Result: BNB balance in TreasuryBuyBack increases → accelerates 2.0 BNB buyback threshold
```

**Sandwich Protection:** `minBnbOut` is computed off-chain by TreasuryMonitorService using `PancakeRouter.getAmountsOut([USDT, WBNB]) × 98%`. `convertUSDTtoBNB` is `onlyOwner` — only admin/backend can call, preventing permissionless sandwich.

---

## PILLAR 3 — $FARM Direct Fee Sinks & Direct Burns

### 3.1 ERC20 `burn()` Path (Reduces totalSupply)

| User Action | Contract | Function | FARM Cost | Mechanism |
|---|---|---|---|---|
| Regular Gacha Pull | BanditDogFusion | `commit()` + `reveal()` | 50 FARM | `_burn(50 FARM)` at commit |
| Golden Lucky Pull | BanditDogFusion | `commitGolden()` + `reveal()` | 50 FARM | `_burn(50 FARM)` at commit |
| Mega Bulk x10 Pull | BanditDogFusion | `commitBulk10()` + `reveal()` | 450 FARM | `_burn(450 FARM)` at commit |
| Fusion T1→T2 (base) | BanditDogFusion | `requestFusion()` | 20 FARM | `_burn()` at resolution |
| Fusion T2→T3 (base) | BanditDogFusion | `requestFusion()` | 80 FARM | `_burn()` at resolution |
| Fusion T3→T4 (base) | BanditDogFusion | `requestFusion()` | 250 FARM | `_burn()` at resolution |
| Fusion T4→T5 (base) | BanditDogFusion | `requestFusion()` | 800 FARM | `_burn()` at resolution |
| Fusion + Lucky Bone | BanditDogFusion | `requestFusion()` | base + 50 FARM | `_burn()` |
| Fusion + Collar | BanditDogFusion | `requestFusion()` | base + 150 FARM | `_burn()` |
| Fusion (Divine Insurance, commit) | BanditDogFusion | `_commitPull()` | 50% of cost | `_burn(cost/2)` immediately |
| Fusion (Divine Insurance, fail) | BanditDogFusion | `resolveFusion()` | remaining 50% | `_burn(remainingCost)` |
| Fusion (Divine Insurance, success) | BanditDogFusion | `resolveFusion()` | 50% refunded | no additional burn |
| Tokenize Dog (x1) | BanditDogFusion | `tokenizeDog()` | 15 FARM | `_burn(15 FARM)` |
| Tokenize Dog (x3 bulk) | BanditDogFusion | `tokenizeDog()` | 40 FARM | `_burn(40 FARM)` |
| Shard Redeem (100 shards) | BanditDogFusion | `redeemShards()` | 100 Soul Shards (ERC1155) | `burnShard()` — NFT burn, not FARM |

**Internal `_burn()` implementation:**
```solidity
function _burn(uint256 amount) internal {
    IBurnable(address(farmToken)).burn(amount);  // calls FarmToken.burn() → reduces totalSupply
}
```

### 3.2 DEAD Address Path (totalSupply unchanged, balance locked forever)

| Source | Contract | Function | FARM Amount | Destination |
|---|---|---|---|---|
| DEX Tax → manual burn | TreasuryBuyBack | `burnHeldFarm()` | All FARM held in Vault | `safeTransfer(DEAD_ADDRESS)` |
| P2P FARM Transfer fee | WalletGateway | `routeTokenTransfer()` | 0.3% of transfer | `safeTransfer(DEAD_ADDRESS)` |
| Auto-Buyback BNB→FARM | TreasuryBuyBack | `_executeSwapAndBurn()` | Variable (swapped from BNB) | Swap destination = DEAD_ADDRESS directly |

### 3.3 DEX Transfer Tax Flow (FarmToken.sol)

**Tax applies only on PancakeSwap pair transactions** (not wallet-to-wallet):

| Tier | Requirement | Buy Tax | Sell Tax | Destination |
|---|---|---|---|---|
| Tier 1 | < 10,000 FARM held | 3% | 5% | `treasuryBuybackPool` |
| Tier 2 | 10,000 - 49,999 FARM | 2% | 3% | `treasuryBuybackPool` |
| Tier 3 | ≥ 50,000 FARM | 1% | 1.5% | `treasuryBuybackPool` |

**Hard cap:** 5% (500 BPS) — prevents Honeypot flag on TokenSniffer.

DEX Tax FARM sits in `treasuryBuybackPool` (TreasuryBuyBack contract) as spendable balance. It is NOT immediately burned. Two paths to eventual burn:
- Manual: owner calls `burnHeldFarm()` → DEAD_ADDRESS
- Organic: accumulates BNB from other sources → hits 2.0 BNB threshold → buyback → DEAD_ADDRESS (tax FARM stays as pending, not double-counted)

### 3.4 NFT Marketplace Fees ($FARM denominated)

| Sale Type | Contract | Fee | Destination |
|---|---|---|---|
| NFT Sale (FARM) | BanditMarket | 5% of priceFarm | `treasury` (TreasuryBuyBack vault — NOT burned directly) |
| NFT Sale (BNB) | BanditMarket | 3% of priceBNB | `treasury` (TreasuryBuyBack vault) |

**Note:** Marketplace FARM fees go to the treasury vault, NOT burned. They accumulate until `burnHeldFarm()` is called.

---

## Off-Chain GOLD Economy Burns (NestJS Backend)

These are server-authoritative burns tracked in `gold_transactions` table. GOLD is an off-chain credit (not a token) that converts to $FARM via CLAIM_WITHDRAW.

| Category | Trigger | Tracked Since |
|---|---|---|
| `SEED_PURCHASE` | Plant crops via action.service | Launch |
| `SHOP_PURCHASE` | Buy items from shop via shop.service | Launch |
| `CLAIM_WITHDRAW` | Convert GOLD → $FARM (generates signed claim) | Launch |
| `DOG_FEED` | Feed guard dog via web3.service | Launch |
| `PLOT_UNLOCK` | Buy new farm plot via farm.service | 2026-09-19 |
| `PLOT_UPGRADE` | Upgrade plot level via farm.service | 2026-09-19 |
| `GUILD_SHIELD` | Purchase guild energy shield via guild.service | 2026-09-19 |
| `GUILD_STAKE` | Stake GOLD into guild via guild.service | 2026-09-19 |
| `BUTLER_OPEX` | Butler auto-fix bugs/weeds/watering via guild.service | 2026-09-19 |
| `BUTLER_REPLANT` | Butler auto-plant seeds via guild.service | 2026-09-19 |

**Economy Oracle** (`economy-oracle.service.ts`) syncs 24h burn/mint totals hourly → computes `alpha` multiplier (0.5–1.5) → adjusts dynamic GOLD→FARM withdrawal rate.

**`totalGoldConverted`** — cumulative GOLD burned via CLAIM_WITHDRAW exposed on `/api/web3/treasury-status` for public vault transparency.

---

## Master Flowchart — Complete Money Routing

```
USER ACTIONS
     │
     ├─[BNB Payment]──────────────────────────────────────────────────────┐
     │   • Golden Pull (0.002 BNB)                                        │
     │   • Bulk x10 (0.015 BNB)                                           │
     │   • Forge Insurance (0.002–0.015 BNB)                              │
     │   • Tokenize Dog (0.002 / 0.005 BNB)                               │
     │   • Subscription 7d/30d (0.005 / 0.015 BNB)                        │
     │   • NFT Marketplace BNB (3% of sale)                               │
     │   • P2P BNB via WalletGateway (0.3% fee)                           │
     │                                                                     │
     │  BanditDogFusion._routeBnbRevenue():                               │
     │    75% ──────────────────────────────────────────────► TreasuryBuyBack.sol
     │    15% ──────────────────────────► referralBalances[]  (claimable)
     │    10% ──────────────────────────► jackpotPoolBnb (in-contract)
     │                                                         │
     │  BarnServices / WalletGateway / BanditMarket BNB:      │
     │    100% / fee ──────────────────────────────────────► TreasuryBuyBack.sol
     │                                                         │
     │                                        BNB accumulates in vault
     │                                              │
     │                              [BNB >= 2.0 BNB threshold]
     │                                              │
     │                                   triggerBuyBack() [cron 1min]
     │                                              │
     │                              PancakeSwap: BNB → $FARM
     │                              Swap TO = 0x000...dEaD ──────────► 🔥 DEAD ADDRESS
     │
     ├─[FARM→USDT Cashout]────────────────────────────────────────────────┐
     │   WalletGateway.cashoutFarmToUSDT(farmAmt, minUsdt)               │
     │     FARM → PancakeSwap → USDT                                      │
     │     1% of USDT → TreasuryBuyBack (USDT balance)                    │
     │     99% USDT → user                                                │
     │                                                                     │
     │                              [USDT >= $50 threshold]               │
     │                                              │                      │
     │                              convertUSDTtoBNB() [cron 1min]        │
     │                                              │                      │
     │                              PancakeSwap: USDT → BNB               │
     │                              BNB added to Vault ──► feeds Pipeline 1
     │
     ├─[$FARM Direct Burns]───────────────────────────────────────────────┐
     │   ERC20 burn() path (reduces totalSupply):                         │
     │   • Gacha commit: 50 FARM ──────────────────────────────► 🔥 BURN()
     │   • Bulk x10 commit: 450 FARM ──────────────────────────► 🔥 BURN()
     │   • Fusion T1-T4: 20/80/250/800 FARM ───────────────────► 🔥 BURN()
     │   • Fusion boosters: +50/+150 FARM ─────────────────────► 🔥 BURN()
     │   • Tokenize Dog: 15/40 FARM ───────────────────────────► 🔥 BURN()
     │                                                                     │
     │   DEAD Address path (locked forever):                              │
     │   • P2P FARM fee (WalletGateway): 0.3% ─────────────────► 0x...dEaD
     │   • burnHeldFarm() (manual): DEX tax FARM ──────────────► 0x...dEaD
     │   • Auto-buyback BNB→FARM swap target ──────────────────► 0x...dEaD
     │
     └─[DEX Transfer Tax (FarmToken.sol)]────────────────────────────────┐
         • Buy T1/T2/T3: 3%/2%/1% ──────────────────► treasuryBuybackPool
         • Sell T1/T2/T3: 5%/3%/1.5% ───────────────► treasuryBuybackPool
                                                               │
                              FARM accumulates in TreasuryBuyBack
                                              │
                              Manual: burnHeldFarm() ────────► 0x...dEaD 🔥
                              or: Waits for BNB buyback cycle (FARM stays pending)
```

---

## Smart Contract Function Matrix

### BanditDogFusion.sol

| Function | Visibility | FARM In | BNB In | BNB Route | FARM Burn | Notes |
|---|---|---|---|---|---|---|
| `commit(bytes32)` | external | 50 FARM | 0 | — | YES `_burn(50)` | Regular gacha, no BNB |
| `commitGolden(bytes32,address)` | external payable | 50 FARM | ≥0.002 BNB | _routeBnbRevenue | YES `_burn(50)` | Golden + referral |
| `commitBulk10(bytes32,address)` | external payable | 450 FARM | ≥0.015 BNB | _routeBnbRevenue | YES `_burn(450)` | Mega pull, 10% discount |
| `reveal(bytes32)` | external | — | — | — | — | Reveals commit result |
| `requestFusion(uint256,bool,bool)` | external | variable | 0 | — | YES on resolution | Base + booster cost |
| `requestFusion(uint256,bool,bool,bool,address)` | external payable | variable | ≥forgeInsuranceFee | _routeBnbRevenue | YES | With Divine Insurance |
| `resolveFusion(uint256,bool,uint256)` | external | — | — | — | YES (remaining) | Oracle callback |
| `tokenizeDog(uint256,uint256,bytes)` | external payable | 15 or 40 FARM | 0.002 or 0.005 BNB | 100% → Vault | YES `_burn()` | Backend signature required |
| `redeemShards()` / `redeemShards(uint256)` | external | — | — | — | NO | Burns Soul Shards (ERC1155), mints dog NFT |
| `claimReferralBnb()` | external | — | — | — | — | Pull-payment for referrers |
| `_routeBnbRevenue(uint256,address)` | internal | — | totalBnb | 75%/15%/10% split | — | BNB split logic |
| `_burn(uint256)` | internal | amount | — | — | YES → FARM.burn() | Reduces totalSupply |

### TreasuryBuyBack.sol

| Function | Visibility | Caller | Purpose | Reentrancy Guard |
|---|---|---|---|---|
| `receive()` | external payable | Any contract | Accept BNB from game fees | — |
| `triggerBuyBack()` | external | Anyone (when BNB≥threshold) | Auto-buyback + burn | YES |
| `executeBuyBack(uint256,uint256)` | external | onlyOwner | Manual buyback with slippage floor | YES |
| `_executeSwapAndBurn(uint256,uint256)` | internal | — | PancakeSwap BNB→FARM→DEAD | — |
| `convertUSDTtoBNB(uint256)` | external | onlyOwner | Batch USDT→BNB conversion | YES |
| `burnHeldFarm()` | external | onlyOwner | Burn FARM held in contract | YES |
| `setBuyBackThreshold(uint256)` | external | onlyOwner | Update 2.0 BNB threshold | — |
| `setSlippage(uint256)` | external | onlyOwner | Update slippage BPS (max 10%) | — |
| `setUsdtConversionThreshold(uint256)` | external | onlyOwner | Update $50 USDT threshold | — |
| `recoverERC20(address,uint256)` | external | onlyOwner | Emergency token recovery (not FARM/USDT) | — |
| `recoverBNB(uint256)` | external | onlyOwner | Emergency BNB recovery | YES |
| `pause()/unpause()` | external | onlyOwner | Kill switch | — |

### WalletGateway.sol

| Function | Visibility | Fee | FARM Fee Dest | BNB Fee Dest | Notes |
|---|---|---|---|---|---|
| `routeBNBTransfer(address)` | external payable | 0.3% of msg.value | — | TreasuryBuyBack | P2P BNB transfer |
| `routeTokenTransfer(address,address,uint256)` | external | 0.3% of amount | DEAD_ADDRESS (if FARM) / Vault (others) | — | FARM fee = instant burn |
| `cashoutFarmToUSDT(uint256,uint256)` | external | 1% of USDT received | — | — (USDT fee→Vault) | Atomic SA ADR-01 |
| `setFeeBps(uint256)` | external | — | — | — | Max 100 BPS (1%) |
| `receive()` | external payable | — | — | 100% → Vault | Fallback forward |

### FarmToken.sol

| Function | Visibility | Purpose | Restriction |
|---|---|---|---|
| `_update(from,to,value)` | internal override | Fee-on-transfer tax logic | whenNotPaused |
| `getTierOf(address)` | public view | Returns tier 1/2/3 by balance | — |
| `setPancakePair(address)` | external | Set DEX pair for tax trigger | onlyOwner |
| `setTreasuryBuybackPool(address)` | external | Set tax destination | onlyOwner |
| `excludeFromFee(address,bool)` | external | Whitelist contracts from tax | onlyOwner |
| `setTierThresholds(uint256,uint256)` | external | Adjust tier2/tier3 balance thresholds | onlyOwner |
| `setTaxRates(uint16×6)` | external | Update all 6 tax rates | onlyOwner, max 500 BPS |
| `pause()/unpause()` | external | Emergency pause all transfers | onlyOwner |
| `burn(uint256)` | public | ERC20Burnable burn | msg.sender balance |

### BarnServices.sol

| Function | Visibility | BNB | Destination | Notes |
|---|---|---|---|---|
| `purchasePremiumSubscription(uint8)` | external payable | 0.005 (7d) / 0.015 (30d) BNB | 100% → TreasuryBuyBack | Extends stackable |
| `setSubscriptionConfig(uint8,uint256,uint256)` | external | — | — | onlyOwner |
| `setTreasury(address)` | external | — | — | onlyOwner |

### BanditMarket.sol

| Function | Visibility | Fee | Destination | Notes |
|---|---|---|---|---|
| `buyNFT(NFTOrder,bytes)` | external | 5% FARM | treasury (Vault) | EIP-712 signed order |
| `buyNFTWithBNB(NFTOrderBNB,bytes)` | external payable | 3% BNB | treasury (Vault) | BNB NFT trades |

---

## QA/QC Edge-Case Checklist

### Section A — Smart Contract Security

#### A1. Reentrancy
- [ ] **TreasuryBuyBack.triggerBuyBack()**: `nonReentrant` guard present. Verify FARM swap uses `_executeSwapAndBurn` which writes `totalBurned += farmBurned` AFTER the external call (CEI pattern check needed — slippage calc reads state before external call, written after).
- [ ] **WalletGateway.cashoutFarmToUSDT()**: `nonReentrant` guard present. Verify USDT balance delta (`usdtBefore`) cannot be manipulated by malicious token callback.
- [ ] **BanditDogFusion._routeBnbRevenue()**: calls `treasuryAddress.call{value: vaultShare}("")` — no reentrancy guard on this internal function. Verify outer functions (`commitGolden`, `requestFusion`) have `nonReentrant`.
- [ ] **BanditMarket.buyNFTWithBNB()**: Verify BNB sent to seller before fee transfer (CEI pattern).

#### A2. Slippage & Sandwich Attacks
- [ ] **TreasuryBuyBack.triggerBuyBack()**: Uses on-chain `getAmountsOut()` as quote → `(quote[1] * (10000 - slippageBps)) / 10000`. **RISK**: On-chain quote can be sandwiched between quote read and swap execution in same block. Auditor should verify `slippageBps = 600` (6%) provides adequate protection at current liquidity depth.
- [ ] **TreasuryBuyBack.convertUSDTtoBNB()**: `minBnbOut` is computed OFF-CHAIN by TreasuryMonitorService. Verify backend uses `getAmountsOut([USDT,WBNB]) × 98%` (2% slippage protection, not 0).
- [ ] **WalletGateway.cashoutFarmToUSDT()**: `minUsdtOut` is required non-zero (enforced by `revert ZeroAmount()`). Frontend must compute via `getAmountsOut × 98%`.

#### A3. Access Control
- [ ] **TreasuryBuyBack.convertUSDTtoBNB()**: `onlyOwner` — backend wallet is the admin. Verify admin private key (`SIGNER_PRIVATE_KEY`) is in HSM/Vault, never in env files committed to git.
- [ ] **BanditDogFusion.resolveFusion()**: `onlyOwner` or `backendSigner` — check who can resolve fusion. Oracle compromise = theft of FARM burns.
- [ ] **FarmToken.excludeFromFee()**: `onlyOwner`. Verify no malicious addresses are whitelisted.
- [ ] **FarmToken.setPancakePair()**: `onlyOwner`. Incorrectly set pair = tax on wrong address.

#### A4. Arithmetic & Rounding
- [ ] **BanditDogFusion.fusionFees**: mapping values — verify T4→T5: 800 FARM is not exploitable (high cost = attacker motivation to find cheaper path).
- [ ] **FarmToken tax calculation**: `(value * rate) / 10000` — integer division truncation favors the user (user gets slightly more than expected). Verify no tax manipulation via dust amounts.
- [ ] **TreasuryBuyBack.totalBurned**: Incremented AFTER swap. If swap reverts, `totalBurned` unchanged. Correct.

#### A5. Commit-Reveal Randomness (BanditDogFusion)
- [ ] **commit()**: `commitment = keccak256(secret, user)`. Verify frontrunning resistance — secret not revealed until `reveal()`.
- [ ] **reveal()**: Uses `block.prevrandao` + `blockhash(block.number - 1)` for randomness. **KNOWN LIMITATION**: Validators on BSC have some influence over `prevrandao`. For a production-grade audit, verify this is acceptable risk given low payout values.
- [ ] **MIN_REVEAL_BLOCKS**: Minimum blocks between commit and reveal enforced. Verify value prevents same-block manipulation.
- [ ] **REVEAL_WINDOW**: Maximum blocks — expired commits should be refundable. Verify refund path exists.

#### A6. Nonce Idempotency
- [ ] **tokenizeDog()**: `usedTokenizeNonces[nonceKey]` — verify nonce key is unique per `(address, nonce)` pair.
- [ ] **redeemShards(uint256,uint256,bytes)**: `usedRedeemNonces[nonceKey]` — same check.
- [ ] **FarmTokenClaim**: Backend generates signed nonce from `users.nonce` (DB column). Verify `user.nonce` incremented atomically in SAME transaction as gold deduction. Replay attack vector: nonce must be invalidated ON-CHAIN after successful claim.

#### A7. Kill Switch / Pause
- [ ] **BanditDogFusion**: `whenNotPaused` on all user-facing functions. Verify `pause()` is onlyOwner.
- [ ] **TreasuryBuyBack**: `whenNotPaused` on `triggerBuyBack()` and `convertUSDTtoBNB()`. Verify pause blocks new buybacks but `recoverBNB` still works.
- [ ] **FarmToken**: `whenNotPaused` in `_update()` — pausing token HALTS ALL TRANSFERS. Verify deployment uses multisig for this power.
- [ ] **Backend kill switch**: `economy-oracle.service.ts` has `killSwitchActive` flag. Verify it blocks CLAIM_WITHDRAW when FARM price volatility > 15%.

---

### Section B — Backend (NestJS) Logic

#### B1. Race Conditions & Double-Spend
- [ ] **Harvest + Claim**: Both endpoints use `FOR UPDATE` pessimistic lock on `users` row. Verify no path bypasses the lock.
- [ ] **Steal action**: `SELECT * FROM farm_plots WHERE id = plotId FOR UPDATE` — verify row-level lock covers the 20% steal cap check.
- [ ] **Gold deduction + gold_transactions INSERT**: All 10 BURN categories verified to be inside same DB transaction (atomic with deduct). Auditor should verify via code review of farm.service.ts:321, farm.service.ts:367, guild.service.ts:544, guild.service.ts:695, guild.service.ts:863, guild.service.ts:917.

#### B2. Signature Verification (Backend → Chain)
- [ ] **generateClaimSignature()**: `ethers.solidityPackedKeccak256(["address","uint256","uint256","uint256"], [walletAddress, amountWei, nonce, chainId])` — verify domain separation. Chain ID must match deployment network.
- [ ] **tokenizeDog signature**: Backend signs `(userAddress, count, nonce)`. Verify same data is checked on-chain in `tokenizeDog()`.
- [ ] **redeemShards signature**: Backend signs `("redeem", userAddress, count, nonce)`. Verify prefix prevents cross-function replay.

#### B3. Economy Oracle Integrity
- [ ] **Alpha formula**: `rawRatio = goldBurned24h / goldMinted24h`, clamped to [0.5, 1.5]. Verify clamping prevents extreme deflation/inflation events from crashing the withdrawal rate.
- [ ] **goldBurned24h** now includes all 10 BURN categories (verified 2026-09-19 audit). Verify no new gold sinks are added to the codebase without adding the corresponding `gold_transactions` INSERT.
- [ ] **Redis cache TTL**: Economy stats cached. If Redis is wiped, service falls back to DB query. Verify fallback works correctly.

#### B4. Withdrawal Rate & Quota
- [ ] **`WITHDRAW_FEE = 5%`**: User burns `goldAmount` GOLD, receives `goldAmount / rate / 1.05` FARM. Verify fee is not double-counted.
- [ ] **Daily cashout quota**: Per-user and global limits tracked in Redis with 48h TTL. Verify quota cannot be reset by key expiry attack.
- [ ] **Kill switch on claim**: `killSwitchActive` in dynamic rates — verify blocks `generateClaimSignature()` when active.

---

### Section C — Frontend / UX Security

#### C1. Wallet Address Consistency
- [ ] **useActiveWallet hook**: Scans ALL localStorage pk slots, returns pk that derives `profile.walletAddress`. Verify no modal falls back to a different pk slot silently.
- [ ] **WalletLocked state**: If pk on device signs wrong address, `walletLocked = true` → all transactions disabled. Verify user cannot bypass locked state by importing a different key.

#### C2. Signature Flows
- [ ] **Claim flow (ClaimModal)**: Signs `buildClaimDigest(chainId, claimContract, walletAddress, amountWei, nonce)` client-side with private key. **SECURITY**: Private key never leaves device. Verify no logging of pk in console or network requests.
- [ ] **Tokenize / Redeem flow**: User approves FARM spend to `BanditDogFusion` contract. Verify approval amount is exact (not `MAX_UINT256`) to limit exposure.

#### C3. slippage in Frontend
- [ ] **cashoutFarmToUSDT()**: Frontend must pass `minUsdtOut = getAmountsOut × 0.98` — verify hardcoded 2% floor, not user-settable to 0.
- [ ] **Gacha commit**: No slippage (FARM burn is deterministic). No issue.

---

### Section D — Deployment Checklist

| Item | Required State | Verified |
|---|---|---|
| `FarmToken.setPancakePair(pair)` | Set to deployed FARM/WBNB pair address | [ ] |
| `FarmToken.setTreasuryBuybackPool(treasury)` | Set to TreasuryBuyBack address | [ ] |
| `FarmToken.excludeFromFee(treasury, true)` | Vault excluded from DEX tax | [ ] |
| `FarmToken.excludeFromFee(claimContract, true)` | Claim contract excluded | [ ] |
| `FarmToken.excludeFromFee(gachaContract, true)` | Gacha excluded (burns internal) | [ ] |
| `TreasuryBuyBack.usdtConversionThreshold` | = 50e18 ($50 USDT) | [ ] |
| `TreasuryBuyBack.buyBackThreshold` | = 2 ether (2 BNB) | [ ] |
| `TreasuryBuyBack.slippageBps` | = 600 (6%) | [ ] |
| `BanditDogFusion.treasuryAddress` | = TreasuryBuyBack address | [ ] |
| `BanditDogFusion.backendSigner` | = admin wallet (HSM) | [ ] |
| `WalletGateway.treasuryVault` | = TreasuryBuyBack address | [ ] |
| `BarnServices.treasury` | = TreasuryBuyBack address | [ ] |
| `BanditMarket.treasury` | = TreasuryBuyBack address | [ ] |
| `SIGNER_PRIVATE_KEY` in .env | Not committed to git | [ ] |
| `.env.example` has placeholder values only | All real values = `your_*_here` | [ ] |

---

## Known Limitations / Accepted Risks

1. **`block.prevrandao` randomness**: Gacha reveal uses on-chain pseudo-randomness. BSC validators have limited influence. Acceptable for cosmetic NFTs with capped value, not acceptable for financial instruments. Mitigated by Commit-Reveal pattern (requires 2 separate blocks).

2. **DEX Tax in TreasuryBuyBack not immediately burned**: Accumulates as spendable FARM in vault. Admin must call `burnHeldFarm()` periodically. Risk: if admin key is compromised, accumulated FARM could be recovered via `recoverERC20` — but this is blocked by `require(token != address(farmToken))`. ✓ Protected.

3. **triggerBuyBack() open to anyone**: Public function, no access control. Anyone can trigger buyback when threshold is met. This is intentional (decentralized trigger). Risk: griefing via multiple calls is blocked by `nonReentrant`. ✓ Protected.

4. **Jackpot BNB in BanditDogFusion contract**: 10% of BNB fees accumulate as `jackpotPoolBnb`. Only distributed via `JackpotTriggered` event (Tier 5/6 NFT win). No explicit withdrawal function found in public ABI — auditor should verify jackpot cannot be stuck permanently.

5. **USDT path assumption**: USDT→WBNB→BNB swap assumes USDT/WBNB pair exists with adequate liquidity on deployed network. On testnet, this pair may be illiquid. Production deployment must verify pair exists before setting USDT threshold.

---

*End of Report — Total Contracts Audited: 6 | Total Backend Modules Audited: 8 | Total Fee Mechanisms Documented: 24*
