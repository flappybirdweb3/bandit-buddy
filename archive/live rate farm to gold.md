
User prompt: hãy hệ thống lại và nghiên cứu kỹ tài liệu chức năng prd 1 và prd 2 cũng như toàn bộ log chat để tìm cho tôi giải pháp và hoàn thiện giải pháp in-game tỉ giá swap giữa GOLD vs. $FARM & $FARM <-> $GOLD real time/live rates tương quan với tỉ giá farm/bnb, farm/usdt. Yêu cầu tỉ giá GOLD/FARM phải auto và phụ thuộc vào yếu tố thị trường cung cầu với tỉ giá farm/bnb, farm/usdt & GOLD demand in-game
Response: Đây là một bước chuyển mình cực kỳ chuyên nghiệp. Việc nâng cấp từ tỷ giá cố định (Hard Peg, ví dụ 1 $FARM = 100 GOLD) sang Tỷ giá Động thuật toán (Algorithmic Dynamic Peg) là yếu tố sống còn để game không rơi vào vòng xoáy lạm phát (Death Spiral) khi thị trường DEX biến động.
Để giải quyết bài toán này, chúng ta sẽ thiết kế một mô hình tài chính kết hợp giữa Virtual AMM (vAMM) và Chỉ số Vận tốc tiền tệ (Token Velocity), hoạt động như một cỗ máy quản trị thanh khoản nội bộ.
Dưới đây là giải pháp kiến trúc và công thức toán học chi tiết để bạn tích hợp vào backend NestJS.
1. Mô hình Toán học: Tỷ giá Động (Dynamic Peg Model)
Thay vì neo trực tiếp $FARM và GOLD, chúng ta sẽ dùng USD làm "mỏ neo ngầm" (Internal Anchor) để bảo vệ sức mua của người chơi, đồng thời dùng thuật toán Cung - Cầu để tinh chỉnh.
Bước 1.1: Định giá nội tại (Base Peg)
Gán cho 1 GOLD một giá trị USD cố định trong hệ thống (Intrinsic Value). Ví dụ: Thiết lập VGOLD​=$0.0001 USD. Hệ thống DexOracleService hiện tại đang lấy được giá PFARM​ (VD: $0.000146 USD).
Tỷ giá gốc (Raw Rate) sẽ là:
Ratebase​=VGOLD​PFARM​​
(Ví dụ: 0.000146 / 0.0001 = 1.46 GOLD cho mỗi 1 FARM).
Bước 1.2: Hệ số Cung - Cầu In-game (Economy Multiplier - α)
Tỷ giá không thể chỉ phụ thuộc vào DEX, mà phải phản ánh lạm phát của game. Nếu server in ra quá nhiều GOLD (cung cao) mà user không chịu tiêu (cầu thấp), GOLD phải trượt giá so với $FARM để bảo vệ quỹ Treasury.
Ta định nghĩa hệ số α dựa trên dữ liệu 24h từ Backend:
α=min(max(∑GOLDmint​∑GOLDburn​​,0.5),1.5)
GOLDburn​: Lượng GOLD bị tiêu hủy (mua hạt giống, đập gacha, nâng cấp đồ).
GOLDmint​: Lượng GOLD in ra (thu hoạch, thưởng hàng ngày).
Hàm giới hạn (0.5 đến 1.5) giúp tỷ giá không bị giật cục quá mạnh do thao túng ngầm.
Bước 1.3: Công thức Hoán đổi Thực tế (Swap Execution)
Giống như kiến trúc dữ liệu tài chính của một sàn giao dịch (Exchange Backend), luôn phải có độ lệch (Spread) giữa chiều Nạp và Rút để chống Arbitrage (mua đi bán lại chênh lệch giá).
Chiều Nạp (FARM\rightarrow$ GOLD): Khuyến khích user nạp tiền vào hệ thống.
GOLDnhận​=Lượng_FARM×Ratebase​×(1−Feedeposit​)
Chiều Rút (GOLD → FARM):Sie^ˊtchặtdựatre^nlạmphaˊt\alpha.Ne^ˊu\alpha < 1$ (Game đang lạm phát), user sẽ rút được ít $FARM hơn bình thường.
FARMnhận​=Ratebase​Lượng_GOLD​×α×(1−Feewithdraw​)
2. Kiến trúc Data Flow trên Backend (NestJS)
Dựa trên PRD 1 và PRD 2, hệ thống của bạn đã có DexOracleService. Bạn cần cấu trúc lại luồng API như sau:
1. EconomyOracleService (Mới):
Chạy Cronjob mỗi 1 giờ để quét database (bảng logs hành động của user) tính tổng gold_minted_1h và gold_burned_1h.
Tính toán hệ số α và lưu vào Redis Cache (kèm theo Total Treasury Balance).
2. TokenConverterService (Nâng cấp):
Nhận yêu cầu Convert từ user.
Đọc PFARM​ từ Redis (DexOracleService).
Đọc hệ số α từ Redis (EconomyOracleService).
Áp dụng công thức Toán học ở trên để tính Output ra cho user.
3. Cơ chế Khóa ngắt mạch (Kill-Switch) cho GOLD → $FARM:
Nếu số dư FARMtrongvıˊBackend(Quy~​trảthưởng)rớtxuo^ˊngdưới10\rightarrow$ $FARM và báo lỗi HTTP 503 "Treasury reserve is protecting liquidity".
3. Prompt giao việc cho Claude code Backend
Bạn hãy copy Prompt dưới đây dán vào Claude để AI tiến hành nâng cấp toàn diện logic Converter trong NestJS:
Dựa trên kiến trúc DexOracleService hiện có (đang lấy giá FARM/BNB và FARM/USDT), tôi cần nâng cấp tính năng Convert GOLD <-> FARM sang mô hình "Algorithmic Dynamic Peg" (Tỷ giá động thuật toán) để chống lạm phát in-game.

