# Independent QA Audit Report — BanditBuddy Backend
**Date:** 2026-09-17  
**Scope:** Full backend codebase audit (`/home/ubuntu/barnbuddy/backend/src/`)  
**Method:** Independent code review, không dựa vào pre-freeze audit report có sẵn  
**Total bugs found:** 8  
**Total bugs fixed:** 8  
**Status:** ALL FIXED & DEPLOYED ✅

---

## Tóm tắt

| # | Severity | Module | Bug | Status |
|---|---|---|---|---|
| 1 | CRITICAL | `app.module.ts` | ThrottlerGuard không được đăng ký — rate limiting bị vô hiệu hóa toàn bộ | ✅ Fixed |
| 2 | CRITICAL | `auth.service.ts` | `isDev` bypass cho phép forge session bất kỳ userId | ✅ Fixed |
| 3 | CRITICAL | `web3-admin.controller.ts` | `GET /admin/dex-status` không có authentication | ✅ Fixed |
| 4 | HIGH | `api/client.ts` (frontend) | Header `x-telegram-init-data` bị block bởi Telegram proxy | ✅ Fixed |
| 5 | HIGH | `action.controller.ts` | `@SkipThrottle()` trên steal endpoint — rate limit bị bypass | ✅ Fixed |
| 6 | HIGH | `user.service.ts` | `claimDaily()` TOCTOU race — double daily reward | ✅ Fixed |
| 7 | MEDIUM | `action.service.ts` | `water()` TOCTOU race — two concurrent waters both succeed | ✅ Fixed |
| 8 | MEDIUM | `farm.service.ts` | `upgradePlot()` TOCTOU race — double gold charge for one upgrade | ✅ Fixed |

---

## Chi tiết từng bug

---

### Bug #1 — [CRITICAL] ThrottlerGuard không được đăng ký

**File:** `backend/src/app.module.ts`  
**Impact:** Rate limiting bị vô hiệu hóa hoàn toàn cho tất cả endpoints — bots có thể spam không giới hạn

**Root cause:**  
`providers: []` — `ThrottlerGuard` không được bind vào `APP_GUARD`, nên tất cả decorator `@Throttle()` và `@SkipThrottle()` trên toàn bộ controller là dead code.

**Before:**
```typescript
providers: [],
```

**After:**
```typescript
providers: [
  {
    provide: APP_GUARD,
    useClass: ThrottlerGuard,
  },
],
```

**Why dangerous:** Endpoint `/action/steal` được thiết kế giới hạn 3 req/giây/user, nhưng thực tế không có giới hạn nào. Bot có thể steal liên tục với tốc độ không giới hạn.

---

### Bug #2 — [CRITICAL] `isDev` bypass trong AuthService

**File:** `backend/src/modules/auth/auth.service.ts`  
**Impact:** Bất kỳ ai cũng có thể tạo session với userId tùy ý nếu `TELEGRAM_BOT_TOKEN` không được set

**Root cause:**  
`validateInitData()` có nhánh `isDev` skip HMAC validation khi `botToken` không tồn tại. Vì `POST/GET /auth/session` là public endpoint (không cần guard), kẻ tấn công chỉ cần call endpoint này với userId bất kỳ để lấy JWT token hợp lệ.

**Before:**
```typescript
if (!botToken || isDev) {
  return { telegramUser: { id: userId, ... }, startParam: null };
}
```

**After:**
```typescript
if (!botToken || botToken === 'your_telegram_bot_token_here') {
  return { telegramUser: null, startParam: null }; // FAIL CLOSED
}
// proceed with full HMAC validation
```

**Why dangerous:** Attacker có thể impersonate bất kỳ user nào, bao gồm cả admin accounts hoặc rich accounts, để drain gold/steal crops.

---

### Bug #3 — [CRITICAL] `GET /admin/dex-status` không có authentication

**File:** `backend/src/modules/web3/web3-admin.controller.ts`  
**Impact:** Bất kỳ ai cũng có thể query DEX price, kill switch status, và treasury balances

**Root cause:**  
Controller không có `@UseGuards()`, không có passcode check. Endpoint trả về thông tin nhạy cảm:
- FARM token price (USD + BNB)
- Kill switch status + reason
- Treasury FARM balance
- Treasury BNB balance
- Tax collected 24h

**Before:**
```typescript
@Get('dex-status')
async getDexStatus() {
  // no auth check
  return { farmPriceUsd: ..., killSwitchActive: ..., treasuryBnbBalance: ... };
}
```

