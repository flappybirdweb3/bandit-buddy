
User prompt: Hãy nghiên cứu việc đặc tả kỹ thuật triển khai tiếp PRD-SPEC-03 (In-App Swap FARM/USDT)
Response: Việc triển khai PRD-SPEC-03 (In-App Swap FARM/USDT) là bước tiến quyết định để hoàn thiện trải nghiệm tài chính (DeFi) ngay bên trong Telegram Mini App. Khác với giao dịch bằng native BNB đã có sẵn, việc tích hợp stablecoin (USDT) giúp người chơi tránh được rủi ro biến động giá của thị trường crypto, nhưng đòi hỏi luồng xử lý Smart Contract phức tạp hơn do bản chất của token ERC-20 (yêu cầu phê duyệt/approve trước khi giao dịch) và cơ chế định tuyến (routing) của PancakeSwap.
Dưới đây là bản Đặc Tả Kỹ Thuật (SRS) chi tiết để giao cho Claude thực thi việc nâng cấp Component Swap hiện tại.
1. ĐẶC TẢ NGHIỆP VỤ & LUỒNG TRẢI NGHIỆM (BUSINESS & UX LOGIC)
Mục tiêu: Cho phép người dùng hoán đổi trực tiếp giữa USDT và $FARM ngay trong modal ClaimModal.tsx hoặc MarketplaceModal.tsx mà không bị văng ra trình duyệt ngoài (như ứng dụng PancakeSwap web).
Luồng Thao Tác (User Flow):
Lựa chọn Cặp Giao Dịch: Giao diện cung cấp nút Toggle chuyển đổi nguồn tiền thanh toán: [ BNB ] hoặc [ USDT ].
Kiểm tra Số Dư & Định Giá: Khi nhập số lượng USDT muốn dùng, hệ thống gọi API /api/web3/exchange-rate (đã có từ DexOracleService) để tính toán estimate số lượng $FARM nhận được.
Kiểm tra Cấp Quyền (Allowance Check): Nếu người dùng chọn USDT, hệ thống tự động kiểm tra xem ví đã cấp quyền (approve) cho hợp đồng PancakeSwap Router tiêu xài USDT chưa.
Luồng Ký Giao Dịch 2 Bước (2-Step Execution):
Bước 1 (Nếu chưa đủ Allowance): Nút bấm hiển thị "Approve USDT". Người dùng ký xác nhận trên ví.
Bước 2 (Khi đã đủ Allowance): Nút bấm hiển thị "Swap USDT to $FARM". Người dùng ký giao dịch swap chính thức.
2. KIẾN TRÚC KỸ THUẬT & SMART CONTRACT (TECHNICAL SPECIFICATIONS)
Vì token $FARM của dự án được thiết kế với cơ chế Thuế Động (Dynamic Tax 1-5%), việc gọi nhầm hàm trên PancakeSwap sẽ dẫn đến lỗi giao dịch bị Revert (thất bại) liên tục do trượt giá (Slippage) của token nhận được thực tế thấp hơn tính toán ban đầu.
Các thông số kỹ thuật bắt buộc:
PancakeSwap V2 Router (BSC): 0x10ED43C718714eb63d5aA57B78B54704E256024E (Mainnet) hoặc địa chỉ Testnet tương ứng.
Path Routing (Đường vòng thanh khoản): Thanh khoản chính nằm ở cặp FARM/WBNB, do đó giao dịch USDT phải đi vòng:
Mua FARM bằng USDT: Path = [USDT_ADDRESS, WBNB_ADDRESS, FARM_ADDRESS]
Bán FARM ra USDT: Path = [FARM_ADDRESS, WBNB_ADDRESS, USDT_ADDRESS]
Hàm Khớp Lệnh Bắt Buộc (Critical):
TUYỆT ĐỐI KHÔNG dùng swapExactTokensForTokens.
BẮT BUỘC dùng swapExactTokensForTokensSupportingFeeOnTransferTokens để PancakeRouter tự động điều chỉnh số lượng đầu ra sau khi bị trừ thuế $FARM.
Quản lý Trạng thái Wagmi v2 (React):
Sử dụng useReadContract để đọc allowance(userAddress, routerAddress) của USDT Contract.
Sử dụng useWriteContract để gọi hàm approve(routerAddress, amount) trên USDT Contract.
Sử dụng useWaitForTransactionReceipt để bắt trạng thái đang chờ mạng lưới (Pending) của cả 2 giao dịch trên, hiển thị Loading Spin khóa UI, tránh việc user bấm đúp.
3. GIAO DIỆN NGƯỜI DÙNG (UI/UX)
Token Selector: Dropdown hoặc Toggle Button chọn Input Token (BNB/USDT).
Input / Output Fields: Ô nhập liệu tự động hiển thị số dư khả dụng (Max Balance) của token đã chọn. Có nút [MAX] tự động điền toàn bộ số dư.
Slippage Tolerance: Mặc định set ngầm ở mức Slippage + Tax + 1% (Ví dụ: Thuế đang 5% thì set slippage truyền vào contract là 6%) để chống lỗi Revert.
Action Button State Machine:
[ Loading Balance... ] (Disabled)
[ Insufficient USDT Balance ] (Disabled, màu đỏ)
[ Approve USDT ] (Màu cam cảnh báo bước 1)
[ Swapping... ] (Disabled, kèm hiệu ứng xoay)
[ Swap Now ] (Màu xanh, sẵn sàng)
4. LỆNH GIAO VIỆC (MAGIC PROMPT) DÀNH CHO CLAUDE DEV
Hãy copy toàn bộ khối lệnh dưới đây và dán vào Claude. Lệnh này đóng khung Claude vào vai trò Frontend Web3 Architect, ép AI sử dụng thư viện Wagmi v2 (chuẩn mới nhất) và xử lý triệt để bài toán Token có thuế.
Role: Lead Web3 Frontend Architect and Senior React Developer.
Context: We are finalizing the In-App Swap feature for our Telegram Mini App "Bandit Buddy". We already support BNB -> $FARM. We now need to implement PRD-SPEC-03: adding USDT support (USDT <-> $FARM) natively inside our React component without redirecting users to external DEX websites.
Constraints: $FARM is a deflationary token with a Dynamic Transfer Tax (1-5%). PancakeSwap will revert standard swap calls. You MUST use the `SupportingFeeOnTransferTokens` functions.

