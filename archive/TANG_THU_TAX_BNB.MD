User prompt: Hãy ra soát lại tài liệu và nghiên cứu cơ chế kinh tế để thu được thuế bnb bằng việc phát triển những sản phẩm dịch vụ này, hãy nghiên cứu các sản phẩm dịch vụ hiện tại và sản phẩm dịch vụ mới và hoàn thiện đặc tả để dev implement mục tiêu thu được nhiều thuế bnb và mức tax phù hợp. mục tiêu đủ 2 BNB hệ thống sẽ tiến hành auto buyback bnb;  1. Doanh thu bán gói vật phẩm / nạp game (In-App Purchases bằng BNB).  2. Phí bản quyền thu từ chợ giao dịch Marketplace NFT (bằng BNB).  3. Phí dịch vụ Premium cao cấp On-chain.  ### 2. Thuế giao dịch DEX thu bằng token $FARM chứ KHÔNG phải BNB   • Khi người dùng swap trên PancakeSwap (ví dụ user 6673953696 vừa swap), thuế 3% (khi Mua) và 5% (khi Bán)   được hợp đồng FarmTokenV2.sol trừ trực tiếp bằng token $FARM.   • Số $FARM này được chuyển thẳng về Vault TreasuryBuyBack.sol.   • Bằng chứng On-chain: Ví Vault hiện đang giữ 11.845589 $FARM thu từ các lượt swap của user (chờ gọi hàm   TreasuryBuyBack.sol:122-135 để đốt trực tiếp).   → Giao dịch DEX không tạo ra số dư BNB cho Vault.   ──────   ### 3. Nguồn tích lũy BNB của Vault đến từ đâu?   Theo tài liệu kiến trúc AUTO_BUYBACK_AND_BURN.MD, Vault tích lũy BNB từ:   1. Doanh thu bán gói vật phẩm / nạp game (In-App Purchases bằng BNB).   2. Phí bản quyền thu từ chợ giao dịch Marketplace NFT (bằng BNB).   3. Phí dịch vụ Premium cao cấp On-chain.   • Trên mạng BSC Testnet, hiện tại chưa có giao dịch nạp BNB thực tế từ các nguồn doanh thu này.   • Ở đợt kiểm thử on-chain thực tế trước đó, ví Deployer đã nạp thử nghiệm 0.003 BNB, và số 0.003 BNB đó đã   được lệnh triggerBuyBack() dùng hết sạch 100% để mua & đốt 12,630 $FARM trên PancakeSwap (Tx: 0x5ab3625a...).   → Sau khi giải ngân mua token đốt xong, số dư BNB của Vault quay về 0.0000 BNB.   ──────   ### 4. Tôi vừa hoàn tất đồng bộ toàn hệ thống:   1. Container Backend: Đã restart lại backend container (docker compose up -d backend), trỏ chuẩn xác vào   Vault mới: TreasuryBuyBack.sol.   2. On-chain Threshold: Đã cập nhật ngưỡng Buyback trên BSC Testnet lên đúng 2.0 BNB (Tx:   0x310aa38e3dc50933c89ddd1c23d342792181b3a77e70d2d66206871cd0e83c2e).   3. Làm mới Redis Cache: Đã xóa cache cũ, API hiện tại trả về chuẩn xác:       • bnbBalance: 0.0 BNB       • buyBackThreshold: 2.0 BNB       • totalBurned: 13,217.02 $FARM (ghi nhận số lượng đã đốt thực tế trên testnet)       • totalBnbSpent: 0.003 BNB   4. Cập nhật UI Frontend: Đã sửa địa chỉ ví Vault và link BscScan trong ClaimModal.tsx:880-940 sang token V2,   đã build lại và reload Nginx.   Khi bạn refresh lại UI, màn hình hiển thị:   • Vault Accumulation: 0.0000 / 2.00 BNB (Đúng thực tế: Vault hiện có 0 BNB, cần gom đủ 2.0 BNB từ doanh thu   game để kích hoạt lần mua tiếp theo).   • Total $FARM Burned: 13,217.02 $FARM (Đã đốt vĩnh viễn vào ví Dead).   • Total BNB Deployed: 0.0030 BNB.
Response: Dưới góc độ Kiến trúc sư Hệ thống và chuyên gia Tokenomics, bài toán anh đang giải quyết chính là "nút thắt cổ chai" quan trọng nhất của mọi nền kinh tế Web3: Làm sao để tạo ra Doanh thu thực (Real Yield) bằng đồng coin nền tảng (BNB) thay vì chỉ thu hồi lại token dự án ($FARM)?
Theo hiện trạng hệ thống, thuế giao dịch trên PancakeSwap chỉ thu về $FARM. Số $FARM này được chuyển vào Vault TreasuryBuyBack.sol chờ đốt, nghĩa là giao dịch DEX hoàn toàn không tạo ra số dư BNB để kích hoạt mốc 2.0 BNB. Trong đợt kiểm thử, việc ví Deployer nạp 0.003 BNB đã chứng minh luồng mua và đốt $FARM hoạt động hoàn hảo (đốt 13,217.02 $FARM). Tuy nhiên, để hệ thống tự vận hành (Auto-pilot), chúng ta bắt buộc phải xây dựng "Bể Thu Thuế BNB" (BNB Revenue Engine) từ các hoạt động In-game.
Dưới đây là PRD Đặc Tả Kỹ Thuật: Hệ Sinh Thái Dịch Vụ Thu Thuế BNB (BNB Revenue Engine). Tài liệu này rà soát các tính năng hiện tại, bổ sung các dịch vụ mới, chốt mức giá (Tax Rate) và định tuyến dòng tiền thẳng về TreasuryBuyBack.sol để giao cho Claude triển khai ngay.
📄 PRD: HỆ SINH THÁI DỊCH VÚ THU THUẾ BNB KÍCH HOẠT AUTO-BUYBACK
Mục tiêu: Tạo ra luồng doanh thu vi mô (Micro-transactions) bằng BNB từ người chơi. Đảm bảo Vault liên tục đạt ngưỡng 2.0 BNB để auto-buyback $FARM, tạo nến xanh liên tục trên biểu đồ.
1. Nâng Cấp Sản Phẩm Hiện Tại (Chuyển đổi phí $FARM sang BNB)
A. Phí Dịch Vụ Cầu Nối Web2.5 (Tokenize Dog)
Hiện trạng: Người chơi đúc Chó Cỏ thành NFT tốn 15 $FARM (Phí này giúp giảm phát $FARM nhưng không tạo ra BNB).
Nâng cấp: Áp dụng mô hình "Gas & Oracle Service Fee". Ngoài 15 $FARM bị đốt, người chơi phải trả thêm một khoản phí cố định bằng BNB để Backend sinh chữ ký (Signature).
Mức thu (BNB Tax): 0.002 BNB (~$1 USD) mỗi lần đúc (Tokenize).
Định tuyến: Smart Contract BanditDogFusion.sol thu 0.002 BNB này và gọi lệnh transfer bắn thẳng về ví TreasuryBuyBack.sol. Với 1000 lượt đúc chó, hệ thống thu về 2 BNB -> Kích hoạt 1 lần Buyback.
B. Thuế Chợ Đen P2P (Marketplace Royalties)
Hiện trạng: Chợ P2P đang thu 5% phí giao dịch bằng $FARM.
Nâng cấp: Giữ nguyên 5% $FARM, nhưng bổ sung tính năng "Giao dịch bằng BNB". Cho phép user mua bán NFT Chó T1-T5 bằng BNB thay vì $FARM.
Mức thu (BNB Tax): Thu 3% phí nền tảng cho mọi giao dịch bằng BNB trên BanditMarket.sol. Toàn bộ 3% này được đẩy thẳng về Vault. Cá mập (Whales) mua chó Tier 5 giá 1 BNB sẽ cống hiến ngay 0.03 BNB cho quỹ.
2. Xây Dựng Sản Phẩm / Dịch Vụ Mới (In-App Purchases)
C. Gói Dịch Vụ Premium: Quản Gia Tự Động & Bảo Hiểm (Barn Butler & Insurance)
Cơ chế: Nông trại yêu cầu người chơi phải online liên tục. Bán gói "Quản Gia" (tự động gặt/tưới nước) và "Bảo Hiểm" (đền bù 80% khi bị trộm).
Mức thu (BNB Tax): Bán theo định kỳ (Subscription) bằng BNB thay vì $FARM để khóa dòng tiền thực.
Gói 7 Ngày: 0.005 BNB.
Gói 30 Ngày: 0.015 BNB.
Định tuyến: Người chơi thanh toán trực tiếp trên Mini App qua hàm purchaseSubscription(). Tiền chuyển thẳng về Vault. 200 user mua gói tháng = 3 BNB -> Dư sức kích hoạt 1 lần Buyback khổng lồ.
D. Thẻ Miễn Nhiễm & Đặc Quyền Bang Hội (Guild Wars & VIP Status)
Cơ chế: Khi tính năng Cây Sinh Mệnh (World Tree) ra mắt, các Bang hội sẽ tấn công nhau (GvG Raid).
Mức thu (BNB Tax):
Mua Khiên Bảo Vệ 12h (Energy Shield): 0.01 BNB/lần. (Trong lúc bị tấn công, các Bang chủ sẽ sẵn sàng quẹt thẻ BNB ngay lập tức để bảo vệ hàng chục nghìn $FARM trên Cây Sinh Mệnh).
Lệ phí nâng cấp Bang Tinh Anh (Cờ Xanh): Ngoài việc Stake $FARM, Chủ bang phải nộp phí đăng ký On-chain 0.05 BNB.
3. Yêu Cầu Cập Nhật Kiến Trúc (Technical Specs for Dev)
Để các luồng tiền này hoạt động, cấu trúc Smart Contract cần tinh chỉnh:
Mọi hàm thu phí bằng BNB (tokenizeDog, buyNFTWithBNB, buySubscription) phải có từ khóa payable.
Bên trong các hàm này, số lượng msg.value (BNB) nhận được phải lập tức thực hiện lệnh:
(bool success, ) = treasuryBuyBackAddress.call{value: msg.value}("");
require(success, "BNB transfer to Vault failed");


