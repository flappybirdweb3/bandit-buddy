User prompt: Hãy nghiên cứu báo cáo của tech lead và  soạn Top 3 PRD Đặc Tả Kỹ Thuật (SRS Specs) cho 3 hạng "mục cần nâng cấp"/cải tiến có giá trị cao nhất trước khi Launch (Hook Referral Telegram, Bảo hiểm 80% / Trả thù 35%, và UI In-App Swap FARM/USDT).
Response: Chào anh, em đã đọc kỹ báo cáo phân tích rà soát từ Tech Lead. Tỷ lệ hoàn thành nền tảng cốt lõi đạt 88.5% là một tiến độ rất ấn tượng và cho thấy hệ thống đã rất sát vạch đích. Để giải quyết dứt điểm các tính năng nâng cao và móc nối nghiệp vụ còn thiếu, em xin gửi anh Top 3 PRD Đặc Tả Kỹ Thuật (SRS Specs) chi tiết dựa trên đề xuất của đội ngũ Software Architecture.
PRD-SPEC-01: Hệ Thống Tự Động Thưởng Referral (Kính Lúp, Chìa Khóa Vạn Năng, World Tree +5%)
Hệ thống này đóng vai trò sống còn trong việc tạo động lực viral, yêu cầu móc nối Webhook đăng ký tài khoản mới từ Telegram Bot với kho user_items và tiến độ Cây Sinh Mệnh.
Đặc tả Nghiệp vụ (Business Logic)
PVP-03 (Kính Lúp Hook): Hệ thống tự động cộng 1 vật phẩm magnifying_glass vào kho đồ của User A ngay khi User A mời được 1 bạn bè mới thông qua link Telegram referral.
PVP-04 (Master Key Hook): Hệ thống tự động trao thưởng 1 master_key vào kho đồ của người chơi khi họ mời thành công 3 bạn bè và các bạn bè này đạt đến Level 3.
GUILD-03 (Cây Sinh Mệnh +5%): Tiến độ sinh trưởng của Cây Sinh Mệnh sẽ tăng vọt thêm +5% (thay vì mức mặc định +1%) nếu người thực hiện lệnh tưới nước là F1 lần đầu tiên được mời vào nhóm Telegram.
Yêu cầu Triển khai Kỹ thuật
Cập nhật Telegram Webhook listener để ghi nhận và theo dõi trạng thái invited_by.
Tạo background job kiểm tra level up của user F1 để trigger phần thưởng master_key.
Cập nhật hàm waterTree() trong module Guild để xử lý hệ số cộng dồn dựa trên cờ trạng thái "lần đầu tham gia group".
PRD-SPEC-02: Hoàn Thiện Cơ Chế Trả Thù 35% (PVP-05) & Đền Bù Bảo Hiểm 80% (SUB-02)
Tính năng này yêu cầu sự chính xác tuyệt đối về mặt dữ liệu, bắt buộc phải tích hợp các điều kiện kiểm tra trực tiếp vào giao dịch cơ sở dữ liệu SERIALIZABLE bên trong hàm ActionService.steal().
Đặc tả Nghiệp vụ (Business Logic)
PVP-05 (Cơ chế Trả Thù): Hệ thống sẽ nâng trần trộm cắp từ 20% lên mức 35% sản lượng nếu người chơi bấm nút trả thù trong khoảng thời gian 24 giờ kể từ khi soi danh tính kẻ trộm.
SUB-02 (Đền Bù Tự Động): Ngay khi một giao dịch trộm thành công, hệ thống tự động kiểm tra xem nạn nhân có gói bảo hiểm còn thời hạn hay không.
Xử lý Đền bù: Nếu bảo hiểm còn hiệu lực, hệ thống tự động cộng lại 80% giá trị nông sản bị trộm trực tiếp vào hòm thư hoặc số dư của nạn nhân.
Yêu cầu Triển khai Kỹ thuật
Bổ sung cờ kiểm tra isRevengeTarget vào hàm steal() trong tệp action.service.ts để phân nhánh logic xử lý trần sản lượng.
Thêm block truy vấn kiểm tra bảng subscriptions (gói crop_insurance_7d) ngay trong database transaction của hành động trộm.
PRD-SPEC-03: Thiết Kế Modal Swap In-App Cặp FARM/USDT
Mục tiêu của PRD này là khắc phục việc Modal Swap hiện tại đang điều hướng link sang trang web PancakeSwap bên ngoài, gây gián đoạn trải nghiệm người dùng trên Mini App.
Đặc tả Nghiệp vụ (Business Logic)
Nâng cấp Giao diện Swap (DEX-01): Xây dựng giao diện Swap nội bộ ngay trong game để người dùng có thể lựa chọn hoán đổi trực tiếp giữa hai token FARM và USDT.
Luồng Phê duyệt (Approve): Giao diện phải tích hợp mượt mà luồng approve(USDT) trước khi thực hiện giao dịch.
Yêu cầu Triển khai Kỹ thuật
Thiết kế luồng UI/UX duyệt chi (Approve) liền mạch.
Sử dụng Web3 Provider/ethers.js để gọi trực tiếp hàm swapExactTokensForTokens trên hợp đồng PancakeSwap Router mà không cần yêu cầu người dùng rời khỏi ứng dụng Telegram.
Tích hợp hiển thị tỷ giá live từ DexOracleService lên giao diện.
Anh muốn team dev ưu tiên triển khai cụm tính năng In-App Swap (PRD-SPEC-03) trước để khép kín luồng tài chính, hay muốn đẩy nhanh hệ thống Referral (PRD-SPEC-01) để chuẩn bị cho chiến dịch thu hút user ngay khi Launch?