Objective: Create a robust custom hook `usePancakeSwapUSDT.ts` and update the `SwapWidget.tsx` UI component to handle the 2-step ERC-20 approval and swap flow.

Execution Requirements:

TASK 1: Custom Hook Logic (`usePancakeSwapUSDT.ts`)
Use Wagmi v2 and Viem.
- Fetch the user's USDT balance and the current `allowance` for the PancakeSwap V2 Router.
- Write the `approveUSDT` function using `useWriteContract`.
- Write the `executeSwap` function. 
  - For buying FARM with USDT, the path must be `[USDT_ADDRESS, WBNB_ADDRESS, FARM_ADDRESS]`.
  - You MUST call `swapExactTokensForTokensSupportingFeeOnTransferTokens`.
  - Calculate `deadline` as `Math.floor(Date.now() / 1000) + 60 * 20`.
- Return state booleans: `isApproving`, `isSwapping`, `needsApproval`.

TASK 2: UI Component (`SwapWidget.tsx`)
Build a modern Web3 Glassmorphism UI using Tailwind CSS.
- Add a Token Selector toggle: [BNB] | [USDT].
- Input fields for Amount In and estimated Amount Out.
- A "MAX" button that fetches the user's maximum balance.
- Dynamic Action Button:
  - If token is USDT and `needsApproval` is true, button reads "Approve USDT" and triggers approval.
  - Once approved, button reads "Swap" and triggers the execution.
  - Disable buttons and show loading spinners during `isPending` / `isConfirming` states from `useWaitForTransactionReceipt`.

Output: Provide the clean, production-ready TypeScript code for both the hook and the UI component. Ensure robust error handling for user rejections or transaction failures.


Bản đặc tả và luồng kỹ thuật này đã khóa chặt rủi ro thất thoát Gas do lỗi Revert (đặc thù của các token có cơ chế đốt/thuế như $FARM). Khi Claude xuất code, đội ngũ Frontend chỉ cần tích hợp Component SwapWidget vào trong ClaimModal hoặc MarketplaceModal là hệ thống giao dịch In-App sẽ hoạt động liền mạch 100%.
