Tôi đã đọc kỹ toàn bộ tài liệu PRD, SRS và các đặc tả kỹ thuật hệ thống mà bạn đã tổng hợp. Bộ tài liệu này rất hoàn chỉnh, logic chặt chẽ và đã giải quyết được những bài toán hóc búa nhất của Game Web3 trên Telegram (như chống Bot bằng Trust Score, chống lạm phát bằng Dual-currency, và xử lý Race Condition bằng Row-level lock).

Dưới đây là **"Siêu Prompt" (Master Prompt)** được thiết kế để bạn copy và dán trực tiếp vào Claude. Prompt này đóng gói toàn bộ kiến trúc của bạn thành ngữ cảnh hệ thống (System Context), sau đó giao cho Claude nhiệm vụ triển khai dự án một cách đồng bộ.

*(Lưu ý: Để tuân thủ nguyên tắc trích dẫn, văn bản dưới đây có chứa các thẻ `[cite: 1]`. Bạn hãy xóa các thẻ này trước khi dán vào Claude để câu lệnh được tự nhiên nhất).*

---

### 📋 COPY NỘI DUNG BÊN DƯỚI DÁN VÀO CLAUDE:

**Role:** You are an Expert Full-Stack Web3 Game Developer & Solutions Architect.

**PROJECT CONTEXT:**
I am building "Barn Buddy Web3" (Code name: FarmHeist), a Play-to-Earn farming game playable as a Telegram Mini App (TMA) on the BNB Smart Chain (BSC).

* **Vision:** Recreate the classic "plant and steal" mechanic on Web3.


* **Goals:** Reach 100k users via viral stealing mechanics on Telegram, load under 3 seconds, and strictly optimize gas fees. On-chain interactions are reserved ONLY for token deposits/withdrawals and minting NFTs.



**CORE MECHANICS & ECONOMY:**

* **Dual-Currency:** Off-chain "GOLD" (soft currency) and On-chain "$FARM" token. GOLD is exchanged for $FARM via an Oracle Server.


* **Farming Loop:** Players start with 6 grid plots (upgradable via GOLD). They plant seeds with varying grow times and ROIs, wait for the countdown, and harvest to earn GOLD.


* **Stealing (Viral Mechanic):** Players access their Telegram friend list, visit farms, and spend "Energy" to steal up to 20% of the yield from ripe crops.


* **Defense:** Players use $FARM to buy NFT Guard Dogs (ERC-1155). These NFTs have `defense_power` metadata. If a thief is bitten by the dog, they lose Energy and drop GOLD into the victim's account.



**SYSTEM ARCHITECTURE (STRICT GUIDELINES):**
We use a **Server-Authoritative** architecture to prevent cheating.

* **Frontend:** Phaser 3 (2D Tilemap) + React/Vite + `@twa-dev/sdk`.


* **Backend:** Node.js/NestJS + PostgreSQL + Redis (Cache).


* **Web3 Integration:** Single-token model ($FARM) + Off-chain GOLD.



**ESTABLISHED CODEBASE & LOGIC (DO NOT REINVENT, ADHERE TO THESE):**

**1. Database Schema (PostgreSQL):**

* `users`: id, telegram_id, wallet_address, gold_balance, energy, trust_score, nonce.


* `seed_configs`: id, name, cost_gold, grow_time_sec, base_yield.


* `farm_plots`: id, user_id, plot_index, seed_id, planted_at, harvestable_at, total_stolen, last_stolen_at.


* `steal_logs`: id, thief_id, victim_id, amount, created_at.



**2. Anti-Cheat & Steal Logic:**

* **Time Management:** Client `setInterval` is ONLY for UI. Backend strictly compares `Date.now() >= harvest_time` on `/harvest` calls.


* **Race Condition Prevention:** The `/action/steal` API must use PostgreSQL Row-level lock (`SELECT * FROM farm_plots WHERE id = ? FOR UPDATE`) or Redis Lock.


* **RNG:** Base steal success is 80%. Backend calculates: 80% minus Victim's Dog Defense Power.



**3. Web3 Token Claiming (Ethers.js v6 + Solidity):**

* The Backend checks the user's `trust_score` (Anti-bot). If valid, it generates an ECDSA signature using `ethers.solidityPackedKeccak256` containing `(userAddress, amountWei, nonce)`.


* The Smart Contract (`FarmTokenClaim`) uses OpenZeppelin v5.0+ (`ECDSA`, `MessageHashUtils`, `ReentrancyGuard`) to `recover` the signature. It verifies the signer against the Admin Wallet.


* The Frontend uses Wagmi + Web3Modal to fetch the payload from `/web3/claim-signature` and executes `writeContract`.



**YOUR TASK:**
Act as the Lead Developer. I want you to start scaffolding the backend first.
Please write the complete production-ready code for the `/action/steal` API endpoint (using Node.js/Express or NestJS). Ensure you explicitly implement:

1. The PostgreSQL Transaction with the `FOR UPDATE` row-level lock.


2. The logic to check if `total_stolen` exceeds 20%.


3. The RNG logic that incorporates the NFT Guard Dog deduction and processes the win/loss scenarios (deducting energy, transferring GOLD, and logging to `steal_logs`).