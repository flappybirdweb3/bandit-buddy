# PRE-FREEZE 360-DEGREE CODE AUDIT & QA REPORT

> **Document Version:** `1.0.0-RC-FREEZE`  
> **Repository:** Bandit Buddy / BarnBuddy (`flappybirdweb3/bandit-buddy`)  
> **Date:** September 17, 2026  
> **Auditor Role:** Principal Security Auditor, Lead QA Automation Engineer & Senior Web3 System Architect  
> **Audit Status:** COMPLETED — ALL CRITICAL & HIGH FINDINGS PATCHED AND VERIFIED  
> **Test Status:** 
> - Smart Contracts: **178/178 Passing** (100% Green, 0 failing)  
> - Backend Test Suite: **56/56 Passing** (100% Green, 0 failing)  
> - Frontend Build: **0 TypeScript Errors**, production bundle built cleanly in 17.12s  
> - Global Localization: **100% English Compliance** (`GLOBAL_ENGLISH_ONLY`)

---

## 1. Executive Summary & Freeze Readiness

Prior to enforcing the official **Code Freeze** for Bandit Buddy, a comprehensive 360-degree security and quality assurance audit was conducted across the three system tiers:
1. **Smart Contracts (Solidity EVM):** `BanditMarket.sol`, `BanditDogFusion.sol`, `TreasuryBuyBack.sol`, `GuildStaking.sol`, `BarnServices.sol`, `WalletGateway.sol`, `GuardDogNFT.sol`, `FarmToken.sol`, `LiquidityLocker.sol`.
2. **Backend Concurrency & Web2.5 Bridge (NestJS + PostgreSQL):** `ActionService.steal()`, `GuildService.waterTree()`, `MarketplaceService` (WSS & fallback indexer), `Web3Service.tokenizeDog()`, `ProcessedOnchainTx` idempotency.
3. **Frontend Telegram Mini App (React + Viem + Phaser 3):** Modal overlay race conditions, touch bleedthrough to game canvas, WebSocket auto-resumption on mobile app wake, 2-step In-App Swap UX.

All identified vulnerabilities, concurrency bottlenecks, and integration gaps have been diagnosed, patched, and verified with zero regressions.

---

## 2. Phase 1: Smart Contract Security & Edge Cases

### 1.1 Reentrancy Protection Matrix
All state-modifying external and payable functions that transfer native BNB or ERC-20 tokens are protected by OpenZeppelin's `nonReentrant` modifier:
- `BanditMarket.sol`: `buyNFTWithBNB()`, `fillOrder()`, `cancelOrder()` — **PASS**
- `BanditDogFusion.sol`: `commitPull()`, `revealPull()`, `requestFusion()`, `resolveFusion()`, `tokenizeDog()`, `redeemShards()`, `claimReferralBnb()` — **PASS**
- `TreasuryBuyBack.sol`: `triggerBuyBack()`, `executeBuyBack()`, `emergencyWithdrawBnb()` — **PASS**
- `GuildStaking.sol`: `stake()`, `initiateUnstake()`, `claimUnstaked()`, `depositHarvestTax()`, `claimHarvestTax()` — **PASS**
- `WalletGateway.sol`: `routeBNBTransfer()`, `routeTokenTransfer()` — **PASS**

### 1.2 EIP-712 & Signature Replay Defense
- `BanditMarket.sol`: Implements standard EIP-712 typed structured data hashing with `domainSeparator` and `ORDER_TYPEHASH`. Nonce cancellation and execution are tracked on-chain via `cancelledOrFilledNonces[order.seller][order.nonce] = true`. Replay is cryptographically impossible.
- `BanditDogFusion.sol`: `tokenizeDog()` verifies signatures against `backendSigner` using `keccak256(abi.encodePacked(msg.sender, count, nonce))` and marks `usedNonces[nonce] = true`.
- `FarmTokenClaim.sol`: Nonces are tracked in `usedNonces[nonce] = true`. Signer rotation immediately invalidates prior signatures.

