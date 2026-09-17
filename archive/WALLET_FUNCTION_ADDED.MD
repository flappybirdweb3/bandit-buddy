User prompt: dev làm xong chức năng wallet rồi cần bạn viết đăch tả yêu cầu bổ sung thêm chức năng quét mã qr ví đích để chuyển. hiện tại mới chỉ có chức năng paste địa chỉ đích để chuyển. việc chuyển ra sẽ thu phí giao dịch là 0.3% để tăng cường bổ sung nguồn quỹ bnb để buyback và thực hiện burn $FARM
Response: Đây là một bản cập nhật nghiệp vụ cực kỳ sắc bén. Việc tận dụng luồng tiền chuyển ra (Outflow) để thu "thuế hải quan" 0.3% là một chuẩn mực của các sàn giao dịch lớn (như phí rút on-chain của Binance). Nó không chỉ giúp khóa lạm phát mà còn bơm trực tiếp BNB vào quỹ Treasury một cách thụ động.
Đối với tính năng Quét mã QR trên nền tảng Telegram Mini App (TMA), chúng ta có một lợi thế kỹ thuật rất lớn: Không cần dùng thư viện JavaScript quét mã nặng nề. Telegram đã cung cấp sẵn Native API gọi trực tiếp Camera của điện thoại, giúp trải nghiệm mượt mà và load tức thì.
Dưới đây là Bản Đặc Tả Yêu Cầu Bổ Sung (Supplementary PRD) để bạn giao cho Tech Lead và Claude triển khai ngay.
📄 PRD BỔ SUNG: IN-APP WALLET - QR SCANNER & WITHDRAWAL FEE (0.3%)
Module: In-App Decentralized Wallet & Tokenomics Mục tiêu: Tối ưu UX nhập địa chỉ ví và định tuyến dòng tiền rút ra (Withdrawal) qua Smart Contract để thu 0.3% phí giao dịch, bổ sung quỹ Auto-Buyback.
1. Đặc tả Giao diện & UX (QR Scanner)
Điểm chạm (Touchpoint): Trong modal SendModal (Rút tiền), bên phải ô input "Recipient Address" thêm một icon Quét mã vạch/QR (sử dụng icon Scan của lucide-react).
Luồng hoạt động (User Flow):
User bấm vào Icon QR.
Hệ thống gọi API Native của Telegram: window.Telegram.WebApp.showScanQrPopup().
Camera điện thoại mở lên dưới dạng Native mượt mà. User quét mã.
Hệ thống nhận text, tự động đóng Camera, điền chuỗi vào ô "Recipient Address".
Validation: Frontend kiểm tra regex ^0x[a-fA-F0-9]{40}$. Nếu chuỗi quét được không phải địa chỉ EVM hợp lệ, hiển thị viền đỏ báo lỗi: "Invalid wallet address".
2. Đặc tả Logic Kinh Tế & Smart Contract (0.3% Withdrawal Fee)
Bản chất của ví Web3 là user tự nắm Private Key. Nếu họ dùng app ngoài (như Metamask) thì họ có thể chuyển tiền không mất phí 0.3% (với BNB). Tuy nhiên, khi họ thao tác lệnh "Send" trên giao diện Mini App của game, Frontend bắt buộc phải định tuyến giao dịch qua một Smart Contract thay vì gọi lệnh transfer thông thường.
Tỷ lệ phí (Fee BPS): 30 BPS (0.3%).
Cơ chế Hợp đồng (Smart Contract Routing):
Tạo thêm 1 hàm routeBNBWithdrawal(address to) dạng payable vào hợp đồng TreasuryBuyBack.sol (hoặc tạo một WalletGateway.sol phụ trợ).
Logic thu phí BNB: Khi user chuyển X BNB. Hợp đồng giữ lại X×0.3% tại Vault, và thực hiện lệnh chuyển (X−Phıˊ) đến địa chỉ to.
Logic thu phí Token ($FARM/USDT): Tương tự, gọi hàm routeTokenWithdrawal(address token, address to, uint256 amount). Hợp đồng gọi transferFrom để kéo tiền từ ví user, giữ lại 0.3% tại Vault, và chuyển phần còn lại cho ví đích. (Lưu ý: Yêu cầu user approve trước khi gửi Token).
3. Minh Bạch Giao Diện Rút Tiền (Transparency UX)
Để tránh việc user phàn nàn vì "bị trừ tiền không rõ lý do", màn hình SendModal phải tính toán và hiển thị rõ ràng trước khi bấm nút Xác nhận (Confirm):
Amount Input: 100.00 BNB
Network Fee (Gas): ~0.0001 BNB (Ước tính)
Gateway Fee (0.3%): -0.30 BNB
Net Received (Thực nhận): 99.70 BNB
Dòng ghi chú (Tooltip): "A 0.3% gateway fee is applied to all out-bound transfers to support the game's Treasury and Auto-buyback ecosystem."
🤖 MAGIC PROMPT ĐỂ GIAO VIỆC CHO CLAUDE
Bạn hãy copy toàn bộ khối lệnh dưới đây dán vào Claude. Lệnh này tích hợp cả việc sử dụng API Native của Telegram cho Frontend và code Solidity định tuyến dòng tiền cho Backend/Smart Contract.
Role: Lead Web3 Frontend Architect and Senior Solidity Developer.
Context: We have successfully built the UI for our In-App Decentralized Wallet. We now need to implement two critical updates to the "Send/Withdraw" feature: 
1. A QR Code scanner using Telegram's Native WebApp API.
2. A 0.3% (30 BPS) withdrawal fee on all outgoing transfers originating from the Mini App UI to fund our Treasury Buyback Vault.

