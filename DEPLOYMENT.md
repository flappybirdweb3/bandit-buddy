# Deployment Guide

Step-by-step instructions for spinning up Barn Buddy from a fresh server to a live Telegram Mini App on BSC.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20 LTS | `nvm install 20` |
| npm | 10+ | bundled with Node 20 |
| Docker + Docker Compose | 24+ / 2.24+ | for local infra |
| Git | any | |
| A Telegram Bot | — | create via [@BotFather](https://t.me/BotFather) |
| A BSC wallet (admin) | — | funded with BNB for gas |
| BSCScan API key | — | for contract verification |
| WalletConnect Project ID | — | from cloud.walletconnect.com |

---

## 1. Clone and configure

```bash
git clone <repo-url> barnbuddy
cd barnbuddy
cp .env.example .env
```

Edit `.env` and fill in every value — see the table below.

### Environment variables

| Variable | Where to get it | Example |
|----------|----------------|---------|
| `NODE_ENV` | — | `production` |
| `PORT` | — | `3000` |
| `DB_HOST` | Docker service name or host | `postgres` |
| `DB_PORT` | — | `5432` |
| `DB_NAME` | — | `barnbuddy` |
| `DB_USER` | — | `barnbuddy` |
| `DB_PASSWORD` | choose a strong password | `s3cr3t!` |
| `REDIS_HOST` | Docker service name or host | `redis` |
| `REDIS_PORT` | — | `6379` |
| `TELEGRAM_BOT_TOKEN` | BotFather `/newbot` | `123456:ABC…` |
| `JWT_SECRET` | generate: `openssl rand -hex 32` | `a1b2c3…` |
| `SIGNER_PRIVATE_KEY` | export from admin wallet | `0xdeadbeef…` |
| `BSC_RPC_URL` | public or private RPC | `https://bsc-dataseed.binance.org/` |
| `FARM_TOKEN_ADDRESS` | after contract deploy | `0xABC…` |
| `CLAIM_CONTRACT_ADDRESS` | after contract deploy | `0xDEF…` |
| `NFT_CONTRACT_ADDRESS` | after contract deploy | `0xGHI…` |
| `MIN_TRUST_SCORE` | anti-bot threshold | `30` |

> **Never commit `.env`** — it contains the signer private key.

---

## 2. Local development

### Start infra (Postgres + Redis)

```bash
docker compose up postgres redis -d
```

### Install backend dependencies

```bash
cd backend
npm install
```

### Run database migrations

```bash
npm run migration:run
```

This creates all five tables and seeds the five crop configs.

### Start backend in watch mode

```bash
npm run start:dev
```

Backend listens on `http://localhost:3000`.

### Install and start frontend

```bash
cd ../frontend
npm install
npm run dev
```

Frontend dev server at `http://localhost:5173`.

Copy `frontend/.env.example` to `frontend/.env` and fill in:

```bash
VITE_WALLETCONNECT_PROJECT_ID=<your_project_id>
VITE_CLAIM_CONTRACT_ADDRESS=<deployed_claim_contract>
```

---

## 3. Smart contracts

### Install dependencies

```bash
cd contracts
npm install
```

### Compile and run tests

```bash
npm run compile
npm test          # 75 tests, ~3 s
```

### Deploy to BSC Testnet

Ensure `.env` (in the root) has `SIGNER_PRIVATE_KEY` set and the wallet has testnet BNB.

Get testnet BNB from: https://testnet.bnbchain.org/faucet-smart

```bash
# From contracts/
npm run deploy:testnet
```

Output:

```
Deploying with: 0xYourAddress
Balance: 0.5 BNB
FarmToken deployed:      0xAAA…
FarmTokenClaim deployed: 0xBBB…
GuardDogNFT deployed:    0xCCC…
Claim pool funded with 100,000 FARM
Deployment saved to deployment.bscTestnet.json
```

Copy the three addresses into root `.env`.

**Optional:** set a dedicated treasury address before deploying:

```bash
TREASURY_ADDRESS=0xMultiSig… npm run deploy:testnet
```

### Verify on BSCScan

Add `BSCSCAN_API_KEY` to `.env`, then:

```bash
npm run verify:testnet
```

The script reads `deployment.bscTestnet.json` automatically. If the signer key used during deploy was a separate wallet, also set:

```bash
CLAIM_SIGNER_ADDRESS=0xBackendWallet… npm run verify:testnet
```

### Fund the claim pool later

```bash
# Add 500,000 FARM to the pool
FUND_AMOUNT=500000 npm run fund-pool
```

### Rotate the backend signer key

After updating `SIGNER_PRIVATE_KEY` in the backend `.env`:

```bash
NEW_SIGNER_ADDRESS=0xNewBackendWallet… npm run rotate-signer
```

Then restart the backend so it picks up the new key.

---

## 4. Docker production build

The `docker-compose.yml` builds and runs the backend in one step:

```bash
# From repo root
docker compose up --build -d
```

This starts:
- `barnbuddy_postgres` — Postgres 16 on port 5432
- `barnbuddy_redis` — Redis 7 on port 6379
- `barnbuddy_backend` — NestJS on port 3000 (waits for DB + Redis healthchecks)

Check logs:

```bash
docker compose logs -f backend
```

Run migrations inside the container:

```bash
docker compose exec backend npm run migration:run
```

### Backend Dockerfile (multi-stage)

```
builder  → npm install → nest build → dist/
runner   → npm install --omit=dev → copy dist/ → node dist/main
```

---

## 5. Frontend build and deploy

```bash
cd frontend
npm run build   # output: dist/
```

Deploy `frontend/dist/` to any static host (Cloudflare Pages, Vercel, S3+CloudFront, Nginx).

The Mini App URL must be HTTPS — Telegram rejects plain HTTP.

### Vite environment variables

Set these in the hosting platform's environment (or create `frontend/.env.production`):

```bash
VITE_WALLETCONNECT_PROJECT_ID=<your_project_id>
VITE_CLAIM_CONTRACT_ADDRESS=<claim_contract_on_mainnet>
```

### Register the Mini App with BotFather

```
/newapp
→ select your bot
→ enter your HTTPS frontend URL
→ BotFather returns a t.me/<bot>/app link
```

Set the Mini App URL to your deployed frontend. Players open the game via that link; Telegram injects `window.Telegram.WebApp.initData` which the backend validates.

---

## 6. Mainnet deploy

Switch every testnet reference to mainnet:

```bash
# contracts/
npm run deploy:mainnet
npm run verify:mainnet

# docker-compose or hosting env
NODE_ENV=production
BSC_RPC_URL=https://bsc-dataseed.binance.org/
```

Recommended mainnet checklist:

- [ ] `SIGNER_PRIVATE_KEY` is a **dedicated backend wallet**, not a personal wallet
- [ ] `TREASURY_ADDRESS` is a multisig (Gnosis Safe)
- [ ] `DB_PASSWORD` and `JWT_SECRET` are random 32+ char strings
- [ ] Backend behind a reverse proxy (Nginx / Caddy) with TLS
- [ ] `MIN_TRUST_SCORE=30` enforced (already the default)
- [ ] `burnOnPurchase=true` on GuardDogNFT (already the default)
- [ ] Confirm `poolBalance` on `FarmTokenClaim` is funded before launch

---

## 7. Operational runbook

### Emergency: pause all claims

```bash
# Call pause() on FarmTokenClaim via Hardhat console
npx hardhat console --network bscMainnet
> const c = await ethers.getContractAt('FarmTokenClaim', process.env.CLAIM_CONTRACT_ADDRESS)
> await c.pause()
```

Or add an admin endpoint in the backend to call `pause()` programmatically.

### Emergency: drain claim pool

```bash
npx hardhat console --network bscMainnet
> const c = await ethers.getContractAt('FarmTokenClaim', '0x…')
> await c.emergencyWithdraw(await c.poolBalance())
```

### Rotate backend signer (key compromise)

1. Generate a new wallet: `cast wallet new` (Foundry) or any wallet tool.
2. Update `SIGNER_PRIVATE_KEY` in the backend `.env`.
3. Run `NEW_SIGNER_ADDRESS=0xNew… npm run rotate-signer --network bscMainnet`.
4. Restart the backend.

### Revert a database migration

```bash
cd backend
npm run migration:revert
```

### Monitor steal rate

The steal endpoint is throttled to **3 req / sec / user** via `@nestjs/throttler`. Watch for 429 spikes in backend logs — a flood of 429s from one Telegram ID indicates a bot.

---

## 8. Folder-by-folder dependency install order

If starting from a clean checkout (no `node_modules` anywhere):

```bash
# 1. contracts
cd contracts && npm install

# 2. backend
cd ../backend && npm install

# 3. frontend
cd ../frontend && npm install
```

No root-level `package.json` — each sub-project is independent.

---

## 9. Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `mcopy opcode not found` | EVM version < cancun | `evmVersion: 'cancun'` in hardhat.config.ts (already set) |
| `InvalidSignature` on-chain | Backend/contract nonce mismatch | Verify `user.nonce` in DB matches what was signed; check `hashMessage()` view |
| `getaddrinfo ENOTFOUND postgres` | Backend can't reach DB | Check `DB_HOST` matches Docker service name |
| `Throttling limit exceeded` | >3 steal calls/sec | Intended; use exponential back-off in client |
| `Trust score too low` | `trust_score < MIN_TRUST_SCORE` | New accounts start at 50; score rises with normal gameplay |
| `Already Verified` on BSCScan | Re-running verify after success | Safe to ignore — script handles this gracefully |