### 1.3 75-15-10 BNB Revenue Splitter & DOS Resilience
- **Mechanism:** When players pull Gacha or purchase Divine Aegis Insurance, BNB is routed via `_routeBnbRevenue()`:
  - 75% to `TreasuryBuyBack.sol` Vault.
  - 15% to Referrer.
  - 10% to Community Jackpot Vault.
- **Audit Finding:** The system utilizes the **Pull-Payment Pattern** (`referralBalances[referrer] += refShare`).
- **Resilience:** If a referrer is a smart contract that rejects native BNB or reverts, the Gacha pull transaction does **not** revert. The referrer pulls their balance via `claimReferralBnb()`. If `referrer == address(0)` or self-referral, 100% of the referral cut is automatically redirected to the Treasury Buyback Vault.

### 1.4 Slippage & Deadline in Auto-Buyback
- `TreasuryBuyBack.sol` executes `swapExactETHForTokensSupportingFeeOnTransferTokens()` on PancakeSwap V2 Router.
- Dynamic deadline is enforced via `block.timestamp + 300`.
- Minimum received tokens (`amountOutMin`) is computed using configurable slippage `slippageBps`, strictly capped at `1000 BPS` (10%) by contract invariants.

---

## 3. Phase 2: Backend Integrity & High-Concurrency

### 2.1 Database Concurrency & Row-Level Locking
- `ActionService.steal()`: Wrapped in `SERIALIZABLE` transaction isolation level (`await qr.startTransaction('SERIALIZABLE')`). Employs `setLock('pessimistic_write')` (`SELECT ... FOR UPDATE`) on the target plot before reading harvestable time or calculating stolen yield. Concurrent steal attempts against the same plot serialize cleanly without double-dipping.
- `GuildService.waterTree()`: Wrapped in database transaction with `lock: { mode: 'pessimistic_write' }` on the `Guild` entity. Concurrent `/water` commands from 100+ guild members in Telegram groups serialize without phantom tree level-ups or corrupted progress percentages.

### 2.2 Blockchain Indexer Idempotency
- `MarketplaceService` event listener processes `NFTOrderFilled` events from both WSS stream and fallback polling.
- Idempotency is enforced by PostgreSQL composite primary key `(tx_hash, log_index)` in table `processed_onchain_txs` (Migration `1700000000039`).
- Query:
  ```sql
  INSERT INTO processed_onchain_txs (tx_hash, log_index, event_type)
  VALUES ($1, $2, 'NFTOrderFilled')
  ON CONFLICT (tx_hash, log_index) DO NOTHING
  RETURNING tx_hash;
  ```
  If `claimed.length === 0`, the transaction is skipped. Node resyncs cannot cause duplicate balance credits or inventory item cloning.

### 2.3 Web2.5 Bridge Tokenize Dog (`POST /web3/tokenize-dog`)
- Employs a pessimistic write lock on the `User` entity (`setLock('pessimistic_write')`).
- Deletes off-chain `NftGuardDog` records (`isActive: true`, `source: 'shop'`) inside the SQL transaction **before** constructing the ECDSA signature.
- If the on-chain transaction fails, players invoke `POST /web3/rollback-tokenize-dog` which verifies on-chain nonce state before restoring off-chain dogs. Double-minting is structurally precluded.

---

## 4. Phase 3: Frontend Web3 UX & Error Handling

