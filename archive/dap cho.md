User prompt: hãy rà soát lại tài liệu prd 1 và prd 2 sau đó hãy nghiên cứu tính năng gacha dog tôi upload mới này để lên giải pháp và đề xuất cho clude code
Response: Chào anh, dưới góc độ của một Senior System Architect, tôi đã rà soát lại toàn bộ kiến trúc từ PRD 1, PRD 2 và đối chiếu với vấn đề thực tế mà team dev đang gặp phải trong file gacha dog.md.
🚨 Chẩn đoán "Căn bệnh" của Hệ thống hiện tại
Sự cố phân mảnh giữa source = 'shop' và source = 'nft' xảy ra vì team Dev đang nhầm lẫn giữa 2 giai đoạn thiết kế của dự án:
Theo PRD gốc: Lò Đập Chó (Gacha Fusion) là hệ thống Web3 (Commit-Reveal Oracle). Người chơi phải đốt NFT cấp thấp + $FARM để ra NFT cấp cao.
Thực tế code hiện tại: Dev đã code một cái "Gacha Shop" thuần Web2 (mua bằng Vàng/Off-chain) và một hệ thống "NFT" riêng biệt. Sự tách biệt này sẽ phá nát hoàn toàn Tokenomics, vì nếu người chơi có thể dùng Vàng (GOLD) mua chó Web2 để bảo vệ farm, họ sẽ KHÔNG BAO GIỜ có động lực bỏ tiền thật mua $FARM để sở hữu NFT Chó Web3.
💡 Giải pháp Đề xuất: "Cây Cầu Web2.5" (Hybrid Bridge)
Không chọn 1 trong 3 Option mà Dev đưa ra, vì Option 1 làm Web3 trở nên vô dụng, Option 2 gây loạn Database, và Option 3 thì giết chết Quỹ dự án vì tiền Gas.
Giải pháp tối ưu nhất cho Bandit Buddy lúc này là Định nghĩa lại Phân cấp Tài sản bằng một "Cây cầu":
1. Tầng Web2 (Dành cho cày chay / Onboarding):
Giữ lại source = 'shop'. Đổi tên nó thành "Shop Chó Cỏ".
Người chơi dùng Vàng (GOLD) mua chó ở đây. Chó này bảo vệ farm bình thường, nhưng KHÔNG THỂ giao dịch trên Marketplace và KHÔNG THỂ mang đi đập (Fusion).
2. Cây Cầu Web3 (Cơ chế Minting / Tokenize):
Thêm một nút "Đúc NFT" (Mint to Web3) trên những con chó source = 'shop' trong túi đồ.
Người chơi phải trả một khoản phí nhỏ bằng $FARM (ví dụ: 10 $FARM). Smart Contract sẽ tự động gọi hàm mint() đúc con chó đó thành ERC-1155 NFT trên ví của họ. Đồng thời Backend xóa con chó Web2 đó khỏi Database.
3. Tầng Web3 (Gacha Fusion & Marketplace):
Bây giờ chó đã biến thành source = 'nft' (hàng on-chain thật).
Người chơi mới có thể đem nó lên chợ P2P để bán, hoặc đem 3 con NFT vào Lò đập chó (Fusion) để ra NFT cấp cao hơn như thiết kế trong PRD.
Cách tiếp cận này giữ chân được người chơi cày chay (F2P), nhưng bắt buộc họ phải tiêu hao $FARM nếu muốn kiếm tiền thật hoặc sở hữu chó xịn, giải quyết triệt để nút thắt Tokenomics.
📋 MAGIC PROMPT CHO CLAUDE
Hãy copy đoạn prompt dưới đây và gửi cho PM Claude. Prompt này sẽ yêu cầu Claude viết code refactor lại toàn bộ luồng logic để giải quyết vấn đề mà file gacha dog.md đang gặp phải.
Role: You are a Senior Web3 Game Architect and Full-Stack Developer (NestJS + React + Solidity).
Context: In our game "Bandit Buddy", we have a structural conflict identified in gacha dog.md. We currently have off-chain dogs (source = 'shop') and on-chain dogs (source = 'nft'). Off-chain dogs cannot be sold on the marketplace, confusing users because of a misleading UI text.
Objective: We will NOT merge the tables or force all gacha pulls to be on-chain. Instead, we will implement the "Web2.5 Bridge Architecture".
Please generate the specific code and execution plan for the following 3 tasks:
Task 1: Fix the UX Text & Marketplace Filter (Frontend - React)
Update the MarketplaceModal Sell Tab. Change the confusing text "Mint dogs via the Gacha machine, then sync in Settings" to "Only On-Chain NFT Guard Dogs can be listed here. Tokenize your in-game dogs via the Inventory."
Ensure the getNftStatus strictly filters and displays ONLY source = 'nft' items in the Sell tab.
Task 2: The "Mint to Web3" Bridge (Frontend & Backend)
React UI: In the player's Inventory, for dogs with source = 'shop', add a [Mint to NFT] button.
Backend API: Create a new endpoint POST /web3/tokenize-dog.
Logic: Verify user owns the off-chain dog. Deduct a flat fee of 10 $FARM (from their off-chain synced balance). Generate a cryptographic signature (ECDSA) authorizing the smart contract to mint 1 Tier 1 Dog NFT. Delete the off-chain dog from the DB (or mark status='tokenized'). Return the signature to the frontend.
Task 3: The Smart Contract Handler (Solidity)
In FarmToken.sol or BanditDogFusion.sol, write a function tokenizeDog(uint256 tier, uint256 nonce, bytes calldata signature) that verifies the backend's signature and mints the ERC-1155 NFT to the msg.sender (the user pays the gas for this mint, NOT the admin).
Output: Provide the React component updates, the NestJS controller/service logic for the signature generation, and the Solidity function. Explain how this preserves the Web3 tokenomics without draining the admin's gas funds.
Với chỉ đạo này, team code của anh sẽ giải quyết mượt mà vấn đề UX mà vẫn đảm bảo tính chặt chẽ của kinh tế Web3! Anh có muốn bàn thêm về mức phí $FARM dùng để "Đúc NFT" này không?

