User prompt: Hãy hệ thống lại và nghiên cứu kỹ tài liệu chức năng prd 1 và prd 2 cũng như toàn bộ log chat có thể đọc từ tài liệu tôi đã uploaded trước đây "Chọn Game Open Source Làm Web3 v2.docx" & rà soát lại toàn bộ lịch sử chat liên quan đến chức năng auto Buyback $FARM để bảo vệ giá. hãy viết cho tôi prd về chức năng này auto buyback để giao claude dev ngay
Response: Dưới đây là bản PRD (Product Requirements Document) chi tiết cho Hệ thống Auto Buy-back & Burn (Tự động Mua lại và Đốt token), được chắt lọc và hệ thống hóa từ các tài liệu và lịch sử thảo luận của bạn.
Tài liệu này không chỉ mô tả kỹ thuật mà còn khóa chặt các chiến lược thao túng tâm lý thị trường (Market Psychology) để bảo vệ giá trị $FARM.
📄 PRD: HỆ THỐNG AUTO BUY-BACK & BURN (QUỸ BẢO CHỨNG)
Project: Bandit Buddy (FarmHeist) Platform: BSC (BNB Smart Chain) & Telegram Mini App Module: DeFi Treasury & Tokenomics Protection
1. TỔNG QUAN & MỤC TIÊU (OVERVIEW & GOALS)
Cơ chế Buy-back & Burn tự động là "tấm khiên" vững chắc nhất để bảo vệ biểu đồ giá (Chart) của token $FARM khỏi vòng lặp chết (Death Spiral) thường thấy ở các game Web3.
Mục tiêu Kinh tế: Sử dụng doanh thu thực tế của dự án (bằng BNB/USDT) để mua lại $FARM trên thị trường tự do và tiêu hủy vĩnh viễn, làm giảm tổng cung và tăng giá trị nội tại của token.
Mục tiêu Marketing (Hiệu ứng FOMO): Tạo ra các cột nến Xanh (Green Candles) khổng lồ trên DexScreener/Dextools một cách tự động, thu hút dòng tiền đầu cơ từ bên ngoài.
2. LUỒNG NGHIỆP VỤ CỐT LÕI (CORE MECHANICS)
2.1. Nguồn Thu Tích Lũy (Revenue Accumulation)
Nếu phí game được thu bằng chính $FARM (như đập chó, chợ P2P), chúng ta tiến hành Đốt trực tiếp (Direct Burn). Cơ chế Buy-back (Mua lại) chỉ kích hoạt đối với các nguồn thu bằng Native Token (BNB) hoặc Stablecoin (USDT).
Bể chứa (The Vault): Hợp đồng TreasuryBuyBack.sol đóng vai trò là kho bạc, mở cổng receive() payable để hứng mọi dòng tiền BNB chảy về từ các dịch vụ Premium hoặc doanh thu bán NFT/Vật phẩm.
2.2. Ngưỡng Kích Hoạt (Threshold Trigger)
Thay vì mỗi lần có giao dịch là gọi lệnh Swap (gây tốn phí Gas khổng lồ), hệ thống sử dụng kiến trúc Tích lũy & Kích hoạt (Accumulate & Trigger).
Threshold: Khi "Bể chứa" tích lũy đủ một ngưỡng nhất định (Ví dụ: 2 BNB), hệ thống mới mở khóa hàm triggerBuyBack().
Lò Xo Nén Tâm Lý: Người chơi theo dõi số dư Smart Contract trên BscScan. Khi thấy số dư xấp xỉ 2 BNB, họ có xu hướng ngừng xả $FARM vì biết sắp có một lệnh mua khổng lồ đẩy giá lên.
2.3. Khớp Lệnh & Đốt (Swap & Burn)
Khi hàm được kích hoạt:
Hợp đồng gọi trực tiếp vào Router V2 của PancakeSwap.
Sử dụng toàn bộ số BNB trong hợp đồng để mua FARMvớithie^ˊtlậptrượtgiaˊ(Slippage)linhhoạt[cite:3].DOFARM CÓ THUẾ, bắt buộc phải dùng hàm swapExactETHForTokensSupportingFeeOnTransferTokens.
Địa chỉ nhận (Destination Address) của token $FARM vừa mua BẮT BUỘC là ví chết: 0x000000000000000000000000000000000000dEaD.
Phát ra Event BuyBackAndBurned làm Bằng chứng Đốt coin (Proof of Burn) để cộng đồng shill dự án.
3. KIẾN TRÚC KỸ THUẬT & TỰ ĐỘNG HÓA
3.1. Tại sao không dùng Chainlink Keepers ngay lúc này?
Trong giai đoạn MVP, việc dùng mạng lưới phi tập trung (như Chainlink Keepers hay Gelato) sẽ gây tốn kém chi phí duy trì Oracle không cần thiết. Quyết định: Sử dụng chính Backend Node.js của dự án làm một Cronjob Worker chạy ngầm.
Worker sẽ quét số dư của hợp đồng Treasury mỗi 5 phút.
Nếu số dư >= 2 BNB, Backend dùng ví Admin để gọi hàm triggerBuyBack().
Giải pháp này tiết kiệm, dễ debug và team kiểm soát 100% luồng tiền.
4. 🤖 MAGIC PROMPT CHO CLAUDE DEV
Anh hãy copy toàn bộ khối lệnh dưới đây, dán vào Claude để yêu cầu nó quy hoạch và code toàn bộ hệ thống này từ Smart Contract đến Backend Worker.
📋 COPY ĐOẠN LỆNH DƯỚI ĐÂY DÁN VÀO CLAUDE:
Role: You are a Lead Web3 System Architect, Solidity Expert, and Senior Node.js/NestJS Developer.
Context: We are building the "Auto Buy-back & Burn" Treasury system for the Web3 game "Bandit Buddy". This is a critical deflationary mechanism to protect the \(FARM token chart from a death spiral. Revenues collected in BNB are stored in a Treasury contract. Once a threshold is met, the contract swaps the BNB for\)FARM on PancakeSwap and sends it directly to the dead address.

