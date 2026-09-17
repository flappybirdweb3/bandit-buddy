Tuyệt vời. Đứng ở góc độ Kiến trúc sư Hệ thống, tôi đã rà soát chéo toàn bộ luồng logic, lỗ hổng bảo mật và Tokenomics. Đây là bản Master Backlog cuối cùng để anh em kỹ thuật đóng cửa gõ code.

## Sprint 1 & 2: Lõi Nông Trại & Cây Cầu Web2.5

* Hoàn thiện cấu trúc Database chuẩn hóa, sử dụng duy nhất bảng `user_items` để quản lý mọi tài sản Off-chain (Nông sản, Kính lúp, Master Key).
* Xây dựng giao diện "Nhà Kho" (The Barn) tích hợp cơ chế "Sell-Lock", chặn tuyệt đối các thao tác giao dịch hoặc đập lò đối với chó đang làm nhiệm vụ canh gác.
* Hoàn thiện API "Web2.5 Bridge" xử lý việc đúc chó in-game thành NFT (thu phí 15 $FARM/con hoặc 40$FARM/3 con) và định tuyến phí về quỹ Treasury.
* Triển khai cơ chế Đóng thùng nông sản (Crates) để tối ưu hóa việc lưu trữ và giao dịch trên chợ.

## Sprint 3: Thị Trường P2P & Smart Contracts

* Phát triển Smart Contract bám sát chuẩn thuần EVM. Tích hợp vật phẩm "Mảnh hồn" (ID 9999) trực tiếp vào `BanditDogFusion.sol`.
* Phân tách rõ ràng luồng thanh toán trong `BanditMarket.sol`: `buyNFT()` cho tài sản trên chuỗi và `buyOffchainItem()` cho chức năng Escrow.
* Xây dựng hệ thống Backend Indexer với mô hình Factory, lắng nghe chính xác các Event giao dịch để cập nhật chéo vào Database thông qua khóa dòng (`SELECT ... FOR UPDATE`).
* Hoàn thiện UI Marketplace với cơ chế ký quỹ EIP-712, hiển thị mượt mà 3 phân khu hàng hóa cho người chơi.

## Sprint 4: Đóng Băng Code & Triển Khai BSC

* Chính thức Code Freeze. Tập trung chạy 100% Test Cases trên Hardhat để vá mọi lỗ hổng Replay Attack hay kẹt lệnh.
* Kích hoạt cấu trúc `chain_id` trong Database, đặt nền móng kiến trúc sẵn sàng cho việc mở rộng sang mạng Base trong Phase 2.
* Tiến hành Audit Smart Contract và chính thức Deploy phiên bản V1 lên mạng lưới BSC.

Hệ thống này đã đủ vững chắc để làm bệ phóng cho toàn bộ nền kinh tế của game, đồng thời là một bản MVP hoàn hảo để báo cáo nghiệm thu trực tiếp với chủ tịch Vũ Thế Vân của Quỹ Phanxipan. Anh hãy chuyển ngay bản thiết kế này cho Nguyễn Mạnh Dũng để phân bổ ticket trên GitHub nhé.