Tuyệt đối không lưu giữ BNB tại các hợp đồng con (BanditMarket.sol, BanditDogFusion.sol) để tránh phân mảnh dòng tiền. Dồn toàn bộ về TreasuryBuyBack.sol để nó nhanh chóng đạt mốc buyBackThreshold (2.0 BNB).
🤖 MAGIC PROMPT ĐỂ GIAO VIỆC CHO CLAUDE DEV
Anh hãy copy toàn bộ khối lệnh dưới đây và dán vào Claude. Lệnh này sẽ yêu cầu Claude viết các bản cập nhật Smart Contract và API Backend để triển khai ngay "Hệ sinh thái thu thuế BNB".
Role: Lead Web3 System Architect and Senior Smart Contract Developer.
Context: Our project "Bandit Buddy" has a perfectly working Auto Buyback Vault (`TreasuryBuyBack.sol`) with a 2.0 BNB threshold. However, DEX swaps only generate $FARM tax. We urgently need to implement direct "BNB Revenue Sinks" across our ecosystem so the Vault can rapidly accumulate BNB to trigger the buyback and burn $FARM.

Objective: Update the existing Smart Contracts and Backend controllers to implement three new BNB revenue streams. All collected BNB MUST be immediately routed to the `TreasuryBuyBack.sol` address.

