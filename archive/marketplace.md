Hãy nghiên cứu tài liệu prd 1, prd 2 và xây dựng yêu cầu cho chức năng: marketplace 
Dưới góc độ của một **Senior System Architect**, tôi đã tổng hợp và chuẩn hóa toàn bộ đặc tả từ hai tài liệu PRD gốc kết hợp với các quyết định kiến trúc chúng ta vừa chốt.

Thay vì xây dựng một sàn giao dịch tập trung truyền thống, Marketplace của Bandit Buddy là một hệ sinh thái tài chính (DeFi) thu nhỏ, lắp ghép từ các "khối lego" Web3. Hệ thống được chia thành 3 phân hệ (Modules) cốt lõi với yêu cầu chi tiết như sau:

---

### PHẦN I: TỔNG QUAN KIẾN TRÚC MARKETPLACE

Marketplace không chỉ là nơi mua bán NFT mà còn là bộ máy luân chuyển dòng tiền (Tokenomics) và chống lạm phát cho game.

1. **DEX Swap (Thị trường Tự do):** Tích hợp PancakeSwap AMM để thị trường tự điều tiết tỷ giá $FARM.


2. **Converter (Trạm Quy Đổi):** Cổng chuyển đổi qua lại giữa tiền Off-chain (GOLD) và On-chain ($FARM) sử dụng Tỷ giá trượt (Dynamic Peg).


3. **P2P Escrow Market (Chợ Giao Dịch Người Chơi):** Kiến trúc Orderbook Off-chain (không tốn Gas khi treo bán) và Khớp lệnh On-chain bằng EIP-712.



---

### PHẦN II: ĐẶC TẢ YÊU CẦU CHI TIẾT (REQUIREMENTS)

#### Module 1: Hệ thống Swap On-chain (DEX)

Hệ thống này cho phép người chơi giao dịch $FARM lấy các đồng coin khác mà không cần rời khỏi Telegram Mini App.

* **Giao diện (React UI):** Widget Swap chuẩn Web3 (có "From", "To", Slippage/Trượt giá).


* **Tích hợp (Smart Contract):** Gọi trực tiếp vào `PancakeSwap V2 Router` trên mạng lưới BSC (hàm `swapExactETHForTokens` và `swapExactTokensForETH`).


* **Thanh khoản ban đầu:** Do Market Maker (MM) khởi tạo pool thanh khoản cặp $FARM/USDT và $FARM/BNB. Sau đó tỷ giá hoàn toàn do công thức AMM ($x * y = k$) của thị trường tự điều tiết.



#### Module 2: Cổng Chuyển Đổi Hệ Nhị Phân (Dynamic Peg)

Đây là "van an toàn" ngăn chặn tình trạng vỡ nợ (Bank run) khi lượng GOLD sinh ra từ game quá nhiều.

* **Nạp tiền ($FARM -> GOLD):** Áp dụng tỷ giá cố định (Ví dụ: 1 $FARM = 100 GOLD). Token $FARM người chơi nạp vào sẽ được khóa lại trong ví Treasury.


* **Rút tiền (GOLD -> $FARM):** Áp dụng tỷ giá trượt tự động.


* **Công thức Backend:** `Tỷ giá rút = Tổng số GOLD đang lưu hành trên server / Tổng số $FARM trong ví Treasury`.


* *Nghiệp vụ:* Lạm phát trong game càng cao, số GOLD cần để rút ra 1 $FARM sẽ càng lớn, bảo vệ giá trị thực của token.




* **Ký quỹ ECDSA:** Backend kiểm tra điểm Trust Score (chống bot), trừ GOLD Off-chain và sinh ra chữ ký số (Signature) để người chơi tự claim $FARM On-chain qua Smart Contract.

#### Module 3: Chợ Giao dịch P2P (In-Game Marketplace)