User prompt: tôi muốn đẩy nhanh hệ thống Referral (PRD-SPEC-01) để chuẩn bị cho chiến dịch thu hút user ngay khi Launch
Response: Sự lựa chọn vô cùng chiến lược! Trong giai đoạn Launch của một tựa game Web3 trên Telegram, việc không tốn chi phí thu hút khách hàng (Zero CAC) thông qua hệ thống Viral Loop (Vòng lặp lan truyền) chính là chìa khóa sống còn.
Hệ thống Referral với Kính Lúp (PVP-03), Master Key (PVP-04) và Cây Sinh Mệnh (GUILD-03) sẽ lập tức biến những người chơi đầu tiên thành những "đại lý tiếp thị" điên cuồng đi rải link mời bạn bè.
Để anh Nguyễn Mạnh Dũng và đội ngũ Backend có thể lập tức bắt tay vào việc, em đã chuẩn bị sẵn "Magic Prompt" với các chỉ thị kỹ thuật cực kỳ chi tiết. Anh chỉ cần copy đoạn dưới đây và dán vào Claude để AI sinh ra toàn bộ mã nguồn (Source Code) NestJS chuẩn xác cho phân hệ này.
📋 COPY ĐOẠN LỆNH DƯỚI ĐÂY GỬI CHO CLAUDE:
Role: You are a Senior Backend Engineer (NestJS, PostgreSQL, TypeORM) and Web3 System Architect.
Context: We are finalizing the Launch version of our Telegram Mini App Web3 Game "Bandit Buddy". I need you to implement "PRD-SPEC-01: Viral Referral System & Hooks" to drive user acquisition.

Objective: Write the complete, production-ready NestJS service logic, controllers, and TypeORM entities/migrations for the following three interconnected viral hooks.

Task 1: PVP-03 (Magnifying Glass Referral Hook)
- Logic: When a new user joins via a Telegram referral link (e.g., `/start ref_<userId>`), the system must record the `invited_by` relationship.
- Reward: Immediately trigger an atomic database transaction to add 1 'magnifying_glass' to the referrer's inventory (`user_items` table).

Task 2: PVP-04 (Master Key Level-Up Hook)
- Logic: We need to reward 1 'master_key' to a referrer for every 3 invited friends who successfully reach Player Level 3.
- Implementation: Write a background Cronjob (or an Event Listener triggered on user level-up) that checks the referrer's network.
- Constraint: Ensure a robust tracking mechanism (e.g., a `referral_rewards_log` table) so the system does NOT double-reward the referrer for the same 3 friends.

