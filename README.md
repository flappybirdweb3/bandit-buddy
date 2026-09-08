# Barn Buddy Web3

A server-authoritative Play-to-Earn farming game running as a **Telegram Mini App** on **BNB Smart Chain**.

Players plant crops, harvest yields, and steal from friends — all governed by a backend that holds the keys, so no client-side cheating is possible.

---

## Architecture overview

```
Telegram Client (Mini App)
        │  Telegram initData (HMAC-SHA256)
        ▼
  NestJS Backend  ◄──── PostgreSQL (game state + row locks)
        │                Redis (rate limiting)
        │  ECDSA signature (ethers v6)
        ▼
  BNB Smart Chain
    ├── FarmToken.sol        (ERC-20, 1B supply, burnable, permit)
    ├── FarmTokenClaim.sol   (signature-gated GOLD→FARM bridge)
    └── GuardDogNFT.sol      (ERC-1155, 6 breeds, defense power)
```

- **No client trust.** All game logic (times, RNG, balances) runs on the backend.
- **Dual currency.** Off-chain GOLD (PostgreSQL decimal) ↔ on-chain $FARM (ERC-20).
- **Race-condition safe.** Steal endpoint uses PostgreSQL `SELECT … FOR UPDATE` inside a SERIALIZABLE transaction.

---

## Repository layout

```
barnbuddy/
├── docker-compose.yml          # postgres:16 + redis:7 + backend
├── .env.example                # all required env vars
│
├── backend/                    # NestJS game server
│   ├── src/
│   │   ├── modules/
│   │   │   ├── action/         # plant / harvest / steal / claim-signature
│   │   │   ├── farm/           # farm state, NFT guard-dogs
│   │   │   ├── user/           # profile
│   │   │   └── web3/           # ECDSA claim-signature
│   │   ├── common/
│   │   │   └── guards/         # Telegram initData validator
│   │   ├── config/             # game constants
│   │   └── database/           # TypeORM + migrations
│   └── Dockerfile
│
├── frontend/                   # React + Vite + Phaser 3
│   └── src/
│       ├── game/               # Phaser scenes + EventBus
│       ├── providers/          # Wagmi, React Query, GameProvider
│       ├── hooks/              # useClaimTokens (on-chain flow)
│       └── components/         # modals: Seed, Steal, Friends, Claim
│
└── contracts/                  # Hardhat + OpenZeppelin v5
    ├── src/                    # Solidity contracts
    ├── test/                   # 75 Hardhat tests
    └── scripts/                # deploy / verify / fundPool / rotateSigner
```

---

## Game mechanics

### Crops

| Name    | Cost (GOLD) | Grow time | Base yield | Max steal |
|---------|-------------|-----------|------------|-----------|
| Wheat   | 10          | 5 min     | 15         | 3.0       |
| Carrot  | 25          | 15 min    | 40         | 8.0       |
| Corn    | 50          | 1 h       | 100        | 20.0      |
| Tomato  | 100         | 2 h       | 220        | 44.0      |
| Pumpkin | 200         | 4 h       | 480        | 96.0      |

Each crop can only be stolen up to **20 %** of its base yield in total before it's protected.

### Steal mechanic

```
success_rate = max(0, 80 - victim_total_defense_power)
```

On **success**: thief gains 5 % of base yield, victim loses the same, thief spends 10 energy.  
On **failure** (dog bite): thief loses 20 energy + 5 % of own GOLD balance, victim receives that penalty as a bonus.

### Guard Dog NFTs (ERC-1155)

| # | Breed       | Defense | Price ($FARM) | Max supply |
|---|-------------|---------|---------------|------------|
| 1 | Chihuahua   | 10 %    | 50            | 10,000     |
| 2 | Corgi       | 20 %    | 100           | 5,000      |
| 3 | Husky       | 35 %    | 200           | 3,000      |
| 4 | Rottweiler  | 50 %    | 500           | 1,000      |
| 5 | Doberman    | 65 %    | 1,000         | 500        |
| 6 | Pitbull     | 80 %    | 2,000         | 100        |

Defense powers **stack** across breeds (and quantities) but are **capped at 80**, making a fully-guarded farm effectively unstealable.

### GOLD → $FARM bridge

1. Player calls `POST /web3/claim-signature { amountToClaim }`.
2. Backend checks `trust_score ≥ 30`, deducts GOLD, signs `keccak256(address, amountWei, nonce)`.
3. Player submits the signature to `FarmTokenClaim.claimTokens()` on-chain.
4. Contract verifies ECDSA, marks nonce as used, transfers $FARM.

---

## API reference

All endpoints require `Authorization: Bearer <jwt>` (issued after Telegram initData validation).

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/user/profile` | — | Gold, energy, trust_score, plot count |
| GET | `/farm/:userId` | — | All plots with crop status for any user |
| POST | `/action/plant` | `{ plotId, seedId }` | Plant a seed; deducts GOLD |
| POST | `/action/harvest` | `{ plotId }` | Harvest ripe crop; adds GOLD |
| POST | `/action/steal` | `{ targetUserId, plotId }` | Steal from a ripe plot |
| POST | `/web3/claim-signature` | `{ amountToClaim }` | Get ECDSA sig for on-chain claim |

Rate limit on `/action/steal`: **3 req / sec / user** (ThrottlerGuard named throttler).

---

## Smart contracts

### FarmToken (ERC-20)

- Symbol: `FARM` — 1,000,000,000 max supply, fully minted to deployer
- ERC-20Burnable: `buyDog()` burns tokens by default
- ERC-20Permit (EIP-2612): gasless approvals
- Pausable: owner can freeze all transfers in an emergency

### FarmTokenClaim

- Signature-gated pool: backend signs, player claims
- CEI pattern + `nonReentrant`
- Per-(address, nonce) replay protection
- Configurable min/max claim bounds (default 1 – 100,000 FARM)
- `emergencyWithdraw` for pool recovery
- `hashMessage()` view helper for backend/test verification

### GuardDogNFT (ERC-1155)

- 6 fixed breeds with immutable defense power and max supply
- `burnOnPurchase = true` by default (deflationary)
- `totalDefensePower(address)` view for backend sync
- Admin: `mintTo` for airdrops, `setPrice`, `setTreasury`, pause

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Game server | NestJS 10, TypeScript, TypeORM 0.3 |
| Database | PostgreSQL 16 |
| Cache / rate-limit | Redis 7 |
| Auth | Telegram initData HMAC-SHA256 + JWT |
| Web3 signing | ethers.js v6 |
| Frontend | React 18, Vite 5, Phaser 3, Wagmi v2 |
| Smart contracts | Solidity 0.8.24, OpenZeppelin 5, Hardhat |
| Chain | BNB Smart Chain (BSC) |
