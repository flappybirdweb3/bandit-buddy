# AUDIT REPORT: Tokenomics V3 — "tokenomics & vesting.MD / .docx"

**Tài liệu được audit:** `archive/tokenomics & vesting.MD` + `archive/tokenomics & vesting.docx`
**Audit by:** Claude Code (Lead Smart Contract Auditor)
**Ngày:** 2026-09-18
**Trạng thái:** PASS VỚI 4 LƯU Ý (không có lỗi nghiêm trọng)

---

## I. TỔNG KẾT NHANH (EXECUTIVE SUMMARY)

| Hạng mục | Kết quả | Ghi chú |
|---|---|---|
| Tổng cung 1B FARM | ✅ PASS | 50+70+50+150+400+180+100 = 1,000,000,000 ✅ |
| IMC = $797,500 | ✅ PASS | 159.5M × $0.005 = $797,500 ✅ (toán học đúng) |
| TGE Circulating = 159.5M (15.95%) | ✅ PASS | Xác minh độc lập từng dòng ✅ |
| 5 lỗi từ TOKENOMICS_REVIEW_REPORT đã fix | ✅ PASS | Xem chi tiết Phần II |
| FarmVesting.sol hỗ trợ Team 2%+cliff | ✅ PASS | **Không cần sửa contract** — đã có sẵn |
| Vesting days ↔ months math | ✅ PASS | 540=18m, 720=24m, 1080=36m ✅ |
| 4 điểm cần lưu ý | ⚠️ WARNING | Xem chi tiết Phần IV |

---

## II. XÁC MINH TOÁN HỌC ĐỘC LẬP

### 2.1 Bảng Phân Bổ V3 (per SA document)

| Hạng mục | Token | TGE % | TGE Unlock | Cliff | Linear Vesting |
|---|---|---|---|---|---|
| Angel | 50,000,000 | 5% | **2,500,000** | 90d | 540d |
| Private | 70,000,000 | 5% | **3,500,000** | 30d | 540d |
| Public | 50,000,000 | 25% | **12,500,000** | 0d | 365d |
| Team | 150,000,000 | 2% | **3,000,000** | 180d | 720d |
| Ecosystem | 400,000,000 | 5% | **20,000,000** | 0d | 1080d |
| Treasury | 180,000,000 | 10% | **18,000,000** | 30d | 720d |
| Liquidity | 100,000,000 | 100% | **100,000,000** | N/A | N/A |
| **TỔNG** | **1,000,000,000** | | **159,500,000** | | |

### 2.2 Xác minh IMC

```
TGE Circulating = 2.5M + 3.5M + 12.5M + 3.0M + 20.0M + 18.0M + 100.0M
               = 159.5M  ✅  (khớp doc)

IMC = 159.5M × $0.005 = $797,500  ✅  (khớp doc)
```

### 2.3 Lịch mở khóa lũy kế theo thời gian

Kết quả từ simulation FarmVesting._releasable() logic:

| Mốc thời gian | Tổng lưu thông | % Supply | Investor+Team lưu thông |
|---|---|---|---|
| TGE (ngày 0) | 159.5M | 16.0% | 21.5M |
| 1 tháng (30d) | 173.1M | 17.3% | 24.6M |
| 3 tháng (90d) | 221.3M | 22.1% | 38.1M |
| 6 tháng (180d) | 301.5M | 30.1% | 66.4M |
| 12 tháng (365d) | 504.0M | 50.4% | 162.2M |
| 18 tháng (540d) | 677.6M | 67.8% | 234.9M |
| 24 tháng (720d) | 829.8M | 83.0% | 283.2M |
| 36 tháng (1080d) | 1,000.0M | 100% | 320.0M |

**Nhận xét:** Áp lực bán từ investors+team được dàn trải đều trong 3 năm. Tại TGE, investor+team chỉ có 21.5M token (6.7% của 320M allocation) → áp lực bán rất nhỏ khi listing. **Thiết kế tốt ✅**

### 2.4 Phân tích Min Wallets để Sell Out mỗi vòng

| Round | Max/wallet | FARM/wallet | Min wallets để sell out |
|---|---|---|---|
| Angel ($0.001) | $5,000 | 5,000,000 | **10 wallets** |
| Private ($0.0025) | $20,000 | 8,000,000 | **9 wallets** |
| Public ($0.005) | $2,000 | 400,000 | **125 wallets** |

→ Angel + Private có min wallets thấp là chủ ý: đây là vòng private/strategic, admin whitelist kiểm soát ai vào. **Không phải lỗi.**
→ Public cần 125+ wallets để sell out — cần marketing tốt cho IDO. Nếu không sell out hết, phần còn lại cần xử lý bằng `recoverFarm()`.

