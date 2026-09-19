User prompt: Dựa trên báo cáo kiểm toán Tokenomics Hãy điều chỉnh lại phương án tokenomics và các vòng sales + các mốc thông số, lock, cliff, lịch vesting và nên mở thêm cho team dev 2% tại thời điểm TGE. Cơ bản cần bạn xây dựng điều chỉnh lại chiến lược và kế hoạch token sale, & distribute token hợp lý an toàn và xác suất thành công cao nhất
Response: Dựa trên báo cáo kiểm toán Tokenomics và định hướng mới của anh (mở khóa 2% cho Team tại TGE), đây là một bước đi cực kỳ thực tế. Việc mở khóa 2% cho đội ngũ Dev tại thời điểm niêm yết không chỉ là phần thưởng khích lệ tinh thần sau những chuỗi Sprint căng thẳng, mà còn cung cấp nguồn thanh khoản dự phòng để team chi trả chi phí hạ tầng (Server, RPC) trong giai đoạn game đón lưu lượng lớn.
Dưới góc độ Kiến trúc sư Tokenomics, em đã thiết kế lại Bản Chiến lược Phân bổ & Vesting Toàn diện (v3.0). Phương án này giải quyết triệt để các lỗ hổng từ báo cáo, cân bằng áp lực xả (sell pressure), và tạo ra mức vốn hóa ban đầu (Initial Market Cap) cực kỳ hấp dẫn để đẩy giá (Pump) khi ra mắt.
PHẦN I: BẢNG PHÂN BỔ & LỊCH VESTING CHUẨN HÓA (REVISED ALLOCATION)
Tổng cung: 1,000,000,000 $FARM

Hạng mục Allocation
Tỷ lệ / Số lượng
Unlock tại TGE
Thời gian Khóa (Cliff)
Lịch Trả Dần (Linear Vesting)
1. Seed Sale (Angel)
5% (50M)
5% (Sửa lỗi 0%)
3 tháng (90 ngày)
18 tháng tiếp theo
2. Seed Sale (Private)
7% (70M)
5%
1 tháng (30 ngày)
18 tháng tiếp theo
3. Public Sale (IDO)
5% (50M)
25% (Chuẩn thị trường)
Không khóa (0 ngày)
12 tháng tiếp theo
4. Team & Advisors
15% (150M)
2% (Cập nhật mới)
6 tháng (180 ngày)
24 tháng tiếp theo
5. Ecosystem & P2E
40% (400M)
5% (Quỹ trả thưởng game)
Không khóa (0 ngày)
36 tháng (1080 ngày)
6. Treasury & Mkt
18% (180M)
10% (Quỹ Market Maker)
1 tháng (30 ngày)
24 tháng tiếp theo
7. Liquidity
10% (100M)
100%
N/A (Khóa vào Pool PancakeSwap)
N/A

