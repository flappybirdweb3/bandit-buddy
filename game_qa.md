# 📋 BÁO CÁO QA — BANDIT BUDDY (Web2.5)

> **Trạng thái tài liệu:** Draft — toàn bộ test case dưới đây ở trạng thái **`Chưa chạy`**.
> Không có PASS/FAIL nào được điền sẵn. Không có tỷ lệ % nào được tổng hợp.

---

## 0. Phạm vi, giả định & Nguồn tham chiếu

### 0.1 Artefact trong phạm vi (đã có trong sơ đồ dự án)

| Layer | Artefact tham chiếu |
|---|---|
| Contracts | `FarmToken.sol`, `FarmTokenClaim.sol`, `GuardDogNFT.sol`, `BanditDogFusion.sol`, `BanditMarket.sol`, `GuildStaking.sol`, `TreasuryBuyBack.sol`, `LiquidityLocker.sol`, `MockERC20.sol` |
| Backend DTO | `action.dto.ts`, `web3.dto.ts`, `inventory.dto.ts`, `marketplace.dto.ts`, `guild.controller.ts` (inline DTO), `user.controller.ts` (`UpdateWalletDto`), `shop.controller.ts` (`BuyItemDto`), `auth.controller.ts` (`SessionDto`) |
| Entities / Tables | `users`, `marketplace_listings`, `processed_onchain_txs`, `system_config`, `claim_intents`, `farm_plots`, `nft_guard_dogs`, `guilds`, `guild_members`, `user_items`, `user_notifications`, `quest_definitions`, `user_daily_quests`, `seed_configs` |
| Migrations | `1700000000027-AddTxHashToListings`, `1700000000030-AddProcessedOnchainTxs` |
| Frontend hooks | `useClaimTokens`, `useMarketplaceTrade`, `useAutoWallet`, `usePlotActions` |

### 0.2 Những điểm yêu cầu nhưng **KHÔNG hiện rõ** trong sơ đồ

Các mục sau **được yêu cầu nhắc tới** trong brief nhưng **chữ ký/hằng số không xuất hiện** trong sơ đồ hàm. Vì ràng buộc "không bịa", các case liên quan sẽ được đánh dấu `⚠ YÊU CẦU XÁC MINH CODE` — test sẽ viết theo hướng **quan sát hành vi thực tế của contract**, không giả định constant/ID cụ thể:

- `MAX_TAX_BPS` — không thấy constant trong `FarmToken.sol`. Ngưỡng cap có thể chưa tồn tại hoặc nằm trong `setTaxRates` (signature bị cắt `setTaxRates(`).
- `UNSTAKE_DELAY` — hằng số không thấy trong `GuildStaking.sol`; chỉ có error `UnstakeLocked()` gợi ý delay tồn tại.
- Soul Shard `id = 9999` — `BanditDogFusion.sol` có `ISoulShardNFT.burnShard`, `SoulShardMinted`, `ShardsRedeemed` nhưng **không** khai báo `uint256 SOUL_SHARD_ID` theo diagram.
- `guardDogDefense`, `pityCounter` reset condition — `pityCounter` có ghi chú "resets on Tier ≥3 pull" trong diagram, nhưng biên cụ thể (`== 3` hay `>= 3`) cần đọc code.
- `BanditMarket` `usedNonces[address][uint256]` là 1-1 ánh xạ; replay theo `(signer, nonce)`; nhưng không có `cancelOrder` semantics với expiry → cần xác nhận.

> **Nguyên tắc:** nơi nào giá trị chưa xác minh, test chỉ assert **hành vi mong đợi theo docs/vendor (event/error cụ thể)** — không hardcode số.

### 0.3 Công cụ

- **Hardhat + ethers v6 + TypeScript + chai**: hợp đồng (so sánh `bigint` với `bigint`, dùng `parseEther`, `toBeBigInt`).
- **Jest + class-validator + class-transformer**: DTO backend (đã có `action.dto.spec.ts`, `web3.dto.spec.ts`, `app.e2e-spec.ts`).
- **fast-check** (optional): property test cho race condition DB.

---

## (a) Ma trận Test Case

### A1. Smart Contract — Security (SEC)

| ID | Module | Loại | Ưu tiên |
|---|---|---|---|
| SEC-RNT-01 | `TreasuryBuyBack.executeBuyBack` | Reentrancy (router re-enter) | P0 |
| SEC-RNT-02 | `GuildStaking.unstake` | Reentrancy (token callback) | P0 |
| SEC-RNT-03 | `BanditDogFusion.reveal` / `tokenizeDog` | Reentrancy (`mint` callback) | P0 |
| SEC-RNT-04 | `GuardDogNFT.buyDog` | Reentrancy (`onERC1155Received`) | P1 |
| SEC-NON-01 | `BanditMarket.buyNFT` / `buyOffchainItem` | Nonce replay (EIP-712) | P0 |
| SEC-NON-02 | `FarmTokenClaim.claimTokens` | Nonce replay (ECDSA) | P0 |
| SEC-NON-03 | `BanditDogFusion.tokenizeDog` | `usedTokenizeNonces` replay | P0 |
| SEC-NON-04 | `BanditDogFusion.redeemShards` | `usedRedeemNonces` replay | P0 |
| SEC-NON-05 | `BanditMarket._validateNonce` | Cross-signer cùng nonce | P1 |
| SEC-SIG-01 | `FarmTokenClaim.claimTokens` | `InvalidSignature` | P0 |
| SEC-SIG-02 | `BanditDogFusion.tokenizeDog/redeemShards` | `InvalidSignature` / `ZeroSigner` | P0 |
| SEC-SIG-03 | `BanditMarket.buyNFT` | `BadSignature` (signer ≠ seller) | P0 |
| SEC-EXPIRE-01 | `BanditMarket._validateNonce` | `OrderExpired` | P1 |
| SEC-EXPIRE-02 | `BanditDogFusion.reveal` | `TooEarly` / `CommitExpired` | P1 |
| SEC-ACC-01 | `FarmToken.{pause,unpause,setPancakePair,setTreasuryBuybackPool,excludeFromFee,setTierThresholds,setTaxRates}` | Access control `OwnableUnauthorizedAccount` | P0 |
| SEC-ACC-02 | `FarmTokenClaim.{fundPool,setSigner,setClaimBounds,pause,unpause,emergencyWithdraw}` | Access control | P0 |
| SEC-ACC-03 | `GuardDogNFT.{setPrice,setTreasury,setBurnMode,setBaseURI,pause,unpause,setFusionContract,mintTo}` | Access control | P0 |
| SEC-ACC-04 | `BanditDogFusion.{setPullCost,setTokenizeCost,setBackendSigner,setWeights,setNftContract,pause,unpause}` | Access control | P0 |
| SEC-ACC-05 | `BanditMarket.{setFee,setTreasury,pause,unpause}` | Access control | P0 |
| SEC-ACC-06 | `GuildStaking.{setMinEliteStake,pause,unpause}` | Access control | P0 |
| SEC-ACC-07 | `TreasuryBuyBack.{burnHeldFarm,setSlippage,recoverERC20,recoverBNB,pause,unpause}` | Access control | P0 |
| SEC-ACC-08 | `GuardDogNFT.{mint,burnShard}` | Chỉ `fusionContract` được gọi | P0 |
| SEC-PAUSE-01 | `FarmToken` pause → `_update` revert `EnforcedPause` | Kill-switch | P0 |
| SEC-PAUSE-02 | `FarmTokenClaim` pause → `claimTokens` revert, `emergencyWithdraw` vẫn chạy | Kill-switch | P0 |
| SEC-PAUSE-03 | `GuildStaking` pause → `stake`/`depositHarvestTax` revert; `unstake` **vẫn chạy** (kiểm tra hành vi thực tế) | Kill-switch | P0 |
| SEC-PAUSE-04 | `BanditDogFusion` pause → `commit`/`reveal` revert | Kill-switch | P0 |
| SEC-PAUSE-05 | `GuardDogNFT` pause → `buyDog` revert; `mint` từ fusion vẫn chạy? | Kill-switch | P0 |
| SEC-PAUSE-06 | `BanditMarket` pause → `buyNFT`/`buyOffchainItem`/`cancelOrder` behavior | Kill-switch | P1 |

### A2. Smart Contract — Thuế FARM holdings-based (TAX)

