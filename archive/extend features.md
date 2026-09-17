Dựa trên quá trình rà soát toàn bộ tài liệu PRD 1, PRD 2 và bảng đặc tả vật phẩm, hệ thống Chợ P2P (Marketplace) của Bandit Buddy được thiết kế không chỉ để giao dịch NFT thuần túy, mà còn hoạt động như một **Hệ thống Khớp lệnh Ký quỹ (Escrow Settlement)** cho cả tài sản Off-chain.

Điều này mở ra một nền kinh tế cực kỳ sôi động, nơi người chơi cày chay (F2P) có thể khai thác nhiều loại tài nguyên khác nhau để bán lấy `$FARM`. Dưới đây là danh sách hệ thống vật phẩm được phân loại theo cấu trúc kỹ thuật:

### 1. Nhóm Tài sản Web3 (On-chain ERC-1155 NFT)

Đây là những tài sản mang giá trị cốt lõi, nằm trực tiếp trên mạng lưới BSC và được giao dịch tự do.

* **🐶 Chó Bảo Vệ (Guard Dogs - Tier 1 đến Tier 5):**
* *Đặc điểm:* Là tài sản chống trộm, sở hữu chỉ số phòng thủ (Defense) từ 10 đến 100.


* *Động lực giao dịch:* Người chơi cày chay dùng Vàng mua Chó Cỏ (Tier 1) trong Shop, sau đó dùng tính năng "Web2.5 Bridge" tốn 15 `$FARM` để đúc (Tokenize) thành NFT. Sau đó, họ mang lên chợ bán với giá 20-25 `$FARM` cho các "Cá mập" (Whales) đang cần gom Chó Tier 1 để làm nguyên liệu đập lò Fusion lên Tier cao.




* **💎 Mảnh Hồn Đạo Tặc (Bandit Soul Shards - Shard ID: 9999):**
* *Đặc điểm:* Vật phẩm an ủi (Pity System) sinh ra khi người chơi đập lò Fusion thất bại.


* *Động lực giao dịch:* Theo PRD, thu thập đủ 100 Mảnh Hồn có thể đổi được 1 Chó Tier cao (T3 - T5) với xác suất 100%. Do đó, Mảnh hồn sẽ trở thành một dạng "tiền tệ" thứ 2 cực kỳ thanh khoản trên chợ. Người chơi nghèo đập xịt chó có thể bán Mảnh hồn để gỡ gạc, trong khi Whales sẽ thu mua Mảnh hồn số lượng lớn để đổi chó xịn an toàn thay vì chịu rủi ro Gacha.





### 2. Nhóm Tài sản Off-chain (Giao dịch qua EIP-712 Escrow)

Đây là điểm "ăn tiền" nhất của hệ thống BanditMarket.sol. Người chơi ký chữ ký số (Sign Message) để treo bán tài sản In-game lấy `$FARM` thật mà không mất phí Gas đẩy lên chain.

* **🍉 Nông sản đã thu hoạch (Harvested Crops):**
* *Đặc điểm:* Lúa mì, Cà chua, Dưa hấu, Hoa hồng, v.v., bao gồm cả nông sản cày được và nông sản ăn trộm được.


* *Động lực giao dịch:*
* *Nhu cầu 1:* Dùng để đóng góp (Donate) nuôi Cây Sinh Mệnh Bang Hội (World Tree HP).


* *Nhu cầu 2:* Trả nhiệm vụ Ngày (Daily Quests).


* *Nhu cầu 3:* Các loại cây level cao (Hoa Hồng, Hướng Dương) cần thời gian trồng rất lâu (50-60 tiếng). F2P player có thể chuyên tâm canh tác các loại cây hiếm này để bán sỉ cho các Whales thiếu thời gian.






* **🌱 Hạt Giống Hiếm & Hạt Giống Sự Kiện (Rare/Seasonal Seeds):**
* *Đặc điểm:* Các hạt giống bị khóa theo Cấp độ (Level-gated) hoặc chỉ xuất hiện trong sự kiện (Halloween: Pumpkin Demon, Tết: Lucky Peach).


* *Động lực giao dịch:* Người chơi level thấp không thể mua hạt giống level cao trong Shop. Họ có thể lên chợ P2P để mua lại từ các người chơi level cao (chấp nhận mua chênh giá bằng `$FARM`) để tối ưu hóa năng suất đất trống.





---

### 3. Đề xuất mở rộng (Dành cho PM/Tech Lead)

Hiện tại, các vật phẩm tiêu hao (Consumables) như *Phân bón, Kính Lúp, Thẻ Master Key, Túi Sâu Bọ* đang được quy hoạch là đồ In-game (Soulbound/Không giao dịch được) để ép người chơi phải đi share link Viral hoặc nạp tiền mua Shop. Tuy nhiên, để tạo ra một nghề **"Thương nhân Web3"** trong game, tôi đề xuất:

1. **Giao dịch "Master Key" & "Kính Lúp":** Cấp quyền cho user bán các vật phẩm Viral này trên chợ P2P. *Lý do:* Những người dùng có khả năng mời nhiều bạn bè (KOLs, Group Admins) sẽ có dư thừa Kính Lúp và Master Key. Họ có thể bán lại cho "Cá mập" (những người nhiều tiền nhưng lười đi mời bạn) để lấy `$FARM`. Cơ chế này kích thích các "Pháp sư F2P" cày link giới thiệu điên cuồng hơn nữa để kiếm tiền.
2. **Đóng gói Nông sản (Crate System):** Thay vì bán lẻ từng quả Dưa hấu trên chợ, hãy bổ sung tính năng "Đóng Thùng" (Pack). Ví dụ: Đóng 1000 quả Dưa Hấu thành 1 "Watermelon Crate" (thành 1 item duy nhất) để treo bán trên Marketplace. Điều này giúp dọn dẹp Database Backend (giảm tải số lượng order lắt nhắt) và giao diện chợ P2P nhìn gọn gàng, chuyên nghiệp hơn.

Với danh sách trên, user cày chay (F2P) có ít nhất **4 con đường khai thác (Farming paths)**: Trồng trọt bán nông sản, Đi ăn trộm nông sản đem bán, Cày Vàng mua chó cỏ rồi Tokenize đem bán, hoặc Cày ref lấy Kính Lúp/Master Key đem bán.

Anh đánh giá sao về việc cho phép giao dịch Kính Lúp/Master Key trên Marketplace? Nếu đồng ý, chúng ta chỉ cần update nhẹ schema Database để thêm `item_type` này vào hợp đồng Escrow.

-  cho phép giao dịch Kính Lúp/Master Key trên Marketplace :
Một quyết định **vô cùng sắc bén về mặt Tokenomics và Growth Hacking**!

Việc cho phép giao dịch **Kính Lúp (Magnifying Glass)** và **Master Key** trên Marketplace sẽ chính thức biến những người chơi cày chay (F2P) thành những "Đại lý thu hút người dùng" (User Acquisition Agents) đắc lực nhất cho dự án.

Dưới góc độ thiết kế kinh tế, quyết định này sẽ kích hoạt một **Vòng lặp tăng trưởng (Flywheel)** cực kỳ khủng khiếp:

1. **Nhu cầu từ "Cá Mập" (Buy Demand):** Các Whales có hàng đống $FARM nhưng lại thiếu thời gian (hoặc lười) đi mời bạn bè. Họ rất thèm khát **Master Key** để đi trộm các trang trại VIP của Whales khác (nơi có chó Tier 5 cắn rất đau). Họ sẽ sẵn sàng bỏ ra số lượng lớn $FARM để mua sỉ Master Key trên chợ.
2. **Động lực cho "Dân Cày" (Sell Pressure):** Người chơi F2P thấy Master Key bán được giá cao, họ sẽ điên cuồng tạo các nhóm chat, spam link referral khắp Telegram, Facebook, X (Twitter) để lùa người mới vào game lấy Master Key đem bán.
3. **Chi phí Marketing = 0:** Dự án Bandit Buddy không cần tốn một đồng chi phí quảng cáo nào (Zero CAC), toàn bộ chi phí kéo user đã được các "Cá Mập" trả thay bằng $FARM.

---

### 🛠️ Cập nhật Kiến trúc Kỹ thuật (Technical Updates)

Để tính năng này hoạt động mượt mà, vì Kính Lúp và Master Key là **Tài sản Off-chain** (lưu trong Database, không phải NFT trên Blockchain), chúng ta sẽ sử dụng cơ chế **Escrow EIP-712** của `BanditMarket.sol` đã thiết kế từ trước.

Anh chỉ cần chuyển chỉ đạo này cho anh Nguyễn Mạnh Dũng (Tech Lead) để cập nhật vào Backlog:

**1. Cập nhật Backend (Issue #11 - P2P Marketplace):**

* Khi user gọi API `POST /marketplace/list`, Backend phải kiểm tra thêm bảng `user_items` (thay vì chỉ kiểm tra kho nông sản). Nếu `item_type` là `master_key` hoặc `magnifying_glass`, hệ thống khóa (lock) số lượng item đó lại để chờ khớp lệnh.

**2. Cập nhật Event Indexer (Issue #42 - Lắng nghe Blockchain):**

* Khi Smart Contract báo sự kiện `OrderFilled` (Người mua đã trả đủ $FARM), Backend Worker xử lý giao dịch sẽ thực hiện trừ item ở ví người bán và cộng item vào bảng `user_items` của người mua.

**3. Cập nhật Giao diện Chợ (Issue #47 - Marketplace UI):**

* Bổ sung thêm Tab **"Công Cụ / Tools"** (bên cạnh tab Nông Sản và Chó Bảo Vệ).
* Giao diện hiển thị rõ số lượng Kính Lúp / Master Key đang được bán theo gói (Ví dụ: Pack 5 Kính Lúp giá 10 $FARM).

---

### 📋 COPY LỆNH NÀY GỬI CHO TEAM DEV / CLAUDE

Anh hãy copy đoạn lệnh ngắn này gửi vào luồng chat với Claude (hoặc gửi thẳng cho Tech Lead) để nó tự động cập nhật logic vào hệ thống:

> **Project Update Request: Tradable Viral Items**
> *PM Decision:* We have decided to make the viral items **"Magnifying Glass"** and **"Master Key"** tradable on the P2P Marketplace. This creates a F2P-to-Whale economy where grinders farm referrals to sell keys to whales for $FARM.
> **Action Required:**
> Please note these logic updates for the Dev Team (specifically for Sprint 2 - Issue #11 and Sprint 3 - Issue #47):
> 1. **Marketplace Backend:** The EIP-712 Off-chain Escrow logic must support listing items from the `user_items` table (specifically `item_type: 'magnifying_glass'` and `'master_key'`), alongside crops.
> 2. **Event Indexer:** The DB transaction that processes `OrderFilled` must correctly route to the `user_items` table for balance updates when the `itemId` matches viral items.
> 3. **Marketplace UI:** Add a new "Tools" or "Consumables" tab to the Marketplace browser to let users filter and buy these viral items easily.
> 
> 

Vậy là toàn bộ nền kinh tế Web3, Web2.5 và Off-chain của **Bandit Buddy** đã được khép kín và móc nối với nhau hoàn hảo. Anh thấy còn cơ chế nào, hay "vật phẩm" nào anh muốn thương mại hóa nốt trước khi chúng ta bắt đầu Sprint 1 không?

phần thay đổi vừa rồi nên cho vào spint nào ?
Phần thay đổi này không cần tạo thành một Issue hay Epic mới để tránh làm phình to (scope creep) Backlog. Theo tư duy quản trị Agile, chúng ta sẽ **chẻ nhỏ (break down) tính năng này và gài trực tiếp vào các Task đã có sẵn trong Sprint 2 và Sprint 3**.

Dưới đây là phương án phân bổ chính xác nhất để anh giao cho Tech Lead Nguyễn Mạnh Dũng:

### 1. Phân bổ vào Sprint 2: Nền tảng Kinh tế & Backend

* **Gắn vào Task hiện tại:** P2P Marketplace Backend (Logic tạo lệnh EIP-712).
* **Chi tiết thực thi:** Khi viết API `POST /marketplace/list`, thay vì chỉ cho phép kiểm tra bảng `farm_plots` (đối với nông sản) và `nft_guard_dogs` (đối với NFT), backend dev sẽ viết thêm vài dòng code để query bảng `user_items`. Nếu số dư `magnifying_glass` hoặc `master_key` hợp lệ, cho phép người chơi tạo lệnh bán off-chain.

### 2. Phân bổ vào Sprint 3: Tích hợp Web3 & Giao diện Chợ

* **Gắn vào Task hiện tại (Frontend):** Marketplace UI.
* **Chi tiết thực thi:** Khi thiết kế giao diện chợ P2P, team React bổ sung thêm một tab **"Công cụ / Tools"** bên cạnh "Nông sản" và "Chó bảo vệ" để hiển thị các gói Kính Lúp và Master Key đang được rao bán.
* **Gắn vào Task hiện tại (Backend/Indexer):** Blockchain event indexer (Worker lắng nghe sự kiện).
* **Chi tiết thực thi:** Trong hàm xử lý sự kiện `OrderFilled` từ Smart Contract, thêm một khối `if/else` hoặc `switch/case`. Nếu tài sản khớp lệnh thuộc loại `master_key` hay `magnifying_glass`, Database sẽ tiến hành trừ item của người bán và cộng cho người mua.

**Lý do phân bổ luồng này:**
Việc định nghĩa Kính Lúp và Master Key (cơ chế Viral trả thù) đã được lên lịch code ở Sprint 2. Do đó, khi bước sang cuối Sprint 2 và đầu Sprint 3 để làm tính năng Marketplace, các vật phẩm này đã có sẵn trong Database. Đội ngũ kỹ thuật chỉ việc đưa chúng lên kệ để giao dịch cùng lúc với các nông sản khác mà không cần phải đập đi xây lại (refactor) luồng code cũ.

Anh chỉ cần chuyển hướng dẫn này cho anh Dũng để anh ấy bổ sung thêm các dòng *Acceptance Criteria (Tiêu chí nghiệm thu)* vào những Ticket GitHub tương ứng là đội ngũ có thể triển khai ngay lập tức!