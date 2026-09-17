# Marketplace Gap Analysis & Task Review
> Tài liệu này để review trước khi bắt đầu dev.  
> Nguồn spec: `marketplace.md` — 3 Module (DEX Swap / Dynamic Peg / P2P Marketplace)  
> Ngày phân tích: 2026-09-11  
> **Cập nhật:** Bổ sung kết quả Senior Architect Review (2026-09-11)

---

## ⚡ KẾT QUẢ REVIEW ARCHITECT (2026-09-11)

**Điểm đánh giá: 90/100** — Kiến trúc tổng thể tốt, đặc biệt phần Row-level Lock, Idempotency, Fallback RPC.

### LỖ HỔNG CHÍ MẠNG — Module 3: BanditMarket.sol (BLOCKER)

**Vấn đề:** Spec gốc mô tả dùng `ERC-1155 safeTransferFrom` cho TẤT CẢ tài sản. Điều này chỉ đúng với Guard Dog (NFT on-chain). Crates / Kính Lúp / Master Key là tài sản off-chain trong bảng `user_items` — Smart Contract KHÔNG THỂ chuyển chúng → mọi giao dịch mua bán Crate/Tools sẽ **REVERT**.

**Giải pháp đã được kiến trúc sư confirm:** Tách `BanditMarket.sol` thành 2 hàm:

| Hàm | Loại tài sản | Luồng | Event |
|-----|-------------|-------|-------|
| `buyNFT()` | Guard Dog (ERC-1155 on-chain) | Thu $FARM → `safeTransferFrom` NFT | `NFTOrderFilled` |
| `buyOffchainItem()` | Crates, Kính Lúp, Master Key (off-chain) | Thu $FARM → emit Event (backend giao hàng trong DB) | `OffchainItemSold` |

**GitHub Issues mới tạo:**
- **#76** — BanditMarket.sol split + EIP-712 cho cả 2 hàm ← **BLOCKER**
- **#77** — Backend listener cho `OffchainItemSold` → deliver via `user_items`
- **#78** — Hardhat test suite: 10 test cases (5 cho buyNFT + 5 cho buyOffchainItem)

### Tinh chỉnh Event Name
Dùng `NFTOrderFilled` (thay `TradeExecuted`) và `OffchainItemSold` để nhất quán với Sprint backlog.

---

## 1. TỔNG KẾT TRẠNG THÁI HIỆN TẠI

### ✅ Đã hoàn thành (Đóng GitHub)

| Issue | Tên | Ghi chú |
|-------|-----|---------|
| #19 | P2P Marketplace Backend | EIP-712, user_items listing, cancel |
| #47 | Marketplace UI | 3 sections, browse/sell/my-listings |
| #60 | Unified Marketplace Backend | asset_type column, list-item endpoint |
| #61 | Viral Items Backend | Kính Lúp, Master Key trong user_items |
| #62 | Crops/Crates Tab UI | Browse + My Listings trong MarketplaceModal |
| #63 | Tools Tab UI | Kính Lúp, Master Key UI trong StorageModal |
| #64 | Blockchain Indexer — OrderFilled routing | TradeExecuted handler, cronjob 5 phút |
| #65 | Soul Shards + v3 deploy | Token ID 9999, syncGuardDogs |
| #66 | Seasonal Seeds Marketplace | Listing từ StorageModal Nông Sản tab |
| #67 | Crate System | pack/unpack endpoints + UI trong Nhà Kho |
| #68 | Guard Dog Sell-Lock + is_guarding | DOG_IS_GUARDING error, migration #29 |
| #69 | Nhà Kho 3-tab Modal | Nông Sản / Vật Phẩm / Chuồng Chó |

---

## 2. CÁC ISSUE ĐANG MỞ LIÊN QUAN MARKETPLACE

