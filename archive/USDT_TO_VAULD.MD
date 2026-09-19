# USDT INTEGRATION AUDIT — Feature Inventory, GAP Analysis & Implementation Roadmap

**Document:** `USDT_TO_VAULD.MD`  
**Status:** ⏳ AWAITING SA + OWNER REVIEW — DO NOT IMPLEMENT UNTIL APPROVED  
**Prepared by:** Engineering Team  
**Date:** 2026-09-18  
**Scope:** All USDT-related features across Smart Contracts, Backend, and Frontend

---

## 0. Context & Purpose

This document audits **every touchpoint where USDT is involved** in the BarnBuddy system, cross-references against the SA specifications in `USDT_TO_VAULD.MD` (archived conversation) and `PRD_REMAINING_FEATURES_SA_SPECIFICATION_REPORT.MD`, and produces a **full GAP table + implementation spec** for each missing piece.

The SA's core design intent:

> *"Dồn toàn bộ lực lượng (kể cả USDT) về thành BNB để bơm cây nến xanh cho $FARM."*  
> — SA architectural directive, `USDT_TO_VAULD.MD`

---

## 1. USDT Contract Addresses (All Networks)

| Token | Mainnet (BSC) | Testnet (BSC) |
|-------|--------------|---------------|
| USDT (BEP-20) | `0x55d398326f99059fF775485246999027B3197955` | `0x337610d27c682E347C9cD60BD4b3b107C9d34dDd` |
| Decimals | 18 | 18 |
| Standard | ERC-20 / BEP-20 | ERC-20 / BEP-20 |

> **Note:** BSC USDT uses **18 decimals** (unlike Ethereum USDT which uses 6). All on-chain math must use `parseUnits(amount, 18)`.

---

## 2. Complete USDT Feature Inventory — Current State

### 2.1 Smart Contracts

| ID | Contract | USDT Role | Implementation | Status |
|----|----------|-----------|---------------|--------|
| SC-U-01 | `FarmTokenSale.sol` | Presale payment currency (Angel/Private/Public rounds) | `usdt.safeTransferFrom(buyer → treasury)`. Three rounds: $0.001/$0.0025/$0.005 per FARM, min $10–$500, max $2K–$20K per wallet | ✅ Live |
| SC-U-02 | `WalletGateway.sol` | P2P USDT transfer fee routing | `routeTokenTransfer(USDT, to, amount)` → 0.3% fee routed to `TreasuryBuyBack.sol` (not DEAD, since USDT ≠ $FARM) | ✅ Live |
| SC-U-03 | `TreasuryBuyBack.sol` | USDT accumulation + batch conversion to BNB | **NO USDT functions exist.** Contract only handles BNB. `recoverERC20()` exists but is admin-rescue only, not automated. | ❌ MISSING |
| SC-U-04 | `BanditMarket.sol` | USDT as marketplace payment currency | Platform collects 3% fee but only on BNB payments. USDT marketplace payments not implemented. | ❌ NOT PLANNED |

### 2.2 Backend (NestJS)

| ID | Service | USDT Role | Implementation | Status |
|----|---------|-----------|---------------|--------|
| BE-U-01 | `DexOracleService` | $FARM/USDT price oracle (24h % change) | `getAmountsOut([FARM, WBNB, USDT])` every 3 min via PancakeSwap. Used by `EconomyOracleService`. | ✅ Live |
| BE-U-02 | `TreasuryMonitorService` | USDT vault balance monitoring + auto-convert trigger | **Only monitors BNB balance.** No USDT balance check. No `convertUSDTtoBNB()` call. Cron runs every 10 min but USDT-blind. | ❌ MISSING |
| BE-U-03 | `Web3Service` / `ClaimService` | USDT in claim/cashout flow | Not applicable — claims are in $FARM. | N/A |

### 2.3 Frontend (React / Viem)

