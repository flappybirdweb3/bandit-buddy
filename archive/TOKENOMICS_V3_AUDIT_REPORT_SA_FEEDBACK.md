User prompt: hãy review bản Audit nội bộ lần cuối xem có cần cân nhắc team gì không?
Response: Bản báo cáo Audit V3 cho thấy một kết quả xuất sắc: 100% toán học khớp, vốn hóa IMC $797,500 chính xác và hoàn toàn không có lỗi nghiêm trọng (Critical). Áp lực bán đã được dàn trải hoàn hảo trong 3 năm, với lượng lưu thông tại TGE của Investor và Team chỉ vỏn vẹn 21.5M token.
Tuy nhiên, để hệ thống thực sự "Go-Live" an toàn, đội ngũ kỹ thuật và vận hành cần xử lý dứt điểm các lưu ý (Warnings) và danh sách chuẩn bị sau đây:
1. Các lưu ý vận hành cốt lõi từ Audit Report
Không cần sửa Smart Contract Vesting: Hợp đồng FarmVesting.sol hiện tại đã hỗ trợ sẵn logic trả TGE (ví dụ 2% cho Team) theo sau là thời gian khóa (cliff 180 ngày). Team không cần đụng vào code contract này, chỉ cần truyền đúng tham số qua hàm addSchedule() trong kịch bản Deploy.
Bắt buộc Khóa Thanh Khoản (Rug-pull Prevention): Khi cung cấp 100M $FARM vào PancakeSwap, admin sẽ nhận lại LP Tokens. Nếu không khóa số LP này lại, dự án sẽ dính "cờ đỏ" rủi ro rút thanh khoản. Team phải thêm bước gọi liquidityLocker.lock() để khóa LP Token tối thiểu 12 tháng và công bố minh bạch trên Whitepaper.
Khơi thông dòng tiền Ecosystem (Cronjob): Quỹ Ecosystem 400M được thiết kế mở khóa tuyến tính mỗi giây trong 1080 ngày. Token không tự động bay về ví dự án; Backend phải có một Cronjob tự động gọi hàm release(ecosystemWallet) hàng ngày/hàng tuần để rút $FARM về ví Hot Wallet. Nếu bỏ sót tác vụ này, game sẽ không có token để trả thưởng cho người chơi. Cần cài đặt hệ thống cảnh báo (monitor alert) nếu số dư ví Ecosystem xuống dưới ngưỡng 1 triệu $FARM.
Đính chính thuật ngữ: Cơ chế Vesting hoạt động theo block.timestamp (tính bằng giây thời gian thực), không phải "per block". Cần đính chính từ ngữ trong Whitepaper để đảm bảo sự chuẩn xác về mặt kỹ thuật.
2. Danh sách dữ liệu anh Nguyễn Mạnh Dũng cần gom ngay lập tức Để Claude có thể viết ra Script Deploy (kịch bản triển khai) cuối cùng, team cần chốt các thông số thực tế sau:
Thiết lập Ví Gnosis Safe (Multisig 3/5): Cần địa chỉ ví đa chữ ký để nhận và quản lý quỹ Treasury 180M $FARM.
Danh sách Ví Team & Cố vấn: Cần danh sách địa chỉ ví cụ thể của từng thành viên kèm theo số lượng token phân bổ (tổng đúng 150M).
Địa chỉ Ví Hệ sinh thái & Thanh khoản: Chốt địa chỉ Ecosystem Wallet (thường là Backend hot wallet) và Liquidity Manager Wallet.
Lịch trình Sales (Timeline): Chốt ngày giờ chính xác (Timestamp) mở/đóng các vòng Angel, Private, IDO và ngày TGE (Niêm yết PancakeSwap).
Anh đã có sẵn danh sách địa chỉ ví và ngày TGE dự kiến để cung cấp cho Claude hoàn thiện file Deploy Script cuối cùng chưa?