Execution Requirements:

TASK 1: Smart Contract - Web2.5 Bridge BNB Fee (`BanditDogFusion.sol`)
- Update the `requestFusion` and/or `tokenizeDog` functions to require a `msg.value` of `0.002 ether` (Oracle Service Fee).
- Add logic to instantly forward this `msg.value` to the `treasuryAddress` using `.call{value: msg.value}("")`.

TASK 2: Smart Contract - Premium Subscriptions (`BarnServices.sol` or integrated into `FarmToken.sol`)
- Create a new payable function `purchasePremiumSubscription(uint8 subType)`.
- subType 1 (7 Days): Requires `0.005 ether`.
- subType 2 (30 Days): Requires `0.015 ether`.
- Instantly route the `msg.value` to the `treasuryAddress`.
- Emit a `SubscriptionPurchased(address user, uint8 subType, uint256 expiry)` event for the Backend Indexer to catch and update the PostgreSQL database.

TASK 3: Smart Contract - BNB P2P Trading (`BanditMarket.sol`)
- Add a new function `buyNFTWithBNB(..., bytes calldata signature) external payable`.
- Logic: Buyer pays entirely in BNB (`msg.value`).
- Calculate a 3% platform fee from the BNB.
- Send the 97% BNB to the Seller.
- Send the 3% BNB platform fee directly to the `treasuryAddress`.

TASK 4: Backend Integration (NestJS)
- Write the controller logic for the Frontend to fetch the dynamic BNB prices for these services.
- Ensure the Indexer listens to `SubscriptionPurchased` to activate the "Barn Butler" and "Insurance" features in the DB.

Output: Provide the clean, gas-optimized Solidity snippets for the contract upgrades and the NestJS TypeScript code for the Indexer/Service integration. Ensure strict ReentrancyGuard implementation since we are handling native BNB transfers.