| ID | Component / Hook | USDT Role | Implementation | Status |
|----|-----------------|-----------|---------------|--------|
| FE-U-01 | `useMPCWallet.ts` | USDT balance read (on-chain) | `publicClient.readContract(USDT_TOKEN_ADDRESS, balanceOf)` in `balancesQuery`. Exposed as `usdtBalance`, `usdtFormatted`, `usdtValueUsd`. | ✅ Live |
| FE-U-02 | `WalletDashboardModal.tsx` | USDT portfolio card display | Renders USDT balance, USD equivalent, 24h badge (+0.01%). `openSend('USDT')` hooks into SendModal. | ✅ Live |
| FE-U-03 | `SendModal.tsx` | Send USDT to external address | Calls `sendUsdt()` → `WalletGateway.routeTokenTransfer(USDT, recipient, amount)` → 0.3% fee to Treasury. Validates BNB gas reserve. | ✅ Live |
| FE-U-04 | `usePancakeSwap.ts` | USDT→FARM swap (buy direction) | 2-step: (1) check/approve USDT allowance for PancakeSwap Router, (2) `swapExactTokensForTokensSupportingFeeOnTransferTokens([USDT→WBNB→FARM])`. **0% gateway fee (correct per SA)**. | ✅ Live |
| FE-U-05 | `usePancakeSwap.ts` | FARM→USDT swap (cashout direction) | `swapExactTokensForTokensSupportingFeeOnTransferTokens([FARM→WBNB→USDT])`. USDT lands directly in user wallet. **No 1% cashout tax deducted. Fee goes to 0%.** | ⚠️ Incomplete |
| FE-U-06 | `MarketplaceModal.tsx` | USDT/FARM pair toggle in swap widget | UI toggle `[BNB] | [USDT]` rendering, buy/sell tax badge, USDT balance display. Delegates to `usePancakeSwap`. | ✅ Live |
| FE-U-07 | `ClaimModal.tsx` | USDT/FARM pair toggle in claim modal | Same as FE-U-06 — toggle + swap widget integrated. | ✅ Live |
| FE-U-08 | `SwapResultModal.tsx` | USDT balance after swap in receipt | Displays `usdtBalanceAfter` on success receipt. | ✅ Live |
| FE-U-09 | `WalletDashboardModal.tsx` | DEX liquidity info card (FARM/USDT) | Static info card showing USDT pair address, description. No action. | ✅ Live |
| FE-U-10 | Presale UI (FarmTokenSale) | Buy $FARM with USDT via presale contract | **No UI exists.** `FarmTokenSale.sol` is live on-chain. Frontend has no modal to interact with it. | ❌ MISSING |

---

## 3. SA Architecture Specification Review

Source: `USDT_TO_VAULD.MD` (archived SA conversation) + `PRD_REMAINING_FEATURES_SA_SPECIFICATION_REPORT.MD`

### 3.1 SA Design Principle: "Batch Conversion Strategy"

```
User does FARM→USDT cashout
        ↓
    1% of USDT output
    ↓                  ↓
99% to user    1% to TreasuryBuyBack.sol (accumulates)
                        ↓
                Cronjob: if Vault USDT ≥ $50
                        ↓
                convertUSDTtoBNB()
                [USDT → WBNB via PancakeSwap]
                        ↓
                BNB stays in TreasuryBuyBack.sol
                        ↓
                Faster approach to 2.0 BNB threshold
                        ↓
                Auto BuyBack & Burn $FARM → 0xdEaD
```

### 3.2 SA Fee Policy (Asymmetric by Direction)

| Swap Direction | Gateway Fee | Fee Token | Fee Destination | SA Intent |
|---------------|-------------|-----------|----------------|-----------|
| USDT → FARM (Buy) | **0%** | — | — | Maximize inflow, attract USDT |
| FARM → USDT (Sell/Cashout) | **1%** | USDT | TreasuryBuyBack.sol | Capture exit tax, fuel BNB accumulation |
| USDT → External (Send) | **0.3%** | USDT | TreasuryBuyBack.sol | Already implemented in WalletGateway |
| FARM → External (Send) | **0.3%** | FARM → DEAD | Dead address (burn) | Already implemented in WalletGateway |
| BNB → External (Send) | **0.3%** | BNB | TreasuryBuyBack.sol | Already implemented in WalletGateway |

