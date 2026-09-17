User prompt: Hãy hệ thống lại và nghiên cứu kỹ tài liệu chức năng prd 1 và prd 2 cũng như toàn bộ log chat có thể đọc từ tài liệu tôi đã uploaded trước đây "Chọn Game Open Source Làm Web3 v2.docx" & rà soát lại toàn bộ lịch sử chat liên quan đến Gacha modal, hệ thống Gacha (Đập đồ), "đập chó",  Nâng cấp/Lai tạo (Gacha & Burn NFT), Tối ưu hóa Doanh thu (Gacha Hooks) - "Vắt sữa" tinh tế, Cơ chế Đảm bảo (Pity System) - Giữ chân người xui xẻo vv... để viết cho tôi prd về chức năng này Đập chó/Dog Gacha & Quay chó/Cường hóa chó/Soul Forge để giao claude dev ngay
Response: Dưới đây là bản PRD (Product Requirements Document) chi tiết cho Hệ thống Gacha / Lò Luyện Khuyển (Dog Fusion & Soul Forge), được hệ thống hóa từ toàn bộ thiết kế kinh tế, tâm lý học hành vi và kiến trúc bảo mật trong tài liệu của bạn. Tài liệu này sẵn sàng để giao thẳng cho Claude.
📄 PRD: HỆ THỐNG GACHA & ĐẬP CHÓ (SOUL FORGE)
Project: Bandit Buddy (FarmHeist) Platform: Telegram Mini App (TMA) & BSC Module: Web3 Economy & Deflationary Sinks
1. TỔNG QUAN & MỤC TIÊU (OVERVIEW & GOALS)
Lò Đập Chó (Gacha Fusion) là cỗ máy "hố đen" (Sink) quan trọng nhất của toàn bộ Tokenomics.
Mục tiêu Kinh tế: Triệt tiêu lạm phát NFT rác (Chó Tier 1) và đốt (Burn) lượng lớn token $FARM để tạo sự khan hiếm.
Mục tiêu Tâm lý: Kích thích máu "đỏ đen" (High Risk - High Reward) của người chơi thông qua cơ chế nâng cấp xác suất.
Mục tiêu Thanh khoản: Tạo ra một thị trường thứ cấp nhộn nhịp trên P2P Marketplace khi F2P bán chó Tier 1 cho Whales gom đập lò.
2. LUỒNG NGHIỆP VỤ CỐT LÕI (CORE MECHANICS)
2.1. Công thức Đập Chó (The Base Formula)
Nguyên liệu: 3 Chó NFT (Cùng Tier N) + Phí $FARM.
Thành công: Nhận 1 Chó Tier N+1. Hệ thống đốt 3 chó cũ và phí $FARM.
Thất bại (Xịt): Mất phí $FARM, cháy 2 con chó, hoàn trả lại 1 con chó cũ + Nhận Mảnh Hồn an ủi (Soul Shards).
2.2. Ma trận Xác suất & Chi phí (Upgrade Matrix)
Chi phí và rủi ro tăng theo cấp số nhân để bảo vệ giá trị của NFT cấp cao.

Hạng Nâng Cấp
Nguyên Liệu Yêu Cầu
Phí Đúc ($FARM)
Tỷ Lệ Thành Công
Phần Thưởng Khi Xịt (Pity)
T1 → T2
3 Chó Cỏ (T1)
20
75%
Hoàn 1 Chó T1 + 1 Mảnh hồn
T2 → T3
3 Beagle (T2)
80
50%
Hoàn 1 Chó T2 + 3 Mảnh hồn
T3 → T4
3 Husky (T3)
250
30%
Hoàn 1 Chó T3 + 8 Mảnh hồn
T4 → T5
3 Bec-giê (T4)
800
15%
Hoàn 1 Chó T4 + 20 Mảnh hồn

