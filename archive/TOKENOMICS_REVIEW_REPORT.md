# REPORT: Đánh giá Tokenomics & Sale Rounds — Bandit Buddy $FARM

**Nguồn tài liệu:** `archive/Chọn Game Open Source Làm Web3 v2.docx`
**Đối chiếu với:** `contracts/src/FarmTokenSale.sol`, `contracts/src/FarmVesting.sol`
**Ngày:** 2026-09-18
**Tác giả:** Claude Code (review + đặc tả)

---

## I. TỔNG CUNG & PHÂN BỔ

### 1.1 Tổng cung

| Tài liệu | Implement | Kết quả |
|---|---|---|
| 1,000,000,000 $FARM (BSC) | FarmToken deploy 1B FARM | ✅ Khớp |

### 1.2 Bảng Phân Bổ Token

Nguồn: Table 11 trang Tokenomics Allocation trong tài liệu.

| Hạng mục | % | Số lượng | Mục đích |
|---|---|---|---|
| Ecosystem & P2E | 40% | 400,000,000 | Phần thưởng in-game, sự kiện Guild, rank rewards |
| Treasury & Marketing | 18% | 180,000,000 | Quỹ buyback, airdrop, đối tác, mở rộng thị trường |
| Team & Advisors | 15% | 150,000,000 | Team kỹ thuật, founders, advisors |
| Seed Sale | 12% | 120,000,000 | Angel (5%) + Private (7%) |
| Liquidity & MM | 10% | 100,000,000 | Pool PancakeSwap, CEX, Market Maker |
| Public Sale (IDO) | 5% | 50,000,000 | Bán lẻ cộng đồng, tạo FOMO listing |
| **Tổng** | **100%** | **1,000,000,000** | |

**Đánh giá cơ cấu phân bổ:**
- Ecosystem 40%: Hợp lý cho P2E — cần pool thưởng lớn để duy trì reward nhiều năm
- Team 15%: Ở mức thị trường chuẩn (thường 10-20%), tốt
- Seed 12%: Khiêm tốn — signal tốt, không bán quá nhiều early
- Liquidity 10%: Đủ để tạo pool PancakeSwap ban đầu, tránh slippage cao
- Public 5%: Nhỏ, tạo FOMO, hạn chế nguồn cung retail → hỗ trợ giá listing
- **Không có vấn đề về cơ cấu phân bổ ✅**

---

## II. CÁC VÒNG SALE

### 2.1 Giá Token & Step-up Valuation

Nguồn: Table 12 + para 909-927 trong tài liệu.

| Vòng | Token | FDV | Giá/FARM | Vốn gọi | Mục đích |
|---|---|---|---|---|---|
| Angel Round | 5% / 50M | $1,000,000 | **$0.001** | $50,000 | Co-founders, nội bộ, đối tác chiến lược |
| Private Sale | 7% / 70M | $2,500,000 | **$0.0025** | $175,000 | VCs, Guild Web3 (khi có Demo) |
| Public IDO | 5% / 50M | $5,000,000 | **$0.005** | $250,000 | Retail community |
| **Tổng 3 vòng** | **17% / 170M** | | | **$475,000** | |

**Implement trong FarmTokenSale.sol:**

| Tham số | Angel | Private | Public | Kết quả |
|---|---|---|---|---|
| Giá (priceWei) | $0.001 | $0.0025 | $0.005 | ✅ Khớp hết |
| Allocation | 50M | 70M | 50M | ✅ Khớp hết |
| Whitelist | Yes | Yes | No | ✅ Khớp hết |

**Đánh giá step-up giá:**
- $0.001 → $0.005 = **5x từ Angel đến Public** — khớp doc para 917 *"định giá Public cao gấp 4-5 lần Seed"* ✅
- $0.001 → $0.0025 = 2.5x từ Angel đến Private — Private investors vẫn có 2x upside tại listing ✅
- Private → Public = 2x — hợp lý, không phủi mặt Private investors ✅

**Rủi ro về tổng vốn gọi ($475K):**
Tổng raise $475K là nhỏ. Với cơ cấu sử dụng vốn (50% dev + 30% liquidity + 20% audit/marketing), chỉ có ~$237K cho dev = runway ngắn (~6-9 tháng). Cần kế hoạch rõ về matching fund từ Quỹ Phanxipan/Chairman Vũ Thế Vân.

---

## III. VESTING SCHEDULE — PHÁT HIỆN SAI LỆCH

