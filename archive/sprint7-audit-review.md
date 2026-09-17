# BanditBuddy — Sprint 7 Task Review
**Dành cho:** Audit Tech Lead  
**Ngày:** 2026-09-11  
**Nguồn:** Điều chỉnh theo `audit pancakeswap connect.md`  
**GitHub Milestone:** Sprint 7: FarmToken V2 + Mainnet Migration

---

## ❓ 3 QUYẾT ĐỊNH CẦN PHẢN HỒI TRƯỚC KHI BẮT ĐẦU CODE

> **Yêu cầu:** Audit và Tech Lead vui lòng trả lời 3 câu hỏi dưới đây.  
> Đây là blockers — team không thể bắt đầu Sprint 7 khi chưa có quyết định.

---

### Câu hỏi 1: Kiến trúc thuế — Option A hay Option B?

Audit đã chỉ ra rằng cơ chế Volume on-chain tốn gas (SSTORE). Có 2 lựa chọn:

| | Option A (Holdings-based) | Option B (Volume Lazy Eval — hiện tại) |
|---|---|---|
| **Cơ chế** | Tier = `balanceOf(user)` | Tier = `userVolume24h[user]` + Lazy Reset |
| **Chi phí gas** | SLOAD miễn phí — **không tốn thêm** | +~20,000 gas/tx (SSTORE) |
| **Logic reset** | Không cần — balance tự động | Lazy: reset khi qua 24h |
| **Audit risk** | Sạch hoàn toàn | Cần giải thích biến động thuế |
| **Deploy time** | Cần viết lại `_transfer` | Chỉ cần fix 5% cap |
| **Tech Lead** | ✅ **Khuyến nghị** | Chấp nhận nếu kịp deadline |

**Ví dụ thực tế Option A:**
```
Ví hold  < 10,000 FARM → Tier 1: Buy 3% / Sell 5%
Ví hold 10K – 50K FARM → Tier 2: Buy 2% / Sell 3%
Ví hold  > 50,000 FARM → Tier 3: Buy 1% / Sell 1.5%
```

**→ Quyết định:** `[ ]` Option A — Holdings-based &nbsp;&nbsp;&nbsp; `[ ]` Option B — Giữ Volume, chỉ fix 5% cap

---

### Câu hỏi 2: Xác nhận fix bắt buộc Max Tax Cap 10% → 5%?

Đây là lỗ hổng audit tìm ra trong code hiện tại:

```solidity
// HIỆN TẠI (sai — cần fix):
require(rate <= 1000, "FarmToken: tax exceeds 10%");

// CẦN SỬA THÀNH:
require(rate <= 500, "FarmToken: tax exceeds 5%");
```

**Lý do bắt buộc:** TokenSniffer và các công cụ audit tự động sẽ flag contract là **Honeypot** nếu owner có thể set tax > 10%. Với ngưỡng 10%, vẫn có rủi ro bị cảnh báo. Ngưỡng 5% là chuẩn an toàn cho community.

**→ Xác nhận:** `[ ]` Đồng ý fix xuống 5% &nbsp;&nbsp;&nbsp; `[ ]` Giữ 10% (cần giải thích lý do)

---

### Câu hỏi 3: Xác nhận danh sách contracts cần excludeFromFee?

Audit yêu cầu tất cả in-game contracts phải được exclude khỏi DEX tax **ngay khi deploy**, trước khi migrate bất kỳ contract nào. Nếu không, người chơi bị thu thuế kép mỗi lần giao dịch trong game.

| Contract | Địa chỉ BSC Testnet | Lý do exclude |
|---|---|---|
| BanditMarket v2 | `0x73Adb0D83283BD5915a85eBE04E26eD1E713eae4` | Marketplace mua/bán NFT — không phải DEX trade |
| BanditDogFusion v3 | `0x07Bb6A77D429DeF6438B227312DcEdd10dA1351E` | Fusion chó — FARM di chuyển nội bộ |
| GuildStaking | `0xE86123fcEEaA78cCeF19bd9c03030283081bF4Cb` | Staking — không phải giao dịch thị trường |
| FarmTokenClaim | `0x92482A9933845fA728ec89B0f1AaDB096D47CfB1` | GOLD → FARM claim — miễn thuế theo design |
| Treasury | `0xc93A925789e82238B884D7537D86364E73D5F7C1` | Ví thu thuế — tự exclude để không vòng lặp |

**→ Xác nhận:** `[ ]` Đồng ý danh sách trên &nbsp;&nbsp;&nbsp; `[ ]` Bổ sung thêm: _______________

---

## 📋 FULL TASK LIST — SPRINT 7

> Trạng thái implement Sprint 5/6 và danh sách việc cần làm Sprint 7.

---

### PHẦN 1: Đã hoàn thành trong Sprint 5/6 (CLOSED)