---

## III. KIỂM TRA 5 LỖI CŨ ĐÃ ĐƯỢC FIX

| Lỗi từ TOKENOMICS_REVIEW_REPORT | V3 Fix | Trạng thái |
|---|---|---|
| **Lỗi 1:** Angel TGE = 0% (doc cam kết 5%) | Angel TGE = 5% | ✅ FIXED |
| **Lỗi 2:** Private cliff = 0d | Private cliff = 30d | ✅ FIXED |
| **Lỗi 3:** Thiếu Team vesting | Team: 2% TGE, 180d cliff, 720d linear | ✅ FIXED |
| **Lỗi 4:** Treasury 180M không lock | Treasury: 10% TGE, 30d cliff, 720d linear | ✅ FIXED |
| **Lỗi 5:** Ecosystem milestone KPI bất khả thi | Ecosystem: 5% TGE, 0d cliff, 1080d linear | ✅ FIXED |

---

## IV. CÁC ĐIỂM CẦN LƯU Ý (WARNINGS)

### ⚠️ WARNING 1 — Magic Prompt TASK 3 là không cần thiết

**SA document viết:** *"Provide the exact Solidity modifications required... to support a custom TGE unlock for the Team (since standard vesting contracts usually don't support a flat TGE% followed by a cliff for teams)"*

**Thực tế:** `FarmVesting.sol` hiện tại **ĐÃ HỖ TRỢ HOÀN TOÀN** pattern này. Không cần bất kỳ sửa đổi nào.

Kiểm chứng qua `_releasable()` logic với Team params (tgeBps=200, cliffDays=180, vestingDays=720):

```
Ngày 0   (TGE):     vested = tgeAmount = 3,000,000  ✅
Ngày 1-179 (trước cliff):  vested = tgeAmount = 3,000,000  ✅ (không thay đổi)
Ngày 180 (cliff end): vested = 3M + (147M × 0/720d) = 3,000,000  ✅
Ngày 181:            vested = 3M + (147M × 1d/720d) = 3,204,167  ✅
Ngày 900 (180+720):  vested = 150,000,000  ✅ (fully vested)
```

**Action:** Không cần sửa `FarmVesting.sol`. Chỉ cần deployment script gọi `addSchedule()` đúng params.

---

### ⚠️ WARNING 2 — "Per block" là mô tả không chính xác

**SA document viết:** *"Mở khóa chậm rãi hàng khối (per block)"*

**Thực tế:** `FarmVesting.sol` sử dụng `block.timestamp` — vesting theo **thời gian thực (per second)**, không phải per block. Trên BSC, block time ≈ 3 giây, nên per-block và per-timestamp có kết quả tương đương về mặt thực tiễn, nhưng mô tả kỹ thuật cần chính xác.

**Action:** Chỉ ảnh hưởng whitepaper/documentation, không ảnh hưởng code. Cần sửa lại mô tả.

---

### ⚠️ WARNING 3 — Liquidity "khóa vào Pool PancakeSwap" cần đặc tả rõ hơn

**SA document viết:** *"Khóa vào Pool PancakeSwap (N/A vesting)"*

**Thực tế kỹ thuật:** Khi add 100M FARM + X USDT vào PancakeSwap pool, admin nhận về **LP tokens (BEP-20)**. Nếu không lock LP tokens, admin có thể rút toàn bộ liquidity bất cứ lúc nào → **rug-pull risk**.

Dự án đã có sẵn `LiquidityLocker.sol`. LP tokens cần được lock tối thiểu 12 tháng sau TGE.

**Action cần bổ sung vào deploy script:**
```
// Sau khi add PancakeSwap liquidity, nhận LP tokens về admin
// Sau đó lock LP tokens:
liquidityLocker.lock(
    lpTokenAddress,
    lpTokenAmount,
    block.timestamp + 365 days,  // 12 tháng minimum
    adminWallet
);
```

**Đây là thông tin bắt buộc phải công bố trong whitepaper** để investor tin tưởng.

---

### ⚠️ WARNING 4 — Ecosystem vesting 0d cliff cần quy trình vận hành rõ ràng

**SA document viết:** *"Backend (cơ chế Drip-Feed) luôn có quỹ"*

**Thực tế:** Với Ecosystem: 0d cliff + 1080d linear, từ ngày TGE+1, mỗi ngày có thêm `380M/1080 ≈ 351,851 FARM` claimable trong FarmVesting. Backend PHẢI gọi `release(ecosystemWallet)` định kỳ để nhận tokens về ecosystem wallet, rồi mới dùng ký ECDSA cấp rewards cho player.

