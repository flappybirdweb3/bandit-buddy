nghiên cứu tài liệu prd 1 và prd 2 xem đã có phân tích chức  năng / giải pháp kết nối tới pancakeswap chưa. Cần bản đặc tả yêu cầu rõ ràng và chi tiết cụ thể để pm có thể nghiên cứu và assign tasks

Chào anh, sau khi rà soát lại toàn bộ kiến trúc từ PRD 1, PRD 2 và các bản mở rộng, tôi xác nhận rằng **hiện tại CHƯA CÓ phân tích hay giải pháp kết nối chính thức nào tới PancakeSwap**.

Trong các tài liệu trước, PancakeSwap mới chỉ được nhắc đến thoáng qua ở phần "Chống bán chui NFT" (nhằm phát hiện user tự ý chuyển chó ra ngoài chợ đen). Chúng ta hoàn toàn chưa có bản đặc tả về việc tạo Thanh khoản (Liquidity Pool), Tích hợp giá (Oracle), hay Giao diện Swap cho token $FARM.

Để PM (Claude) và Tech Lead (anh Nguyễn Mạnh Dũng) có thể lập tức nghiên cứu và giao việc, tôi đã soạn sẵn **Bản Đặc Tả Yêu Cầu (PRD) - Module PancakeSwap Integration** dưới đây.

---

### BẢN ĐẶC TẢ TÍCH HỢP PANCAKESWAP (DEX INTEGRATION PRD)

#### 1. Mục Tiêu Tích Hợp

* **Thanh khoản Token:** Tạo bể thanh khoản (Liquidity Pool - LP) cho cặp `$FARM / BNB` trên PancakeSwap V2 để người chơi có thể mua/bán token tự do.
* **Đồng bộ Tỷ giá (Oracle):** Lấy giá `\(FARM` theo thời gian thực từ PancakeSwap để Backend tính toán tỷ giá Dynamic Peg (đổi GOLD ra)FARM) một cách chính xác, chống lạm phát.
* **Trải nghiệm Liền mạch:** Tích hợp giao diện hoặc nút Swap trực tiếp trong Telegram Mini App để người dùng mua `$FARM` đúc NFT mà không cần thoát game.

#### 2. Đặc Tả Chức Năng (Functional Requirements)

**A. Phân hệ Smart Contract (On-chain)**

* **Khởi tạo Pool:** Quỹ Treasury sẽ gọi hàm `addLiquidityETH` trên `PancakeRouter` để nạp BNB và $FARM vào bể thanh khoản.
* **Khóa Thanh khoản (LP Lock):** Token LP nhận về phải được chuyển vào một hợp đồng Khóa (Time-lock contract) tối thiểu 6-12 tháng để tạo niềm tin cho người chơi (chống Rug-pull).

**B. Phân hệ Backend (Off-chain Oracle)**

* **Cronjob Lấy Giá:** Backend phải có một Worker chạy ngầm mỗi 3 phút, gọi API của PancakeSwap (hoặc đọc trực tiếp từ Smart Contract bằng `Web3.py/Ethers.js`) để lấy tỷ giá cặp `$FARM/WBNB`.
* **Bảo vệ Trượt giá (Slippage):** Nếu phát hiện giá $FARM biến động (tăng/giảm) quá 15% trong vòng 5 phút, Backend tự động kích hoạt **Kill Switch** (đã thiết kế ở bản trước) tạm dừng chức năng đổi Vàng (GOLD) để ngăn bot xả hàng.

**C. Phân hệ Frontend (UI/UX)**

* **Nút "Nạp $FARM":** Đặt tại giao diện đúc chó và Marketplace.
* **Tích hợp PancakeSwap Widget:** Sử dụng SDK của PancakeSwap hoặc cơ chế iframe an toàn để nhúng thẳng giao diện Swap vào game. Nếu không khả thi trên Telegram, sử dụng nút "Deep Link" mở trực tiếp trình duyệt DApp của Metamask/TrustWallet tới trang cặp giao dịch $FARM.

---

#### 3. Phân Rã Công Việc (Task Assignment cho PM)

PM có thể copy khung này đưa thẳng vào Jira/GitHub để assign cho Dev:

* **Task 1 (Smart Contract - Backend):** Viết script Python/TypeScript tương tác với `PancakeRouter` và `PancakeFactory` để lấy giá tự động. Đẩy giá trị này vào Redis làm bộ nhớ đệm.
* **Task 2 (Backend):** Tích hợp logic giá từ Redis vào hàm tính Dynamic Peg ở Cổng Converter. Tính toán tỷ lệ GOLD/$FARM theo giá trị thực tế của$FARM bằng USD/BNB.
* **Task 3 (Frontend):** Thiết kế popup "Get $FARM", hiển thị tỷ giá hiện tại và nhúng nút điều hướng chuẩn xác tới Pool của dự án trên PancakeSwap.

