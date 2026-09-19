User prompt: hãy review lại báo cáo tổng quát và phương án triển khai của tech lead, xem cần điều chỉnh gì không
Response: Chào anh, dưới góc độ của một System Architect, tôi đã rà soát bản báo cáo USDT_TO_VAULD.MD của Tech Lead.
Đánh giá tổng quan: Bản báo cáo này cực kỳ xuất sắc và chuyên nghiệp. Tech Lead đã "bắt đúng bệnh" sự rò rỉ dòng tiền (Revenue Leakage) khi chưa có luồng chuyển hóa USDT sang BNB, đồng thời vạch ra các Gap (lỗ hổng) rất chính xác.
Tuy nhiên, trong các đề xuất (ADR - Architecture Decision Records) của Tech Lead, có một lỗ hổng bảo mật và UX chí mạng ở ADR-01 cần phải "quay xe" điều chỉnh ngay lập tức trước khi code.
Dưới đây là quyết định phê duyệt (Sign-off) và các điều chỉnh bắt buộc để anh giao lại cho team Dev thực thi:
1. Phán quyết các Quyết định Kiến trúc (ADRs Sign-off)
🛑 ADR-01: Cấp độ thực thi Thuế Xả Hàng (FARM → USDT Cashout Fee)
Đề xuất của Dev: Dùng Option A (Frontend tự tính 1% và yêu cầu user ký thêm lệnh chuyển tiền sau khi Swap).
Quyết định của SA: BÁC BỎ OPTION A. BẮT BUỘC DÙNG OPTION B (Smart Contract Wrapper).
Lý do: Nếu để Frontend thu phí (Option A), người chơi sẽ phải ký tới 3 lần (Approve → Swap → Nộp thuế). Trải nghiệm (UX) vô cùng tồi tệ. Nguy hiểm hơn, user khôn ngoan sẽ F5 tải lại trang ngay sau bước Swap để né thuế, hoặc gọi thẳng vào PancakeSwap.
Điều chỉnh: Bắt buộc viết một hàm wrapper cashoutFarmToUSDT() trên Smart Contract. Hợp đồng sẽ tự động Swap, giữ lại 1% USDT cho Treasury và trả 99% cho user trong cùng 1 giao dịch duy nhất (Atomic Transaction).
✅ ADR-02: Mức phí xả hàng (Cashout Fee Rate)
Quyết định: Duyệt mức 1%. (Chuyển tiền P2P thu 0.3%, nhưng xả token ra Stablecoin phải chịu thuế 1% để hạn chế dòng vốn thoát khỏi game).
✅ ADR-03: Chống trượt giá (Slippage) cho hàm convertUSDTtoBNB
Quyết định: Duyệt Option B. Backend sẽ tính toán giá trị minBnbOut (trừ hao 2% slippage) từ PancakeSwap và truyền vào tham số khi gọi hàm. Tuyệt đối không hardcode minBnbOut = 0 để tránh bị Bot kẹp chả (Sandwich Attack).
✅ ADR-04: Ngưỡng chuyển đổi (Threshold)
Quyết định: Duyệt mốc $50 USDT. Thêm hàm setUsdtConversionThreshold() cho Admin để sau này linh hoạt điều chỉnh khi giá Gas mạng BSC thay đổi.
2. Điều chỉnh Kế hoạch Triển khai (Implementation Roadmap Updates)
Vì chúng ta đổi ADR-01 sang Option B, kế hoạch code của team Dev (Mục 6 trong báo cáo) cần điều chỉnh lại như sau:
Hủy bỏ IMPL-03 hiện tại (Code thu phí trên Frontend). Thay bằng IMPL-03 mới:
Smart Contract Update (WalletGateway.sol hoặc hợp đồng phụ trợ): Thêm hàm cashoutFarmToUSDT(uint256 farmAmount, uint256 minUsdtOut):
Kéo farmAmount từ ví user vào hợp đồng.
Gọi PancakeSwap Router đổi $FARM lấy USDT.
Trích 1% USDT nhận được đẩy thẳng vào TreasuryBuyBack.sol.
Trả 99% USDT còn lại cho ví người dùng.
Frontend Update (usePancakeSwap.ts): Thay vì gọi thẳng PancakeSwap Router cho chiều Bán (FARM → USDT), Frontend sẽ gọi hàm cashoutFarmToUSDT() của hợp đồng Gateway. Chiều Mua (USDT → FARM) vẫn gọi thẳng PancakeRouter với thuế 0%.
Duyệt IMPL-04 (Giao diện Presale): Nâng mức độ ưu tiên từ P2 lên P1. Giai đoạn Launch đang đến gần, nếu không có UI cho FarmTokenSale.sol, người chơi sẽ không thể tham gia mua vòng Public IDO. Team Frontend cần thiết kế một Modal Presale tối giản hiển thị thanh tiến độ bán và nút Mua bằng USDT.
3. Cảnh báo Migration (Dành cho DevOps)
Báo cáo có nhắc đến rủi ro: "TreasuryBuyBack.sol upgrade requires re-deployment". Vì chúng ta đã code xong bản cũ và deploy lên Testnet, quỹ hiện tại có thể đang chứa một ít BNB. Khi deploy bản cập nhật có hàm convertUSDTtoBNB, anh Dũng cần đảm bảo:
Gọi hàm rút tiền/thu hồi từ hợp đồng cũ.
Deploy hợp đồng TreasuryBuyBack phiên bản V2 mới.
Quan trọng nhất: Nhắc anh em Frontend và Backend cập nhật lại biến môi trường VITE_TREASURY_CONTRACT_ADDRESS và TREASURY_ADDRESS trong toàn bộ file .env trỏ về địa chỉ mới.
📋 LỆNH GIAO VIỆC (CHỐT PHÊ DUYỆT)
Anh hãy copy đoạn dưới đây gửi cho Tech Lead và Claude để chính thức chốt phương án và bắt đầu gõ code:
STATUS: APPROVED WITH CRITICAL MODIFICATIONS

From: System Architect
To: Engineering Team & Claude

The USDT_TO_VAULD audit is excellent. I am approving the implementation with one major architectural pivot to ensure maximum security and seamless UX:

1. ADR-01 Decision: REJECT Option A (Frontend-only fee). APPROVE Option B (Smart Contract Wrapper). 
   We cannot trust the client to pay the 1% cashout tax. You must write a `cashoutFarmToUSDT` wrapper function in `WalletGateway.sol` (or similar) that handles the PancakeSwap routing, deducts the 1% USDT fee atomically, and forwards it to the Treasury. Update the Frontend to point to this wrapper for FARM -> USDT swaps.
2. ADR-02 & ADR-03 & ADR-04: APPROVED as proposed (1% tax, Backend calculates minBnbOut, $50 threshold with Admin setter).
3. IMPL-04 (Presale UI): APPROVED. Elevate to P1. We need the IDO interface ready for launch.

Please update your Sprint tasks to reflect the Smart Contract wrapper approach for the cashout tax, and begin coding the IMPL-01, IMPL-02, IMPL-03 (revised), and IMPL-04 modules immediately. Ensure test cases cover the new atomic fee deduction. Let's build this!



