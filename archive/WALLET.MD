User prompt: Hãy phân tích nghiên cứu để xây dựng cho tôi tài liệu đặc tả chức năng wallet như chức năng decentralized wallet của binance để giữ digital assets của user & có icon wallet trên top HUD bar. Show balance, chức năng nạp rút bnb, $farm vv... yêu cầu tiêu chuẩn bảo mật và chú trọng ui/ux user flow phải được tối ưu thuận tiện thao tác focus người dùng global

Response: Dựa trên các hình ảnh tham khảo từ Binance Web3 Wallet mà bạn cung cấp /home/ubuntu/barnbuddy/wallet (đặc biệt chú ý đến các từ khóa "Keyless Wallet", "Cloud Backups", và UI quản lý tài sản) cùng với mục tiêu xây dựng cho tập người dùng Global trên nền tảng Telegram Mini App (TMA), đây là một bước đi mang tính bước ngoặt.
Việc bắt người dùng liên tục nhảy qua lại giữa Telegram và MetaMask/TrustWallet là "sát thủ" giết chết tỷ lệ chuyển đổi (Conversion Rate). Việc tích hợp một In-App Decentralized Wallet (Ví phi tập trung nội bộ) sử dụng công nghệ MPC (Multi-Party Computation - Ví không cần khóa) sẽ mang lại trải nghiệm mượt mà như Web2 nhưng vẫn đảm bảo tính bảo mật phi tập trung của Web3.
Dưới đây là Tài liệu Đặc tả Sản phẩm (PRD) chi tiết cho tính năng này.
📄 PRD: HỆ THỐNG IN-APP DECENTRALIZED WALLET (KEYLESS)
Project: Bandit Buddy (FarmHeist) Platform: Telegram Mini App (TMA) & BSC Reference: Binance Web3 Wallet UI/UX
1. TỔNG QUAN & MỤC TIÊU (OVERVIEW & GOALS)
Mục tiêu cốt lõi: Tạo ra một ví Web3 non-custodial (không lưu giữ private key của user) nằm ngay bên trong giao diện game.
Công nghệ: Sử dụng MPC (Ví chia sẻ khóa) thông qua các provider như Web3Auth hoặc Particle Network. Người chơi chỉ cần đăng nhập qua Telegram, hệ thống sẽ tự động tạo một ví Web3 thực thụ trên mạng BSC mà họ không cần phải nhớ 12 từ khóa (Seed Phrase).
Định hướng Global: Giao diện tối giản, hỗ trợ đa tiền tệ fiat (USD, VND, EUR...), hiển thị số dư trực quan, quy trình Nạp/Rút (Deposit/Withdraw) chỉ với 2-3 thao tác (clicks).
2. ĐẶC TẢ GIAO DIỆN & TRẢI NGHIỆM (UI/UX SPECIFICATIONS)
2.1. Top HUD Bar (Điểm chạm trên màn hình Game chính)
Vị trí: Nằm cố định ở góc trên cùng (Top Right hoặc Top Left) của giao diện nông trại.
Hiển thị:
Icon Ví (Wallet Icon).
Địa chỉ ví rút gọn (VD: 0x1A2...3B4).
Số dư $FARM hoặc USD tổng hợp (Tùy chọn ẩn/hiện số dư bằng icon 👁️).
Tương tác: Chạm vào khu vực này sẽ trượt (Slide up) Modal hoặc mở toàn màn hình giao diện Ví chính (Assets Dashboard).
2.2. Assets Dashboard (Màn hình Ví chính - Ref: Ảnh 1)
Thiết kế theo phong cách tối giản của Binance Web3 Wallet:
Header: Tổng tài sản quy đổi ra Fiat (Ví dụ: $1,250.00). Hỗ trợ chọn Currency (USD mặc định cho Global).
Quick Actions (4 Nút tròn):
Send (Gửi): Rút BNB/$FARM ra ví ngoài.
Receive (Nhận): Hiện mã QR và địa chỉ ví để nạp tiền.
History (Lịch sử): Lịch sử nạp, rút, swap, claim thưởng.
Approvals (Quản lý cấp quyền): Thu hồi quyền (Revoke) của các Smart Contract (Bảo mật cao).
Asset List (Danh sách Token):
Hiển thị 2 tài sản chính của game: BNB (Dùng làm Gas) và $FARM (Token in-game).
Hiển thị số lượng token, giá hiện tại (fetch từ Oracle) và tổng giá trị Fiat của token đó.
2.3. Wallet Security & Settings (Bảo mật & Cài đặt - Ref: Ảnh 2, 3, 4)
Cơ chế Backup (Keyless Wallet Backups):
Ví tạo bằng Telegram account. Để tăng tính bảo mật, người dùng được khuyến nghị tạo bản sao lưu (Backup) chia sẻ (Mô hình 2/3 shares của MPC).
Giao diện cho phép sao lưu mã hóa lên Google Drive / iCloud (Quick Backup) hoặc lưu dưới dạng Mã QR mã hóa.
Settings Menu: Hỗ trợ đổi ngôn ngữ (Language), Đổi đơn vị tiền tệ (Currency), và Quản lý kết nối mạng (Network).
3. ĐẶC TẢ TÍNH NĂNG (FUNCTIONAL REQUIREMENTS)
3.1. Luồng Tạo Ví Tự Động (Frictionless Onboarding)
User mở Mini App trên Telegram → Hệ thống lấy Telegram ID & InitData.
Gửi request đến MPC Provider (VD: Web3Auth) → Tự động sinh ra một địa chỉ ví BSC hợp lệ.
User KHÔNG cần ghi chép Seed Phrase. Họ có thể chơi game ngay lập tức.
Khi số dư ví vượt qua một ngưỡng nhất định (VD: > $10), hệ thống hiện thông báo (Red dot) yêu cầu User vào Settings để thực hiện "Cloud Backup".
3.2. Luồng Nạp/Rút (Deposit/Withdraw)
Nạp (Receive):
Hiển thị QR Code lớn, tích hợp nút "Copy Address".
Nút "Share Address" gửi thẳng địa chỉ ví vào khung chat Telegram cho bạn bè.
Rút (Send):
Input: Địa chỉ nhận, Loại Token (BNB/FARM), Số lượng.
Tích hợp tính năng dán (Paste) từ clipboard.
Tự động ước tính phí Gas mạng BSC. Nút "MAX" trừ đi phí Gas để không bị kẹt giao dịch.
Bảo mật: Yêu cầu xác thực sinh trắc học (FaceID/Fingerprint) của thiết bị thông qua API của Telegram WebApp (biometricManager) trước khi ký giao dịch chuyển đi.
4. TIÊU CHUẨN BẢO MẬT (SECURITY STANDARDS)
Non-custodial Tuyệt Đối: Backend của game (Node.js/NestJS) TUYỆT ĐỐI KHÔNG lưu trữ Private Key của người dùng. Khóa được chia nhỏ (Sharding): 1 phần nằm ở thiết bị người dùng (Local Storage/Keychain), 1 phần nằm ở node của MPC Provider, 1 phần dùng để khôi phục (Backup).
Chống Phishing: Do ví nằm tích hợp trong Mini App Telegram, người dùng không bao giờ bị lộ giao diện Confirm Transaction giả mạo từ các trang web lừa đảo.
Bảo vệ Anti-Drainer: Tính năng "Approvals" cho phép người chơi dễ dàng thu hồi các quyền Approve vô hạn đối với các contract rác nếu họ lỡ tương tác.
5. 🤖 MAGIC PROMPT GIAO VIỆC CHO CLAUDE DEV
Dưới đây là Prompt kiến trúc sư để bạn copy và gửi cho Claude. Prompt này định hướng sử dụng Particle Network hoặc Web3Auth (hai giải pháp ví MPC số 1 hiện nay cho Telegram) để code ra giao diện giống Binance Web3 Wallet.
📋 COPY ĐOẠN DƯỚI ĐÂY DÁN VÀO CLAUDE:
Role: You are a Lead Web3 Frontend Architect and Senior UI/UX Designer specializing in React, Tailwind CSS, and Telegram Mini Apps.