User prompt: Có tôi muốn bàn thêm về mức phí $FARM dùng để "Đúc NFT" này
Response: Mức phí $FARM dùng để "Đúc NFT" (Mint Fee) chính là "trạm thu phí" chiến lược nằm giữa hai nền kinh tế: Vàng (Off-chain) và $FARM (On-chain). Nếu thiết lập sai con số này, chúng ta sẽ mở ra một lỗ hổng chênh lệch giá (Arbitrage), khiến giới cày airdrop/bot dùng tool cày Vàng mua chó Web2, đúc ra NFT với giá rẻ mạt và xả ngập chợ P2P.
Dưới đây là bài toán thiết kế chi tiết để anh giao cho anh Nguyễn Mạnh Dũng thiết lập ngay vào Smart Contract.
1. Phân Tích Mỏ Neo Giá Trị (Value Anchoring)
Hãy nhìn lại Bảng giá Đập Chó (Gacha Fusion) mà chúng ta đã chốt:
Ghép 3 Chó Tier 1 -> Tier 2: Tốn 20 $FARM.
Với chi phí đập là 20 $FARM, giá trị nội tại (Intrinsic Value) của một con Chó Tier 1 trên chợ P2P sẽ rơi vào khoảng 10 đến 15 $FARM.
Đề xuất: Mức phí đúc (Mint Fee) cho một con Chó Web2 (Tier 1) nên được chốt cứng ở mức 15 $FARM.
2. Tác Động Bình Ổn Giá Sàn (Floor Price Stabilizer)
Việc đặt mức phí đúc là 15 $FARM sẽ tự động biến nó thành một "Cơ quan điều phối thị trường" (Market Maker) vô hình cực kỳ thông minh:
Kịch bản 1 (Khi chợ P2P khan hiếm): Nếu giá Chó Tier 1 trên chợ bị đẩy lên 20 $FARM, người chơi F2P sẽ thấy đúc NFT có lợi hơn. Họ sẽ lấy chó Web2 trong túi, trả 15 $FARM cho hệ thống để đúc, sau đó đem lên chợ bán. Kết quả: Lượng $FARM khổng lồ bị hệ thống thu hồi (Sink) và đốt đi, chống lạm phát token.
Kịch bản 2 (Khi chợ P2P bán tháo): Nếu có người xả hàng, bán Chó Tier 1 với giá 8 $FARM. Người chơi sẽ dừng việc đúc (vì đúc tốn 15 $FARM). Thay vào đó, họ sẽ mua gom Chó Tier 1 trên chợ để đem đi đập (Fusion) lên Tier 2. Kết quả: Lượng cung NFT rác trên chợ bị dọn sạch nhanh chóng, giá sàn tự động phục hồi về mốc 15 $FARM mà dự án không cần bỏ tiền ra can thiệp.
3. Thiết Kế Luồng Dòng Tiền (Revenue Routing)
Khoản phí 15 $FARM này tuyệt đối không được để kẹt trong ví Admin hay ví Backend. Anh hãy yêu cầu team Dev cấu hình theo luồng sau trong Smart Contract:
Người chơi gọi hàm đúc (thông qua Backend Signature).
Smart Contract trừ 15 $FARM từ ví người chơi.
100% số $FARM này được gửi thẳng vào địa chỉ 0xdead (Đốt vĩnh viễn) hoặc gửi vào TreasuryBuyBack.sol.
Điều này tạo ra một "Bằng chứng giảm phát" (Proof of Deflation) hiển thị ngay trên Blockchain. Cộng đồng sẽ thấy tổng cung $FARM liên tục giảm đi mỗi khi có một F2P user chuyển đổi sang Web3, tạo hiệu ứng FOMO (Sợ bỏ lỡ) cực mạnh cho giá token.
4. Gợi Ý Bổ Sung: Combo "Mồi Nhử" Tâm Lý
Để kích thích người chơi cày chay đốt $FARM nhanh hơn, chúng ta có thể thiết kế một gói "Bulk Minting" (Đúc sỉ) trong UI/UX của Inventory:
Đúc 1 Chó Web2 thành NFT: Tốn 15 $FARM.
Đúc 3 Chó Web2 cùng lúc: Tốn 40 $FARM (Giảm giá 5 $FARM).
Khi người chơi đúc cùng lúc 3 con chó, tâm lý tiếp theo của họ sẽ là gì? Chính xác, họ sẽ tò mò bước thẳng sang Lò Đập Chó (Fusion) để trải nghiệm việc ghép 3 con Tier 1 thành Tier 2, từ đó kích hoạt hoàn hảo chu kỳ tiêu hao của game.
Cơ chế "Đúc Sỉ" này có phù hợp để thêm ngay vào giao diện (React UI) của Sprint 3 