### 3.1 Tài liệu định nghĩa vesting (para 896-899 — nguyên văn)

```
Seed Sale:     5% TGE | cliff 3 tháng (90d) | linear 18 tháng (540d)
Team:          0% TGE | cliff 6 tháng (180d) | linear 24 tháng (720d)
Ecosystem:     5% TGE | phần còn lại mở theo KPI milestone
Liquidity:     100% TGE (không lock)
```

**Trích dẫn then chốt (para 918 — nguyên văn):**
> *"Nhà đầu tư Seed (mua giá $0.001) sẽ thấy ngay khoản đầu tư của họ có giá trị tăng gấp 5 lần (x5) ngay khi dự án niêm yết (TGE). Dù bị khóa token (vesting) và **chỉ nhận 5% ở tháng đầu tiên**, tâm lý có lãi ngay lập tức sẽ khiến họ sẵn sàng chốt deal."*

→ Tài liệu **cam kết rõ ràng**: cả Angel lẫn Private đều nhận **5% tại TGE**.

### 3.2 Bảng so sánh chi tiết

| Tham số | Doc (Seed Sale) | Angel implement | Status | Private implement | Status | Public implement | Status |
|---|---|---|---|---|---|---|---|
| TGE % | **5%** | **0%** | ❌ SAI | 5% | ✅ | 25% | ⚠️ Không có trong doc |
| Cliff | **90d (3 tháng)** | 90d | ✅ | **0d** | ❌ SAI | 0d | ⚠️ Không có trong doc |
| Vesting duration | **540d (18 tháng)** | 540d | ✅ | 540d | ✅ | 365d | ⚠️ Không có trong doc |

### 3.3 Chi tiết từng sai lệch

#### LỖI 1 — Angel TGE = 0% (nên là 5%) — SEVERITY: HIGH 🔴

Tài liệu tại para 918 **cam kết công khai với investor**: seed investors nhận 5% tại TGE.
Contract hiện tại set `tgeBps: 0` cho Angel.

**Hệ quả nếu không sửa:**
- Nhà đầu tư Angel không nhận được token nào tại TGE, đồng thời bị cliff 90 ngày tiếp theo
- Vi phạm term đã pitch với investor → mất trust
- Có thể bị khiếu nại pháp lý nếu đây là cam kết ghi trong SAFT/term sheet

**Fix cần thiết:** Sửa `tgeBps: 500` (5%) cho ROUND_ANGEL trong FarmTokenSale.sol

---

#### LỖI 2 — Private cliff = 0d (nên là 90d) — SEVERITY: MEDIUM 🟡

Tài liệu chỉ định nghĩa 1 bộ vesting cho toàn bộ "Seed Sale" = 3 tháng cliff.
Private là một phần của Seed Sale. Không có note nào trong tài liệu cho phép bỏ cliff với Private.

**Hệ quả nếu không sửa:**
- VC/Guild mua Private có thể nhận 5% TGE rồi bán linear từ ngay ngày TGE+1
- Áp lực bán ngay sau listing → suppress giá, ảnh hưởng community
- Angel investors sẽ không hài lòng vì họ bị cliff 90d trong khi Private không có

**Các phương án:**
- Option A: 90d cliff (đúng tài liệu, nhưng VC có thể negotiate)
- Option B: 30d cliff (compromise, Private ưu đãi hơn Angel nhưng có lockup)
- Option C: Giữ 0d cliff (cần note rõ trong whitepaper và SAFT)

---

#### CẢNH BÁO — Public vesting không có trong tài liệu — SEVERITY: LOW 🟢

Tài liệu không đặc tả vesting cho Public IDO.
Current implement (25% TGE, 0d cliff, 365d linear) là lựa chọn hợp lý theo thông lệ thị trường.
Cần SA confirm và ghi vào whitepaper chính thức.

---

## IV. CÁC HỢP ĐỒNG ĐANG THIẾU

FarmVesting.sol có đủ năng lực handle tất cả các allocation, nhưng chưa có deploy script và setup schedule cho:

| Allocation | Token | Vesting (per doc) | Status |
|---|---|---|---|
| **Team & Advisors** | 150,000,000 | 0% TGE, 180d cliff, 720d (24m) linear | ❌ Chưa làm |
| **Ecosystem & P2E** | 400,000,000 | 5% TGE + KPI milestone unlock | ❌ Chưa làm |
| **Liquidity & MM** | 100,000,000 | 100% TGE (transfer thẳng) | ❌ Chưa làm |
| **Treasury & Marketing** | 180,000,000 | Không đặc tả trong tài liệu | ❌ Chưa làm |