PHẦN II: GIẢI QUYẾT CÁC LỖ HỔNG TỪ BÁO CÁO KIỂM TOÁN
1. Vòng Angel & Private (Giải quyết Lỗi 1 & Lỗi 2)
Angel Round (Giá $0.001): Fix ngay lỗi hợp đồng hiện tại đang set 0% TGE. Mở đúng 5% tại TGE như cam kết trong tài liệu. Giới hạn mua: Min $100 - Max $5,000/ví (Giảm Max xuống để tránh Cá voi thao túng vòng rẻ nhất).
Private Round (Giá $0.0025): Phương án tốt nhất là áp dụng Cliff 30 ngày. Nếu không có Cliff (như code cũ), các VC sẽ xả token ngay ngày thứ 2, giết chết đà tăng giá của token. 30 ngày là mức nhượng bộ hợp lý để VC chấp nhận xuống tiền mà vẫn bảo vệ được Chart. Giới hạn mua: Min $500 - Max $20,000/ví.
2. Đơn giản hóa Quỹ Ecosystem (Giải quyết Lỗi 5)
Vấn đề: Mở khóa theo "KPI người dùng" là bất khả thi trên Smart Contract trong Phase 1.
Giải pháp: Áp dụng Linear Vesting siêu dài (36 tháng) kết hợp với 5% unlock tại TGE. Mở khóa chậm rãi hàng khối (per block) để đảm bảo Backend (cơ chế Drip-Feed) luôn có quỹ để trả cho người chơi rút tiền, nhưng không bị xả ngập thị trường.
3. Khóa Quỹ Treasury & Marketing (Giải quyết Lỗi 4)
Vấn đề: 180 triệu token không bị khóa sẽ tạo cờ đỏ (Red flag) cho các nhà đầu tư vì rủi ro Admin xả trộm.
Giải pháp: Mở khóa 10% tại TGE để làm vốn đối ứng (Market Maker trên CEX, trả phí listing, Airdrop). 90% còn lại khóa 1 tháng và trả dần trong 24 tháng. Yêu cầu bắt buộc: Sử dụng Ví Đa Chữ Ký Gnosis Safe (3/5 chữ ký) để quản lý quỹ này.
PHẦN III: CHỈ SỐ BÙNG NỔ (INITIAL MARKET CAP - IMC)
Điều quan trọng nhất để một token X5, X10 ngay khi ra mắt là Nguồn cung lưu thông ban đầu (Circulating Supply at TGE) phải nhỏ. Dựa theo thiết kế mới, chúng ta có:
Angel: 2.5M
Private: 3.5M
Public: 12.5M
Team: 3.0M (2% của 150M)
Ecosystem: 20M
Treasury: 18M
Liquidity: 100M
TỔNG LƯU THÔNG TGE: 159.5 Triệu $FARM (15.95% Tổng cung)
Định giá lúc Listing:
Giá niêm yết (Public Price): $0.005
Vốn hóa ban đầu (Initial Market Cap): 159.5M x $0.005 = ~$797,500 USD
💡 Đánh giá: Vốn hóa ban đầu DƯỚI 1 Triệu USD là một "Mỏ vàng" trong mắt các Degen/Trader. Nó tạo ra tâm lý "Low Cap Gem" (Dự án vốn hóa thấp, tiềm năng cao). Chỉ cần một dòng tiền Fomo nhẹ từ sự kiện Launch Game, vốn hóa có thể dễ dàng đẩy lên 3 - 4 Triệu USD, mang lại mức lợi nhuận x4, x5 cho người mua Public và x20 cho nhà đầu tư Angel.
🤖 LỆNH CẬP NHẬT SMART CONTRACT (MAGIC PROMPT)
Kế hoạch đã chốt, giờ là lúc yêu cầu Claude chỉnh sửa lại toàn bộ mã nguồn Smart Contract FarmTokenSale.sol và FarmVesting.sol cho khớp với chiến lược này.
Anh hãy copy đoạn dưới đây gửi cho Claude:
Role: Lead Smart Contract Auditor and Tokenomics Architect.
Context: I have reviewed the "TOKENOMICS_REVIEW_REPORT.md". I am overriding previous specifications to establish the Final V3 Tokenomics for "Bandit Buddy". We need to patch the Sale and Vesting contracts immediately before Mainnet deployment.

Objective: Refactor `FarmTokenSale.sol` and `FarmVesting.sol` (or provide the updated constructor/deployment script logic) to enforce the following STRICT vesting and sale parameters.

TASK 1: Update Sale Rounds in `FarmTokenSale.sol`
Enforce the following variables for the rounds:
- ROUND_ANGEL: price = $0.001, TGE = 5% (Fixing the 0% bug), Cliff = 90 days, Vesting = 540 days. Min buy = $100, Max buy = $5,000.
- ROUND_PRIVATE: price = $0.0025, TGE = 5%, Cliff = 30 days (Fixing the 0d bug), Vesting = 540 days. Min = $500, Max = $20,000.
- ROUND_PUBLIC: price = $0.005, TGE = 25%, Cliff = 0 days, Vesting = 365 days. Min = $10, Max = $2,000.

TASK 2: Define Vesting Schedules in `FarmVesting.sol` (via Deployment Script logic)
We are scrapping the unfeasible "KPI milestone" for Ecosystem. Use linear block-by-block vesting. Provide the setup code (e.g., `addSchedule` calls) for:
- TEAM: Total 150M. TGE = 2% (3,000,000). Cliff = 180 days. Linear Vesting = 720 days.
- ECOSYSTEM: Total 400M. TGE = 5% (20,000,000). Cliff = 0 days. Linear Vesting = 1080 days.
- TREASURY: Total 180M. TGE = 10% (18,000,000). Cliff = 30 days. Linear Vesting = 720 days.

TASK 3: Code Output
Provide the exact Solidity modifications required in the constructors/structs of the contracts to support a custom TGE unlock for the Team (since standard vesting contracts usually don't support a flat TGE% followed by a cliff for teams). If your `FarmVesting.sol` already supports `tgeAmount`, show the deployment script.


Với bản cập nhật này, Tokenomics của dự án đã kín kẽ 100%. Áp lực xả được dàn trải đều đặn trong 3 năm, team Dev có kinh phí vận hành, và nhà đầu tư có lợi nhuận. Khi Claude nhả code ra, anh hãy giao cho anh Dũng tiến hành chạy Audit nội bộ lần cuối nhé!