| ID | Module | Loại | Ưu tiên |
|---|---|---|---|
| TAX-TIER-01 | `FarmToken.getTierOf` | Tier theo `balanceOf(user)`, không phải pool | P0 |
| TAX-TIER-02 | `FarmToken.getTierOf` | Boundary `tier2Balance` (vừa đủ & vừa thiếu 1 wei) | P0 |
| TAX-TIER-03 | `FarmToken.getTierOf` | Boundary `tier3Balance` | P0 |
| TAX-TIER-04 | `FarmToken.getTierOf` | Ví excluded vẫn có tier đúng | P1 |
| TAX-RATE-01 | `FarmToken.setTaxRates` | Buy tax theo từng tier 0..2 | P0 |
| TAX-RATE-02 | `FarmToken.setTaxRates` | Sell tax theo từng tier 0..2 | P0 |
| TAX-RATE-03 | `FarmToken.setTaxRates` | Cap trên (nếu có) — **⚠ YÊU CẦU XÁC MINH `MAX_TAX_BPS`** | P0 |
| TAX-RATE-04 | `FarmToken` | `TaxCollected` event với `taxAmount` = `value * bps / 10_000` (dùng bigint) | P1 |
| TAX-EVADE-01 | `FarmToken` | Vector né thuế vừa đúng ngưỡng tier 2 để né sell tax tier 3 | P0 |
| TAX-EVADE-02 | `FarmToken` | Sell xuống dưới ngưỡng → tier thay đổi **trong cùng tx**? | P0 |
| TAX-PAIR-01 | `FarmToken._update` | Chỉ `pancakePair` mới kích hoạt tax | P0 |
| TAX-EXCL-01 | `FarmToken.excludeFromFee` | Ví excluded không bị trừ tax | P1 |
| TAX-BUYPATH-01 | `FarmToken` | Buy path: `from == pancakePair && to != pancakePair` | P1 |
| TAX-SELLPATH-01 | `FarmToken` | Sell path: `to == pancakePair` | P1 |
| TAX-PAUSE-01 | `FarmToken.pause` | `_update` bị chặn hoàn toàn | P0 |

### A3. Kinh tế Token & Web2.5 Bridge (ECO)

| ID | Module | Loại | Ưu tiên |
|---|---|---|---|
| ECO-CLAIM-01 | `FarmTokenClaim.claimTokens` | `AmountOutOfBounds(amount, min, max)` | P0 |
| ECO-CLAIM-02 | `FarmTokenClaim.setSigner` | `SignerUpdated(old, new)` + sig cũ bị reject  | P0 |
| ECO-CLAIM-03 | `FarmTokenClaim.fundPool` | `PoolFunded` + `poolBalance` | P1 |
| ECO-CLAIM-04 | `FarmTokenClaim.setClaimBounds` | `ClaimBoundsUpdated` | P1 |
| ECO-CLAIM-05 | `FarmTokenClaim.claimTokens` | `InsufficientPoolBalance(available, requested)` | P0 |
| ECO-CLAIM-06 | `FarmTokenClaim.emergencyWithdraw` | `EmergencyWithdraw(to, amount)` | P0 |
| ECO-NFT-01 | `GuardDogNFT.buyDog` | `MaxSupplyReached(tokenId, maxSupply)` | P0 |
| ECO-NFT-02 | `GuardDogNFT.setBurnMode(true)` → `buyDog` burn token BNB? (thực tế là FARM?) | P0 |
| ECO-NFT-03 | `GuardDogNFT.setFusionContract` → `mint`/`burnShard` chỉ nhận từ fusion | P0 |
| ECO-NFT-04 | `GuardDogNFT.totalDefensePower` | Cộng dồn defense theo balance | P1 |
| ECO-NFT-05 | `GuardDogNFT.remainingSupply` | `maxSupply - totalSupply(id)` | P1 |
| ECO-FUSION-01 | `BanditDogFusion.commit/reveal` | `AlreadyPending`, `NoPendingCommit`, `WrongSecret` | P0 |
| ECO-FUSION-02 | `BanditDogFusion.pityCounter` | Reset khi Tier ≥ 3; không reset khi Tier < 3 | P0 |
| ECO-FUSION-03 | `BanditDogFusion._resolveTokenId` | Deterministic theo `(secret, player)` | P1 |
| ECO-FUSION-04 | `BanditDogFusion.tokenizeDog` | `CountExceedsMax` / `InvalidCount` (count = 0) | P0 |
| ECO-FUSION-05 | `BanditDogFusion.redeemShards` | `InsufficientShards(have, need)` — **⚠ xác minh `SOUL_SHARD_ID`** | P0 |
| ECO-FUSION-06 | `BanditDogFusion` | `InsufficientShards` burn shard id đúng | P0 |
| ECO-GUILD-01 | `GuildStaking.stake` | `Staked(guildId, user, amount)`; `stakes[guildId][user]` | P1 |
| ECO-GUILD-02 | `GuildStaking.requestUnstake` | `UnstakeRequested`; gọi 2 lần → `AlreadyRequestedUnstake` | P0 |
| ECO-GUILD-03 | `GuildStaking.unstake` | Trước delay → `UnstakeLocked`; sau delay (time travel) → `Unstaked` | P0 |
| ECO-GUILD-04 | `GuildStaking.unstake` | Không request → `UnstakeNotRequested`; amount 0 → `NothingToUnstake` | P0 |
| ECO-GUILD-05 | `GuildStaking.isEliteEligible` | So với `setMinEliteStake` | P1 |
| ECO-GUILD-06 | `GuildStaking.unstake` khi paused | Kỳ vọng cho phép rút (không có `whenNotPaused` trên `unstake`) | P0 |
| ECO-LIQ-01 | `LiquidityLocker.lockTokens/withdraw` | `TooShort`, `NotBeneficiary`, `NotYet`, `AlreadyWithdrawn` | P1 |
| ECO-BUY-01 | `TreasuryBuyBack.executeBuyBack` | `InsufficientBalance`, `SlippageTooHigh`, `BuyBackExecuted` | P0 |
| ECO-BUY-02 | `TreasuryBuyBack.setSlippage` | `SlippageUpdated`, biên hợp lệ | P1 |

### A4. Đồng bộ Off-chain ↔ On-chain (SYNC)

| ID | Module | Loại | Ưu tiên |
|---|---|---|---|
| SYNC-RACE-01 | `MarketplaceService`, `MarketplaceListing` | Hai buyer mua cùng listing đồng thời | P0 |
| SYNC-RACE-02 | `Web3Service.claim-signature` + `ClaimIntent` | Trùng `(user, nonce)` cho intent mới | P0 |
| SYNC-IDEMP-01 | `ProcessedOnchainTx` (`tx_hash` + `log_index`) | Event listener bị chạy lại — unique constraint | P0 |
| SYNC-IDEMP-02 | `MarketplaceListing.status` | `active → filled` chỉ 1 lần | P0 |
| SYNC-REORG-01 | `ProcessedOnchainTx` | Reorg đảo `tx_hash` — không double-process | P1 |
| SYNC-REORG-02 | Listener | Retry backoff; dead-letter queue | P1 |
| SYNC-OPT-01 | `User.gold_balance` | Optimistic locking (`@VersionColumn`) hoặc conditional UPDATE | P0 |
| SYNC-DEX-01 | `DexVolumeService.computeTierFromBalance` | Đồng bộ tier với `FarmToken.getTierOf` (sanity) | P1 |
| SYNC-CFG-01 | `SystemConfig` | Key/value parse — không để lại layout drift | P2 |

### A5. Validation DTO / Mass-assignment (VAL)

| ID | Module | Loại | Ưu tiên |
|---|---|---|---|
| VAL-DTO-01 | Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) | Reject field thừa trên **mọi** DTO | P0 |
| VAL-DTO-02 | `SyncNftDto.walletAddress` | `0x` + 40 hex; **⚠ xác minh decorator** | P0 |
| VAL-DTO-03 | `RepairDto.amount` | Không âm, không rỗng, **⚠ xác minh decorator** | P0 |
| VAL-DTO-04 | `ClaimSignatureDto` | Không chấp nhận `number` cho field string bigint | P0 |
| VAL-DTO-05 | `RefundClaimDto` | Field bắt buộc | P1 |
| VAL-DTO-06 | `CreateListingDto` / `CreateItemListingDto` | `price_farm` string decimal | P0 |
| VAL-DTO-07 | `StakeDto` | `guildId` format, `amount` > 0 | P0 |
| VAL-DTO-08 | `UpdateWalletDto` | `wallet_address` nullable/format | P1 |
| VAL-DTO-09 | `BuyItemDto` / `SessionDto` | Field bắt buộc | P1 |
| VAL-DTO-10 | `PlantDto` / `FertilizeDto` / `ThrowAttackDto` | UUID / số dương | P1 |
| VAL-DTO-11 | Bất kỳ DTO | **Tuyệt đối không** `enableImplicitConversion` cho số tiền | P0 |
| VAL-DTO-12 | `DepositVerifyDto` | `txHash` `0x`+64 hex | P0 |

