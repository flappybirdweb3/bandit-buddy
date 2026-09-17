User prompt: Hãy nghiên cứu tài liệu PRD_FEATURE_LIST_AND_PRIORITIZATION.MD các tính năng claude dev/tech lead hệ thống lại cần phải implement & PRD_REMAINING_FEATURES_SA_SPECIFICATION_REPORT.MD là những chức năng cần bạn review và viết tài liệu đặc tả chức năng cho claude dev triển khai
Response: Dựa trên các hình ảnh tham khảo từ Binance Web3 Wallet và mục tiêu xây dựng một ứng dụng nhắm tới tập người dùng toàn cầu (Global Users) trên nền tảng Telegram Mini App (TMA), việc tích hợp một Ví Phi Tập Trung Nội Bộ (In-App Decentralized Wallet) là một quyết định mang tính bước ngoặt.
Việc bắt người dùng liên tục phải nhảy qua lại giữa Telegram và MetaMask/TrustWallet là "sát thủ" giết chết tỷ lệ chuyển đổi (Conversion Rate). Với công nghệ Ví không khóa (Keyless/MPC Wallet), chúng ta sẽ mang lại trải nghiệm mượt mà như Web2 (Binance) nhưng vẫn đảm bảo tính phi tập trung và bảo mật tuyệt đối của Web3.
Dưới đây là Tài liệu Đặc tả Chức năng (PRD) chi tiết để anh giao cho Tech Lead và đội ngũ Frontend.
📄 PRD-SPEC-WAL: IN-APP KEYLESS DECENTRALIZED WALLET
Module: Web3 Wallet Infrastructure & UI/UX Reference: Binance Web3 Wallet (Keyless) Tech Stack: React, Tailwind CSS, Web3Auth / Particle Network (MPC)
1. TỔNG QUAN VÀ KIẾN TRÚC LÕI (OVERVIEW & ARCHITECTURE)
Mục tiêu: Tạo ra một ví Non-custodial (Không giam giữ tài sản) nằm ngay bên trong giao diện Telegram Mini App.
Công nghệ lõi (MPC - Multi-Party Computation): Sử dụng các nhà cung cấp như Web3Auth hoặc Particle Network. Hệ thống không tạo ra 12 từ khóa (Seed Phrase) truyền thống. Khóa cá nhân (Private Key) được chia làm 3 mảnh (Shards):
Mảnh 1: Nằm trên thiết bị người dùng (Local Storage/Keychain).
Mảnh 2: Gắn với tài khoản mạng xã hội (Telegram OAuth).
Mảnh 3 (Backup): Lưu mã hóa trên iCloud / Google Drive.
Lợi ích: 0-click onboarding. Người dùng vừa mở Bot Telegram là có ngay một ví BSC thực thụ để chứa BNB và $FARM mà không sợ quên mật khẩu.
2. ĐẶC TẢ GIAO DIỆN & TRẢI NGHIỆM (UI/UX SPECIFICATIONS)
2.1. Top HUD Bar (Điểm chạm Game chính)
Đây là lối vào ví, hiển thị liên tục ở góc trên cùng màn hình (Top Right hoặc Top Left).
UI Components:
Icon Ví (Wallet Icon) nổi bật.
Địa chỉ ví rút gọn (VD: 0x1A2...3B4).
Tổng số dư quy đổi ra Fiat (VD: $150.25).
Icon 👁️ (Mắt) để ẩn/hiện số dư (Privacy mode).
Interaction: Chạm (Tap) vào khu vực này sẽ kích hoạt hiệu ứng trượt mượt mà (Slide Up) mở ra WalletDashboardModal.
2.2. Assets Dashboard (Trang Chủ Ví - Ref: Ảnh 1 Binance)
Thiết kế theo phong cách tối giản, dồn trọng tâm vào tài sản (Assets-centric).
Global Header: Hiển thị số dư tổng (Total Assets) bằng Fiat. Hỗ trợ dropdown chọn đơn vị tiền tệ (USD, EUR, VND) fetch tỷ giá từ API.
Quick Actions (4 Nút Tròn):
Send (Gửi): Điều hướng sang luồng rút tiền.
Receive (Nhận): Điều hướng sang luồng nạp tiền.
History (Lịch sử): Hiển thị lịch sử On-chain (In/Out/Swap).
Approvals (Cấp quyền): Quản lý và thu hồi (Revoke) quyền tiêu xài token của các Smart Contract. (Đây là tính năng bảo mật chuẩn Tier 1 của Binance).
Asset Tabs:
Tokens: Danh sách BNB và $FARM. Hiển thị Logo, số lượng token, giá trị Fiat quy đổi, và % biến động giá 24h.
NFTs: Danh sách Chó bảo vệ (Guard Dogs ERC-1155) đang không được trang bị.
2.3. Luồng Nạp/Rút Tối Ưu (Receive & Send Flow)
Receive Modal:
Hiển thị QR Code lớn (Sử dụng thư viện qrcode.react).
Hiển thị địa chỉ ví đầy đủ.
Nút [Copy Address] (Nảy Toast thông báo "Copied").
Nút [Share to Chat] gọi API Telegram để gửi địa chỉ ví thẳng vào khung chat cho bạn bè.
Send Modal:
Input địa chỉ nhận (Có nút Scan QR code tích hợp Camera nếu Telegram hỗ trợ, hoặc nút Paste từ Clipboard).
Dropdown chọn loại Token (BNB / FARM).
Input số lượng kèm nút [MAX]. Lưu ý UX: Nút MAX phải tự động tính toán trừ đi phí Gas mạng BSC để giao dịch không bị lỗi "Insufficient funds for gas".
Xác thực: Bật Popup Telegram Haptic Feedback (Rung nhẹ) khi gửi thành công.
2.4. Keyless Backup & Security (Bảo mật ví - Ref: Ảnh 2, 3, 4)
Màn hình Wallet Settings:
Trạng thái Backup: [Not Backed Up] (Màu đỏ) / [Backed Up] (Màu xanh).
Quick Backup: Tích hợp API lưu mảnh khóa mã hóa lên iCloud (iOS) hoặc Google Drive (Android).
Convert to Private Key: Cho phép Whales (Cá mập) xuất Private Key/Seed Phrase để họ import ngược vào MetaMask/TrustWallet nếu họ muốn nắm quyền kiểm soát 100% tài sản ở app ngoài.
3. TIÊU CHUẨN BẢO MẬT & GLOBAL UX
Zero Backend Custody: Backend NestJS của dự án TUYỆT ĐỐI KHÔNG được đụng vào hay lưu trữ Private Key của user. Phải tuân thủ 100% kiến trúc Client-side MPC.
Anti-Drainer (Chống quét ví): Bất kỳ giao dịch rút tiền (Send) nào cũng phải hiển thị một Popup Confirm xác nhận lại số lượng và địa chỉ đích, tránh việc UI bị clickjacking.
Global Localization: Mặc định ngôn ngữ là Tiếng Anh (GLOBAL_ENGLISH_ONLY). Các định dạng số phải hỗ trợ chuẩn quốc tế (Dấu phẩy cho hàng nghìn: 1,000.50). Mặc định Fiat hiển thị là USD.
4. 🤖 MAGIC PROMPT ĐỂ GIAO VIỆC CHO CLAUDE DEV
Anh hãy copy toàn bộ khối lệnh dưới đây, dán vào Claude để yêu cầu nó quy hoạch kiến trúc Frontend và viết code UI/UX chuẩn xác cho hệ thống ví này. Prompt này định hướng sử dụng Web3Auth/Particle làm nền tảng MPC.
📋 COPY ĐOẠN LỆNH DƯỚI ĐÂY DÁN VÀO CLAUDE:
Role: Lead Web3 Frontend Architect and Senior UI/UX Developer (React, Tailwind CSS, Framer Motion).
Context: We are building an "In-App Keyless Decentralized Wallet" for our Telegram Mini App game "Bandit Buddy" (on BSC network). The goal is to replicate the smooth, secure, and global UI/UX of the "Binance Web3 Wallet" directly inside our TMA. We will use an MPC/Account Abstraction approach (like Web3Auth or Particle Network) for frictionless onboarding without seed phrases.