Nếu backend không gọi `release()` trong nhiều ngày, tokens tích lũy trong FarmVesting — **không mất, nhưng không thể cấp rewards cho player**.

**Action cần có:**
1. Cron job backend tự động gọi `release(ecosystemWallet)` mỗi ngày/tuần
2. Monitor alert nếu ecosystemWallet balance < threshold (ví dụ < 1M FARM)
3. Document rõ quy trình để anh Dũng setup

---

## V. THÔNG SỐ CUỐI CÙNG ĐỂ IMPLEMENT

### 5.1 FarmTokenSale.sol — Thay đổi cần thiết

So với code hiện tại (`git` state), cần patch các giá trị sau trong constructor:

```solidity
// ROUND_ANGEL (thay đổi 2 dòng):
tgeBps:           500,        // WAS: 0   → FIX lỗi 1
cliffDays:        90,         // OK ✅
vestingDays:      540,        // OK ✅
minUsdtAmount:    100 * 1e18, // OK ✅
maxUsdtPerWallet: 5_000 * 1e18, // WAS: 10_000 → giảm anti-whale

// ROUND_PRIVATE (thay đổi 2 dòng):
tgeBps:           500,        // OK ✅
cliffDays:        30,         // WAS: 0 → FIX lỗi 2
vestingDays:      540,        // OK ✅
minUsdtAmount:    500 * 1e18, // OK ✅
maxUsdtPerWallet: 20_000 * 1e18, // WAS: 50_000 → giảm

// ROUND_PUBLIC (thay đổi 1 dòng):
tgeBps:           2_500,      // OK ✅
cliffDays:        0,          // OK ✅
vestingDays:      365,        // OK ✅
minUsdtAmount:    10 * 1e18,  // OK ✅
maxUsdtPerWallet: 2_000 * 1e18, // WAS: 5_000 → giảm
```

### 5.2 FarmVesting.sol — KHÔNG CẦN SỬA

Contract hiện tại đã hỗ trợ đầy đủ tất cả patterns V3. **Không sửa gì.**

### 5.3 Deployment Script — addSchedule calls cho 4 allocation còn lại

```typescript
// Cần chạy sau khi deploy FarmVesting
// Admin phải transfer đủ FARM vào vestingContract trước

const E18 = (n: string) => ethers.parseEther(n);

// TEAM: 150M, 2% TGE, cliff 180d, linear 720d
// (Gọi lần lượt cho từng member, tổng phải bằng 150M)
await farmVesting.addSchedule(
    TEAM_WALLET_1,        // địa chỉ ví member 1
    E18("30000000"),      // 30M (ví dụ)
    200,                  // 2% TGE
    180,                  // 180d cliff
    720,                  // 720d linear
    "team"
);
// ... gọi tương tự cho các member khác

// ECOSYSTEM: 400M, 5% TGE, cliff 0d, linear 1080d
await farmVesting.addSchedule(
    ECOSYSTEM_WALLET,
    E18("400000000"),
    500,   // 5% TGE
    0,     // no cliff
    1080,  // 36-month linear
    "ecosystem"
);

// TREASURY: 180M, 10% TGE, cliff 30d, linear 720d
await farmVesting.addSchedule(
    TREASURY_GNOSIS_SAFE,  // Gnosis Safe 3/5 multisig
    E18("180000000"),
    1000,  // 10% TGE
    30,    // 30d cliff
    720,   // 24-month linear
    "treasury"
);

// LIQUIDITY: 100M, 100% TGE (chuyển thẳng, không qua FarmVesting)
await farm.transfer(LIQUIDITY_MANAGER_WALLET, E18("100000000"));
// Sau khi add PancakeSwap LP → lock LP tokens vào LiquidityLocker.sol
```

### 5.4 Deploy Sequence Đầy Đủ