---

## (b) Chi tiết Test Case

> Tất cả: **Trạng thái = `Chưa chạy`**, cột Kết quả **ĐỂ TRỐNG**.

### B1. Reentrancy — `TreasuryBuyBack.executeBuyBack` [SEC-RNT-01]

**Mục tiêu:** Chứng minh `nonReentrant` chặn re-entry qua router khi router cố gọi lại `executeBuyBack`.

- **Tiền điều kiện:**
  - Deploy `MockERC20` (FARM), `MockPancakeRouter` độc hại (có hàm `swapExactETHForTokens` gọi lại target).
  - Deploy `TreasuryBuyBack(router, farm, owner)`.
  - Fund BNB cho contract; fund router bằng FARM để trả về ≥ `minFarmOut`.
- **Các bước:**
  1. Cấu hình `MaliciousRouter.setTarget(treasury)`.
  2. Gọi `treasury.executeBuyBack(1 ether, 0)`.
  3. Router, trong `swapExactETHForTokens`, gọi lại `treasury.executeBuyBack(1 wei, 0)`.
- **Kỳ vọng:**
  - Tx gốc revert với selector của `ReentrancyGuardReentrantCall` (OZ v5) **hoặc** revert bất kỳ khiến BNB **không** rời contract.
  - `getBalance(treasury)` sau tx **không đổi** so với trước.
  - **Không** emit `BuyBackExecuted` khi re-entrancy fail.

**Trạng thái:** `Chưa chạy`
**Kết quả:** —

---

### B2. Reentrancy — `GuildStaking.unstake` [SEC-RNT-02]

**Mục tiêu:** `unstake` có `nonReentrant` — FARM token độc hại gọi lại `unstake` không thể double-withdraw.

- **Tiền điều kiện:** `MaliciousERC20` override `transfer` để re-enter `GuildStaking.unstake(guildId)`.
- **Các bước:**
  1. `user.stake(guildId, 100 ether)`.
  2. `user.requestUnstake(guildId)`.
  3. Time travel qua `UnstakeLocked` window (xác nhận delay từ code, không giả định 7 ngày).
  4. `user.unstake(guildId)` → trong `transfer`, attacker re-enter.
- **Kỳ vọng:** revert re-entrancy guard; `stakes[guildId][user].amount` **không** bị trừ 2 lần; `guildTotalStaked` nhất quán.

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B3. Reentrancy — `BanditDogFusion.reveal` [SEC-RNT-03]

**Mục tiêu:** Trong `reveal`, khi `IMintableNFT.mint` callback, không thể gọi lại `reveal`/`commit` để mint thêm token ngoài ý muốn.

- **Các bước:**
  1. `commit(keccak256(abi.encodePacked(secret, player, blockNumber_placeholder)))` — dùng pattern commit/reveal của contract.
  2. Mint NFT contract độc hại gọi lại `reveal`.
  3. Tiến hành `reveal(secret)`.
- **Kỳ vọng:** revert re-entrancy; `pityCounter[player]` tăng đúng 1 lần.
- **Ghi chú:** cần đọc `_resolveTokenId` để biết seed — không đoán.

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B4. Replay Nonce — `BanditMarket.buyNFT` (EIP-712) [SEC-NON-01]

**Mục tiêu:** Một `NFTOrder` không thể fill 2 lần bởi bất kỳ ví nào.

- **Tiền điều kiện:** Seller ký order qua `hashNFTOrder(order)` + domain `BanditMarket`.
- **Các bước:**
  1. `buyer1.buyNFT(order, sig)` → thành công, emit `NFTOrderFilled`.
  2. `buyer2.buyNFT(order, sig)` với cùng order.
- **Kỳ vọng:** revert `NonceUsed()`; `usedNonces[seller][order.nonce] == true`; NFT không đổi chủ.

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B5. Replay Nonce — `FarmTokenClaim.claimTokens` (ECDSA) [SEC-NON-02]

**Mục tiêu:** Một `(user, nonce)` claim đúng 1 lần.

- **Các bước:**
  1. `fundPool(1000 ether)`.
  2. Off-chain ký message theo `hashMessage(user, amount, nonce)`.
  3. `user.claimTokens(amount, nonce, sig)` → emit `TokensClaimed`, `isNonceUsed(user, nonce) == true`.
  4. Gọi lại `claimTokens(amount, nonce, sig)`.
- **Kỳ vọng:** revert `NonceAlreadyUsed(user, nonce)`.

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B6. Replay Nonce — `BanditDogFusion.usedTokenizeNonces` [SEC-NON-03]

- **Các bước:**
  1. Fund FARM cho user, approve cho contract.
  2. `tokenizeDog(count, nonce, sig)` lần 1 → emit `DogTokenized`.
  3. Lặp lại cùng `(count, nonce, sig)`.
- **Kỳ vọng:** revert `NonceUsed()`; mapping `usedTokenizeNonces[keccak256(user, nonce)] == true`.

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B7. Commit–Reveal — `BanditDogFusion.reveal` [SEC-EXPIRE-02 + ECO-FUSION-01/02]

- **Các bước:**
  1. `commit(c1)` → emit `Committed`.
  2. Gọi `commit(c2)` trước khi reveal → revert `AlreadyPending()`.
  3. Gọi `reveal(secretWrong)` → revert `WrongSecret()`.
  4. Gọi `reveal(secret)` trước `TooEarly` block → revert `TooEarly()`.
  5. Time travel đủ block → `reveal(secret)` → emit `Revealed(tokenId, pity)`.
  6. Gọi lại `reveal(secret)` → revert `NoPendingCommit()`.
  7. Sau `CommitExpired`, nếu chưa reveal → `reveal` revert `CommitExpired()`.
- **Kỳ vọng:** đúng danh sách error; `pityCounter` chỉ nhảy khi Tier ≥ 3 (xác minh điều kiện so sánh từ code).

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B8. Access Control — Kiểm tra toàn bộ hàm `onlyOwner` [SEC-ACC-01..07]

- **Mục tiêu:** Non-owner gọi các hàm admin → revert `OwnableUnauthorizedAccount(addr)` (OZ v5).
- **Các bước:** Với mỗi contract, iterate qua danh sách hàm `onlyOwner`; gọi từ `notOwner`; assert revert selector.
- **Kỳ vọng:** Revert thống nhất; **không** state change (assert state before/after bằng nhau).
- **Ghi chú:** đây là bài "sweep" — 1 test file per contract, dùng `for ... of` để giảm boilerplate.

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B9. Kill-switch / Pause [SEC-PAUSE-01..06]

- **Các bước & kỳ vọng (tóm tắt — chi tiết ở code mẫu):**

| Case | Hành động khi paused | Kỳ vọng |
|---|---|---|
| SEC-PAUSE-01 | `FARM.transfer(a, b)` | revert `EnforcedPause` (OZ v5) |
| SEC-PAUSE-02 | `Claim.claimTokens(...)` | revert `EnforcedPause`; `emergencyWithdraw` **vẫn chạy** (không có `whenNotPaused`) |
| SEC-PAUSE-03 | `Guild.stake` / `depositHarvestTax` | revert `EnforcedPause`; `unstake` — **kiểm tra thực tế**: không thấy `whenNotPaused` trên `unstake` → **kỳ vọng cho phép rút** |
| SEC-PAUSE-04 | `Fusion.commit/reveal` | revert `EnforcedPause` |
| SEC-PAUSE-05 | `GuardDogNFT.buyDog` | revert `EnforcedPause`; riêng `mint` từ fusion — không có `whenNotPaused` trên `mint` → xác nhận kỳ vọng |
| SEC-PAUSE-06 | `Market.buyNFT/buyOffchainItem/cancelOrder` | `buyNFT`/`buyOffchainItem` có `whenNotPaused`? `cancelOrder` có thể không |

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B10. Thuế holdings-based — Tier theo ví người dùng [TAX-TIER-01/02/03]