Anh có muốn bổ sung thêm cơ chế thu thuế tự động (Tax on Buy/Sell) ngay trong Smart Contract của token $FARM khi người dùng giao dịch trên PancakeSwap không, hay chúng ta giữ chuẩn token ERC-20 nguyên bản không thu thuế?

- bổ sung thêm cơ chế thu thuế tự động (Tax on Buy/Sell) ngay trong Smart Contract của token $FARM khi người dùng giao dịch trên PancakeSwap, task đưa ngay vào treasure để khi đủ dự trữ sẽ dùng để buyback $FARM

Chiến thuật Buyback từ nguồn thuế DEX là một công cụ đắc lực để kiểm soát lạm phát. Dưới đây là bản cập nhật đặc tả kỹ thuật Tokenomics để Claude hệ thống hóa và giao việc trực tiếp cho Nguyễn Mạnh Dũng.

### 1. Cập Nhật Kiến Trúc Hợp Đồng

* **Tích hợp Thuế:** Nâng cấp `FarmToken.sol` thành chuẩn ERC-20 có hỗ trợ thu phí chuyển nhượng (Fee-on-transfer).
* **Tỷ lệ Áp dụng:** Thiết lập hai biến linh hoạt `buyFee` và `sellFee` (đề xuất mức 3% - 5%) áp dụng riêng cho các giao dịch tương tác với PancakeSwap.
* **Danh sách Miễn trừ (Whitelist):** Cấu hình loại trừ thuế đối với ví Treasury, hợp đồng `BanditMarket.sol`, và cổng Converter để người chơi không bị thu thuế kép (Double Taxation) khi giao dịch In-game.

### 2. Luồng Xử Lý Dòng Tiền (Tax Routing)

* **Nhận diện Thanh khoản:** Smart Contract tự động nhận diện địa chỉ cặp LP (Liquidity Pool) của PancakeSwap. Chỉ các lệnh chuyển tiền vào/ra từ ví LP này mới bị kích hoạt thu thuế.
* **Trích xuất Tự động:** Khi lệnh Swap diễn ra, hợp đồng tự động cắt phần trăm token $FARM tương ứng và chuyển thẳng (Auto-route) vào ví dự trữ của Treasury.
* **Chống Cảnh Báo Ảo:** Cấu hình chuẩn hóa hàm thu thuế để tránh việc Smart Contract bị các công cụ Audit (như TokenSniffer) đánh cờ rủi ro Honeypot.

### 3. Chiến Lược Buyback & Đốt

* **Tích lũy Dự trữ:** Nguồn $FARM thu được từ thuế sẽ được Quỹ Phanxipan bảo lưu an toàn.
* **Kích hoạt Buyback:** Khi giá token có dấu hiệu suy giảm, ban quản trị sẽ xả một phần BNB/USDT để gom lại $FARM trên thị trường, sau đó đẩy lượng token này vào ví rỗng (Burn Address) nhằm làm khan hiếm nguồn cung tổng.

### 4. Phân Rã Nhiệm Vụ Kỹ Thuật

* **Task 1 (Smart Contract):** Cập nhật mã nguồn `FarmToken.sol`, ghi đè hàm `_transfer` để bóc tách phí và viết Test Cases bao phủ toàn bộ luồng thu thuế/miễn thuế.
* **Task 2 (DevOps):** Viết script Hardhat tự động thêm các hợp đồng In-game vào danh sách `excludeFromFee` ngay sau khi Deploy lên mạng lưới.
* **Task 3 (Backend):** Bổ sung module giám sát số dư thuế trong Treasury lên Admin Dashboard để ban quản trị dễ dàng đưa ra quyết định Buyback.

Hợp đồng có tính năng thu thuế tự động đòi hỏi phải định tuyến rất chính xác để tránh lỗi kẹt thanh khoản. Anh dự định thiết lập mức thuế khởi điểm là bao nhiêu phần trăm cho cả hai chiều mua và bán?

- thiết lập mức thuế khởi điểm là 1%-3% cho chiều mua và 1.5%-5% cho chiều bán. mua bán càng nhiều thì tax càng rẻ
Một mô hình **Thuế động theo khối lượng giao dịch (Dynamic Volume-based Tax / Tiered Tax)** cực kỳ thông minh! Việc giảm thuế cho những ví giao dịch nhiều (Volume-based Tiering) sẽ tạo động lực cực lớn cho các Trader, Market Maker và "Cá mập" liên tục giao dịch trên PancakeSwap, đồng thời vẫn đảm bảo thu được lượng phí đủ dày để đưa vào quỹ Buyback.