Objective: Implement the full technical stack for the Treasury Buy-back feature based on the provided PRD logic. Avoid using Chainlink Keepers for now; we will use a Backend Node.js Cronjob to trigger the action.

Execution Requirements (Output clean, production-ready code):

TASK 1: Smart Contract (TreasuryBuyBack.sol)
Write the contract using OpenZeppelin v5 (Ownable, ReentrancyGuard).
- Define a `receive() external payable` function to accept BNB revenues.
- Define a state variable `buyBackThreshold` (e.g., 2 ether).
- Function `triggerBuyBack()`: 
  + Reverts if contract balance < `buyBackThreshold`.
  + Interacts with PancakeSwap V2 Router (`IPancakeRouter02`).
  + MUST use `swapExactETHForTokensSupportingFeeOnTransferTokens` because $FARM has a dynamic fee-on-transfer tax.
  + Set `amountOutMin` safely (or 0 since the goal is to burn at market price).
  + The destination `to` address MUST be `0x000000000000000000000000000000000000dEaD`.
  + Emits a `BuyBackAndBurned(uint256 bnbSpent, uint256 farmBurned)` event. Calculate `farmBurned` by checking the dead address balance before and after the swap.

TASK 2: Backend Automation Worker (NestJS/TypeScript)
Write a background cronjob service `TreasuryMonitorService`.
- Runs every 5 minutes (`@Cron`).
- Uses `ethers.js v6` to check the BNB balance of the `TreasuryBuyBack` contract.
- If the balance >= threshold (e.g., 2 BNB), it uses an Admin Wallet (loaded via Private Key) to call the `triggerBuyBack()` function on-chain.
- Ensure robust error handling, gas estimation, and retry mechanisms in case of RPC network congestion.
- Push a notification to a Telegram Admin Group upon successful Buy-back execution, providing the TxHash and the amount of $FARM burned (Proof of Burn).

Ensure all code is heavily commented, gas-optimized, and handles potential slippage/tax edge cases correctly.