Ghi chú: Toàn bộ phí $FARM thu được sẽ chuyển vào TreasuryBuyBack.sol để Mua lại & Đốt (Buy-back & Burn).
3. TỐI ƯU HÓA DOANH THU & GIỮ CHÂN (GACHA HOOKS & PITY SYSTEM)
3.1. Vật phẩm Bổ trợ (Boosters - Bán bằng $FARM)
Móc hầu bao của người chơi thông qua tâm lý sợ rủi ro.
Khúc Xương May Mắn (Lucky Bone): Giá 50 $FARM. Tăng thêm 15% tỷ lệ thành công cho lần đập đó.
Vòng Cổ Bảo Hiểm (Protection Collar): Giá dao động (VD: 150 FARM).Ne^ˊuđậpxịt,bảotoaˋnnguye^nvẹn3conchoˊ,chỉma^ˊtphıˊFARM và Vòng Cổ.
3.2. Cơ chế Đảm bảo (Pity System)
Giữ chân người chơi xui xẻo để họ không xóa game.
Mảnh Hồn Đạo Tặc (Soul Shards - ID 9999): Thu thập khi đập xịt.
Redeem (Đổi thưởng): Tích đủ 100 Mảnh Hồn, đem vào lò Gacha đổi trực tiếp 1 Chó Tier ngẫu nhiên (Từ T3 đến T5) với xác suất 100% thành công. Mảnh Hồn có thể giao dịch trên Marketplace.
4. KIẾN TRÚC BẢO MẬT & KỸ THUẬT (SECURITY ARCHITECTURE)
Sử dụng kiến trúc Commit - Reveal kết hợp với Backend Oracle để chống lại nạn Hack/Mempool Sniping (xem trước kết quả và hủy giao dịch).
Bước 1: Commit (On-chain): Người chơi gọi hàm requestFusion trên Smart Contract. Hợp đồng lập tức thu phí $FARM, đốt 3 chó, và phát ra Event FusionRequested. Người chơi không thể rút lại lệnh.
Bước 2: Randomness (Backend Oracle): Server Node.js lắng nghe Event. Dùng thư viện crypto sinh số ngẫu nhiên (1-100) để quyết định thành bại dựa trên ma trận tỷ lệ.
Bước 3: Reveal (On-chain): Server dùng ví Admin gọi hàm resolveFusion trả kết quả về Blockchain (Đúc chó mới hoặc hoàn trả chó + Mảnh hồn). Trải nghiệm mượt mà dưới 6 giây (2 blocks BSC).
5. 🤖 MAGIC PROMPT CHO CLAUDE DEV
Anh hãy copy toàn bộ khối lệnh dưới đây, dán vào Claude để yêu cầu nó quy hoạch và code toàn bộ hệ thống này từ Frontend, Backend đến Smart Contract.
📋 COPY ĐOẠN LỆNH DƯỚI ĐÂY DÁN VÀO CLAUDE:
Role: You are a Lead Web3 System Architect, Solidity Expert, and Senior React/NestJS Developer.
Context: We are building the "Soul Forge" (Gacha / Dog Fusion System) for the Web3 game "Bandit Buddy". This is a critical deflationary mechanism to burn $FARM tokens and low-tier NFTs. 
Security Constraint: To prevent mempool front-running and RNG manipulation, we MUST use a Commit-Reveal pattern with a Backend Oracle. Only on-chain NFT dogs (source = 'nft') can be used.

Objective: Implement the full technical stack for the Gacha Fusion feature based on the provided PRD logic.

Execution Requirements (Output clean, production-ready code):

TASK 1: Smart Contract (BanditDogFusion.sol - ERC1155)
Write the contract implementing the Commit-Reveal pattern.
- Function `requestFusion(uint256 baseTierId, bool useLuckyBone, bool useCollar)`: Deducts the $FARM fee + extra fees for boosters, burns 3 NFTs of `baseTierId`, saves request state, and emits `FusionRequested`.
- Function `resolveFusion(uint256 requestId, bool isSuccess, uint256 shardsToReward)`: Restricted to the `backendOracle` address. Handles minting the upgraded dog OR returning 1 base dog + Shards (ID 9999).
- Function `redeemShards()`: Burns 100 Shards to mint a random T3-T5 dog.

TASK 2: Backend Oracle Listener & RNG Logic (NestJS/TypeScript)
Write the worker that listens to the `FusionRequested` event.
- Use `crypto.randomBytes` for secure RNG (1-100).
- Apply the Success Matrix: T1->T2 (75%), T2->T3 (50%), T3->T4 (30%), T4->T5 (15%). Add +15% if `useLuckyBone` was true.
- Automatically call `resolveFusion` on the blockchain with the result. Ensure error handling and retry mechanisms.

TASK 3: Frontend Gacha Modal (React + Wagmi/Viem)
Write the React component `SoulForgeModal.tsx`.
- UI to select 3 Dogs of the same Tier from the inventory (filter by `source === 'nft'`).
- Toggles for Gacha Hooks: "Use Lucky Bone (50 $FARM)" and "Use Protection Collar".
- Dynamic cost and success rate display.
- Integration with Wagmi's `useWriteContract` to call `requestFusion`. Show a cool "Forging..." loading state while waiting for the Oracle to reveal the result.

Ensure all variables, modifiers (ReentrancyGuard), and event emissions are strictly optimized for gas on the BSC network.