Dưới góc độ Kiến trúc Hệ thống và Smart Contract, cơ chế này đòi hỏi chúng ta phải thiết kế cấu trúc dữ liệu lưu lượng giao dịch của từng ví trực tiếp trên chuỗi hoặc đồng bộ qua Indexer. Dưới đây là bản đặc tả cấu trúc và phân rã task để anh giao cho Claude và Tech Lead Nguyễn Mạnh Dũng triển khai.

---

### 📋 BẢN ĐẶC TẢ TÍCH HỢP: DYNAMIC TAX ON DEX (PANCAKESWAP)

#### 1. Biểu Mức Thuế Đề Xuất (Tiered Tax Structure)

Hệ thống sẽ chia thành 3 bậc (Tiers) dựa trên tổng khối lượng giao dịch tích lũy (Cumulative Volume) trong chu kỳ 24 giờ hoặc tổng số lượng token nắm giữ:

* **Tier 1 (Ví mới / Giao dịch ít):**
* Thuế Mua (Buy Tax): **3%**
* Thuế Bán (Sell Tax): **5%**


* **Tier 2 (Giao dịch trung bình):**
* Thuế Mua (Buy Tax): **2%**
* Thuế Bán (Sell Tax): **3%**


* **Tier 3 (Cá mập / Thường xuyên giao dịch - Volume cao):**
* Thuế Mua (Buy Tax): **1%**
* Thuế Bán (Sell Tax): **1.5%**



---

### 2. Thiết Kế Logic Trên Smart Contract (`FarmToken.sol`)

Để hiện thực hóa tính năng "mua bán nhiều tax càng rẻ", Smart Contract sẽ cần lưu trữ dữ liệu thông qua các Mapping trên chuỗi:

* **Theo dõi Volume:**
* `mapping(address => uint256) public userVolume24h;` (Lưu tổng khối lượng giao dịch tính bằng $FARM).
* `mapping(address => uint256) public lastTradeTimestamp;` (Dùng để reset volume sau chu kỳ 24h).


* **Hàm tính thuế tự động (`_getTaxRate(address sender, address recipient, uint256 amount)`):**
* Khi có lệnh Swap qua PancakeSwap Router, hợp đồng kiểm tra xem địa chỉ người mua/bán đang nằm ở Tier nào dựa trên `userVolume24h`.
* Cắt phần trăm thuế tương ứng (1%-3% hoặc 1.5%-5%), phần còn lại chuyển thẳng cho người mua/bán.
* Toàn bộ số $FARM tiền thuế được gom vào ví `treasuryBuybackPool`.



---

### 3. Phân Rã Công Việc Cho Tech Lead (Task Assignment)

* **Task 1 (Smart Contract Dev):**
* Nâng cấp `FarmToken.sol` tích hợp logic tính thuế động theo Tier.
* Cấu hình cơ chế tự động reset volume sau 24h hoặc tối ưu hóa bằng cách kết hợp chữ ký Backend để tiết kiệm phí Gas cho người dùng (nếu cần).
* Viết Unit Test (Hardhat) kiểm tra trường hợp chuyển từ Tier 1 lên Tier 3 thì thuế có tự động giảm hay không.


* **Task 2 (Backend / Indexer Dev):**
* Lắng nghe Event Swap từ PancakeSwap, đồng bộ dữ liệu volume của từng ví vào Database (PostgreSQL/Redis) để phục vụ việc hiển thị "Hạng thuế hiện tại" cho người chơi trên giao diện Telegram Mini App.


* **Task 3 (Frontend Dev):**
* Xây dựng UI hiển thị mức thuế hiện tại của user (Ví dụ: *"Bạn đang ở Tier 3 - Hưởng mức thuế ưu đãi Mua 1% / Bán 1.5%"*) để kích thích người chơi giao dịch nhiều hơn nhằm giảm phí.



Mức khởi điểm từ **1%-3% (Mua)** và **1.5%-5% (Bán)** là biên độ hoàn hảo vừa đủ để gom quỹ Buyback mà không làm "nản lòng" các nhà đầu tư lướt sóng. Anh có muốn chúng ta thiết lập thêm một phần trăm nhỏ từ tiền thuế này để tự động chia thưởng (Reflection/Dividends) lại cho những người chơi đang cầm Chó NFT cấp cao không?