**Lưu ý về Ecosystem milestone-based:**
Cơ chế "mở khóa khi đạt KPI người dùng" (para 898) đòi hỏi oracle on-chain hoặc admin multisig trigger.
Không thể implement tự động 100% on-chain mà không có trusted data source.
→ Khuyến nghị: simplify thành linear vesting + admin có quyền accelerate tối đa X%, milestone phức tạp để Phase 2.

---

## V. ĐÁNH GIÁ TỔNG THỂ THIẾT KẾ TOKENOMICS

### Điểm mạnh ✅

| # | Điểm mạnh | Phân tích |
|---|---|---|
| 1 | FDV conservative $5M tại listing | Nhiều dự án tương tự listing $20-50M FDV → pump rồi dump. $5M tạo room tăng 10-20x |
| 2 | Circulating supply tại TGE nhỏ | ~176M lưu thông (Liquidity 100M + Public 50M + TGE unlock ~26M) → FMC ≈ $880K → hỗ trợ giá |
| 3 | Step-up giá rõ ràng | 5x Angel→listing, 2x Private→listing → kỳ vọng ROI hợp lý |
| 4 | Team cliff 6 tháng | Signal cam kết mạnh với investor |
| 5 | Deflationary mechanisms | Gacha đập chó + bảo hiểm nông sản + phí P2P → buyback & burn từ Treasury |
| 6 | Dual currency (GOLD + $FARM) | Chống bot hiệu quả: server kiểm soát GOLD trước khi convert ra $FARM |
| 7 | Liquidity 100% TGE | Tạo pool ngay lập tức, tránh thin liquidity khi listing |

### Điểm cần cân nhắc ⚠️

| # | Rủi ro | Hệ quả | Đề xuất |
|---|---|---|---|
| 1 | Angel 0% TGE (lỗi) | Vi phạm cam kết investor | Sửa ngay thành 5% |
| 2 | Private không cliff | VC dump ngay sau TGE | SA chốt: 30d hoặc 90d cliff |
| 3 | Ecosystem 400M milestone | Không implement được on-chain | Simplify thành linear có admin override |
| 4 | Treasury 180M không lock | 180M token admin có thể move bất kỳ lúc nào | Cần governance/multisig policy |
| 5 | Tổng raise $475K nhỏ | Runway 6-9 tháng nếu không có matching fund | Xác nhận matching fund từ Quỹ Phanxipan |
| 6 | Public vesting chưa confirm | Inconsistency giữa doc và contract | SA confirm 25%/365d vào whitepaper |

---

## VI. YÊU CẦU ĐẶC TẢ CHO SOFTWARE ARCHITECT

### 6.1 Các quyết định cần SA chốt ngay trước khi sửa/deploy contract

