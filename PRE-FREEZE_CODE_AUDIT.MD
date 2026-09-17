User prompt: - Trước khi đi vào chính thức Đóng băng Code (Code Freeze) toàn bộ hệ thống hãy viết cho tôi promt để yêu cầu claude dev hệ thống lại toàn bộ chức năng để tiến hày audit và qa để fix toàn bộ bug
Response: Đây là một quyết định mang tính sinh tử và thể hiện sự cẩn trọng tuyệt vời của một người làm Product thực thụ. Trước khi ấn nút "Code Freeze" (Đóng băng mã nguồn), việc thực hiện một đợt Tổng rà soát (Comprehensive Audit) toàn bộ hệ thống từ Frontend, Backend đến Smart Contract là lớp khiên cuối cùng để ngăn chặn thảm họa ngày Launch.
Để Claude có thể "quét" toàn bộ dự án với tư duy của một Chuyên gia Kiểm thử (QA) và Hacker Mũ Trắng, anh cần một "Magic Prompt" ép AI này phải rà soát chéo các lỗ hổng về Race Condition (Tranh chấp dữ liệu), Exploit kinh tế, và các điểm mù tích hợp Web2.5.
Anh hãy copy đoạn lệnh dưới đây, đính kèm toàn bộ thư mục code (hoặc cấp quyền truy cập GitHub repo cho Claude) và dán vào:
📋 COPY ĐOẠN LỆNH DƯỚI ĐÂY DÁN VÀO CLAUDE:
Role: You are a Principal Security Auditor, Lead QA Automation Engineer, and Senior Web3 System Architect. 
Context: We are hours away from executing a strict "Code Freeze" for our Web3 Telegram Mini App game, "Bandit Buddy" (Stack: React, NestJS, PostgreSQL, Solidity). Before we freeze, we must perform a 360-degree, end-to-end security and quality assurance (QA) audit to identify and fix all hidden bugs, integration gaps, and economic exploits.

Objective: Deeply analyze the entire codebase (Smart Contracts, Backend Services, Frontend Components, and Database Schemas). Do not build new features. Your sole job is to AUDIT, BREAK the system mentally, and FIX the bugs.

Execution Steps:

PHASE 1: Smart Contract Security & Edge Cases
Audit `BanditMarket.sol`, `BanditDogFusion.sol`, `TreasuryBuyBack.sol`, and `GuildStaking.sol`.
- Verify Reentrancy guards on ALL external payable/transfer functions.
- Check EIP-712 implementation for Signature Replay vulnerabilities (nonce tracking).
- Audit the 75-15-10 BNB revenue splitter logic in Gacha. Does it handle reverts gracefully if the referrer's wallet rejects native BNB?
- Check the `swapExactETHForTokensSupportingFeeOnTransferTokens` in Auto-Buyback for slippage/deadline vulnerabilities.

PHASE 2: Backend Integrity & High-Concurrency (NestJS + PostgreSQL)
- Audit the database transactions. Are `SERIALIZABLE` isolation levels and `SELECT ... FOR UPDATE` row-level locks correctly applied in `ActionService.steal()`, `GuildService.waterTree()`, and the `Indexer/Worker` to prevent Race Conditions?
- Audit the Blockchain Indexer (Event Listener). Is the idempotency logic bulletproof? (i.e., making sure a `tx_hash` is never processed twice, even if the node resyncs).
- Verify the Web2.5 Bridge (`POST /web3/tokenize-dog`): Are we deleting/locking the off-chain dog BEFORE issuing the ECDSA signature to prevent double-minting?

PHASE 3: Frontend Web3 UX & Error Handling (React + Wagmi)
- Review the 2-step In-App Swap (USDT to $FARM) and Gacha Modal. Are there proper loading states, disables on buttons, and error boundaries if a user rejects the MetaMask/Wallet signature?
- Review the WebSocket `EventsGateway`. Does the React client handle automatic reconnections if the Telegram app goes to sleep?

PHASE 4: Generate the "Pre-Freeze Audit & Fix Report"
Output a structured report categorizing findings into:
1. [CRITICAL] Security & Exploit Bugs
2. [HIGH] Concurrency & Data Integrity Bugs
3. [MEDIUM] UI/UX & Web3 Integration Bugs

For EACH bug found, you MUST provide:
- The Root Cause.
- The specific File Name.
- The exact, ready-to-copy Code Snippet to fix it.

Take a deep breath, analyze the system architecture rigorously, and give me the final audit report to patch this system before Code Freeze.


💡 Hướng dẫn cho Tech Lead (Nguyễn Mạnh Dũng) sau khi chạy Prompt này:
Không Auto-Merge (Trộn code tự động): Khi Claude nhả ra danh sách các lỗi và đoạn code fix, team Dev không được copy-paste nhắm mắt. Anh Dũng phải review từng cục code fix xem nó có gây ảnh hưởng phụ (side-effect) đến các logic khác không.
Kiểm tra chéo (Cross-check): Nếu Claude báo lỗi ở phần Indexer chống xử lý trùng (Idempotency) hoặc Row-level Lock ở hàm Ăn Trộm, đây là những lỗi Critical (Nghiêm trọng), phải ưu tiên fix ngay lập tức vì nó liên quan trực tiếp đến việc user có thể hack nhân bản vật phẩm hay không.
Chạy lại Test Suite: Sau khi áp dụng toàn bộ các bản vá lỗi của Claude, team phải chạy lại lệnh npx hardhat test và npm run test (cho Backend). Nếu kết quả trả về xanh (100% Pass), lúc đó chúng ta mới chính thức gắn tag v1.0.0-rc (Release Candidate) và khóa repo.
Anh cứ chạy thử prompt này với Claude, bảo đảm nó sẽ "bới lông tìm vết" ra được những góc khuất kỹ thuật mà trong lúc code nhanh anh em Dev có thể đã bỏ sót!