#### Smart Contract
| Issue | Task | Trạng thái | Ghi chú |
|---|---|---|---|
| #79 | [SC-1] Upgrade FarmToken.sol: Fee-on-Transfer + Dynamic Tiered Tax | ✅ DONE | Dùng Option B (Lazy Eval). **Tồn tại lỗi max tax 10%** → fix ở #97 |
| #80 | [SC-2] LiquidityLocker.sol — LP Token Time-Lock (6–12 tháng) | ✅ DONE | 19 unit tests passing |
| #81 | [SC-3] Hardhat Deploy Scripts + Unit Tests | ✅ DONE | 41 tests: 22 FarmToken tax + 19 LiquidityLocker |

#### Backend
| Issue | Task | Trạng thái |
|---|---|---|
| #82 | [BE-1] DexOracle — cron 3 phút đọc giá PancakeSwap | ✅ DONE |
| #83 | [BE-2] Kill Switch — pause claim khi giá biến động >15%/5 phút | ✅ DONE |
| #84 | [BE-3] Exchange Rate: thay treasury ratio bằng giá DEX thật | ✅ DONE |
| #85 | [BE-4] Swap Event Indexer — sync volume ví vào Redis/DB | ✅ DONE |
| #86 | [BE-5] Admin Dashboard: DEX Metrics (giá, kill switch, tax balance) | ✅ DONE |

#### Frontend
| Issue | Task | Trạng thái |
|---|---|---|
| #87 | [FE-1] "Get $FARM" Popup — live price + tier + PancakeSwap deep link | ✅ DONE |
| #88 | [FE-2] Tax Tier Badge trong ClaimModal | ✅ DONE |

#### BSC Testnet Deploy & Verify
| Issue | Task | Trạng thái | Kết quả |
|---|---|---|---|
| #89 | [INFRA-1] Top up tBNB admin wallet | ✅ DONE | Đủ với 0.073 tBNB |
| #90 | [SC-DEPLOY-1] Script createPairAndAddLiquidity.ts | ✅ DONE | `contracts/scripts/createPairAndAddLiquidity.ts` |
| #91 | [SC-DEPLOY-2] Tạo FARM/WBNB pair trên BSC Testnet | ✅ DONE | Pair: `0x1B2eE79d6eB68841409c470485304Bb7A98019c0` |
| #92 | [BE-CONFIG-1] Cập nhật .env + rebuild backend | ✅ DONE | RPC: `bsc-testnet-rpc.publicnode.com` |
| #93 | [BE-VERIFY-1] DexOracle sync giá thật từ PancakeSwap | ✅ DONE | `$0.000144/FARM` từ `pancakeswap-v2` |
| #94 | [BE-VERIFY-2] DexVolumeService tracking Swap events | ✅ DONE | Synced 1 event, Redis + DB updated |
| #95 | [FE-VERIFY-1] Frontend E2E live data | ✅ DONE | GetFarmModal + tier badge live |

---

### PHẦN 2: Điều chỉnh bắt buộc từ Audit — Sprint 7 (OPEN)

> ⚠️ Các task dưới đây KHÔNG thể bắt đầu trước khi có quyết định từ Câu hỏi 1, 2, 3 ở trên.

---

#### [#97] SC-FIX-1: FarmToken V2 — Fix kiến trúc thuế theo audit
**Mức độ:** 🔴 HIGH — Blocker cho toàn bộ Sprint 7  
**Phụ thuộc vào:** Câu hỏi 1 (Option A/B) + Câu hỏi 2 (5% cap)

**Công việc nếu chọn Option A (Holdings-based):**
- [ ] Xóa `userVolume24h` và `lastTradeTimestamp` mappings khỏi contract
- [ ] Thay `_getTaxTier()` để dùng `balanceOf(user)` thay vì volume
- [ ] Cập nhật `setTierThresholds()` sang ngưỡng balance thay vì volume
- [ ] Viết lại 22 unit tests theo logic mới
- [ ] Verify TokenSniffer: không flag Honeypot, không flag dynamic tax risk

**Công việc nếu chọn Option B (giữ Lazy Eval):**
- [ ] Đổi `require(rate <= 1000)` → `require(rate <= 500)` trong `setTaxRates()`
- [ ] Đổi message lỗi: `"FarmToken: tax exceeds 5%"`
- [ ] Cập nhật 1 unit test: `'rejects rates above 5%'`
- [ ] Verify TokenSniffer pass

**Acceptance Criteria (cả 2 options):**
- [ ] Deployed FarmToken V2 pass TokenSniffer scan (không có Red Flag)
- [ ] Max tax cap = 5% không thể vượt qua dù owner cố set
- [ ] Tier structure giữ nguyên: Tier1 (3%/5%), Tier2 (2%/3%), Tier3 (1%/1.5%)

---