Nơi người chơi mua bán NFT Chó bảo vệ, Nông sản đóng thùng (Crates) và Vật phẩm Viral (Kính Lúp, Master Key).

**1. Luồng Treo Bán (Seller Flow - Off-chain)**

* **Logic Ký quỹ (EIP-712):** Người bán chọn vật phẩm, đặt giá bằng $FARM và thời gian hết hạn (Expiry). Giao diện yêu cầu người chơi ký một tin nhắn số (Sign Message) qua ví Metamask/TrustWallet.


* **Backend Lock:** Lệnh bán được lưu vào Database (bảng `marketplace_listings`). Vật phẩm tương ứng trong bảng `user_items` hoặc `nft_guard_dogs` bị tạm khóa (Lock) để không thể sử dụng in-game.


* **Validation:** KHÔNG cho phép treo bán chó NFT đang ở trạng thái bảo vệ (`is_active = true`). Phải thu hồi về Nhà Kho mới được bán.

**2. Luồng Mua (Buyer Flow - On-chain Settlement)**

* **Giao diện:** Hiển thị 3 Tabs phân trang (Chó Bảo Vệ, Nông Sản, Công Cụ). Hỗ trợ Lọc (Filter) theo giá, độ hiếm.
* **Khớp lệnh:** Người mua bấm "Mua", xác nhận giao dịch trên ví. Lúc này, Smart Contract `BanditMarket.sol` mới thực sự được gọi.


* **Smart Contract Execution:** Hợp đồng kiểm tra chữ ký EIP-712 của người bán, trừ tiền $FARM của người mua, chuyển tài sản (ERC-1155 `safeTransferFrom`), thu phí giao dịch 5% (gửi về Treasury) và trả 95% $FARM còn lại cho người bán.



---

### PHẦN III: YÊU CẦU KỸ THUẬT & BẢO MẬT HỆ THỐNG

Để nền kinh tế không bị sụp đổ bởi Hacker hoặc lỗi mất kết nối mạng, Backend và Smart Contract phải đáp ứng các tiêu chuẩn khắt khe sau:

**1. Cơ chế Lắng nghe Sự kiện Bất tử (Event Indexer & Fallback)**

* **Realtime WebSocket:** Backend lắng nghe sự kiện `TradeExecuted` từ BSC bằng WebSockets (WSS). Khi có người mua thành công, tiến hành chuyển vật phẩm Off-chain từ người bán sang người mua.


* **Fallback Cronjob:** Cần một Cronjob chạy mỗi 5 phút/lần sử dụng `queryFilter` quét các Block lịch sử (cắt nhỏ 2000 blocks/lần). Lưu mốc `last_scanned_block` vào Database để đảm bảo nếu Server sập, khi khởi động lại sẽ tự động quét bù các giao dịch bị bỏ lỡ.



**2. Tính Lũy Đẳng & Khóa Dòng Database (Idempotency & Row-level Lock)**

* Trong luồng xử lý giao dịch mua bán, sử dụng câu lệnh PostgreSQL `SELECT ... FOR UPDATE` để khóa dòng.


* Kiểm tra Transaction Hash trong bảng `processed_onchain_txs`. Đảm bảo một giao dịch (txHash) trên blockchain chỉ được cộng/trừ vật phẩm 1 lần duy nhất, ngăn chặn tuyệt đối lỗi nhân bản đồ đạc do Race Condition.



**3. Cơ sở hạ tầng RPC (Dedicated Node)**

* Sử dụng Dedicated RPC (như QuickNode hoặc Ankr) thay vì Public RPC.


* Cấu hình `FallbackProvider` trong Ethers.js v6 với nhiều lớp ưu tiên để đảm bảo Game không bao giờ bị đứt kết nối với Blockchain.



Anh đánh giá sao về bản đặc tả Marketplace này? Tôi có thể xuất tài liệu này thành định dạng Markdown hoặc Ticket Jira để anh Dũng trực tiếp import vào hệ thống quản lý task của team.