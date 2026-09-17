User prompt: hãy hệ thống lại và nghiên cứu kỹ tài liệu chức năng prd 1 và prd 2 cũng như toàn bộ log chat có thể đọc từ tài liệu tôi upload kèm theo đây "Chọn Game Open Source Làm Web3 v2.docx" & rà soát lại toàn bộ lịch sử chat liên quan đến "Cây Sinh Mệnh Bang Hội (Co-op Boss Farm)" để viết cho tôi prd về chức năng này "Cây Sinh Mệnh Bang Hội" để giao claude dev ngay
Response: Dựa trên toàn bộ tài liệu và lịch sử log chat bạn đã cung cấp, tính năng "Cây Sinh Mệnh Bang Hội" (Guild World Tree / Co-op Boss Farm) là mảnh ghép Social-Fi quan trọng nhất để tạo ra hiệu ứng mạng lưới (Network Effect) bùng nổ trên Telegram, đồng thời đóng vai trò là một "Hố đen" (Sink) khổng lồ để đốt token $FARM.
Dưới đây là bản PRD (Product Requirements Document) tiêu chuẩn kỹ thuật sâu, được hệ thống hóa lại từ số 0 để bạn có thể sao chép và giao thẳng cho Claude (hoặc team Dev) bắt tay vào chia Task và Code ngay lập tức.
📄 PRD: CÂY SINH MỆNH BANG HỘI (GUILD WORLD TREE) & SOCIAL-FI
Project: Bandit Buddy (FarmHeist) Platform: Telegram Mini App (TMA) & Telegram Group Chat Document Status: Ready for Development
1. TỔNG QUAN & MỤC TIÊU (OVERVIEW & GOALS)
Tính năng cho phép người chơi tích hợp Bot Game vào các hội nhóm Telegram để cùng nhau chăm sóc một "Cây Sinh Mệnh".
Mục tiêu Viral (Growth Hack): Tận dụng tệp danh bạ Telegram. Biến mỗi user thành đại lý kéo ref tự nhiên thông qua động lực ép cây lớn nhanh.
Mục tiêu Kinh tế (Tokenomics): Khóa (Stake) lượng lớn FARMrakhỏilưutho^ngtho^ngquaviệclậpBangVIP,đo^ˋngthờiđo^ˊtFARM thông qua các cơ chế mua Khiên bảo vệ khi PvP (Guild Wars).
2. ĐẶC TẢ NGHIỆP VỤ & LUỒNG LOGIC (BUSINESS LOGIC)

2.1. Phân cấp Bang Hội (Guild Tiers - Mô hình Paltalk Blue Badge)

Bang Dân Dã (Free Tier - Cờ Nâu/Xám):
Điều kiện: Tạo miễn phí (1 lần duy nhất cho mỗi account).
Giới hạn: Tối đa 20 thành viên. Cây Sinh Mệnh max Level 3.
Bất lợi: Không có bảng xếp hạng, không mua được khiên bảo vệ (dễ bị cướp).
Bang Tinh Anh (Premium Tier - Cờ Xanh Phát Sáng):
Điều kiện: Chủ bang (Guild Master) phải Khóa (Stake) 1,000 $FARM vào Smart Contract. Rút (Unstake) cần 7-14 ngày cooldown.
Đặc quyền: Sức chứa không giới hạn. Cây Sinh Mệnh mở max Level. Có mặt trên Bảng xếp hạng toàn Server.
Quyền lợi kinh tế: Chủ bang được thiết lập Thuế (Tax) từ 1% - 5% trên tổng sản lượng thu hoạch nông sản cá nhân của các thành viên trong Bang.

2.2. Cơ chế Tưới Nước & Viral Growth Hack (The Watering Loop)

Cây Sinh Mệnh mọc ở giữa Group Telegram. Mức độ trưởng thành tính bằng % (0% -> 100%).
Check-in Hàng Ngày: Mỗi thành viên gõ lệnh /water trong group chat hoặc bấm nút [Tưới Nước] trên Mini App 1 lần/ngày. Mỗi lượt tưới cộng 1% tiến độ.
Growth Hack (Cơ chế Viral): Nếu thành viên A chia sẻ Referral Link và mời được User B (tài khoản hoàn toàn mới) vào Group. Khi User B bấm /water lần đầu tiên, tiến độ cây lập tức tăng đột biến +5% (Tương đương sức tưới của 5 người cũ).
Tâm lý học: Cơ chế này ép các thành viên phải liên tục đi spam link mời người ngoài vào group để cây mau chín.

2.3. Cơ chế Thu Hoạch & Bằng Chứng Đóng Góp (Proof of Contribution)

Khi Cây đạt 100%, nó nổ ra rương phần thưởng chứa $FARM và vật phẩm hiếm. Phần thưởng phân bổ tự động:
Chủ Bang (Guild Master): Nhận mặc định 10% tổng quỹ thưởng (Khuyến khích các KOL/Admin mang game về group của họ).
Thành viên (Members): 90% còn lại chia theo tỷ lệ đóng góp (Proof of Work). Hệ thống chấm điểm: (Số lần tưới nước * Hệ số 1) + (Số người F1 mời được * Hệ số 5). Ai cày ref nhiều sẽ nhận lượng $FARM lớn nhất.