| Issue | Tên | Trạng thái | Thuộc Gap |
|-------|-----|-----------|----------|
| **#76** | **BanditMarket.sol split — buyNFT + buyOffchainItem** | **OPEN (NEW — BLOCKER)** | **Contract Bug** |
| **#77** | **Backend: OffchainItemSold listener + user_items delivery** | **OPEN (NEW)** | **Contract Bug** |
| **#78** | **Hardhat test suite: buyNFT + buyOffchainItem** | **OPEN (NEW)** | **Contract Bug** |
| #70 | Idempotency — processed_onchain_txs | OPEN (mới tạo) | Gap 1 (MKT-1) |
| #71 | last_scanned_block persistence | OPEN (mới tạo) | Gap 2 (MKT-2) |
| #72 | $FARM → GOLD Deposit Flow | OPEN (mới tạo) | Gap 3 (MKT-3) |
| #73 | Fix totalGoldCirculating | OPEN (mới tạo) | Gap 4 (MKT-4) |
| #74 | Marketplace Filter & Sort + Load More | OPEN (mới tạo) | Gap 5 (MKT-5) |
| #75 | WebSocket reconnect + heartbeat | OPEN (mới tạo) | Gap 6 (MKT-6) |
| #18 | GOLD↔$FARM dynamic exchange rate engine | OPEN (partial) | Gap 4 (#73 sẽ fix) |
| #23 | PancakeSwap V2 DEX swap UI | OPEN (chưa dev) | Module 1 — DEX |
| #42 | Blockchain event indexer với fallback cronjob | OPEN (partial) | #71 + #75 sẽ close |
| #44 | Dedicated RPC provider (QuickNode/Ankr) | OPEN (chưa dev) | Infra |

---

## 3. PHÂN TÍCH GAP THEO SPEC marketplace.md

### MODULE 1 — DEX Swap (PancakeSwap)
**Trạng thái: ❌ Chưa implement**

Spec yêu cầu widget swap trong-app cho phép đổi $FARM ↔ BNB ↔ USDT trực tiếp trong Telegram Mini App.

**Gaps:**
- Không có PancakeSwap Router integration
- Không có swap UI widget (From/To/Slippage)
- Không có price quote display (`getAmountsOut`)
- Không có in-app transaction signing flow cho swap

**GitHub issue hiện có:** #23 (OPEN, chưa dev)

---

### MODULE 2 — Dynamic Peg (Converter GOLD ↔ $FARM)
**Trạng thái: ⚠️ Partial**

| Tính năng | Trạng thái | Ghi chú |
|-----------|-----------|---------|
| GOLD → $FARM claim (ECDSA) | ✅ Done | `POST /web3/claim-signature` |
| Dynamic peg formula (goldCirc/treasury) | ⚠️ Partial | farmInTreasury query OK, nhưng `totalGoldCirculating = 0` |
| $FARM → GOLD deposit flow | ❌ Chưa có | Chiều ngược hoàn toàn thiếu |
| UI hiển thị tỷ giá thực | ⚠️ Partial | Hiển thị nhưng dữ liệu không chính xác |

---

### MODULE 3 — P2P Marketplace
**Trạng thái: ⚠️ Mostly Done, có BUG NGHIÊM TRỌNG + 3 gaps quan trọng**