**Mục tiêu:** `getTierOf(account)` xác định theo `balanceOf(account)`, không theo pool hay tổng supply.

- **Tiền điều kiện:** Owner set `setTierThresholds(t2, t3)`.
- **Các bước:**
  1. `expect(await farm.getTierOf(alice)).to.equal(0n)` khi balance = 0.
  2. `farm.transfer(alice, t2)` → `getTierOf(alice) == 1`.
  3. `farm.transfer(alice, t3 - t2 - 1n)` → vẫn tier 1.
  4. `farm.transfer(alice, 1n)` → tier 2.
  5. `balanceOf(alice) == t3` → tier 2; `t3 + 1n` → cần xác minh so sánh (`>=` vs `>`) trong code.
- **Kỳ vọng:** tất cả trả về `bigint` (uint8 → bigint khi so qua ethers v6). **Không** so sánh với `number`.

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B11. Vector né thuế tại ngưỡng [TAX-EVADE-01/02]

**Mục tiêu:** Đảm bảo không có khe hở kiểu "giữ vừa đủ tier thấp để bán với tax thấp nhưng thực tế ví lớn".

- **Các bước:**
  1. Ví A giữ `balance == t2 - 1 wei`.
  2. Ví A bán toàn bộ qua `simulateSell` → ghi `getTierOf` tại block bán là `0`, tax áp `tier0`.
  3. Kiểm tra `_update` **dùng tier tại thời điểm trước hay sau khi trừ value** — đây là điểm nhạy cảm kế toán: `super._update` thường chạy sau khi tính tax; nếu contract tính tax dựa trên `balanceOf(from)` **sau** khi trừ, tier sẽ khác.
  4. Test tương tự với `balance == t3 - 1`.
- **Kỳ vọng:** ghi lại hành vi **thực tế**; nếu contract dùng "balance after" thì đây là rủi ro **né thuế 1-wei** cần báo cáo, **không** tự sửa giả định.

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B12. Tax cap trên `setTaxRates` [TAX-RATE-03]

- **Tiền điều kiện:** signature `setTaxRates` **cần đọc code** (bị cắt trong sơ đồ).
- **Các bước:** Owner thử set rate cực đại; assert revert với custom error (nếu có `FeeTooHigh` style) **hoặc** chấp nhận nếu hàm không chặn.
- **Kỳ vọng:**
  - **Nếu** contract có `MAX_TAX_BPS` → assert revert khi vượt.
  - **Nếu không** → ghi nhận đây là **gap P0** (xem mục d): không có cap on-chain = rug risk.
- **Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B13. Thuế chỉ áp cho Pancake Pair [TAX-PAIR-01]

- **Các bước:**
  1. `farm.setPancakePair(pairAddr)`.
  2. `pair → user` (buy) → assert `TaxCollected`.
  3. `userA → userB` P2P → assert **không** có `TaxCollected`.
- **Kỳ vọng:** chỉ khi `from == pancakePair || to == pancakePair`.

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B14. `FarmTokenClaim` min/max + rotateSigner [ECO-CLAIM-01/02]

- **Các bước (tách 2 test):**
  - (a) Set `setClaimBounds(1e18, 100e18)`. Ký amount = 0 → revert `AmountOutOfBounds(0, min, max)`. Ký amount = max+1 → revert tương tự.
  - (b) Set `setSigner(s1)`; ký với `s1` → success. `setSigner(s2)` → emit `SignerUpdated(s1, s2)`. Ký lại với `s1` (nonce mới) → revert `InvalidSignature`. Ký với `s2` → success.
  - (c) `setSigner(address(0))` → revert `ZeroAddress()`.
- **Kỳ vọng:** đúng error; mapping `usedNonces` per user.

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B15. GuardDogNFT — maxSupply + burnOnPurchase + fusion gate [ECO-NFT-01..03]

- **Các bước:**
  1. `setBurnMode(true)` → mua dog → assert `totalSupply(id)` không tăng (đã burn) nhưng buyer nhận? — **cần đọc code**: `_burnOnPurchase` có thể burn BNB-purchased? Test assert chỉ những gì code thực sự làm.
  2. Mua đến `maxSupply` rồi mua thêm → revert `MaxSupplyReached(tokenId, maxSupply)`.
  3. Gọi `mint(...)` từ ví không phải fusion → revert (`ZeroAddress`/custom hay modifier?) — thực tế có `event FusionContractUpdated` và hàm `setFusionContract`; `mint` chắc chắn có check caller.
  4. `burnShard(alice, 10)` từ non-fusion → revert.
- **Kỳ vọng:** các nhánh trên đúng hành vi; **không** tự bịa error nếu chưa có.

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B16. GuildStaking — UNSTAKE_DELAY + rút khi paused [ECO-GUILD-02/03/06]

- **Các bước:**
  1. `stake(gid, 100e18)`.
  2. `unstake(gid)` ngay → revert `UnstakeNotRequested()` (chưa request).
  3. `requestUnstake(gid)` → emit `UnstakeRequested`. Gọi lại → `AlreadyRequestedUnstake()`.
  4. Advance thời gian chưa đủ (đọc delay từ code — nếu rõ ràng hằng số `UNSTAKE_DELAY` trong code, dùng nó; nếu không, time travel 6 ngày 23h) → `unstake` → revert `UnstakeLocked()`.
  5. Time travel qua delay → `unstake` → emit `Unstaked`, balance FARM của user tăng đúng, `guildTotalStaked` giảm.
  6. **Pause test:** `pause()`, sau đó `requestUnstake` + `unstake` sau delay. Kỳ vọng: **cho phép** (không thấy `whenNotPaused` trên `unstake`). Nếu code thực tế chặn → ghi nhận xung đột với nguyên tắc "kill-switch không được khóa rút quỹ".
- **Kỳ vọng:** đúng theo behavior thực tế.

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B17. `TreasuryBuyBack.executeBuyBack` — slippage + insufficient [ECO-BUY-01]

- **Các bước:**
  1. Router trả về FARM ít hơn `minFarmOut` → revert `SlippageTooHigh()`.
  2. `bnbAmount > address(this).balance` → revert `InsufficientBalance()`.
  3. Happy path → emit `BuyBackExecuted(bnbSpent, farmBurned)` với `bnbSpent == bnbAmount`.
- **Kỳ vọng:** số học bigint; không so sánh number.

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B18. Race condition DB — 2 buyer cùng 1 listing [SYNC-RACE-01]

- **Tiền điều kiện:** DB Postgres e2e (`jest-e2e.json`).
- **Các bước:**
  1. Tạo `MarketplaceListing` với `status = 'active'`.
  2. `Promise.all` 2 request `POST /marketplace/buy/:id` từ 2 user khác nhau.
- **Kỳ vọng:**
  - Đúng 1 request thành công; 1 request fail với conflict (409) hoặc lỗi nghiệp vụ.
  - `MarketplaceListing.status == 'filled'`, `buyer_id` là 1 trong 2.
  - **Không** có 2 row `processed_onchain_txs` cho cùng fill.
- **Rủi ro:** nếu `buy` không dùng `SELECT ... FOR UPDATE` / conditional `UPDATE status='active'`, race tồn tại.

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B19. Idempotency listener — unique (`tx_hash` + `log_index`) [SYNC-IDEMP-01]

- **Mục tiêu:** Event listener chạy lại cùng event không double-credit.
- **Migration tham chiếu:** `1700000000030-AddProcessedOnchainTxs`, entity `ProcessedOnchainTx`.
- **Các bước:**
  1. Insert `ProcessedOnchainTx { tx_hash: h, log_index: 0, event_type: 'DogPurchased' }`.
  2. Insert lại cùng `(h, 0)` → kỳ vọng unique violation.
  3. Kiểm tra `UNIQUE(tx_hash, log_index)` có tồn tại trong migration 30 (nếu không → gap P0).
- **Lưu ý:** cần xác minh composite unique; nếu chỉ có `UNIQUE(tx_hash)` thì listener gộp nhiều log cùng tx gãy.

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B20. Optimistic locking gold_balance [SYNC-OPT-01]