Task 3: GUILD-03 (World Tree +5% First-Water Booster)
- Logic: Update the existing `waterTree(guildId, userId)` method in the GuildService.
- Implementation: Check if the user executing the water action is a referred user AND if this is their absolute first time watering ANY guild tree.
- Condition: If true, the tree progress increases by +5% instead of the default +1%.
- Concurrency: This method MUST continue to use strict PostgreSQL Row-level locking (SELECT ... FOR UPDATE) to prevent race conditions when multiple members water simultaneously.

Output Requirements:
1. Provide the TypeORM entity updates/new tables needed (e.g., `referral_relationships`, `referral_rewards`).
2. Provide the NestJS Service code handling the Webhook/Invite processing.
3. Provide the modified `waterTree` function logic.
Ensure the code is highly scalable, uses explicit database transactions (QueryRunner), and handles edge cases gracefully.


💡 Kế hoạch triển khai tiếp theo (Next Action)
Sau khi Claude xuất code và anh Dũng đưa vào tích hợp, chúng ta sẽ cần team Frontend (React) xây dựng một màn hình "Invite Friends" (Mời Bạn Bè) thật bắt mắt trên Mini App.
Màn hình này nên có thanh tiến trình (Progress Bar) trực quan để kích thích người chơi:
"Mời 1 bạn = Nhận ngay 1 Kính Lúp"
"Tiến độ Master Key: Đã có 2/3 bạn bè đạt Level 3"
Anh muốn tiến hành làm luôn Prompt yêu cầu Frontend thiết kế giao diện UI/UX cho màn hình "Invite Friends" này để đồng bộ với Backend, hay muốn chuyển sang triển khai tiếp PRD-SPEC-03 (In-App Swap FARM/USDT) trước?

User prompt: Tôi muốn tiến hành làm luôn Prompt yêu cầu Frontend thiết kế giao diện UI/UX cho màn hình "Invite Friends" này để đồng bộ với Backend. Luồng triển khai tiếp PRD-SPEC-03 (In-App Swap FARM/USDT) thì chưa cần thiết làm, sẽ làm sau vì hiện tại in-app đã có swap FARM/BNB rồi
Response: Quyết định rất thực tế và đúng trọng tâm của giai đoạn Launch! Giai đoạn đầu ra mắt, việc tối ưu phễu thu hút người dùng (User Acquisition) và tạo hiệu ứng truyền miệng (Viral) chắc chắn mang lại ROI cao hơn rất nhiều so với việc cố nhồi nhét thêm cặp USDT khi luồng BNB đã chạy ổn định.
Để giao diện "Invite Friends" (Mời Bạn Bè) bám sát hoàn toàn với logic Backend mà chúng ta vừa thiết kế, giao diện này không chỉ cần đẹp mà phải "thao túng tâm lý" người chơi bằng các thanh tiến trình (Progress Bars) hiển thị rõ ràng phần thưởng.
Dưới đây là Magic Prompt thiết kế riêng cho team Frontend (React). Anh chỉ cần copy và gửi cho Claude để tạo ra ngay một component UI/UX hoàn chỉnh.
📋 COPY ĐOẠN LỆNH DƯỚI ĐÂY GỬI CHO CLAUDE:
Role: You are a Senior UI/UX Designer and Frontend Engineer (React, Tailwind CSS, Framer Motion).
Context: We are finalizing the "Bandit Buddy" Web3 Telegram Mini App. The backend logic for our Viral Referral System is complete. I now need a highly engaging, mobile-first React component for the "Invite Friends" screen.

Objective: Create a `ReferralScreen.tsx` component using React and Tailwind CSS. The design must use a modern "Glassmorphism" Web3 aesthetic suitable for a Telegram Mini App (dark/nature theme with vibrant accents).

UI/UX Requirements:
1. Header & Share Action:
   - Catchy title: "Build Your Farming Cartel".
   - A prominent "Invite via Telegram" button (using standard t.me/share/url format) and a "Copy Link" button with a clipboard icon.