**After:**
```typescript
@Get('dex-status')
async getDexStatus(@Query('p') p: string) {
  if (!this.passcode || p !== this.passcode) {
    throw new UnauthorizedException('Invalid admin passcode');
  }
  return { ... };
}
```

**Note:** Pattern nhất quán với `AdminController` — passcode từ `config.get('admin.passcode')`.

---

### Bug #4 — [HIGH] Connection error cho Telegram proxy accounts

**File:** `frontend/src/api/client.ts`  
**Impact:** Users dùng Telegram Desktop qua proxy (VPN/corporate proxy) không thể connect

**Root cause:**  
Client gửi auth qua custom header `x-telegram-init-data`. Một số Telegram proxy và corporate firewalls block custom headers. Kết quả: kraken404, charon39 và các proxy accounts luôn nhận lỗi 401.

**Before:**
```typescript
const headers = initData
  ? { 'x-telegram-init-data': initData }
  : {};
```

**After:**
```typescript
// GET /auth/session?d=<base64> — no custom headers needed
// Server returns { ok: true, token: uuid }
// Subsequent requests use standard Authorization header
const authHeader = _sessionToken
  ? { Authorization: `Bearer ${_sessionToken}` }
  : initData
  ? { 'x-telegram-init-data': initData }  // fallback
  : {};
```

**Flow mới:**
1. App khởi động → `GET /auth/session?d=<base64(initData)>` (no custom headers, passes any proxy)
2. Server trả về `{ ok: true, token: "uuid-v4" }` + set cookie
3. Client lưu token vào memory
4. Mọi request sau dùng `Authorization: Bearer <token>` (standard header, RFC 7235)
5. Nếu nhận 401 → reset token, re-authenticate

---

### Bug #5 — [HIGH] `@SkipThrottle()` trên steal endpoint

**File:** `backend/src/modules/action/action.controller.ts`  
**Impact:** Rate limiting bị bypass trên endpoint nguy hiểm nhất — bots có thể steal không giới hạn

**Root cause:**  
Steal endpoint (mục tiêu của bots) được đánh dấu `@SkipThrottle()` thay vì giới hạn chặt hơn.

**Before:**
```typescript
@SkipThrottle()
@Post('steal')
async steal(...) { ... }
```

**After:**
```typescript
@Throttle({ steal: { limit: 3, ttl: 1000 } })
@Post('steal')
async steal(...) { ... }
```

Named throttler `steal` (ttl: 1000ms, limit: 3) được định nghĩa trong `app.module.ts` — giới hạn 3 steal/giây/user.

---

### Bug #6 — [HIGH] `claimDaily()` TOCTOU race condition

**File:** `backend/src/modules/user/user.service.ts`  
**Impact:** User có thể claim daily reward nhiều lần bằng cách gửi concurrent requests

**Root cause:**  
User record được đọc NGOÀI transaction (không có lock). Nếu 2 requests đến đồng thời:

```
Request A: read user (lastClaim=null → canClaim=true)
Request B: read user (lastClaim=null → canClaim=true)
Request A: UPDATE gold += reward, lastClaim = now ✓
Request B: UPDATE gold += reward, lastClaim = now ✓ (BUG: claimed twice!)
```

**Before:**
```typescript
async claimDaily(userId: string) {
  const user = await this.userRepo.findOne({ where: { id: userId } }); // NO LOCK
  // ... check cooldown
  await this.userRepo.update(userId, { goldBalance: () => `"gold_balance" + ${goldReward}`, ... });
}
```

**After:**
```typescript
async claimDaily(userId: string) {
  const qr = this.dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    const user = await qr.manager
      .createQueryBuilder(User, 'u')
      .where('u.id = :id', { id: userId })
      .setLock('pessimistic_write')  // SELECT ... FOR UPDATE
      .getOne();
    // check cooldown INSIDE lock — concurrent request blocks here
    // ... update inside same transaction
    await qr.commitTransaction();
  } catch (err) {
    await qr.rollbackTransaction();
    throw err;
  } finally {
    await qr.release();
  }
}
```

---

### Bug #7 — [MEDIUM] `water()` TOCTOU race condition

**File:** `backend/src/modules/action/action.service.ts`  
**Impact:** Hai concurrent water requests trên cùng plot đều thành công — user nhận 2x bonus