- **Các bước:** 2 request song song cùng `POST /action/harvest` cho cùng plot.
- **Kỳ vọng:** 1 fail với "plot not harvestable/already harvested"; `User.gold_balance` **không** tăng gấp đôi.
- **Ghi chú:** `User` entity trong sơ đồ **không** có `@VersionColumn`. Đây là điểm kiểm tra: nếu không có version, service phải dùng conditional update (`UPDATE users SET gold = gold + :delta WHERE id = :id`) hoặc pessimistic lock.

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B21. DTO validation — whitelist [VAL-DTO-01]

- **Các bước:** POST bất kỳ endpoint với payload có thêm field lạ (`isAdmin: true`, `gold_balance: 1e9`).
- **Kỳ vọng:** 400 với message từ `forbidNonWhitelisted`. **Không** có field nào lọt vào service.

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B22. `SyncNftDto.walletAddress` [VAL-DTO-02] — ⚠ cần xác minh decorator

- **Các bước:** Test các input `undefined`, `""`, `"0x"`, `"0xabc"`, `42` (number), `"0x" + "a".repeat(40)`.
- **Kỳ vọng:**
  - Nếu có `@IsEthereumAddress()` / `@Matches(/^0x[a-fA-F0-9]{40}$/)` → reject các input sai, chấp nhận input đúng.
  - Nếu **không** → ghi **gap P0** trong mục (d).
- **Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B23. `RepairDto.amount` [VAL-DTO-03] — ⚠ cần xác minh decorator

- **Các bước:** Test `amount = -1`, `amount = "1"` (string bị ép sang number?), `amount = NaN`, `amount = 1e15` (quá lớn), `amount` thiếu.
- **Kỳ vọng:** nếu `@IsInt() @Min(1)` → reject đúng; nếu thiếu → ghi gap.

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B24. Không cho phép implicit numeric conversion trên tiền [VAL-DTO-11]

- **Các bước:** Gửi `ClaimSignatureDto` với `amount` là số JS; gửi `CreateListingDto.price_farm` số; verbose log ra payload đã transform.
- **Kỳ vọng:** service nhận string, không phải number; hoặc reject với 400. **Không** cho `transform: true` + `enableImplicitConversion: true` biến `"0x..."` thành giá trị lạ.

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

### B25. `marketplace_listings` schema — tx_hash & eip712_sig [SYNC-IDEMP-02]

- **Migration:** `1700000000027-AddTxHashToListings`.
- **Các bước:** POST `/marketplace/buy/:id` thành công, kiểm tra `tx_hash` ghi vào row đó; insert row mới với cùng `tx_hash` → unique violation nếu migration thiết kế unique.

**Trạng thái:** `Chưa chạy` · **Kết quả:** —

---

## (c) Code mẫu Hardhat (TypeScript) & Jest

### C1. `test/TreasuryBuyBack.security.test.ts` — Reentrancy [SEC-RNT-01]

```solidity
// contracts/src/test/MaliciousRouter.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITreasury {
    function executeBuyBack(uint256 bnbAmount, uint256 minFarmOut) external;
}

contract MaliciousRouter {
    ITreasury public target;
    address public farm;
    bool private attacking;

    constructor(address _farm) { farm = _farm; }
    function setTarget(address _t) external { target = ITreasury(_t); }

    function swapExactETHForTokens(
        uint256, address[] calldata, address, uint256
    ) external payable returns (uint256[] memory amounts) {
        if (!attacking) {
            attacking = true;
            // cố tình re-enter
            target.executeBuyBack(1, 0);
        }
        // trả token tối thiểu để không dính SlippageTooHigh (nếu code tới đây)
        amounts = new uint256[](1);
        amounts[0] = 0;
        return amounts;
    }
}
```

```ts
// contracts/test/TreasuryBuyBack.security.test.ts
import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("TreasuryBuyBack — security", () => {
  async function deployFixture() {
    const [owner, alice] = await ethers.getSigners();

    const FARM = await ethers.deployContract("MockERC20");
    await FARM.waitForDeployment();

    const Router = await ethers.deployContract("MaliciousRouter", [await FARM.getAddress()]);
    await Router.waitForDeployment();

    const BB = await ethers.deployContract("TreasuryBuyBack", [
      owner.address,
      await Router.getAddress(),
      await FARM.getAddress(),
      // ... theo constructor signature thực tế của TreasuryBuyBack
    ]);
    await BB.waitForDeployment();

    await Router.setTarget(await BB.getAddress());
    // fund BNB vào contract
    await owner.sendTransaction({ to: await BB.getAddress(), value: ethers.parseEther("10") });

    return { owner, alice, FARM, Router, BB };
  }

  it("executeBuyBack không cho router re-enter (nonReentrant) [SEC-RNT-01]", async () => {
    const { owner, BB } = await loadFixture(deployFixture);
    const balanceBefore = await ethers.provider.getBalance(await BB.getAddress());

    // MaliciousRouter sẽ gọi lại executeBuyBack trong swap
    await expect(
      BB.executeBuyBack(ethers.parseEther("1"), 0n)
    ).to.be.reverted; // selector cụ thể: ReentrancyGuardReentrantCall (OZ v5) — xác minh sau khi chạy

    const balanceAfter = await ethers.provider.getBalance(await BB.getAddress());
    expect(balanceAfter).to.equal(balanceBefore);
  });

  it("executeBuyBack revert InsufficientBalance khi bnb vượt số dư [ECO-BUY-01]", async () => {
    const { BB } = await loadFixture(deployFixture);
    const tooMuch = ethers.parseEther("1000000");
    await expect(BB.executeBuyBack(tooMuch, 0n))
      .to.be.revertedWithCustomError(BB, "InsufficientBalance");
  });
});
```

### C2. `test/BanditMarket.replay.test.ts` — EIP-712 replay [SEC-NON-01, SEC-SIG-03, SEC-EXPIRE-01]

```ts
import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("BanditMarket — EIP-712 replay", () => {
  async function deployFixture() {
    const [owner, seller, buyer1, buyer2] = await ethers.getSigners();

    const FARM = await ethers.deployContract("MockERC20");
    await FARM.waitForDeployment();

    const Market = await ethers.deployContract("BanditMarket", [
      await FARM.getAddress(),
      owner.address,     // treasury
      owner.address,     // owner
    ]);
    await Market.waitForDeployment();

    const MarketAddr = await Market.getAddress();
    const chainId = (await ethers.provider.getNetwork()).chainId;

    const domain = {
      name: "BanditMarket",
      version: "1",
      chainId,
      verifyingContract: MarketAddr,
    } as const;

    return { owner, seller, buyer1, buyer2, Market, domain, FARM };
  }

  async function makeSigner(domain: any) {
    // Tuỳ schema thực tế NFTOrder trong BanditMarket.sol (tokens, tokenId, price, nonce, deadline, ...)
    const types = {
      NFTOrder: [
        { name: "seller",   type: "address" },
        { name: "nft",      type: "address" },
        { name: "tokenId",  type: "uint256" },
        { name: "amount",   type: "uint256" },
        { name: "price",    type: "uint256" },
        { name: "nonce",    type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    } as const;
    return types;
  }

  it("cùng order không thể fill 2 lần → NonceUsed [SEC-NON-01]", async () => {
    const { seller, buyer1, buyer2, Market, domain } = await loadFixture(deployFixture);
    const types = await makeSigner(domain);

    const deadline = BigInt(await time.latest()) + 3600n;
    const order = {
      seller: seller.address,
      nft: await Market.getAddress(),        // placeholder — set theo test thực
      tokenId: 1n,
      amount: 1n,
      price: ethers.parseEther("1"),
      nonce: 7n,
      deadline,
    };

    const sig = await seller.signTypedData(domain, types, order);

    // Lần 1: kỳ vọng fail vì chưa hold NFT / chưa approve trước — setup trước ở test thực
    // ... approve NFT cho Market, buyer1 approve FARM ...
    await Market.connect(buyer1).buyNFT(order, sig);

    await expect(
      Market.connect(buyer2).buyNFT(order, sig)
    ).to.be.revertedWithCustomError(Market, "NonceUsed");
  });

  it("signature từ ví không phải seller → BadSignature [SEC-SIG-03]", async () => {
    const { seller, buyer1, Market, domain } = await loadFixture(deployFixture);
    const types = await makeSigner(domain);
    const deadline = BigInt(await time.latest()) + 3600n;
    const order = { seller: seller.address, nft: await Market.getAddress(), tokenId: 1n,
      amount: 1n, price: ethers.parseEther("1"), nonce: 8n, deadline };
    const badSig = await buyer1.signTypedData(domain, types, order); // seller trong struct nhưng ký bởi buyer1
    await expect(Market.connect(buyer1).buyNFT(order, badSig))
      .to.be.revertedWithCustomError(Market, "BadSignature");
  });

  it("deadline hết hạn → OrderExpired [SEC-EXPIRE-01]", async () => {
    const { seller, buyer1, Market, domain } = await loadFixture(deployFixture);
    const types = await makeSigner(domain);
    const deadline = BigInt(await time.latest()) - 1n;
    const order = { seller: seller.address, nft: await Market.getAddress(), tokenId: 1n,
      amount: 1n, price: ethers.parseEther("1"), nonce: 9n, deadline };
    const sig = await seller.signTypedData(domain, types, order);
    await expect(Market.connect(buyer1).buyNFT(order, sig))
      .to.be.revertedWithCustomError(Market, "OrderExpired");
  });
});
```