```
[TRƯỚC KHI DEPLOY — dữ liệu cần có]
  - Địa chỉ ví từng Team member + allocation %
  - Địa chỉ Gnosis Safe (3/5) cho Treasury
  - Địa chỉ Ecosystem wallet (backend hot wallet hoặc multisig)
  - Địa chỉ Liquidity Manager wallet
  - Timeline: ngày mở Angel, Private, IDO, TGE

[DEPLOY ORDER]
  1.  Deploy FarmVesting(FARM, ADMIN)
  2.  Deploy FarmTokenSale(USDT, FARM, VESTING, TREASURY_GNOSIS, ADMIN)
  3.  farmVesting.grantRole(CREATOR_ROLE, saleContract)
  4.  farm.transfer(saleContract, 170_000_000 FARM)          // Angel+Private+Public
  5.  farm.transfer(vestingContract, 150_000_000 FARM)       // Team
  6.  farmVesting.addSchedule(member1...) × N                // Team members
  7.  farm.transfer(vestingContract, 400_000_000 FARM)       // Ecosystem
  8.  farmVesting.addSchedule(ecosystemWallet, 400M, ...)    // Ecosystem
  9.  farm.transfer(vestingContract, 180_000_000 FARM)       // Treasury
  10. farmVesting.addSchedule(gnosisSafe, 180M, ...)         // Treasury
  11. farm.transfer(liquidityWallet, 100_000_000 FARM)       // Liquidity (no lock)
  12. farmTokenSale.setRoundTimes(0, angelStart, angelEnd)
  13. farmTokenSale.setRoundTimes(1, privateStart, privateEnd)
  14. farmTokenSale.setRoundTimes(2, idoStart, idoEnd)
  15. farmTokenSale.addToWhitelist(0, [angel addresses])
  16. farmTokenSale.addToWhitelist(1, [private addresses])

[KHI LISTING — ngày TGE]
  17. Add PancakeSwap liquidity (100M FARM + USDT)
  18. farmVesting.setTge(listingTimestamp)                   // BẮT BUỘC trước khi claim
  19. liquidityLocker.lock(lpToken, lpAmount, now + 365d)    // Lock LP 12 tháng

[SAU KHI LISTING]
  20. Backend cron: release(ecosystemWallet) định kỳ
  21. Verify tất cả contracts trên BscScan
```

---

## VI. ĐỐI CHIẾU V3 VỚI TÀI LIỆU GỐC (Chọn Game Open Source v2.docx)

| Tham số | Tài liệu Gốc | V3 SA | Trạng thái |
|---|---|---|---|
| Giá Angel | $0.001 | $0.001 | ✅ |
| Giá Private | $0.0025 | $0.0025 | ✅ |
| Giá Public | $0.005 | $0.005 | ✅ |
| Angel TGE | 5% | 5% | ✅ Fixed |
| Angel cliff | 90d | 90d | ✅ |
| Private cliff | 90d | **30d** | ⚠️ Thay đổi có chủ ý (nhượng bộ VC) |
| Team cliff | 180d | 180d | ✅ |
| Team TGE | 0% | **2%** | ⚠️ Thay đổi có chủ ý (theo yêu cầu anh) |
| Ecosystem vesting | KPI | **1080d linear** | ✅ Simplification đúng |
| Treasury lock | Không có | **30d cliff + 720d** | ✅ Cải thiện |
| Gnosis Safe | Không có | **3/5 multisig** | ✅ Cải thiện |

---

## VII. KẾT LUẬN

### VERDICT: ✅ APPROVED WITH NOTES

Phương án V3 do SA thiết kế:

1. **Toán học 100% chính xác** — tất cả con số xác minh độc lập đều khớp
2. **Giải quyết đầy đủ 5 lỗi** từ TOKENOMICS_REVIEW_REPORT.md
3. **Cải thiện đáng kể** so với V1: Treasury lock, Team TGE, Private cliff, Ecosystem simplification
4. **Không có lỗi nghiêm trọng** (0 critical bugs)
5. **4 warnings** — đều là operational/documentation issues, không ảnh hưởng tính chính xác của contract

### Việc cần làm trước khi code:

| # | Việc cần làm | Người thực hiện |
|---|---|---|
| 1 | Chuẩn bị Gnosis Safe 3/5 multisig cho Treasury | anh Nguyễn Mạnh Dũng |
| 2 | Cung cấp danh sách ví Team members + % allocation | Founder |
| 3 | Confirm Ecosystem wallet address | anh Dũng |
| 4 | Confirm Liquidity wallet + LiquidityLocker setup | anh Dũng |
| 5 | Confirm timeline (ngày mở từng round, ngày TGE) | PM/Founder |
| 6 | Patch FarmTokenSale.sol (4 dòng thay đổi per 5.1) | Claude Code |
| 7 | Viết deploy script đầy đủ per section 5.3 + 5.4 | Claude Code |
| 8 | Setup cron job release(ecosystemWallet) trong backend | anh Dũng |

**Sau khi có đủ dữ liệu từ mục 1-5 → Claude Code thực hiện mục 6-7 ngay lập tức.**

---

*Audit performed by reading source documents directly, no assumptions made.*
*All math verified via independent Python simulation of FarmVesting._releasable() logic.*