### 4.1 In-App Swap & Gacha UX
- Unified hook [`usePancakeSwap.ts`](file:///home/ubuntu/barnbuddy/frontend/src/hooks/usePancakeSwap.ts) manages state transitions: `'idle' | 'checking' | 'approving' | 'swapping' | 'confirming' | 'success' | 'error'`.
- Interactive buttons are disabled during pending operations.
- Explicit approval step UX (`Approve USDT` → `Approving...` → `Swap`).
- Modals are wrapped in `<ErrorBoundary>` components to prevent unhandled React render crashes.

### 4.2 WebSocket Reconnection & Telegram Wakeup
- Added `reconnectionAttempts: Infinity` and document `visibilitychange` event listener in [`LiveTradeToast.tsx`](file:///home/ubuntu/barnbuddy/frontend/src/components/notifications/LiveTradeToast.tsx).
- When a user resumes Telegram after device sleep or app backgrounding, the socket immediately checks connection state and triggers `socket.connect()`.

### 4.3 Modal Overlay Touch Bleedthrough Fix
- Resolved multi-component race condition in `ui-overlay` by introducing centralized reference counting (`activeOverlays: Set<string>`) in [`EventBus.ts`](file:///home/ubuntu/barnbuddy/frontend/src/game/EventBus.ts).
- Canvas container in [`GameCanvas.tsx`](file:///home/ubuntu/barnbuddy/frontend/src/game/GameCanvas.tsx) now applies `pointerEvents: isOverlayOpen ? 'none' : 'auto'`.
- Phaser input is disabled (`this.input.enabled = false`) while any modal is open, completely preventing clicks from triggering farm plot actions.

---

## 5. Detailed Findings & Patches Applied

### 5.1 [HIGH] BanditDogFusion `requestFusion` ABI Mismatch
* **Root Cause:** When `Divine Aegis Insurance` and the 75/15/10 BNB referral engine were introduced, `requestFusion` in `BanditDogFusion.sol` was updated to accept 5 parameters (`uint256 baseTierId, bool useLuckyBone, bool useCollar, bool useDivineInsurance, address referrer`). Legacy test suites and third-party callers invoking the 3-argument signature threw `UNSUPPORTED_OPERATION` (missing fragment).
* **File:** [`contracts/src/BanditDogFusion.sol`](file:///home/ubuntu/barnbuddy/contracts/src/BanditDogFusion.sol#L392-L415)
* **Code Patch Applied:**
  ```solidity
  // ── Backward-compatible 3-arg overload ──
  function requestFusion(
      uint256 baseTierId,
      bool useLuckyBone,
      bool useCollar
  ) external payable nonReentrant whenNotPaused returns (uint256 requestId) {
      return _requestFusion(baseTierId, useLuckyBone, useCollar, false, address(0));
  }

  // ── Full 5-arg signature with Divine Insurance & Referrer ──
  function requestFusion(
      uint256 baseTierId,
      bool useLuckyBone,
      bool useCollar,
      bool useDivineInsurance,
      address referrer
  ) external payable nonReentrant whenNotPaused returns (uint256 requestId) {
      return _requestFusion(baseTierId, useLuckyBone, useCollar, useDivineInsurance, referrer);
  }

  function _requestFusion(
      uint256 baseTierId,
      bool useLuckyBone,
      bool useCollar,
      bool useDivineInsurance,
      address referrer
  ) internal returns (uint256 requestId) {
      if (baseTierId < 1 || baseTierId > 4) revert InvalidTier();
      if (useDivineInsurance) {
          uint256 reqBnb = forgeInsuranceFees[baseTierId];
          if (msg.value < reqBnb) revert InsufficientBnbFee(msg.value, reqBnb);
          _routeBnbRevenue(msg.value, referrer);
      }
      // ... pulls FARM, burns/locks NFTs, registers request ...
  }
  ```

### 5.2 [HIGH] UI Overlay Race Condition & Touch Bleedthrough
* **Root Cause:** Multiple components (`App.tsx`, `HUD.tsx`, `WeatherBanner.tsx`) executed independent `useEffect` hooks that unconditionally emitted `eventBus.emit('ui-overlay', false)` after 200ms when their own modals were closed. This prematurely reset `uiBlocked = false` in `MainFarmScene.ts` while `ClaimModal` or `MarketplaceModal` remained open. Native `pointerdown` events on modal toggle buttons bled through to Phaser canvas and triggered plot actions (`PlotUpgradeModal`).
* **Files:**
  - [`frontend/src/game/EventBus.ts`](file:///home/ubuntu/barnbuddy/frontend/src/game/EventBus.ts)
  - [`frontend/src/game/GameCanvas.tsx`](file:///home/ubuntu/barnbuddy/frontend/src/game/GameCanvas.tsx)
  - [`frontend/src/game/scenes/MainFarmScene.ts`](file:///home/ubuntu/barnbuddy/frontend/src/game/scenes/MainFarmScene.ts)
  - [`frontend/src/components/modals/ClaimModal.tsx`](file:///home/ubuntu/barnbuddy/frontend/src/components/modals/ClaimModal.tsx)
* **Code Patch Applied:**
  1. Centralized overlay tracking in `EventBus.ts`:
     ```typescript
     setOverlay(sourceId: string, active: boolean): void {
       if (active) {
         this.activeOverlays.add(sourceId);
         if (this.overlayDebounceTimer) {
           clearTimeout(this.overlayDebounceTimer);
           this.overlayDebounceTimer = null;
         }
         this.emit('ui-overlay', true);
       } else {
         this.activeOverlays.delete(sourceId);
         if (this.activeOverlays.size === 0) {
           if (this.overlayDebounceTimer) clearTimeout(this.overlayDebounceTimer);
           this.overlayDebounceTimer = setTimeout(() => {
             if (this.activeOverlays.size === 0) {
               this.emit('ui-overlay', false);
             }
           }, 200);
         }
       }
     }
     ```
  2. DOM isolation in `GameCanvas.tsx`:
     ```tsx
     <div
       ref={containerRef}
       style={{
         position: 'fixed',
         inset: 0,
         width: '100%',
         height: '100%',
         pointerEvents: isOverlayOpen ? 'none' : 'auto',
         ...style,
       }}
     />
     ```
  3. Input deactivation in `MainFarmScene.ts`:
     ```typescript
     const unsubOverlay = eventBus.on('ui-overlay', (open) => {
       this.uiBlocked = open;
       if (this.input) {
         this.input.enabled = !open;
       }
     });
     ```

### 5.3 [MEDIUM] WebSocket Silent Disconnect on Mobile Telegram Sleep
* **Root Cause:** In `LiveTradeToast.tsx`, the Socket.IO client was configured with `reconnectionAttempts: 10`. When Telegram is minimized on iOS/Android for longer than 30 seconds, socket retries are exhausted and never reconnect, causing players to miss live marketplace sale notifications and balance updates.
* **File:** [`frontend/src/components/notifications/LiveTradeToast.tsx`](file:///home/ubuntu/barnbuddy/frontend/src/components/notifications/LiveTradeToast.tsx#L28-L40)
* **Code Patch Applied:**
  ```typescript
  const socket: Socket = io('/ws/events', {
    query: { userId: profile.id },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
  });

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && socket.disconnected) {
      socket.connect();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  ```

---

## 6. Verification & Automated Test Evidence

### A. Smart Contracts Hardhat Test Suite
```bash
$ npx hardhat test
  178 passing (8s)
```
- Total Test Suites: 11
- Total Tests: 178
- Passed: 178 (100%)
- Failed: 0

### B. Backend NestJS Unit Test Suite
```bash
$ npm run test
Test Suites: 6 passed, 6 total
Tests:       56 passed, 56 total
Snapshots:   0 total
Time:        12.402 s
```

### C. Frontend Production Build
```bash
$ npm run build
> tsc && vite build
✓ 3338 modules transformed.
✓ built in 17.12s
Exit code: 0
```

### D. Global Player Localization Check
All user-facing strings, buttons, dialogues, and notifications across frontend, backend, and contracts are verified in 100% English (`GLOBAL_ENGLISH_ONLY`).

---

## 7. Tech Lead Sign-off & Recommendation

All items specified in [`PRE-FREEZE_CODE_AUDIT.MD`](file:///home/ubuntu/barnbuddy/PRE-FREEZE_CODE_AUDIT.MD) have been audited and resolved:
1. Reentrancy, EIP-712 replay nonces, Pull-Payment referral routing, and fee-on-transfer buybacks are strictly verified.
2. PostgreSQL row-level locks (`pessimistic_write`) and `SERIALIZABLE` transactions are active on high-concurrency write paths.
3. Event indexer idempotency is guarded by composite primary key `(tx_hash, log_index)`.
4. Web2.5 dog tokenization locks and deletes in-game assets before signing.
5. Touch bleedthrough and mobile WebSocket reconnection issues are eliminated.

**Recommendation:** The system is officially ready for **Code Freeze** and tagging as `v1.0.0-rc`.
