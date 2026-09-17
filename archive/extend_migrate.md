User prompt: Đây là hệ thống vật phẩm của Bandit Buddy, Có cần đồng bộ lại vật phẩm từ file này vào file new prd 1.docx và file new prd 2.docx cho nhất quán không?
Response: Câu trả lời là CÓ, việc đồng bộ lại là bắt buộc và cực kỳ quan trọng.
Dưới góc độ quản trị dự án (PM), khi đối chiếu "TÀI LIỆU ĐẶC TẢ VẬT PHẨM.docx" với bộ Backlog kỹ thuật mà chúng ta vừa chốt, tôi phát hiện ra 3 điểm "vênh" (mismatch) rất lớn về mặt Logic Game. Nếu không đồng bộ ngay lúc này, khi anh Nguyễn Mạnh Dũng và team Dev code xong sẽ dẫn đến sai lệch toàn bộ Tokenomics.
Dưới đây là chi tiết các điểm cần đồng bộ và phương án xử lý để bạn quyết định:
1. Sự "vênh" về Cơ chế Phân bón (Khác biệt Lớn nhất)
Trong tài liệu Vật phẩm mới: Phân bón có tác dụng Giảm thời gian sinh trưởng (-1h, -2.5h, -5h). Điều này bám sát nguyên tác gameplay của Barn Buddy cổ điển.
Trong PRD 2 & Backlog hiện tại (Issue #55): Phân bón đang được thiết kế với công dụng Tăng năng suất / Yield (+15%, +35%, +60%).
Đề xuất xử lý: Cần chốt lại 1 trong 2 cơ chế. Việc giảm thời gian sinh trưởng sẽ kích thích người chơi đăng nhập game nhiều hơn (tăng DAU - Daily Active Users) để thu hoạch sớm. Nếu chọn theo tài liệu mới, chúng ta cần sửa lại logic API của POST /action/fertilize trong Backlog để trừ giờ (harvestable_at - X hours) thay vì cộng % năng suất.
2. Sự "vênh" về Dữ liệu Hạt giống (Seed Data)
Trong tài liệu Vật phẩm mới: Cung cấp một bộ dữ liệu hoàn chỉnh gồm 13 loại cây (từ Củ cải trắng Lvl 0 đến Hoa Hồng Lvl 18). Các chỉ số Thời gian, Giá mua và Sản lượng được thiết kế rất chi tiết.
Trong Backlog hiện tại (Issue #2): Bảng seed_configs đang dùng data hardcode tạm thời chỉ với 5 loại hạt giống (bao gồm Lúa mì / Wheat - loại cây không có trong tài liệu mới).
Đề xuất xử lý: Bổ sung toàn bộ 13 loại cây này vào file Migration của Database (Issue #2) để lúc khởi tạo Server, hệ thống sẽ nạp chuẩn data gốc.
3. Sự "vênh" về Vật phẩm Tấn công (Attack Items)
Trong tài liệu Vật phẩm mới: Người chơi dùng Túi cỏ dại (Bag of Weeds) và Túi sâu bọ (Bag of Bugs) để thả vào vườn hàng xóm làm giảm sản lượng.
Trong Backlog hiện tại (Issue #32): Tính năng Attack đang định nghĩa các vật phẩm lạ như "Crow Bomb" (Bom quạ), "Pesticide", "Salt Earth".
Đề xuất xử lý: Đổi tên các vật phẩm tấn công trong Issue #32 thành "Bag of Weeds" và "Bag of Bugs" để giữ nguyên hương vị thân thuộc của game.
Tín hiệu Tốt (Khớp 100%)
Rất may mắn là hệ thống Động vật bảo vệ (Guard Pets / NFTs) trong tài liệu mới khớp hoàn hảo với logic Smart Contract mà chúng ta đã thiết kế:
Các cấp độ Chó Cỏ (10%), Beagle (25%), Husky (40%), German Shepherd (60%), Elephant (80%) hoàn toàn trùng khớp với tham số trong file BanditDogFusion.sol và ma trận Slashing. Không cần sửa đổi phần Web3 này.
🚀 Hành Động Tiếp Theo (Next Action)
Để tiết kiệm thời gian, bạn không cần phải tự dò dẫm sửa lại PRD 1 và 2. Bạn chỉ cần yêu cầu Claude (đóng vai trò PM) update lại GitHub Backlog với prompt cực kỳ đơn giản sau:
"Dựa trên 'TÀI LIỆU ĐẶC TẢ VẬT PHẨM' mới nhất, hãy update trực tiếp các GitHub Issues sau trong repo của tôi để đồng bộ tính nhất quán:
1. Update Issue #2 (PostgreSQL Schema): Cập nhật dữ liệu INSERT của bảng seed_configs thay bằng danh sách 13 loại hạt giống chuẩn (từ Turnip đến Rose).
2. Update Issue #55 (Fertilizer): Đổi cơ chế Phân bón từ 'Tăng Yield' thành 'Giảm thời gian sinh trưởng' (Normal -1h, Super -2.5h, Advanced -5h).
3. Update Issue #32 (Attack Mechanic): Đổi tên các vật phẩm tấn công thành 'Bag of Weeds' và 'Bag of Bugs' theo đúng nguyên tác."