### C3. `test/BanditDogFusion.commitReveal.test.ts` — commit/reveal + pity [SEC-NON-03, SEC-EXPIRE-02, ECO-FUSION-01/02]

```ts
import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("BanditDogFusion — commit/reveal", () => {
  async function fixture() {
    const [owner, backend, alice, bob] = await ethers.getSigners();
    const FARM = await ethers.deployContract("MockERC20");
    await FARM.waitForDeployment();
    const NFT = await ethers.deployContract("GuardDogNFT", [
      // tuỳ constructor thực tế
      owner.address, "https://meta/"
    ]);
    await NFT.waitForDeployment();

    const Fusion = await ethers.deployContract("BanditDogFusion", [
      await FARM.getAddress(),
      await NFT.getAddress(),
      owner.address,
      backend.address,
    ]);
    await Fusion.waitForDeployment();
    await NFT.connect(owner).setFusionContract(await Fusion.getAddress());

    await FARM.mint(alice.address, ethers.parseEther("10"));
    await FARM.connect(alice).approve(await Fusion.getAddress(), ethers.MaxUint256);

    return { owner, backend, alice, bob, FARM, NFT, Fusion };
  }

  it("commit trùng → AlreadyPending [ECO-FUSION-01]", async () => {
    const { alice, Fusion } = await loadFixture(fixture);
    const c = ethers.keccak256(ethers.toUtf8Bytes("c1"));
    await Fusion.connect(alice).commit(c);
    await expect(Fusion.connect(alice).commit(c))
      .to.be.revertedWithCustomError(Fusion, "AlreadyPending");
  });

  it("reveal ngay sau commit (chưa đủ block) → TooEarly [SEC-EXPIRE-02]", async () => {
    const { alice, Fusion } = await loadFixture(fixture);
    const secret = ethers.hexlify(ethers.randomBytes(32));
    // Commit pattern thực tế: keccak256(abi.encodePacked(secret, player, blockNumber)) hay tương tự —
    // PHẢI đọc code; ở đây minh hoạ pattern đơn giản.
    const commitment = ethers.solidityPackedKeccak256(["bytes32", "address"], [secret, alice.address]);
    await Fusion.connect(alice).commit(commitment);
    await expect(Fusion.connect(alice).reveal(secret))
      .to.be.revertedWithCustomError(Fusion, "TooEarly");
  });

  it("reveal sai secret → WrongSecret", async () => {
    const { alice, Fusion } = await loadFixture(fixture);
    const secret = ethers.hexlify(ethers.randomBytes(32));
    const commitment = ethers.solidityPackedKeccak256(["bytes32", "address"], [secret, alice.address]);
    await Fusion.connect(alice).commit(commitment);
    await time.increase(60); // tuỳ MinRevealDelay thực tế
    await expect(Fusion.connect(alice).reveal(ethers.hexlify(ethers.randomBytes(32))))
      .to.be.revertedWithCustomError(Fusion, "WrongSecret");
  });

  it("tokenizeDog nonce replay → NonceUsed [SEC-NON-03]", async () => {
    const { alice, backend, Fusion } = await loadFixture(fixture);
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const domain = { name: "BanditDogFusion", version: "1", chainId,
      verifyingContract: await Fusion.getAddress() } as const;
    const types = {
      Tokenize: [
        { name: "player", type: "address" },
        { name: "count", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    } as const;
    const nonce = 1n;
    const msg = { player: alice.address, count: 1n, nonce };
    const sig = await backend.signTypedData(domain, types, msg);

    await Fusion.connect(alice).tokenizeDog(1n, nonce, sig);
    await expect(Fusion.connect(alice).tokenizeDog(1n, nonce, sig))
      .to.be.revertedWithCustomError(Fusion, "NonceUsed");
  });
});
```

### C4. `test/FarmToken.tax.boundary.test.ts` — Tier boundary [TAX-TIER-02/03, TAX-EVADE-01]

```ts
import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("FarmToken — tax tier boundary", () => {
  async function fixture() {
    const [owner, alice, pair] = await ethers.getSigners();
    const FARM = await ethers.deployContract("FarmToken", [owner.address]);
    await FARM.waitForDeployment();

    const t2 = ethers.parseEther("1000");
    const t3 = ethers.parseEther("5000");
    await FARM.connect(owner).setTierThresholds(t2, t3);
    await FARM.connect(owner).setPancakePair(pair.address);
    await FARM.connect(owner).excludeFromFee(owner.address, true);
    await FARM.mint(owner.address, ethers.parseEther("1000000")); // giả định có mint cho owner hoặc qua constructor
    // Nếu FarmToken không có mint, thay bằng transfer từ owner (excluded) sang alice

    return { owner, alice, FARM, t2, t3 };
  }

  it("getTierOf theo balance VÍ (không phải pool) — boundary tier2", async () => {
    const { owner, alice, FARM, t2 } = await loadFixture(fixture);

    expect(await FARM.getTierOf(alice.address)).to.equal(0n);

    await FARM.connect(owner).transfer(alice.address, t2 - 1n);
    expect(await FARM.getTierOf(alice.address)).to.equal(0n);

    await FARM.connect(owner).transfer(alice.address, 1n);   // == t2
    // Cần xác minh điều kiện code: `balance >= t2` hay `> t2`
    expect(await FARM.getTierOf(alice.address)).to.equal(1n);
  });

  it("boundary tier3", async () => {
    const { owner, alice, FARM, t3 } = await loadFixture(fixture);
    await FARM.connect(owner).transfer(alice.address, t3 - 1n);
    expect(await FARM.getTierOf(alice.address)).to.equal(1n);
    await FARM.connect(owner).transfer(alice.address, 1n);
    expect(await FARM.getTierOf(alice.address)).to.equal(2n);
  });

  it("evasion: 'bán' ngay tại biên tier2-1 → tax áp tier0 [TAX-EVADE-01]", async () => {
    // Vector: giữ đúng tier2-1 wei, bán xuống tier0 → assert tax tier0.
    // Việc này dùng _update qua pancake pair — cần mock pair contract.
    // Ghi nhận: hành vi thực tế → ghi vào report, KHÔNG assert hardcode nếu chưa rõ code.
  });
});
```

### C5. `test/FarmTokenClaim.replay.test.ts` — ECDSA nonce + setSigner [ECO-CLAIM-02, SEC-NON-02]