Objective: Design and implement the Frontend UI components and the state management framework for this wallet.

Execution Requirements (Output production-ready React/TypeScript code):

TASK 1: Top HUD Component (`WalletHUD.tsx`)
- Create a persistent top bar component.
- Display a wallet icon, truncated BSC address (e.g., 0x1A...2B), and total fiat balance ($USD).
- Include an eye icon to toggle balance visibility (Privacy mode).
- onClick opens the `WalletDashboardModal`.

TASK 2: Main Assets Dashboard (`WalletDashboardModal.tsx`)
- Replicate the Binance Web3 Wallet "Assets" tab vibe.
- Header: Large Total Assets balance in USD.
- Quick Actions Row: 4 sleek icon buttons using `lucide-react` (Send, Receive, History, Approvals).
- Asset List Tabs: "Tokens" and "NFTs". 
- Under "Tokens", list BNB and $FARM with mock balances, real-time fiat values, and 24h % change. Use clean Tailwind glassmorphism or modern dark/light mode cards.

TASK 3: Receive & Send Flows (`ReceiveModal.tsx` & `SendModal.tsx`)
- Receive: Show a large QR Code, full address, and a "Copy" button with a clipboard icon.
- Send: Inputs for Recipient Address, Token Select (BNB/FARM), and Amount. Include a "MAX" button that intelligently calculates (Balance - Estimated Gas). Add a confirmation step before execution.