#### [#98] SC-FIX-2: Script excludeFromFee cho in-game contracts
**Mức độ:** 🔴 HIGH — Phải chạy trước khi migrate bất kỳ contract nào  
**Phụ thuộc vào:** Câu hỏi 3 (confirm danh sách contracts)

**Deliverable:** `contracts/scripts/setExcludeFromFee.ts`

```typescript
// Pseudocode
const toExclude = [
  process.env.BANDIT_MARKET_ADDRESS,
  process.env.BANDIT_DOG_FUSION_ADDRESS,
  process.env.GUILD_STAKING_ADDRESS,
  process.env.CLAIM_CONTRACT_ADDRESS,
  process.env.TREASURY_ADDRESS,
];
for (const addr of toExclude) {
  await farmTokenV2.excludeFromFee(addr, true);
}
```

**Thứ tự deploy bắt buộc:**
1. Deploy FarmToken V2
2. **Chạy ngay `setExcludeFromFee.ts`** ← không được bỏ qua
3. Gọi `setPancakePair()` với pair address
4. Migrate ClaimContract, Market, Fusion → dùng token address mới
5. Chạy `createPairAndAddLiquidity.ts` (mainnet)
6. LiquidityLocker 12 tháng

**Acceptance Criteria:**
- [ ] Script chạy thành công trên BSC Testnet
- [ ] Verify: BanditMarket.sol nhận FARM không bị thu thuế
- [ ] Verify: Người chơi claim GOLD→FARM không bị thu thuế DEX

---

#### [#96] Backlog — Sprint 7 Full: Deploy FarmToken V2 + Mainnet Migration
**Mức độ:** 🟡 MEDIUM — Sau khi SC-FIX-1 và SC-FIX-2 hoàn thành

| # | Task | Owner | Depends on |
|---|---|---|---|
| 1 | Approve kiến trúc thuế (Option A/B) | **PM + Tech Lead** | Câu hỏi 1 |
| 2 | #97 SC-FIX-1: Fix FarmToken V2 | Smart Contract Dev | Approval |
| 3 | #98 SC-FIX-2: Script excludeFromFee | Smart Contract Dev | SC-FIX-1 |
| 4 | Top up tBNB mainnet wallet ≥ 0.5 BNB | DevOps | — |
| 5 | Deploy FarmToken V2 BSC Testnet + verify TokenSniffer | Smart Contract Dev | SC-FIX-1 |
| 6 | Migrate ClaimContract → FarmToken V2 address | Smart Contract Dev | Step 5 |
| 7 | Migrate BanditMarket → FarmToken V2 address | Smart Contract Dev | Step 5 |
| 8 | Migrate GuildStaking → FarmToken V2 address | Smart Contract Dev | Step 5 |
| 9 | Gọi `setPancakePair()` trên FarmToken V2 | DevOps | Step 5 |
| 10 | Add liquidity mainnet + LiquidityLocker 12 tháng | DevOps | Step 9 |
| 11 | Cập nhật .env production FARM_TOKEN_ADDRESS | Backend | Step 5 |
| 12 | Verify DexOracle + DexVolume với FarmToken V2 | Backend | Step 11 |
| 13 | Deploy FarmToken V2 BSC Mainnet | Smart Contract Dev | Testnet verify OK |
| 14 | Full E2E test sau mainnet deploy | QA | Step 13 |

---

## 📊 Tổng kết trạng thái

```
Sprint 5/6 (PancakeSwap DEX Integration):
  ✅ Đóng: 17/17 issues (100%)
  
Sprint 7 (FarmToken V2 + Mainnet):
  🔵 Open: 3 issues (#96, #97, #98)
  ❓ Blocked: Chờ quyết định 3 câu hỏi từ Tech Lead
  
Điều chỉnh từ audit:
  ❌ Max tax cap: 10% → cần fix xuống 5%
  ⚠️  Kiến trúc thuế: Option A được khuyến nghị nhưng chưa được phê duyệt
  ❌ excludeFromFee script: Chưa có, cần tạo mới
```

---

## 📎 Tài liệu tham khảo

- Audit feedback: `audit pancakeswap connect.md`  
- Original PRD: `pancakeswap connect.md`  
- Contract hiện tại: `contracts/src/FarmToken.sol`  
- Tests: `contracts/test/FarmToken.tax.test.ts` (22 tests)  
- GitHub Milestone: [Sprint 7](https://github.com/flappybirdweb3/bandit-buddy/milestone/7)  
- GitHub Issues: [#96](https://github.com/flappybirdweb3/bandit-buddy/issues/96) · [#97](https://github.com/flappybirdweb3/bandit-buddy/issues/97) · [#98](https://github.com/flappybirdweb3/bandit-buddy/issues/98)

---

*Tài liệu được tạo tự động từ Claude Code — 2026-09-11*