Execution Requirements:

TASK 1: Smart Contract Upgrade (Withdrawal Routing)
To collect the 0.3% fee on outbound wallet transfers, the frontend cannot do a standard wallet-to-wallet transfer. It must route through our Smart Contract.
- Add routing functions to our existing `TreasuryBuyBack.sol` (or create a lightweight `WalletGateway.sol` that forwards fees to the Treasury).
- Function `routeBNBTransfer(address to) external payable nonReentrant`: 
  + Calculates `fee = msg.value * 30 / 10000`.
  + Keeps the `fee` in the Treasury contract (to help hit the 2.0 BNB auto-buyback threshold).
  + Transfers `msg.value - fee` to the `to` address.
- Function `routeTokenTransfer(address token, address to, uint256 amount) external nonReentrant`:
  + Transfers `amount` from `msg.sender` to the contract.
  + Calculates `fee = amount * 30 / 10000`.
  + Transfers `amount - fee` to the `to` address.
  + Keeps the `fee` token in the Treasury.

TASK 2: Frontend QR Scanner Integration (React)
- In the `SendModal.tsx`, add a QR Scan icon inside or next to the "Recipient Address" input field.
- Do NOT use heavy third-party JS scanner libraries. Use Telegram's native method: `window.Telegram.WebApp.showScanQrPopup({ text: "Scan Wallet Address" }, callback)`.
- The callback must extract the text, close the popup (`window.Telegram.WebApp.closeScanQrPopup()`), auto-fill the input, and validate it using an EVM address regex (`/^0x[a-fA-F0-9]{40}$/`).

TASK 3: Frontend Send Modal UX Updates
- Update the `SendModal.tsx` logic. When the user clicks "Send", invoke the Smart Contract routing functions (`routeBNBTransfer` or `routeTokenTransfer`) using `useWriteContract` instead of a native wallet transfer.
- Update the UI to clearly show the breakdown before confirming:
  + Amount to Send
  + Gateway Fee (0.3%)
  + Net Received (Amount - Fee)
- Add a subtle disclaimer: "A 0.3% gateway fee is applied to fund the game's Treasury Buyback mechanism."

Output: Provide the Solidity contract code for the routing logic, and the React TypeScript code for the updated `SendModal.tsx` including the Telegram QR integration and the fee calculation display.