TASK 4: Keyless Security Settings (`WalletSettingsModal.tsx`)
- Replicate the Binance "Wallet Management" UI.
- Show "Backup Status" (Backed Up / Not Backed Up).
- Include buttons for "Cloud Backup (Google Drive/iCloud)" and "Export Private Key".
- Toggles for Currency (USD, EUR, VND).

Technical Specifications:
- Use React, TypeScript, Tailwind CSS. Add smooth Framer Motion slide-up animations for the modals.
- Create a Zustand store (`useWalletStore.ts`) to mock the MPC wallet state (address, balances, backup status) so we can wire it up to Web3Auth SDK later.
- Design must be mobile-first, heavily optimized for the Telegram WebApp viewport. Keep the tone premium and globally accessible (English default).


💡 Ghi chú cho Tech Lead (Nguyễn Mạnh Dũng):
Với kiến trúc này, khi người chơi bấm vào "Marketplace" hay "Gacha", ứng dụng sẽ tự động trích xuất ví In-app này để ký giao dịch (Sign Tx) mà không cần bật popup Metamask phiền phức. Trải nghiệm sẽ liền mạch 100% từ đầu đến cuối như chơi game Web2, nhưng tài sản lại hoàn toàn nằm trên Blockchain.

User prompt: Hãy nghiên cứu tài liệu PRD_FEATURE_LIST_AND_PRIORITIZATION.MD các tính năng claude dev/tech lead hệ thống lại cần phải implement & PRD_REMAINING_FEATURES_SA_SPECIFICATION_REPORT.MD là những chức năng cần bạn review và viết tài liệu đặc tả chức năng cho claude dev triển khai
Response: Dựa trên danh sách tính năng từ PRD Master Catalog và báo cáo đánh giá kiến trúc (Gap Analysis), hệ thống của chúng ta đã hoàn thiện hầu hết các luồng cơ bản. Tuy nhiên, để nền kinh tế và trải nghiệm người dùng đạt trạng thái hoàn hảo nhất trước khi Launch, chúng ta cần giải quyết dứt điểm 3 khối tính năng nâng cao (Remaining Deliverables) còn tồn đọng trong Backlog.
Dưới đây là Đặc Tả Kỹ Thuật (SRS - Software Requirements Specification) cho 3 Epic cuối cùng, kèm theo "Magic Prompt" để anh giao cho Claude Dev triển khai ngay.
1. PRD-SPEC-04: Hệ Thống Tự Động Hóa Quản Gia (Barn Butler Full Automation)
Mã tính năng: SUB-01
Mục tiêu: Tạo ra một "Hố đen" (Sink) tiêu thụ $FARM liên tục hàng tháng, nhắm vào tập người chơi bận rộn muốn tối ưu hóa năng suất nông trại.
Đặc tả Nghiệp vụ (Business Logic):
Chi phí: Người chơi trả 50 $FARM/tháng để thuê Quản gia. 100% phí này được chuyển thẳng về Treasury Buyback Vault để đốt.
Thu hoạch tự động: Quản gia sẽ tự động gặt nông sản ngay khi cây chín.
Chữa bệnh tự động (OpEx Auto-Cure): Quản gia tự động trả Vàng (GOLD) để diệt cỏ dại (40G), xịt sâu bọ (60G) hoặc tưới nước (30G) khi thời tiết xấu. Điều kiện an toàn: Chỉ thực hiện nếu số dư của người chơi ≥ Chi phí sửa chữa + 100 GOLD dự phòng.
Tự động Gieo hạt (Seed Queue): Trồng lại hạt giống dựa trên danh sách ưu tiên (Priority Order) mà người chơi đã cài đặt.
Yêu cầu Kỹ thuật:
Sử dụng một Cronjob (@Cron('*/10 * * * *')) chạy mỗi 10 phút trên Backend NestJS.
Bắt buộc áp dụng khóa dòng (pessimistic_write hoặc SELECT ... FOR UPDATE) khi cronjob cập nhật trạng thái ô đất và trừ tiền, để tránh lỗi Race Condition khi người chơi cũng đang thao tác trên UI cùng lúc.
2. PRD-SPEC-05: Radar Chiến Tranh Bang Hội & Khiên 12h (GvG Shield Wars)
Mã tính năng: GUILD-04
Mục tiêu: Kích hoạt tính năng PvP quy mô lớn giữa các Guild Tinh Anh, ép các Chủ bang phải liên tục nạp tiền mua Khiên bảo vệ Cây Sinh Mệnh.
Đặc tả Nghiệp vụ (Business Logic):
Đột kích (Raid): Khi Cây Sinh Mệnh của một bang đạt 100% (Chín), các bang đối thủ có thể tràn sang cướp tối đa 15% tổng quỹ thưởng (Dividend Pool).
Khiên Năng Lượng (Energy Shield): Bang chủ có thể kích hoạt Khiên bảo vệ kéo dài 12 giờ với chi phí 500 GOLD. Khi có Khiên, bang khác không thể đột kích.
Raid Radar (Giao diện): Cung cấp một màn hình Radar cho phép thành viên bang quét các bang đối thủ có Cây đang chín. Radar hiển thị rõ trạng thái: 🛡️ Shielded (HH:MM:SS remaining) hoặc ⚔️ Vulnerable (Unshielded).
Yêu cầu Kỹ thuật:
Bổ sung trường shield_until (Timestamp) vào bảng guilds.
API POST /guild/raid xử lý logic cướp 15% và chuyển thẳng vào quỹ của bang đi cướp.
3. PRD-SPEC-06: Hệ Thống Thông Báo Chợ P2P Thời Gian Thực (Live Trade Toast)
Mã tính năng: MKT-04
Mục tiêu: Tạo hiệu ứng Dopamine tức thì khi người chơi bán được hàng trên chợ P2P, kích thích họ tiếp tục treo bán và tương tác với game.
Đặc tả Nghiệp vụ (Business Logic):
Ngay khi một lệnh bán Off-chain (Crates, Master Key, Kính lúp) được khớp trên Smart Contract (BanditMarket.sol), người bán sẽ nhận được một Pop-up (Toast) nổi lên màn hình ngay lập tức dù đang ở bất kỳ giao diện nào.
Giao diện & Âm thanh: Toast hiển thị thẻ bài mạ vàng với nội dung "Cha-ching! Thùng 1,000 Dưa hấu đã được bán với giá 15.00 FARM!". Kèm theo đó là hiệu ứng âm thanh tiếng tiền rơi (soundManager.play('coin')) và thiết bị rung nhẹ (Haptic feedback).
Yêu cầu Kỹ thuật:
Backend sử dụng EventsGateway (WebSocket qua Socket.io) lắng nghe sự kiện từ Blockchain Indexer.
Phát sự kiện trade_filled đến đúng phòng riêng (user:${sellerUserId}) của người bán.
🤖 MAGIC PROMPT GIAO VIỆC CHO CLAUDE DEV
Để đội ngũ kỹ thuật có thể hoàn thiện nốt 3 Epic cuối cùng này, anh hãy copy đoạn lệnh dưới đây và dán vào Claude.
Role: Lead Web3 Software Architect and Senior Full-Stack Developer (NestJS, React).
Context: We are executing the final features from our "PRD_REMAINING_FEATURES_SA_SPECIFICATION_REPORT.MD" before launching our Telegram Mini App game "Bandit Buddy". I need you to implement the codebase for three critical remaining deliverables: Barn Butler Automation, GvG Shield Wars, and Live WebSocket Trade Toasts.