```ts
import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("FarmTokenClaim — replay & rotate", () => {
  async function fixture() {
    const [owner, s1, s2, alice] = await ethers.getSigners();
    const FARM = await ethers.deployContract("MockERC20");
    await FARM.waitForDeployment();
    const Claim = await ethers.deployContract("FarmTokenClaim", [
      await FARM.getAddress(),
      s1.address,
      owner.address,
      0n,               // minAmount
      ethers.MaxUint256,// maxAmount (tuỳ constructor signature thực tế)
    ]);
    await Claim.waitForDeployment();
    await FARM.mint(await Claim.getAddress(), ethers.parseEther("100000"));
    return { owner, s1, s2, alice, FARM, Claim };
  }

  async function buildSig(signer: any, Claim: any, user: string, amount: bigint, nonce: bigint) {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const domain = { name: "FarmTokenClaim", version: "1", chainId,
      verifyingContract: await Claim.getAddress() } as const;
    const types = {
      Claim: [
        { name: "user", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    } as const;
    return signer.signTypedData(domain, types, { user, amount, nonce });
  }

  it("cùng (user, nonce) không thể claim 2 lần [SEC-NON-02]", async () => {
    const { s1, alice, Claim } = await loadFixture(fixture);
    const amount = ethers.parseEther("10");
    const nonce = 1n;
    const sig = await buildSig(s1, Claim, alice.address, amount, nonce);

    await Claim.connect(alice).claimTokens(amount, nonce, sig);
    expect(await Claim.isNonceUsed(alice.address, nonce)).to.equal(true);

    await expect(Claim.connect(alice).claimTokens(amount, nonce, sig))
      .to.be.revertedWithCustomError(Claim, "NonceAlreadyUsed");
  });

  it("rotateSigner → SignerUpdated, sig cũ bị reject [ECO-CLAIM-02]", async () => {
    const { s1, s2, alice, Claim } = await loadFixture(fixture);
    const amount = ethers.parseEther("10");

    const sigOld = await buildSig(s1, Claim, alice.address, amount, 2n);
    await expect(Claim.setSigner(s2.address))
      .to.emit(Claim, "SignerUpdated").withArgs(s1.address, s2.address);

    await expect(Claim.connect(alice).claimTokens(amount, 2n, sigOld))
      .to.be.revertedWithCustomError(Claim, "InvalidSignature");

    const sigNew = await buildSig(s2, Claim, alice.address, amount, 3n);
    await Claim.connect(alice).claimTokens(amount, 3n, sigNew);
  });

  it("setSigner(0) → ZeroAddress", async () => {
    const { Claim } = await loadFixture(fixture);
    await expect(Claim.setSigner(ethers.ZeroAddress))
      .to.be.revertedWithCustomError(Claim, "ZeroAddress");
  });

  it("pause chặn claimTokens nhưng emergencyWithdraw vẫn chạy [SEC-PAUSE-02]", async () => {
    const { owner, alice, Claim } = await loadFixture(fixture);
    await Claim.connect(owner).pause();
    // claimTokens — giả định cần sig hợp lệ
    // ... expect revertWithCustomError(Claim, "EnforcedPause");
    await expect(Claim.connect(owner).emergencyWithdraw(1n))
      .to.emit(Claim, "EmergencyWithdraw");
  });
});
```

### C6. `backend/src/modules/web3/dto/web3.dto.spec.ts` — DTO validation [VAL-DTO-02, VAL-DTO-04, VAL-DTO-11]

```ts
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SyncNftDto } from './web3.dto';

async function validateDto(metatype: any, payload: unknown) {
  const instance = plainToInstance(metatype, payload, { enableImplicitConversion: false });
  const errors = await validate(instance as object, { whitelist: true, forbidNonWhitelisted: true });
  return { instance, errors };
}

describe('SyncNftDto validation [VAL-DTO-02]', () => {
  it('chấp nhận địa chỉ wallet hợp lệ', async () => {
    const { errors } = await validateDto(SyncNftDto, {
      walletAddress: '0x' + 'a'.repeat(40),
      tokenId: 1,
    });
    expect(errors).toHaveLength(0);
  });

  it('reject walletAddress thiếu / sai format', async () => {
    for (const bad of ['', '0x', '0x123', 42 as unknown as string]) {
      const { errors } = await validateDto(SyncNftDto, { walletAddress: bad as any, tokenId: 1 });
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('reject field thừa (mass-assignment)', async () => {
    const { errors } = await validateDto(SyncNftDto, {
      walletAddress: '0x' + 'a'.repeat(40),
      tokenId: 1,
      isAdmin: true, // phải bị chặn bởi forbidNonWhitelisted
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});
```

### C7. `backend/test/processed-onchain-tx.e2e-spec.ts` — Idempotency [SYNC-IDEMP-01]

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { ProcessedOnchainTx } from '../src/modules/marketplace/entities/processed-onchain-tx.entity';