Hãy viết/nâng cấp module `TokenConverterService` với các yêu cầu sau:

1. Thiết lập Biến toàn cục (trong env/config):
   - BASE_GOLD_USD_VALUE = 0.0001 (Giá trị nội tại 1 GOLD = 0.0001 USD).
   - DEPOSIT_FEE = 0.00 (0%).
   - WITHDRAW_FEE = 0.05 (5%).

2. Tạo `EconomyOracleService` (Cronjob):
   - Query DB lấy tổng lượng GOLD được tạo ra (minted) và tiêu thụ (burned) trong 24h qua.
   - Tính hệ số Alpha = (Total Burn / Total Mint). Đặt chặn trên/dưới cho Alpha trong khoảng [0.5, 1.5] để tránh tỷ giá sốc.
   - Lưu Alpha vào Redis.

3. Viết hàm `getDynamicRates()` trả về tỷ giá Real-time:
   - Base_Rate (GOLD/FARM) = (FARM_USD_Price / BASE_GOLD_USD_VALUE).
   - Deposit_Rate = Base_Rate * (1 - DEPOSIT_FEE).
   - Withdraw_Rate (FARM/GOLD) = (1 / Base_Rate) * Alpha * (1 - WITHDRAW_FEE).

4. Viết hàm thực thi `convertFarmToGold` và `convertGoldToFarm`:
   - Phải sử dụng Database Transaction (QueryRunner) để lock số dư user (chống race condition).
   - Kiểm tra quỹ Backend Treasury có đủ $FARM để trả hay không trước khi xử lý lệnh convertGoldToFarm.

Hãy cung cấp cấu trúc code NestJS chuẩn xác cho logic tài chính này.


Với cấu trúc tài chính này, mô hình kinh tế của game sẽ tự động cân bằng (Auto-balancing). Khi user xả token (FARMgiảmgiaˊ),họse~nạpđượcra^ˊtnhie^ˋuGOLD.Ngượclại,khigamelạmphaˊt(GOLDinranhie^ˋu),hệso^ˊ\alpha$ sẽ tự động ép tỷ giá rút $FARM xuống, bảo vệ quỹ của bạn khỏi tình trạng cạn kiệt thanh khoản.