Context: We are building an In-App Decentralized "Keyless" Wallet for our Web3 game "Bandit Buddy" (on BSC). The goal is to replicate the smooth, secure, and global UI/UX of the "Binance Web3 Wallet" directly inside our Telegram Mini App. We will use an MPC/Account Abstraction approach (like Web3Auth or Particle Network) so users do not need to manage seed phrases.

Objective: Design and implement the Frontend UI components and the integration logic framework for this In-App Wallet.

Execution Requirements:

TASK 1: Top HUD Wallet Component (`WalletHUD.tsx`)
- A small, persistent top bar component.
- Display a wallet icon, truncated BSC address (e.g., 0x1A...2B), and total fiat balance (e.g., $150.00).
- Must have an onClick handler to open the main Wallet Dashboard.

TASK 2: Main Assets Dashboard (`WalletDashboardModal.tsx`)
- Replicate the Binance Web3 Wallet "Assets" tab vibe.
- Header: Large Total Assets balance in USD.
- Quick Actions Row: 4 sleek icon buttons (Send, Receive, History, Approvals).
- Asset List: A tabbed view (Tokens, NFTs). Under Tokens, list BNB and $FARM. Show token balance, real-time fiat value, and 24h price change. Use clean Tailwind glassmorphism or neat white/dark mode cards.

TASK 3: Receive & Send Flows
- `ReceiveModal`: Show a large QR Code (use `qrcode.react`), the full address, and a "Copy Address" button with a clipboard icon.
- `SendModal`: Inputs for Recipient Address, Token Dropdown (BNB/FARM), and Amount. Include a "MAX" button that calculates balance minus estimated gas. 

TASK 4: Keyless Backup & Settings UI (`WalletSettings.tsx`)
- Replicate the Binance "Wallet Management" security feel.
- Sections for "Keyless Wallet Backups". Show options for "Quick Backup (Cloud)" and "QR Code Backup".
- UI toggles for Language and Currency (USD, EUR, VND).

Technical Specs:
- Use React, TypeScript, Tailwind CSS, and `lucide-react` for icons.
- Mock the state management (e.g., using Zustand) and provide the hook signatures (e.g., `useMPCWallet()`) that we will later wire up to Web3Auth/Particle Network.
- Output clean, production-ready, mobile-first responsive code tailored for the Telegram WebApp viewport. Ensure the UI feels premium and trustworthy.


💡 Lời khuyên chiến lược (Actionable Advice)
Với việc triển khai tính năng này, game của bạn không còn đơn thuần là một trò chơi, mà đã trở thành một Siêu ứng dụng (Super App). Người dùng Global cực kỳ dị ứng với việc tải thêm extension ví hoặc lo sợ mất 12 từ khóa. Bằng cách giấu toàn bộ sự phức tạp của Web3 ra phía sau, bạn sẽ tạo ra tỷ lệ giữ chân (Retention Rate) cực cao.