describe('ProcessedOnchainTx idempotency (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    ds = app.get(DataSource);
  });

  afterAll(async () => { await app.close(); });

  it('unique (tx_hash, log_index) [SYNC-IDEMP-01]', async () => {
    const repo = ds.getRepository(ProcessedOnchainTx);
    const row = { event_type: 'DogPurchased', tx_hash: '0x' + 'b'.repeat(64), log_index: 0 };
    await repo.insert(row);
    await expect(repo.insert(row)).rejects.toBeDefined();
    // Nếu cột log_index KHÔNG nằm trong unique composite → test sẽ pass sai.
    // Phải assert thêm: 2 log cùng tx_hash, khác log_index đều insert được.
    await repo.insert({ ...row, log_index: 1 });
  });
});
```

### C8. `test/GuildStaking.pause.test.ts` — Rút khi paused [ECO-GUILD-06]

```ts
import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("GuildStaking — pause & unstake", () => {
  async function fixture() {
    const [owner, alice] = await ethers.getSigners();
    const FARM = await ethers.deployContract("MockERC20");
    await FARM.waitForDeployment();
    const Staking = await ethers.deployContract("GuildStaking", [
      await FARM.getAddress(),
      owner.address,
    ]);
    await Staking.waitForDeployment();
    await FARM.mint(alice.address, ethers.parseEther("100"));
    await FARM.connect(alice).approve(await Staking.getAddress(), ethers.MaxUint256);
    return { owner, alice, FARM, Staking };
  }

  it("stake revert khi paused; unstake sau delay VẪN chạy khi paused", async () => {
    const { owner, alice, Staking } = await loadFixture(fixture);
    const guildId = ethers.id("guild-1");

    // happy path chuẩn bị
    await Staking.connect(alice).stake(guildId, ethers.parseEther("50"));
    await Staking.connect(alice).requestUnstake(guildId);

    // Time travel qua delay — delay thực tế đọc từ code; time travel quá dư
    await time.increase(60 * 60 * 24 * 30);

    await Staking.connect(owner).pause();

    // stake bị chặn
    await expect(Staking.connect(alice).stake(guildId, 1n))
      .to.be.reverted; // EnforcedPause

    // unstake — KỲ VỌNG: cho phép (không có whenNotPaused trên unstake)
    await expect(Staking.connect(alice).unstake(guildId))
      .to.emit(Staking, "Unstaked");
  });

  it("requestUnstake 2 lần → AlreadyRequestedUnstake", async () => {
    const { alice, Staking } = await loadFixture(fixture);
    const guildId = ethers.id("g2");
    await Staking.connect(alice).stake(guildId, 1n);
    await Staking.connect(alice).requestUnstake(guildId);
    await expect(Staking.connect(alice).requestUnstake(guildId))
      .to.be.revertedWithCustomError(Staking, "AlreadyRequestedUnstake");
  });

  it("unstake chưa request → UnstakeNotRequested", async () => {
    const { alice, Staking } = await loadFixture(fixture);
    const guildId = ethers.id("g3");
    await Staking.connect(alice).stake(guildId, 1n);
    await expect(Staking.connect(alice).unstake(guildId))
      .to.be.revertedWithCustomError(Staking, "UnstakeNotRequested");
  });
});
```

---

## (d) Rủi ro & Khuyến nghị

> Phân loại theo mức độ ảnh hưởng; **không** gán tỷ lệ pass/fail.

### P0 — Phải xử lý trước khi lên mainnet / trước khi public beta

| # | Rủi ro | Bằng chứng / điểm cần xác minh | Khuyến nghị |
|---|---|---|---|
| P0-1 | **Không chắc tồn tại cap thuế** (`MAX_TAX_BPS` không thấy trong `FarmToken.sol`) | Brief yêu cầu test cap; sơ đồ chỉ có `setTaxRates(` (bị cắt) | Đọc code xác minh; nếu chưa có, thêm `MAX_TAX_BPS` và revert khi `buyBps/tier`, `sellBps/tier` > cap. Thêm event `TaxRatesUpdated`. |
| P0-2 | **Né thuế bằng ngưỡng tier** — tier dùng `balanceOf(from)` tại thời điểm `_update` | Cần test TAX-EVADE-01/02 | Test kỹ biên; nếu contract dùng "balance after" hoặc "balance before", chọn cố định + document. Cân nhắc snapshot balance trước `super._update`. |
| P0-3 | **Reentrancy qua router ở `TreasuryBuyBack.executeBuyBack`** | Contract có `ReentrancyGuard` + `whenNotPaused` — cần verify lần chạy thật | Chạy `test/TreasuryBuyBack.security.test.ts`; nếu router là `immutable` set trong constructor **và** owner có thể đổi → thêm timelock set router. |
| P0-4 | **Nonce replay ECDSA/EIP-712**: `usedNonces[seller][nonce]` ở `BanditMarket` là 1-1 (không có domain separation theo chain? ) | Sơ đồ không thấy `chainId` trong domain — verify `_domainSeparatorV4` có `block.chainid` | Đảm bảo `hashNFTOrder`/`hashOffchainOrder` domain có `chainId` + `verifyingContract`; tăng test cross-chain replay. |
| P0-5 | **`GuildStaking.unstake` không có `whenNotPaused`** — chủ ý hay bug? | Sơ đồ: `unstake(bytes32) external nonReentrant` (không `whenNotPaused`) | Nếu chủ ý → document đây là "always-exit" pattern (khuyến nghị giữ). Nếu vô tình → **giữ nguyên**, chuyển thành design note. |
| P0-6 | **Idempotency event listener**: chưa xác minh unique `(tx_hash, log_index)`. | Migration `1700000000030-AddProcessedOnchainTxs` | Bắt buộc có composite unique. Nếu chỉ unique `tx_hash` → 1 tx có nhiều event sẽ bị gộp → thiếu sự kiện. Test SYNC-IDEMP-01. |
| P0-7 | **Race condition 2 buyer cùng listing** (không có `@VersionColumn` trên `MarketplaceListing`) | Sơ đồ entity không có `version`; check service | Dùng `UPDATE ... WHERE id = :id AND status = 'active'` và kiểm tra `affected === 1`, hoặc pessimistic lock. Thêm unique `(listing_id, buyer_id)`. |
| P0-8 | **`SyncNftDto.walletAddress` & `RepairDto.amount` chưa xác minh validator** | Sơ đồ DTO chỉ liệt kê tên field | Đọc code; nếu thiếu `@IsEthereumAddress`, `@Matches(/^0x[a-fA-F0-9]{40}$/)`, `@IsPositive` → **thêm ngay**. Test VAL-DTO-02/03. |
| P0-9 | **Không cho phép implicit numeric conversion cho tiền FARM/gold** | `ValidationPipe {transform: true}` — cần đảm bảo không bật `enableImplicitConversion` cho số tiền | Dùng string + `@Matches(/^\d+$/)`; cấm `@IsNumber()` cho `amount_wei`/`price_farm`. Test VAL-DTO-11. |
| P0-10 | **Access control sweep chưa có test tự động** | Nhiều contract có nhiều hàm `onlyOwner` | Viết file sweep per contract (C-B8); fail build nếu có hàm admin thiếu test. |
| P0-11 | **Kill-switch không thể rút quỹ user** (nếu chặn `unstake`, `emergencyWithdraw`) | `GuildStaking.unstake` (không pause-gate) và `FarmTokenClaim.emergencyWithdraw` (không pause-gate) — đúng pattern | Bổ sung test đảm bảo PAUSE **không** chặn hai hàm này. |
| P0-12 | **`FarmTokenClaim.setSigner` rotе** có emit event đúng và sig cũ bị reject? | Sơ đồ có `SignerUpdated` | Test rotateSigner.ts end-to-end: đổi signer → ký lại → verify on-chain. |

### P1 — Nên xử lý trước khi scale

| # | Rủi ro | Khuyến nghị |
|---|---|---|
| P1-1 | **`UNSTAKE_DELAY` không hiện trong sơ đồ** | Đọc code; nếu là constant `immutable uint64` → viết test đọc từ biến on-chain; nếu hard-code 7 ngày → chuyển thành `onlyOwner` configurable + event `UnstakeDelayUpdated`. |
| P1-2 | **`pityCounter` reset điều kiện "Tier ≥ 3"** — biên `>=` vs `>` | Test fixture cho từng tier; nếu chưa có hàm `getPityOf` view → thêm để test off-chain. |
| P1-3 | **`Soul Shard id 9999` không hiện trong sơ đồ** — xác minh | Nếu là literal `9999` trong `BanditDogFusion`, chuyển thành constant có tên, có event. Test ECO-FUSION-05/06. |
| P1-4 | **`BanditDogFusion._resolveTokenId` deterministic?** — nếu dùng `block.prevrandao` → predictable | Nếu predict được, không phải lỗi bảo mật nếu front-run không khả thi vì cần `reveal` với secret của user; nhưng **phải** ensure commit đủ block trước. |
| P1-5 | **`GuardDogNFT.burnOnPurchase`** — cần assert tổng cung + người mua | Test mua với `setBurnMode(true)` và `setBurnMode(false)`; assert `totalSupply` + `balanceOf`. |
| P1-6 | **`TreasuryBuyBack.recoverERC20`/`recoverBNB` có thể rút FARM đã mua** | Nếu owner rút FARM thì phá vỡ buy-back commitment. Thêm `onlyOwner` + timelock hoặc giới hạn chỉ FARM không phải token đích. |
| P1-7 | **`LiquidityLocker` — kiểm tra `NotBeneficiary`** và không có `whenNotPaused` | Test `withdraw` với beneficiary khác → revert; `withdraw` trước `unlockTime` → `NotYet`. |
| P1-8 | **Race condition DB khi sync deposit** — `DepositVerifyDto` không check replay `txHash` | Unique `(user_id, tx_hash)` trong bảng `processed_onchain_txs` hoặc bảng riêng. Test SYNC-REORG-01. |
| P1-9 | **Không có test reorg handler** | Mock event handler chạy 2 lần cùng `(tx_hash, log_index)` → no-op lần 2. |
| P1-10 | **`BanditMarket._splitFee`** — cap bps (contract có `FeeTooHigh`) | Test `setFee > cap` → `FeeTooHigh`; math bigint cho `price` lẻ. |
| P1-11 | **`MarketplaceListing.eip712_sig` lưu raw** — nếu lộ ra public API | Kiểm tra response API không trả `eip712_sig`. Test sync DTO output. |

### P2 — Cải thiện / vệ sinh

| # | Rủi ro | Khuyến nghị |
|---|---|---|
| P2-1 | **`SystemConfig` key/value parse** — schema drift | Thêm test round-trip JSON parse cho `configuration.ts`. |
| P2-2 | **`DexVolumeService.computeTierFromBalance`** — có thể lệch khỏi `FarmToken.getTierOf` | Thêm test so trực tiếp hai hàm với cùng một balance. |
| P2-3 | **`user_items.locked_quantity`** — race khi pack crate | Test pack/unpack song song; dùng conditional update. |
| P2-4 | **`User.notifications_enabled`** — DTO `UpdateWalletDto` không cover | Mở rộng DTO hoặc endpoint chuyên biệt; test VAL-DTO-08. |
| P2-5 | **`quest.service.ts` `pickDailyIndices`** — tính deterministic theo `(userId, dateStr, poolSize)` | Thêm unit test: cùng input → cùng output; khác date → có thể khác. |
| P2-6 | **`steal_logs.is_anonymous`** — privacy | Test API không trả `thief_id` khi `is_anonymous = true`. |
| P2-7 | **Frontend `friendlyError`** — map custom errors on-chain | Thêm test cho `useClaimTokens.friendlyError` và `useMarketplaceTrade` step mapping khi revert với các custom error vừa liệt kê. |
| P2-8 | **Loader `load_test_barnbuddy.js`** — smoke test dùng K6 | Đảm bảo không chạy trên prod; gắn cờ môi trường. |

---

### Tổng kết trạng thái

- **Tổng số kịch bản liệt kê:** ~80 test case / ~30 test file dự kiến.
- **Trạng thái:** **`Chưa chạy`** — không có cột Kết quả nào được điền.
- **Điều kiện tiên quyết để chạy:**
  1. Xác minh các dấu **⚠** trong sơ đồ (`MAX_TAX_BPS`, `UNSTAKE_DELAY`, `SOUL_SHARD_ID`, constructor signatures của `TreasuryBuyBack`, `BanditMarket`, `GuardDogNFT`, `FarmTokenClaim`).
  2. Xác minh validator của `SyncNftDto.walletAddress`, `RepairDto.amount`.
  3. Xác minh unique constraint ở migration 30.
- **Không** có tỷ lệ PASS nào được ghi trong tài liệu này.