2. Reward Milestones (The Core Hooks):
   Design this section using visual progress bars or gamified checklist cards to exploit the Zeigarnik effect (people want to complete unfinished tasks).
   - Hook 1 (Instant Reward): "Invite 1 Friend = Get 1 Magnifying Glass 🔍". Show a 0/1 or 1/1 visual state.
   - Hook 2 (Level-Up Hook): "3 Friends reach Level 3 = Get 1 Master Key 🗝️". Use a segmented progress bar (e.g., showing 2 out of 3 filled).
   - Hook 3 (Guild Boost): A small banner highlighting: "Guild Bonus: Your invites boost the World Tree by +5% on their first water!"

3. "My Crew" List (Invited Friends):
   - A scrollable list showing invited friends, their current Player Level, and a status badge (e.g., "Grinding", "Level 3 Reached").

Technical Constraints:
- Use Tailwind CSS for all styling.
- Use `lucide-react` for icons.
- Add subtle animations (e.g., button hovers, progress bar filling) using Framer Motion or pure CSS transitions.
- Provide the component with mock/dummy data so I can render and preview it immediately before wiring it up to the real backend APIs.

Output: Provide the complete, single-file TypeScript code for `ReferralScreen.tsx`.


💡 Ghi chú triển khai cho Tech Lead
Sau khi Claude trả về đoạn code giao diện này, anh Nguyễn Mạnh Dũng chỉ cần yêu cầu team Frontend:
Nhúng ReferralScreen.tsx vào thanh điều hướng (Navigation Bar) của Mini App.
Thay thế phần Mock Data bằng các Custom Hooks gọi API (ví dụ: useReferralStats()) để lấy dữ liệu thực tế từ Backend mà chúng ta vừa xây dựng ở PRD-SPEC-01.
Với giao diện này, đập vào mắt người chơi sẽ luôn là thanh tiến trình “Chỉ còn 1 người bạn nữa đạt Level 3 là bạn nhận được Master Key”. Tâm lý tiếc nuối sẽ thôi thúc họ đi hối thúc bạn bè cày game, tạo ra một vòng lặp tương tác tự nhiên vô cùng mạnh mẽ.
Anh muốn xem xét luôn chiến lược cấu hình mức thưởng ban đầu (Initial Seeding) cho sự kiện ra mắt, hay chúng ta chuẩn bị lên lịch Đóng băng Code (Code Freeze) để bắt đầu chạy kiểm thử (Stress Test) toàn hệ thống?