2.4. Guild Wars (GvG) & Tiêu hao Token (Token Sinks)

Trạng thái Ripe (Chín): Khi cây đạt 100%, nó phát sáng trên Bản đồ Server trong 12 giờ trước khi được claim.
Đại chiến Ăn Trộm: Các Bang khác có thể kéo quân sang "đục khoét" Cây của Bang này.
Mua Khiên (The Sink): Để bảo vệ Cây, Chủ bang và Thành viên phải đóng góp $FARM để mua "Khiên Năng Lượng" hoặc "Thần Thú Giữ Cửa".
Dòng tiền: Số $FARM dùng để mua khiên sẽ bị Đốt (Burn) hoặc chuyển vào Quỹ TreasuryBuyBack, giúp game giảm phát mạnh mẽ.
3. KIẾN TRÚC KỸ THUẬT (TECHNICAL ARCHITECTURE)
3.1. Smart Contract (GuildStaking.sol)
Sử dụng mạng BSC.
Hàm stake(uint256 amount, string guildId): Thu 1000 $FARM, cấp cờ Premium cho guildId.
Hàm requestUnstake(string guildId): Khóa 7-14 ngày.
Hàm unstake(string guildId): Hoàn tiền sau khi hết cooldown.
Hàm claimGuildReward(...): Backend sinh chữ ký ECDSA chứa bảng phân bổ (Merkle Root hoặc mảng phân phối) để các user claim $FARM khi cây chín.
3.2. Backend & Database Schema (PostgreSQL)
Cần bổ sung các bảng sau:
guilds: id, telegram_group_id, name, owner_id, is_premium (bool), tax_rate (1-5%), tree_level, tree_progress_percent, status (growing, ripe).
guild_members: guild_id, user_id, role, joined_at.
tree_contributions: guild_id, user_id, water_count, invited_count, calculated_points.
API Logic: Cần có Row-level lock (FOR UPDATE) khi gọi API /guild/water để tránh 100 người trong group chat gõ lệnh cùng lúc làm sai lệch % sinh trưởng.
3.3. Telegram Bot Integration (Webhook)
Lắng nghe lệnh /water từ Telegram Webhook.
Lắng nghe sự kiện "User joins group" để tính toán Referral.
Bot tự động push message vào Group: "Cây Sinh Mệnh đã đạt 100%! Đang bị Bang XXX tấn công! Anh em vào mua khiên ngay!"
4. 🤖 MAGIC PROMPT ĐỂ GIAO VIỆC CHO CLAUDE DEV
Dưới đây là Prompt thiết kế chuẩn mực để bạn ném cho Claude (cùng với tính năng GitHub Integration). Claude sẽ tự động đọc PRD này, bóc tách thành các Epic, Task cụ thể và code luôn cấu trúc hệ thống.
📋 COPY NỘI DUNG BÊN DƯỚI DÁN VÀO CLAUDE:
Role: You are a Lead Web3 System Architect and Senior Full-Stack Developer (NestJS, React, Solidity).
Context: We are expanding the Telegram Mini App Web3 game "Bandit Buddy". I have provided the complete PRD for the new "Co-op Boss Farm" (Guild World Tree) feature. This feature combines Social-Fi mechanics, a Paltalk-style Blue Badge premium tier via staking, viral growth loops (affiliate networking), and GvG PvP token sinks.

Objective: Your task is to act as the Engineering Manager and Lead Coder. First, break this PRD down into technical implementation steps. Then, write the core foundational code for this system.

Execution Requirements:

TASK 1: Database Schema (PostgreSQL)
Write the strict SQL migration queries to create the following tables with proper relations and indexing for high-concurrency: `guilds`, `guild_members`, and `tree_contributions`. Ensure you add fields to support the Premium "Blue Flag" status and Tax Rate (1-5%).

TASK 2: Smart Contract (Solidity)
Write the `GuildStaking.sol` contract (using OpenZeppelin v5).
- Include `stakeToCreateGuild(bytes32 guildId)` requiring 1000 $FARM.
- Include a 7-day delayed unstake mechanism (`requestUnstake` and `executeUnstake`).
- Ensure it is tightly secured against Reentrancy.

TASK 3: Backend Logic & Concurrency Control (NestJS/TypeScript)
Write the Service logic for the `/guild/water` endpoint. 
- You MUST implement PostgreSQL Row-level locking (SELECT ... FOR UPDATE) on the Guild's tree to prevent race conditions when 100 users type the `/water` command simultaneously in a Telegram group.
- Implement the logic: +1% for normal water, +5% if it's a newly referred user's first water.

TASK 4: Execution Plan & Backlog
Briefly list out the next 5 API endpoints and 3 React UI components we will need to build to complete this Epic, structured as GitHub Issue titles.

Please output the SQL, Solidity, and TypeScript code clean, modular, and ready for production. Do not skip error handling.



