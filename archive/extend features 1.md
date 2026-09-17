Một phát hiện cực kỳ tinh tế về mặt logic hệ thống! Trong thiết kế Game Web3, nếu không xử lý triệt để trạng thái (State) của NFT giữa On-chain và In-game, dự án sẽ gặp ngay lỗi "Nhân bản phòng thủ" (chó đã bán cho người khác nhưng vẫn đứng gác ở farm cũ).

Dưới góc độ Kiến trúc Hệ thống (System Architecture), yêu cầu này hoàn toàn hợp lý và cần được "chốt hạ" ngay lập tức vào thiết kế của Frontend và Backend.

Dưới đây là giải pháp kỹ thuật chi tiết và bản đặc tả yêu cầu (Requirements) để anh Dũng (Tech Lead) giao việc cho team Dev.

---

### PHẦN I: GIẢI PHÁP LOGIC "KHÓA BÁN" (SELL LOCK) CHO CHÓ ĐANG CANH GÁC

Chúng ta sẽ sử dụng trường `is_active` (boolean) đã có sẵn trong bảng `nft_guard_dogs` của Database để làm chìa khóa đóng mở tính năng này.

**1. Luồng xử lý Frontend (UI/UX)**

* Trong giao diện Nhà Kho (Dog Kennel), chia làm 2 khu vực: **Đang canh gác (Equipped)** và **Đang nghỉ ngơi (Stored)**.
* Nút **[List on Marketplace]** (Bán) và nút **[Fuse]** (Đập lò) sẽ bị **mờ đi (disabled)** đối với những con chó đang ở trạng thái Equipped.
* Khi người chơi bấm vào nút Bán đang bị mờ, hiển thị một Tooltip/Toast: *"Chú chó này đang làm nhiệm vụ gác cổng. Hãy thu hồi về Nhà Kho (Unequip) trước khi bán!"*
* Người chơi phải bấm **[Thu hồi / Unequip]** -> Chó chuyển sang trạng thái "Đang nghỉ ngơi" -> Nút Bán sáng lên.

**2. Luồng bảo mật Backend (API Validation)**
Giao diện có thể bị hacker dùng tool bypass, nên Backend phải là chốt chặn cuối cùng.

* Khi có request `POST /marketplace/list` (Tạo lệnh bán EIP-712), Backend kiểm tra bảng `nft_guard_dogs`.
* Nếu `is_active == true`, chặn ngay lập tức và trả về mã lỗi HTTP 400: `{"error": "DOG_IS_GUARDING", "message": "Cannot sell a dog that is currently guarding the farm."}`.

**3. Xử lý Edge Case (Hành vi xả lén qua chợ ngoài)**
*Vấn đề:* Vì chó là NFT (ERC-1155) thật trên blockchain, người chơi có thể không bán trên Marketplace của game mà mang thẳng lên các chợ Web3 khác (như TofuNFT, Element) để bán. Lúc này Smart Contract vẫn cho phép chuyển nhượng, và con chó sẽ rời khỏi ví người chơi.
*Khắc phục (Đã có sẵn trong Indexer):* Worker lắng nghe sự kiện `TransferSingle` hoặc `TransferBatch` của Smart Contract. Nếu phát hiện NFT chó bị chuyển sang ví khác, Backend lập tức **xóa** con chó đó khỏi farm của người bán, và set `is_active = false` tự động. Hàng rào phòng thủ của Farm bị tụt ngay lập tức.

---

### PHẦN II: THIẾT KẾ CHỨC NĂNG "NHÀ KHO" (INVENTORY / BARN)

Thay vì để vật phẩm rải rác, chúng ta sẽ gom tất cả vào một Modal UI duy nhất gọi là **"Nhà Kho" (The Barn)**. Đây sẽ là trung tâm quản lý tài sản của người chơi.

**1. Cấu trúc Giao diện Nhà Kho (Barn Modal)**
Chia làm 3 Tab chính để người chơi dễ quản lý:

* **Tab 1: Nông Sản & Hạt Giống (Crops & Seeds)**
* Hiển thị danh sách hạt giống chưa trồng.
* Hiển thị nông sản đã thu hoạch.
* **Nút thao tác:** [Đóng Thùng / Pack Crate] (để gom nông sản mang lên chợ bán), hoặc [Bán lấy Vàng / Sell to System].