### 3.3 SA Smart Contract Specification (TreasuryBuyBack.sol upgrade)

```solidity
// New state variables:
IERC20 public usdtToken;
uint256 public usdtConversionThreshold = 50 * 1e18; // $50 USDT

// New function:
function convertUSDTtoBNB() external nonReentrant whenNotPaused onlyKeeper {
    uint256 usdtBal = usdtToken.balanceOf(address(this));
    require(usdtBal >= usdtConversionThreshold, "Below threshold");

    usdtToken.approve(pancakeRouter, usdtBal);

    address[] memory path = new address[](2);
    path[0] = address(usdtToken);
    path[1] = wbnb;

    // amountOutMin = live oracle price * 99% (1% slippage protection)
    IPancakeRouter(pancakeRouter).swapExactTokensForETH(
        usdtBal,
        amountOutMin,      // must be calculated, NOT 0 (sandwich protection)
        path,
        address(this),     // BNB stays in vault
        block.timestamp + 300
    );
    emit USDTConvertedToBNB(usdtBal, address(this).balance);
}

// New event:
event USDTConvertedToBNB(uint256 usdtAmount, uint256 newBnbBalance);
```

### 3.4 SA Backend Specification (NestJS Cronjob)

```typescript
// In TreasuryMonitorService — extend existing @Cron('*/10 * * * *'):
const USDT_ABI = ['function balanceOf(address) view returns (uint256)'];
const CONVERT_ABI = ['function convertUSDTtoBNB() external'];
const USDT_THRESHOLD = ethers.parseEther('50'); // $50

const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
const usdtBalance = await usdtContract.balanceOf(treasuryAddress);

if (usdtBalance >= USDT_THRESHOLD) {
    const treasury = new ethers.Contract(treasuryAddress, CONVERT_ABI, wallet);
    await treasury.convertUSDTtoBNB();
    this.logger.log(`[Treasury] Converted ${ethers.formatEther(usdtBalance)} USDT → BNB`);
}
```

### 3.5 SA Frontend Specification (FARM→USDT Cashout Tax)

After FARM→USDT swap confirms, frontend executes additional transaction:

```typescript
// In usePancakeSwap.ts — after FARM_TO_USDT swap receipt:
const usdtReceived = /* read from event log or re-query balance delta */;
const cashoutFee = (usdtReceived * 100n) / 10000n; // 1% of USDT output

if (cashoutFee > 0n) {
  // Transfer 1% USDT fee to TreasuryBuyBack.sol
  await walletClient.writeContract({
    address: USDT_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [TREASURY_BUYBACK_ADDRESS, cashoutFee],
  });
}
```

> **Architecture Note:** The SA specifies a "wrapper" approach at the frontend level. This is client-side and technically bypassable by a determined user who calls PancakeSwap directly. For a stronger enforcement, the fee should be captured in a smart contract wrapper. This trade-off is listed in Section 5.

---

## 4. GAP Analysis Table

| GAP ID | Layer | Missing Feature | SA Reference | Revenue Impact | Priority |
|--------|-------|-----------------|-------------|----------------|----------|
| **GAP-01** | SC | `convertUSDTtoBNB()` in `TreasuryBuyBack.sol` | SA Task 1 | HIGH — USDT cannot be converted to BNB to fuel buyback without this | P0 |
| **GAP-02** | BE | USDT vault monitoring + `convertUSDTtoBNB()` trigger in `TreasuryMonitorService` | SA Task 3 | HIGH — Even with SC ready, no automation | P0 |
| **GAP-03** | FE | 1% cashout tax deduction on FARM→USDT swap | SA Task 2 | MEDIUM — Current: 100% of USDT goes to user, 0% to Treasury. Revenue leakage on every sell. | P1 |
| **GAP-04** | FE | In-app presale UI for `FarmTokenSale.sol` | PRD (implicit) | MEDIUM — SC deployed but inaccessible to users in-app | P2 |
| **GAP-05** | SC | Anti-sandwich `amountOutMin` for `convertUSDTtoBNB()` | SA Task 1 (security note) | HIGH security risk if `amountOutMin = 0` | P0 (blocker for GAP-01) |
| **GAP-06** | SC | `setUsdtConversionThreshold()` admin setter in TreasuryBuyBack | SA Task 1 | LOW — Threshold hardcoded, needs governance flexibility | P2 |