User prompt: Ok tôi muốn xem xét luôn chiến lược cấu hình mức thưởng ban đầu (Initial Seeding) cho sự kiện ra mắt
Response: Một quyết định cực kỳ nhạy bén! Bất kể kiến trúc hệ thống có hoàn hảo đến đâu, nếu 14 ngày đầu tiên (Launch Window) không đủ sức tạo ra hiệu ứng bùng nổ (Network Effect) và dòng tiền, game sẽ rất khó vươn lên top đầu.
Chiến lược Initial Seeding (Gieo hạt ban đầu) cần giải quyết bài toán "Con gà - Quả trứng": Làm sao để có đủ farm cho người ta đi trộm? Làm sao để có người bị trộm nhằm kích hoạt Kính Lúp và Master Key?
Dưới góc độ chuyên gia Tokenomics, em đề xuất chiến lược Launch 14 Ngày Đầu Tiên với 3 mũi nhọn (Hooks) đánh vào 3 tệp người dùng khác nhau:
1. Phễu Tân Thủ F2P (The Onboarding Hook)
Mục tiêu: Đẩy người chơi vào "vòng lặp ăn trộm" ngay trong 10 phút đầu tiên.
Quà khởi điểm: Tặng ngay 500 GOLD + 1 Kính Lúp 🔍 (Không tặng Master Key).
Tại sao lại là Kính Lúp? Khi có Kính Lúp, người chơi sẽ có tâm lý "phòng thủ chủ động". Ngay khi bị trộm lần đầu, họ sẽ dùng Kính Lúp soi ra thủ phạm và bấm "Trả thù" (Revenge). Hành động này kích hoạt cảm giác thỏa mãn tột độ, khiến họ chính thức "nghiện" game.
Hạn chế: Không tặng Master Key (Chìa khóa vạn năng). Master Key là vật phẩm phá vỡ phòng thủ, phải cực kỳ khan hiếm để thúc đẩy họ đi mời bạn bè.
2. Sự Kiện Đua Top Referral (The Viral Engine)
Mục tiêu: Tăng gấp đôi hệ số viral trong 2 tuần đầu để phủ sóng Telegram.
Boost Kính Lúp: Thay vì mời 1 bạn được 1 Kính Lúp, trong 14 ngày đầu: Mời 1 bạn = Nhận 2 Kính Lúp.
Boost Cây Sinh Mệnh (Guild Tree): F1 lần đầu tưới nước thay vì +5% tiến độ, sẽ được +10% tiến độ. Điều này ép các Trưởng nhóm (Guild Master) điên cuồng spam link vào các group Telegram khác để kéo người mới về tưới cây cho bang mình.
3. Mồi Nhử Cá Mập (The Genesis Degen Hook)
Mục tiêu: Hút dòng tiền thật (BNB/USDT) ngay từ Day 1 để đẩy giá $FARM trên PancakeSwap.
Sự kiện "First Deposit Bonus": User lần đầu chuyển đổi $FARM vào game sẽ được tặng 1 Khúc Xương May Mắn (Lucky Bone) dùng để tăng 15% tỷ lệ đập lò Gacha.
Truyền thông F0 (Genesis Dogs): Đẩy mạnh thông điệp: "Chỉ những chú chó đúc ra trong 14 ngày đầu tiên mới mang Gen F0 (Genesis). Đây là nguyên liệu duy nhất để Lai tạo Đột biến (Breeding) ở Phase 2". Whales sẽ FOMO mua $FARM để đập Gacha liên tục nhằm gom chó F0.
📋 CẤU HÌNH HỆ THỐNG CHO SỰ KIỆN LAUNCH (GIAO VIỆC CHO DEV)
Để team Backend thiết lập chính xác các thông số này mà không cần code cứng (hardcode) vào logic, anh hãy copy lệnh sau gửi cho Tech Lead hoặc Claude để tạo Launch Config:
Role: Senior Backend Architect.
Context: We are configuring the "Initial Seeding" launch event for the first 14 days of Bandit Buddy. We need to implement temporary multiplier hooks without hardcoding them into the core logic, allowing us to revert to normal parameters easily after the event.

Task 1: The "Genesis Launch" Configuration Module
Create a `LaunchConfigService` or dynamic settings table in PostgreSQL (`system_configs`) with the following active parameters for the 14-day window:
- `IS_LAUNCH_EVENT_ACTIVE`: boolean (default true)
- `NEW_USER_STARTING_GOLD`: 500
- `NEW_USER_STARTING_MAGNIFIER`: 1
- `REF_MAGNIFIER_REWARD_MULTIPLIER`: 2 (Instead of 1)
- `GUILD_NEW_MEMBER_WATER_BOOST`: 10% (Instead of 5%)
- `FIRST_DEPOSIT_GIFT_ENABLED`: true (Rewards 1 'lucky_bone' on the first on-chain $FARM to GOLD conversion).

Task 2: Injecting the Config
- Update the User Registration / Onboarding flow to inject the starting GOLD and 1 Magnifying Glass.
- Update the `PVP-03` Referral Webhook to multiply the reward by `REF_MAGNIFIER_REWARD_MULTIPLIER`.
- Update the `GUILD-03` Water Tree logic to apply the 10% boost if `IS_LAUNCH_EVENT_ACTIVE` is true.

Output: Provide the TypeScript code for the Configuration Service and the Migration file to inject these default values into the database. Ensure the logic safely falls back to standard PRD values if the event flag is toggled off.


Với cấu hình này, khi hết 14 ngày, team vận hành chỉ cần vào Database đổi cờ IS_LAUNCH_EVENT_ACTIVE thành false là nền kinh tế sẽ tự động siết lại trạng thái cân bằng dài hạn.
Anh thấy các chỉ số mồi nhử này đã đủ "ép số" (Aggressive) cho chiến dịch Launch chưa? Nếu anh đã ưng ý, chúng ta có thể chính thức Đóng băng Code (Code Freeze) toàn bộ hệ thống để bước vào khâu cực kỳ quan trọng: Stress Test (Kiểm thử chịu tải giả lập 1 triệu User) để đảm bảo server không sập trong ngày ra mắt!