* **Tab 2: Vật phẩm Tiêu hao (Tools & Consumables)**
* Hiển thị Phân bón, Túi Sâu Bọ, Kính Lúp 🔍, Master Key 🗝️, Khúc Xương May Mắn, Mảnh Hồn (Shards).
* **Nút thao tác:** Mảnh Hồn, Kính Lúp, Master Key sẽ có nút **[Bán trên Chợ]** (vì chúng ta đã thống nhất cho phép giao dịch P2P). Các vật phẩm khác chỉ có nút [Sử dụng].


* **Tab 3: Chuồng Chó (Guard Dogs)**
* Quản lý chó Web2 (mua bằng vàng) và chó NFT Web3.
* **Nút thao tác:** [Bố trí canh gác / Equip], [Thu hồi / Unequip], [Cho ăn / Feed], [Đúc NFT / Tokenize] (dành riêng cho chó Web2), [Bán trên Chợ] (dành riêng cho chó NFT đang nghỉ ngơi).



**2. Gộp API Backend (Inventory Aggregator)**
Để Frontend gọi dữ liệu nhanh nhất khi mở Nhà Kho, Backend sẽ cung cấp một Endpoint tổng hợp:

* `GET /user/inventory`
* Hàm này sẽ query đồng loạt từ các bảng `user_items`, `nft_guard_dogs` và `seed_configs` để trả về một file JSON hoàn chỉnh cho Frontend render ngay lập tức (Kết hợp Redis cache để giảm tải).

---

### 📋 UPDATE VÀO BACKLOG CHO TEAM DEV

Anh hãy copy đoạn chỉ đạo dưới đây gửi cho Tech Lead hoặc ném vào luồng chat với Claude để update trực tiếp vào các ticket trên GitHub (gắn vào Sprint 2 và Sprint 3):

> **Project Update: Sell-Lock Logic & The Barn Inventory System**
> Vui lòng cập nhật các yêu cầu sau vào Backlog hiện tại:
> **1. Update Task #11 (P2P Marketplace Backend) - Sprint 2:**
> * Bổ sung Validation: Endpoint `POST /marketplace/list` bắt buộc phải check bảng `nft_guard_dogs`. Nếu `is_active === true` (chó đang canh gác), block request và return 400 `DOG_IS_GUARDING`.
> * Tương tự, không cho phép ghép chó (Fusion) nếu chó đang ở trạng thái `is_active === true`.
> 
> 
> **2. Update Task #31 (Shop & Inventory UI) - Sprint 2:**
> * Mở rộng Modal thành **"The Barn" (Nhà Kho)** với 3 Tabs: `Crops & Seeds`, `Consumables`, `Guard Dogs`.
> * Trong Tab `Guard Dogs`: Implement logic Equip/Unequip. Nút [Sell on Market] và [Fuse] bắt buộc bị `disabled` (kèm tooltip cảnh báo) nếu chó đang trạng thái Equipped.
> 
> 
> **3. Add New Endpoint `GET /user/inventory` - Sprint 2:**
> * Viết một Aggregation API fetch toàn bộ dữ liệu từ `user_items` và `nft_guard_dogs` trả về một payload duy nhất để Frontend render Nhà Kho mượt mà (có cache Redis 10s).
> 
> 
> **4. Update Task #18 (Blockchain Indexer) - Sprint 3:**
> * Xử lý edge-case: Lắng nghe event `TransferSingle/TransferBatch` của ERC-1155. Nếu user tự ý transfer NFT chó đi ví khác (không qua in-game market), tự động gỡ chó khỏi farm (`is_active = false`) và xóa ownership trong Database.
> 
> 

Như vậy, chúng ta đã vá kín được lỗ hổng logic về phòng thủ, đồng thời mang lại một giao diện UI (Nhà Kho) cực kỳ quy củ, mang đậm chất game nông trại truyền thống. Hãy build luồng thao tác Equip/Unequip này trực quan cho người chơi và tối ưu ui/ux flow