---

## 5. Architecture Decision Points — Requires SA Sign-off

### ADR-01: FARM→USDT Cashout Fee Enforcement Level

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A — Frontend-only** (SA's current spec) | FE calculates 1%, sends separate `USDT.transfer(treasury, fee)` after swap | Fast to implement, 2 user-visible txns | Bypassable: user can call PancakeSwap directly and skip the fee |
| **B — Smart Contract Wrapper** | New `routeSwapAndCaptureFee(uint256 farmIn, uint256 minUSDTOut)` in `WalletGateway.sol`. Contract does swap via PancakeSwap + captures fee atomically | Trustless, cannot be bypassed | Requires SC upgrade + new Hardhat tests + re-audit |
| **C — Hybrid** | Frontend enforces by default; SC wrapper for large amounts (>$100) | Covers most cases | Complex UX state machine |

**Recommendation:** Option B for production security. Option A acceptable for testnet/MVP.

### ADR-02: USDT Cashout Fee Rate — 1% vs 0.3%

- SA specification says **1%** for FARM→USDT cashout (explicit)
- WalletGateway currently charges **0.3%** for USDT P2P transfers
- Question: Should cashout be at **1% (SA spec)** or align with WalletGateway's **0.3%**?

**SA's stated rationale:** "Chiều Bán (FARM → USDT): Đây là hành vi xả (Cashout). Áp dụng 1% phí Gateway" — 1% is intentionally higher to disincentivize exits.

**Recommendation:** Use **1%** as specified. These are two different economic actions: P2P transfer (0.3%) vs DEX cashout (1%).

### ADR-03: `amountOutMin` for `convertUSDTtoBNB()` in TreasuryBuyBack

**The SA prompt says:** *"ensure strict Slippage limits (amountOutMin) are either dynamically calculated or safely handled"*

Options:
- **A — On-chain oracle:** Use PancakeSwap's `getAmountsOut([USDT, WBNB])` to calculate live price, then apply 2% slippage tolerance.
- **B — Backend-calculated:** Backend calls `getAmountsOut` before calling `convertUSDTtoBNB(amount, minOut)` and passes `minOut` as parameter.
- **C — Fixed haircut:** Hardcode `amountOutMin = 0` — **REJECTED** (sandwich attack vector).

**Recommendation:** Option B — Backend calculates `minOut` before each call. Simpler SC, more flexibility.

### ADR-04: USDT Conversion Threshold ($50 vs Other)

SA specifies **$50 USDT** as the trigger threshold. Rationale: Gas cost for the conversion call (~0.001 BNB ≈ $0.60) is only 1.2% of $50. Below $10, gas overhead exceeds 6% — uneconomical.

**Recommendation:** Accept $50 default. Add admin setter to tune post-launch.

---

## 6. Implementation Specification (Post-Approval)

### IMPL-01 — SC: Upgrade `TreasuryBuyBack.sol` (GAP-01, GAP-05, GAP-06)

**File:** `contracts/src/TreasuryBuyBack.sol`  
**New additions:**
```
+ IERC20 public usdtToken (immutable, set in constructor)
+ uint256 public usdtConversionThreshold = 50e18
+ event USDTConvertedToBNB(uint256 usdtIn, uint256 bnbOut)
+ function convertUSDTtoBNB(uint256 minBnbOut) external nonReentrant whenNotPaused
+ function setUsdtConversionThreshold(uint256) external onlyOwner
```

**Constructor update:** Add `address _usdt` parameter, set `usdtToken = IERC20(_usdt)`.

**Test cases required:**
- `TC-USDT-01`: convertUSDTtoBNB reverts if USDT balance < threshold
- `TC-USDT-02`: convertUSDTtoBNB succeeds, BNB balance increases, USDT balance = 0
- `TC-USDT-03`: minBnbOut = large value → revert (slippage protection works)
- `TC-USDT-04`: Only keeper/owner can call convertUSDTtoBNB

---

### IMPL-02 — BE: Extend `TreasuryMonitorService` (GAP-02)

**File:** `backend/src/modules/web3/treasury-monitor.service.ts`  
**Change:** Extend the existing `@Cron('*/10 * * * *')` cronjob:

```
Step 1: Read Vault USDT balance (new)
Step 2: If USDT ≥ threshold → call convertUSDTtoBNB(minBnbOut) (new)
         - minBnbOut: query getAmountsOut([USDT,WBNB]) × 0.98 (2% slippage)
         - Emit log: [Treasury] Converting X USDT → BNB
Step 3: [Existing] Check BNB balance vs 2.0 BNB threshold → triggerBuyBack()
```

**No new files needed.** Add ~50 lines to existing service.

**Env vars needed:** No new vars — uses existing `TREASURY_CONTRACT_ADDRESS` + `ADMIN_PRIVATE_KEY`.

---

### IMPL-03 — FE: FARM→USDT Cashout Tax 1% (GAP-03)

**File:** `frontend/src/hooks/usePancakeSwap.ts`  
**Where:** After `FARM_TO_USDT` swap receipt confirmed (line ~826)  
**What to add:**

```typescript
// Post-swap: deduct 1% cashout fee → TreasuryBuyBack
const CASHOUT_FEE_BPS = 100n; // 1% = 100 bps
const FEE_DENOMINATOR = 10000n;

// Re-read USDT balance to calculate actual received amount
const usdtAfter = await publicClient.readContract({ address: USDT_TOKEN_ADDRESS, functionName: 'balanceOf', args: [userAddress] }) as bigint;
const usdtReceived = usdtAfter - latestUsdt; // delta = amount received in this swap

if (usdtReceived > 0n) {
  const cashoutFee = (usdtReceived * CASHOUT_FEE_BPS) / FEE_DENOMINATOR;
  if (cashoutFee > 0n) {
    setStep('fee'); // new step label: "Applying 1% Cashout Tax…"
    const feeTx = await walletClient.writeContract({
      account: signingAccount,
      address: USDT_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [TREASURY_BUYBACK_ADDRESS as `0x${string}`, cashoutFee],
    });
    await publicClient.waitForTransactionReceipt({ hash: feeTx });
  }
}
```

**UX impact:** FARM→USDT becomes a **3-step flow** (approve if needed → swap → fee transfer). Step indicator must be updated in `ClaimModal.tsx` / `MarketplaceModal.tsx` to show the extra step.

**New constant needed:**
```typescript
// In usePancakeSwap.ts:
export const TREASURY_BUYBACK_ADDRESS = (
  import.meta.env.VITE_TREASURY_CONTRACT_ADDRESS || '0xe59FfB05EdF59464e8803E81A4d790d828915006'
) as `0x${string}`;
```

---

### IMPL-04 — FE: In-App Presale UI (GAP-04)

**Scope:** New modal or section in `GetFarmModal.tsx` / `ShopModal.tsx`  
**Contract:** `FarmTokenSale.sol` (deployed)  
**Functions needed:**
- `buy(roundId, usdtAmount)` — buy $FARM with USDT
- `farmForUsdt(roundId, usdtAmount)` — preview calculation
- `rounds(roundId)` — fetch round info (price, min, max, active status)
- `canBuy(roundId, account)` — eligibility check
- `spent(roundId, account)` — how much user already spent

**Flow:** USDT approve → `FarmTokenSale.buy()`. Simple 2-step, same pattern as USDT→FARM swap.

> Note: Presale UI priority is lower (P2) pending SA confirmation of public round timeline.

---

## 7. Execution Checklist Summary

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                    USDT→VAULT IMPLEMENTATION ROADMAP (POST-APPROVAL)                        │
├─────────┬──────────────────────────────────────────────────┬────────┬────────┬──────────────┤
│ Task ID │ Description                                      │ Layer  │ Effort │ Priority     │
├─────────┼──────────────────────────────────────────────────┼────────┼────────┼──────────────┤
│ IMPL-01 │ TreasuryBuyBack.sol: add convertUSDTtoBNB()      │ SC     │ M      │ P0 (BLOCKER) │
│         │ + usdtToken, threshold, event, admin setter      │        │        │              │
├─────────┼──────────────────────────────────────────────────┼────────┼────────┼──────────────┤
│ IMPL-02 │ TreasuryMonitorService: USDT balance check +     │ BE     │ S      │ P0 (BLOCKER) │
│         │ auto convertUSDTtoBNB() trigger in cron          │        │        │              │
├─────────┼──────────────────────────────────────────────────┼────────┼────────┼──────────────┤
│ IMPL-03 │ usePancakeSwap.ts: 1% cashout tax on             │ FE     │ M      │ P1           │
│         │ FARM→USDT direction + step UI update             │        │        │              │
├─────────┼──────────────────────────────────────────────────┼────────┼────────┼──────────────┤
│ IMPL-04 │ In-App Presale UI (FarmTokenSale integration)    │ FE     │ L      │ P2           │
└─────────┴──────────────────────────────────────────────────┴────────┴────────┴──────────────┘
Legend: S=Small (<1d), M=Medium (1-2d), L=Large (3-5d)
```

---

## 8. Known Risks & Dependencies

| Risk | Mitigation |
|------|-----------|
| `convertUSDTtoBNB()` is sandwich-attackable if `minBnbOut = 0` | Backend MUST calculate `minBnbOut = getAmountsOut() × 98%` before calling |
| FARM→USDT cashout tax (FE-level) is bypassable by direct PancakeSwap calls | Acceptable for MVP. Upgrade to SC wrapper (ADR-01 Option B) in v2. |
| `TreasuryBuyBack.sol` upgrade requires re-deployment. Existing BNB balance must be migrated. | Use `recoverBNB()` on old contract → transfer to new address. Update all BE config vars. |
| Hardhat tests for IMPL-01 require USDT mock on testnet | Use existing `contracts/src/mocks/` pattern. Add `MockUSDT.sol` if not present. |
| USDT on BSC Testnet: `0x337610d27c682E347C9cD60BD4b3b107C9d34dDd` — faucet required | Team must ensure test wallets have testnet USDT for E2E testing. |

---

## 9. Files Affected (for SA Review)

```
Smart Contracts:
  MODIFY   contracts/src/TreasuryBuyBack.sol
  ADD TEST contracts/test/TreasuryBuyBack.USDT.test.ts

Backend:
  MODIFY   backend/src/modules/web3/treasury-monitor.service.ts

Frontend:
  MODIFY   frontend/src/hooks/usePancakeSwap.ts
  MODIFY   frontend/src/components/modals/ClaimModal.tsx        (step label update)
  MODIFY   frontend/src/components/modals/MarketplaceModal.tsx  (step label update)
  OPTIONAL frontend/src/components/modals/PresaleModal.tsx      (new, IMPL-04)
```

---

## 10. Sign-off Required

| Reviewer | Role | Decision Needed |
|----------|------|----------------|
| SA | Software Architect | Approve ADR-01 (enforcement level), ADR-02 (fee rate), ADR-03 (slippage method) |
| Owner | Project Owner | Approve IMPL-04 priority + public round launch timeline |
| Engineering | Dev Team | Confirm effort estimates + test strategy |

**⛔ DO NOT START DEVELOPMENT until this document receives written approval.**

---

*Document prepared by automated audit from codebase scan + SA conversation archive.*  
*Last codebase revision: git commit `91c25d7` (multi-wallet cloud backup).*