```
╔══════════════════════════════════════════════════════════════╗
║  [QUYẾT ĐỊNH 1] Angel TGE %                                  ║
║                                                              ║
║  Doc nói: 5% (para 918 cam kết rõ ràng với investor)        ║
║  Implement hiện tại: 0%                                      ║
║                                                              ║
║  Option A: Sửa thành 5% TGE → đúng doc, giữ cam kết         ║
║  Option B: Giữ 0% TGE → khắt khe hơn, nhưng lệch doc       ║
║                                                              ║
║  → SA phải chốt trước khi deploy. Nếu chọn A: sửa 1 dòng   ║
║    tgeBps: 0 → tgeBps: 500 trong constructor                ║
╚══════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════╗
║  [QUYẾT ĐỊNH 2] Private Cliff                                ║
║                                                              ║
║  Doc nói: 90d (Seed Sale chung = 3 tháng cliff)             ║
║  Implement hiện tại: 0d                                      ║
║                                                              ║
║  Option A: 90d cliff → đúng doc, bảo vệ giá tốt nhất        ║
║  Option B: 30d cliff → compromise, VC vẫn có lock ngắn      ║
║  Option C: Giữ 0d → linh hoạt cho VC nhưng rủi ro dump      ║
║                                                              ║
║  → SA chốt, ghi vào SAFT/term sheet với Private investors   ║
╚══════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════╗
║  [QUYẾT ĐỊNH 3] Public IDO Vesting                           ║
║                                                              ║
║  Doc: Không đặc tả                                          ║
║  Implement hiện tại: 25% TGE, 0d cliff, 365d linear         ║
║                                                              ║
║  Option A: Giữ nguyên 25%/365d → chuẩn thị trường IDO       ║
║  Option B: 50% TGE, 180d → public mua cao nên unlock nhiều  ║
║                                                              ║
║  → SA confirm, ghi vào whitepaper chính thức                ║
╚══════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════╗
║  [QUYẾT ĐỊNH 4] Treasury & Marketing 180M                    ║
║                                                              ║
║  Doc: Không đặc tả lock/vesting                             ║
║                                                              ║
║  Option A: Không lock → admin toàn quyền, rủi ro tin tưởng  ║
║  Option B: Timelock 12 tháng → tăng trust investor          ║
║  Option C: Gnosis Safe multisig (3/5 sig) → governance tốt  ║
║                                                              ║
║  → SA chốt policy, ảnh hưởng trực tiếp đến investor trust   ║
╚══════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════╗
║  [QUYẾT ĐỊNH 5] Ecosystem 400M Vesting Simplification        ║
║                                                              ║
║  Doc nói: 5% TGE + "mở khóa linh hoạt theo KPI người dùng" ║
║  Vấn đề: Không implement được KPI on-chain trong Phase 1     ║
║                                                              ║
║  Đề xuất: 5% TGE + linear 36 tháng (1080d) + admin wallet   ║
║  có thể accelerate thêm tối đa 10% nếu đạt milestone        ║
║  (milestone do team thông báo, không tự động)               ║
║                                                              ║
║  → SA confirm đề xuất simplification này hay có cách khác?  ║
╚══════════════════════════════════════════════════════════════╝
```

### 6.2 Thông tin cần thu thập trước khi viết deploy script hoàn chỉnh

```
[DATA CẦN CÓ 1: Team Vesting Beneficiaries]
  - Danh sách địa chỉ ví từng thành viên
  - % allocation của từng người trong 150M
  - Tên/vai trò để đặt label trong VestingSchedule
  Ví dụ cần:
    { address: "0x...", amount: "30000000", label: "founder" }
    { address: "0x...", amount: "45000000", label: "tech-lead" }
    ...

[DATA CẦN CÓ 2: Ecosystem Multisig Address]
  - Địa chỉ ví Gnosis Safe / multisig cho Ecosystem 400M
  - Hoặc địa chỉ ví admin sẽ hold và distribute

[DATA CẦN CÓ 3: Liquidity Manager Address]
  - Ai hold ví Liquidity 100M?
  - Khi nào add vào PancakeSwap pool?
  - Cần bao nhiêu USDT để pair? (nếu giá listing $0.005 và muốn pool $50K depth
    thì cần: 10M FARM + $50K USDT)

[DATA CẦN CÓ 4: Sale Timeline cụ thể]
  - Ngày mở Angel Round: DD/MM/YYYY
  - Ngày đóng Angel Round: DD/MM/YYYY
  - Ngày mở Private Sale: DD/MM/YYYY
  - Ngày đóng Private Sale: DD/MM/YYYY
  - Ngày IDO (Public): DD/MM/YYYY
  - Ngày TGE + PancakeSwap Listing: DD/MM/YYYY

[DATA CẦN CÓ 5: Whitelist Addresses]
  - Danh sách địa chỉ ví cho Angel Round
  - Danh sách địa chỉ ví cho Private Sale (VCs, Guilds)

[DATA CẦN CÓ 6: Min/Max Purchase Confirmation]
  Hiện implement (chưa confirm trong doc):
  - Angel: min $100 / max $10,000 per wallet
  - Private: min $500 / max $50,000 per wallet
  - Public: min $10 / max $5,000 per wallet
  SA xác nhận các con số này?
```

### 6.3 Checklist deploy đầy đủ (sau khi SA chốt)