**Root cause:**  
Plot và user được đọc ngoài transaction. Cả hai requests đều pass check "đã watered chưa?" trước khi update.

**Fix:** Đọc cả `FarmPlot` lẫn `User` bên trong `QueryRunner` transaction với `setLock('pessimistic_write')`. Request thứ hai block tại `SELECT ... FOR UPDATE` cho đến khi request đầu commit, sau đó đọc được state đã updated và fail đúng.

---

### Bug #8 — [MEDIUM] `upgradePlot()` TOCTOU race condition

**File:** `backend/src/modules/farm/farm.service.ts`  
**Impact:** User bị charge gold 2 lần cho một lần upgrade (concurrent requests cùng plot)

**Root cause:**  
Plot level và gold balance đọc ngoài transaction:

```
Request A: read plot (level=1), read user (gold=500) → cost=200 → PASS
Request B: read plot (level=1), read user (gold=500) → cost=200 → PASS
Request A: UPDATE gold -= 200 (500→300), UPDATE plot level = 2 ✓
Request B: UPDATE gold -= 200 (300→100), UPDATE plot level = 2 (already 2, sets to 2 again)
Result: user paid 400G for a 1→2 upgrade (should be 200G)
```

**Before:**
```typescript
async upgradePlot(userId, plotId) {
  const plot = await this.plotRepo.findOne(...);   // outside tx
  const user = await this.userRepo.findOne(...);   // outside tx
  // check level + balance
  const qr = ...;
  await qr.startTransaction();
  await qr.manager.update(User, { goldBalance: () => `... - ${cost}` });
  await qr.manager.update(FarmPlot, plotId, { level: currentLevel + 1 });
  await qr.commitTransaction();
}
```

**After:**
```typescript
async upgradePlot(userId, plotId) {
  const qr = this.dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    const [plot, user] = await Promise.all([
      qr.manager.createQueryBuilder(FarmPlot, 'p')
        .where('p.id = :id AND p.user_id = :userId', { id: plotId, userId })
        .setLock('pessimistic_write')
        .getOne(),
      qr.manager.createQueryBuilder(User, 'u')
        .where('u.id = :id', { id: userId })
        .setLock('pessimistic_write')
        .getOne(),
    ]);
    // validate level + balance INSIDE the lock
    // update INSIDE the same transaction
    await qr.commitTransaction();
  } catch (e) {
    await qr.rollbackTransaction();
    throw e;
  } finally {
    await qr.release();
  }
}
```

---

## Các service đã audit và KHÔNG có vấn đề

| Service | Kết quả |
|---|---|
| `shop.service.ts` | ✅ Clean — `buyItem()` dùng QueryRunner + pessimistic_write |
| `inventory.service.ts` | ✅ Clean — `sellCrops()`, `packCrate()`, `unpackCrate()` đều locked |
| `marketplace.service.ts` | ✅ Clean — `createListing()`, `buyListing()`, `cancelListing()`, event handlers đều transactional |
| `quest.service.ts` | ✅ Clean — `claimReward()` dùng pessimistic_write lock |
| `web3.service.ts` | ✅ Clean — `generateClaimSignature()` có pre-flight check + re-check với lock bên trong tx |
| `guild.service.ts` | ✅ Clean — `waterTree()` dùng pessimistic_write lock trên Guild entity |
| `bot.controller.ts` | ✅ Acceptable — webhook validates `x-telegram-bot-api-secret-token` header |

---

## Deployment

```
Backend:  docker compose build backend && docker compose up -d backend
Frontend: npm run build (trong frontend/) → sudo cp -r dist/. /var/www/barnbuddy/
```

**Verified live:**
- `GET /api/ping` → `{"ok":true}` ✅
- `GET /api/admin/dex-status` (no passcode) → `401 Unauthorized` ✅
- `GET /api/admin/dex-status?p=<passcode>` → DEX data ✅
- Frontend → HTTP 200 ✅

---

## Patterns được áp dụng nhất quán sau audit

1. **FAIL CLOSED** — khi thiếu config (bot token, passcode), từ chối thay vì bypass
2. **Lock before check** — mọi read-check-write trên financial data phải trong cùng một `QueryRunner` transaction với `setLock('pessimistic_write')`
3. **Named throttlers** — endpoint nhạy cảm dùng `@Throttle({ steal: { limit, ttl } })` không phải `@SkipThrottle()`
4. **Standard headers** — auth qua `Authorization: Bearer` thay vì custom headers để đảm bảo proxy compatibility