| Tính năng | Trạng thái | Ghi chú |
|-----------|-----------|---------|
| Off-chain EIP-712 listing | ✅ Done | |
| On-chain settlement — Guard Dog (NFT) | ✅ Done (partial) | buyNFT() cần tách riêng (#76) |
| On-chain settlement — Crate/Tools (off-chain) | ❌ **BUG** | safeTransferFrom sẽ REVERT (#76) |
| OffchainItemSold listener + DB delivery | ❌ Chưa có | Cần sau #76 (#77) |
| WebSocket listener TradeExecuted | ✅ Done (partial) | Thiếu reconnect logic |
| Fallback cronjob 5 phút | ✅ Done (partial) | Chỉ quét 150 blocks cuối, thiếu last_scanned_block |
| Expired listing cleanup (hourly cron) | ✅ Done | |
| Guard Dog sell-lock | ✅ Done | #68 |
| 3 tabs UI (NFT/Crops/Tools) | ✅ Done | |
| Filter & Sort | ⚠️ Partial | Chỉ filter by type, thiếu sort by price, price range |
| Pagination (Load More) | ❌ Thiếu UI | Backend có offset, frontend chưa có nút Load More |
| **Idempotency (processed_onchain_txs)** | ❌ **CRITICAL** | Không có, có thể double-credit |
| **last_scanned_block persistence** | ❌ **HIGH** | Server down >5 phút sẽ miss trades |

---

## 4. GITHUB ISSUES ĐÃ TẠO

### #76 — [MKT-0] BanditMarket.sol: Split buyNFT() + buyOffchainItem()
**Priority: 🔴 BLOCKER | Label: smart-contract, critical**

**Vấn đề cốt lõi:** Single function gọi `safeTransferFrom` cho cả NFT lẫn off-chain items → off-chain item trades REVERT 100%.

**Giải pháp:**
- `buyNFT()`: Thu $FARM → `IERC1155.safeTransferFrom` → emit `NFTOrderFilled`
- `buyOffchainItem()`: Thu $FARM → emit `OffchainItemSold(buyer, seller, itemType, quantity, price, nonce)` → backend giao hàng
- `usedNonces` mapping ngăn replay attack trên cả 2 hàm

**Effort estimate:** 1-2 ngày (Solidity + audit + redeploy)

**Files:**
- `contracts/src/BanditMarket.sol` — rewrite
- Hardhat deploy script — redeploy + verify
- Update contract address trong docs

---

### #77 — [MKT-0b] Backend: OffchainItemSold listener → user_items delivery
**Priority: 🔴 HIGH | Label: backend, blockchain-infra**

**Vấn đề:** Sau khi #76 deploy, backend cần lắng nghe `OffchainItemSold` event để giao item cho buyer trong DB.

**Giải pháp:**
- Thêm listener `contract.on('OffchainItemSold', handleOffchainItemSold)`
- `handleOffchainItemSold()`: idempotency check → lock listing → decrement seller's `user_items` → upsert buyer's `user_items` → mark listing sold
- Fallback cronjob cũng parse `OffchainItemSold` từ historical blocks

**Effort estimate:** 1 ngày backend

**Dependency:** #76 (cần ABI mới) + #70 (idempotency table)

---

### #78 — [MKT-0c] Hardhat Test Suite: buyNFT + buyOffchainItem
**Priority: 🔴 HIGH | Label: smart-contract, security**

**10 test cases:**

| Suite | Test | Expected |
|-------|------|----------|
| buyNFT | Happy path 20 $FARM | Buyer -20, Seller +19, Treasury +1; NFT transferred; `NFTOrderFilled` emitted |
| buyNFT | Invalid signature | revert "Invalid signature" |
| buyNFT | Replay attack (same nonce) | 2nd call revert "Nonce already used" |
| buyNFT | Deadline expired | revert "Order expired" |
| buyNFT | Missing setApprovalForAll | revert ERC1155 error |
| buyOffchainItem | Happy path 50 $FARM (5 Master Key) | Buyer -50, Seller +47.5, Treasury +2.5; NO NFT transfer; `OffchainItemSold` emitted |
| buyOffchainItem | Insufficient allowance/balance | revert ERC20 error |
| buyOffchainItem | Invalid signature | revert "Invalid signature" |
| buyOffchainItem | Replay attack | revert "Nonce already used" |
| buyOffchainItem | Deadline expired | revert "Order expired" |

**Acceptance Criteria:** `npx hardhat coverage` = 100% function + branch

---

### #70 — [MKT-1] Idempotency — processed_onchain_txs
**Priority: 🔴 CRITICAL | Label: backend**

- Migration: `processed_onchain_txs (tx_hash UNIQUE, event_type, processed_at)`
- Trong `handleTradeExecuted()` + `handleOffchainItemSold()`: INSERT txHash trước khi credit (trong cùng DB transaction)
- Nếu txHash đã tồn tại → skip, log warning

**Effort estimate:** 0.5 ngày backend

---

### #71 — [MKT-2] last_scanned_block persistence
**Priority: 🟠 HIGH | Label: backend, infra**

- Migration: `system_config (key PRIMARY KEY, value, updated_at)` 
- `syncMissedTrades()` đọc `last_scanned_block` từ DB, quét từ đó tới current block, chia 2000 blocks/batch
- Lưu tiến trình sau mỗi batch để crash-safe

**Effort estimate:** 1 ngày backend

---

### #72 — [MKT-3] $FARM → GOLD Deposit Flow
**Priority: 🟠 HIGH | Label: backend, frontend, smart-contract**

⚠️ **Cần quyết định kiến trúc trước khi dev (Q1, Q2 bên dưới)**

| | Phương án A: Transfer trực tiếp | Phương án B: FarmDeposit.sol |
|-|---------------------------------|------------------------------|
| Cách hoạt động | User transfer $FARM tới treasury address, backend scan Transfer event | Deploy contract nhỏ, emit Deposited(user, amount) |
| Smart contract mới | Không cần | Cần deploy |
| Bảo mật | Cần link wallet address | Không cần link (ref code) |
| Khuyến nghị | ✅ Nếu user đã link wallet | ✅ An toàn hơn nếu chưa link |

**Effort estimate:** 2-3 ngày (backend + frontend + arch decision)

---

### #73 — [MKT-4] Fix Dynamic Peg — totalGoldCirculating từ DB
**Priority: 🟡 MEDIUM | Label: backend**

```typescript
// Fix trong syncExchangeRate():
const result = await this.dataSource.manager.query(
  'SELECT COALESCE(SUM(gold_balance), 0)::float AS total FROM users'
);
const goldCirculating = Number(result[0].total);
```

**Effort estimate:** 0.5 ngày backend + 0.5 ngày frontend

---

### #74 — [MKT-5] Marketplace Filter & Sort + Load More
**Priority: 🟡 MEDIUM | Label: backend, frontend**

- Backend: thêm `sortBy`, `order`, `minPrice`, `maxPrice` params
- Frontend: sort dropdown, price range, "Tải thêm" button, "X/Y kết quả"

**Effort estimate:** 1 ngày backend + 1.5 ngày frontend

---

### #75 — [MKT-6] WebSocket reconnect + heartbeat
**Priority: 🟡 MEDIUM | Label: backend, infra**

- Heartbeat ping mỗi 30s (`getBlockNumber()`)
- Nếu ping fail → reconnect sau 5s (exponential backoff)
- **Dependency:** #44 (dedicated RPC với WSS)

**Effort estimate:** 1 ngày backend

---

## 5. ISSUES CŨ CẦN DEV

### #23 — PancakeSwap V2 DEX Swap Widget
**Priority: 🟡 MEDIUM | Label: frontend, smart-contract**

Swap widget in-app cho phép user swap $FARM ↔ BNB ↔ USDT mà không cần rời Telegram Mini App.
- Frontend: From/To token, amount, slippage %, price impact %
- Integration: PancakeSwap V2 Router (`swapExactETHForTokens`, `swapExactTokensForETH`)
- Quote: `getAmountsOut(amountIn, path)`
- **Effort estimate:** 3-4 ngày frontend

### #44 — Dedicated RPC Provider (QuickNode/Ankr)
**Priority: 🟠 HIGH cho production | Label: infra**

Update `.env`: `BSC_RPC_URL=https://...` và `BSC_WSS_URL=wss://...`
- **Effort estimate:** 0.5 ngày (subscription + config)

---

## 6. THỨ TỰ PHÁT TRIỂN ĐỀ XUẤT (CẬP NHẬT SAU REVIEW)

```
Phase 0 — Contract Bug Fix (BLOCKER — phải làm trước tất cả)
├── #76 BanditMarket.sol split (buyNFT + buyOffchainItem)   1-2 ngày  🔴 BLOCKER
└── #78 Hardhat test suite (10 test cases)                  1 ngày    🔴 Song song với #76

Phase 1 — Backend Safety (Phải làm ngay sau Phase 0)
├── #70 [MKT-1] Idempotency table                          0.5 ngày  🔴 CRITICAL
├── #77 Backend OffchainItemSold listener                   1.0 ngày  🔴 Cần #76 + #70
└── #71 [MKT-2] last_scanned_block persistence              1.0 ngày  🟠 Cần sau #70

Phase 2 — Tokenomics Fixes
├── #73 [MKT-4] Fix totalGoldCirculating                   0.5 ngày  🟡 Độc lập
└── #72 [MKT-3] Deposit $FARM → GOLD                       2-3 ngày  🟠 Cần quyết định arch

Phase 3 — UX Improvements
├── #74 [MKT-5] Filter & Sort + Load More                  2.5 ngày  🟡 Độc lập
└── #75 [MKT-6] WSS Reconnect                              1.0 ngày  🟡 Cần #44

Phase 4 — Ecosystem Expansion
├── #44 Dedicated RPC                                       0.5 ngày  Infra setup
└── #23 PancakeSwap DEX Widget                              3-4 ngày  🟡 Lớn nhất

Tổng ước tính: ~14-17 ngày dev (tăng 2-3 ngày do Phase 0 mới)
```

---

## 7. ĐIỂM CẦN XÁC NHẬN TRƯỚC KHI DEV

**Q1 (cho #72 — Deposit):** Chọn phương án nào?
- **A:** User transfer $FARM thẳng vào Treasury address → backend scan Transfer event
- **B:** Deploy thêm `FarmDeposit.sol` với function `deposit(amount, userId)`

**Q2 (cho #72 — Deposit UI):** Đặt UI ở đâu?
- **A:** Thêm tab "Nạp $FARM" vào ClaimModal hiện tại
- **B:** Tạo modal riêng `DepositModal`

**Q3 (cho #73 — Peg Rate):** Khi tỷ giá quá cao (ví dụ 500 GOLD/FARM)?
- Chỉ hiển thị cảnh báo?
- Hay block việc claim khi tỷ giá > ngưỡng nào đó?

**Q4 (cho #23 — DEX):** PancakeSwap widget ưu tiên sprint nào?
- Đây là feature lớn (~4 ngày), cần trước testnet launch?
- Hay user tự lên PancakeSwap.finance để swap?

**Q5 (Priority):** Sau Phase 0+1, ưu tiên Phase 2 (Tokenomics) hay Phase 3 (UX)?

---

## 8. MAPPING SPEC → IMPLEMENTATION STATUS (CẬP NHẬT)

| Yêu cầu trong marketplace.md | Status | Issue |
|-------------------------------|--------|-------|
| DEX Swap Widget (From/To/Slippage) | ❌ Chưa | #23 |
| PancakeSwap V2 Router integration | ❌ Chưa | #23 |
| $FARM → GOLD deposit (1 FARM = 100 GOLD) | ❌ Chưa | #72 |
| GOLD → $FARM claim (ECDSA) | ✅ Done | — |
| Dynamic peg formula (goldCirc/treasury) | ⚠️ Partial | #73 |
| P2P EIP-712 off-chain listing | ✅ Done | — |
| On-chain settlement Guard Dog (buyNFT) | ⚠️ Cần tách | #76 |
| On-chain settlement Crate/Tools (buyOffchainItem) | ❌ BUG — sẽ REVERT | #76 |
| Backend giao item off-chain sau OffchainItemSold | ❌ Chưa có | #77 |
| Smart contract test suite (Hardhat) | ❌ Chưa có | #78 |
| 3 tabs browse (NFT/Nông sản/Công cụ) | ✅ Done | — |
| Filter by price/rarity | ⚠️ Partial | #74 |
| TradeExecuted WebSocket listener | ✅ Done (partial) | #75 |
| Fallback cronjob 5 phút | ✅ Done (partial) | #71 |
| last_scanned_block persistence | ❌ Chưa | #71 |
| Idempotency (processed_onchain_txs) | ❌ Chưa | #70 |
| SELECT FOR UPDATE row-level lock | ✅ Done | — |
| Dedicated RPC (QuickNode/Ankr) | ❌ Chưa | #44 |
| FallbackProvider Ethers.js v6 | ✅ Done | — |
| Guard Dog sell-lock | ✅ Done | #68 |
| Expired listing auto-cleanup | ✅ Done | — |

---

*File này do Claude Code tạo và cập nhật tự động từ gap analysis + Architect Review.  
Phase 0 (Contract Bug) phải hoàn thành 100% trước khi bắt đầu bất kỳ phase nào khác.*