```
PRE-DEPLOY CHECKLIST:
  [ ] Chốt Quyết Định 1-5 ở mục 6.1
  [ ] Thu thập tất cả Data 1-6 ở mục 6.2
  [ ] Audit code (khuyến nghị bắt buộc trước mainnet)
  [ ] Có đủ BNB để deploy + gas cho tất cả transactions

DEPLOY ORDER (BSC Testnet trước, Mainnet sau):
  Step 1:  Deploy FarmVesting(FARM_ADDRESS, ADMIN_WALLET)
  Step 2:  Deploy FarmTokenSale(USDT, FARM, VESTING, TREASURY, ADMIN)
  Step 3:  farmVesting.grantRole(CREATOR_ROLE, saleContract)
  Step 4:  farm.transfer(saleContract, 170_000_000 FARM)
  Step 5:  farm.transfer(vestingContract, 150_000_000 FARM)  ← Team
  Step 6:  farmVesting.addSchedule(member1, amount, 0, 180, 720, "team")
           farmVesting.addSchedule(member2, amount, 0, 180, 720, "team")
           ... (tất cả team members)
  Step 7:  farm.transfer(vestingContract, 400_000_000 FARM)  ← Ecosystem
  Step 8:  farmVesting.addSchedule(ecosystemWallet, 400M, 500, 0, 1080, "ecosystem")
  Step 9:  farm.transfer(liquidityWallet, 100_000_000 FARM)  ← 100% TGE
  Step 10: farmTokenSale.setRoundTimes(0, angelStart, angelEnd)
  Step 11: farmTokenSale.setRoundTimes(1, privateStart, privateEnd)
  Step 12: farmTokenSale.setRoundTimes(2, idoStart, idoEnd)
  Step 13: farmTokenSale.addToWhitelist(0, [angel addresses...])
  Step 14: farmTokenSale.addToWhitelist(1, [private addresses...])

POST-DEPLOY:
  [ ] Verify tất cả contracts trên BscScan
  [ ] Test mua token với ví test từng round
  [ ] Monitor USDT flow vào treasury wallet
  [ ] Đúng ngày TGE: farmVesting.setTge(unixTimestamp)
  [ ] Add PancakeSwap liquidity sau khi setTge()
```

---

## VII. HIỆN TRẠNG CODE

### Đã hoàn thành ✅

| File | Mô tả | Tests |
|---|---|---|
| `contracts/src/FarmVesting.sol` | Multi-schedule linear vesting, TGE unlock, cliff, CREATOR_ROLE | 15/15 ✅ |
| `contracts/src/FarmTokenSale.sol` | 3-round sale, whitelist, per-wallet cap, USDT→treasury, auto vesting | 29/29 ✅ |
| `contracts/scripts/deployTokenSale.ts` | Deploy FarmVesting + FarmTokenSale, grant role, fund 170M | — |
| `contracts/test/FarmVestingAndSale.test.ts` | 44 test cases | 44/44 ✅ |

### Cần sửa sau khi SA chốt quyết định

```solidity
// File: contracts/src/FarmTokenSale.sol — constructor

// [LỖI 1] Nếu SA chọn Angel TGE = 5%:
rounds[ROUND_ANGEL].tgeBps = 500;  // ← Đổi từ 0 sang 500

// [LỖI 2] Nếu SA chọn Private cliff = 90d:
rounds[ROUND_PRIVATE].cliffDays = 90;  // ← Đổi từ 0 sang 90

// [LỖI 2] Nếu SA chọn Private cliff = 30d:
rounds[ROUND_PRIVATE].cliffDays = 30;  // ← Đổi từ 0 sang 30
```

---

## VIII. TÓM TẮT ƯU TIÊN

| # | Vấn đề | Mức độ | Action |
|---|---|---|---|
| 1 | Angel TGE = 0% (doc nói 5%) | 🔴 CRITICAL | Sửa contract trước deploy |
| 2 | Private cliff = 0d (doc nói 90d) | 🔴 HIGH | SA chốt option A/B/C, sửa nếu cần |
| 3 | Thiếu Team vesting contract/script | 🔴 HIGH | Cần địa chỉ ví + tỷ lệ từ SA |
| 4 | Thiếu Ecosystem vesting | 🔴 HIGH | SA chốt simplification, viết script |
| 5 | Treasury 180M không có lock | 🟡 MEDIUM | SA chốt governance policy |
| 6 | Public vesting chưa confirm | 🟡 MEDIUM | SA confirm 25%/365d → ghi whitepaper |
| 7 | Liquidity deploy script | 🟡 MEDIUM | Cần sau khi có ví Liquidity |
| 8 | Min/max purchase confirmation | 🟢 LOW | SA xem lại các con số |
| 9 | Audit trước mainnet | 🔴 CRITICAL | Bắt buộc — không deploy mainnet chưa audit |

---

*Report này được tổng hợp từ việc đọc kỹ tài liệu gốc (không đoán). Tất cả trích dẫn có ghi rõ số paragraph nguồn. Mọi sửa đổi contract phải chờ SA chốt quyết định.*