Execution Requirements:

TASK 1: Barn Butler Automation Engine (SUB-01)
- Write the `BarnButlerService` in NestJS with a `@Cron('*/10 * * * *')` decorator.
- The cronjob must query users who have an active Butler subscription.
- Implement logic to: 
  1. Harvest ripe crops.
  2. Cure debuffs (drought=30G, pests=60G, weeds=40G) ONLY IF `goldBalance >= cost + 100`.
  3. Replant seeds based on a hypothetical `butler_seed_queues` table.
- Wrap all modifications in a PostgreSQL transaction using `pessimistic_write` row-level locking.

TASK 2: GvG Raid Radar & Shields (GUILD-04)
- Backend: Write the endpoint `POST /guild/shield` to deduct 500 GOLD and extend the Guild's `shieldUntil` timestamp by 12 hours.
- Backend: Write `GET /guild/raid-targets` returning rival guilds with 100% tree progress, including their `shieldUntil` status and calculated 15% siphon potential.
- Frontend (React): Create a `GuildRaidRadar.tsx` component that renders this list. Show "🛡️ Shielded (HH:MM:SS)" or a "⚔️ Launch Siphon Raid" button if unshielded.

TASK 3: Real-Time Trade Toast (MKT-04)
- Backend: Write the `EventsGateway` logic pushing a `trade_filled` event to a specific `user:${sellerUserId}` room.
- Frontend (React): Write a `TradeToastProvider.tsx` component that listens to the `trade_filled` WebSocket event.
- Upon receiving the event, trigger a custom golden toast UI showing: "💰 Trade Filled! [Quantity] [Item] sold for [Price] $FARM". Include a mock function call for `soundManager.play('coin')` and Telegram haptic feedback `window.Telegram.WebApp.HapticFeedback.notificationOccurred('success')`.

Output: Provide the clean, production-ready TypeScript code for the NestJS services/controllers and the React UI components. Emphasize transaction safety and scalable WebSocket architecture.



