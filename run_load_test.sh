#!/usr/bin/env bash
#
# run_load_test.sh — chạy k6 và sinh báo cáo /home/ubuntu/barnbuddy/load_test.md
#
# Tự động 4 bước:
#   1. Đọc TELEGRAM_BOT_TOKEN từ .env, so khớp với env của container barnbuddy_backend
#   2. Kiểm tra backend sống (/api/ping)
#   3. Chạy k6 với PROFILE (mặc định smoke), ghi stdout ra load_test_k6.log
#   4. Parse load_test_summary.json → sinh load_test.md (số liệu THẬT)
#
# Dùng:
#   chmod +x run_load_test.sh
#   ./run_load_test.sh                          # smoke (2 VU / 30s)
#   PROFILE=load VUS=50 ./run_load_test.sh      # load test
#
# Nếu tiền đề không đạt, script KHÔNG bịa số liệu: load_test.md ghi "Chưa chạy"
# kèm lý do cụ thể.

set -uo pipefail

REPO="/home/ubuntu/barnbuddy"
cd "$REPO" || { echo "❌ Không vào được $REPO"; exit 1; }

PROFILE="${PROFILE:-smoke}"
VUS="${VUS:-50}"
BASE_URL="${BASE_URL:-http://localhost:3003}"
THINK="${THINK:-1}"
RUN_K6_CMD="${RUN_K6_CMD:-}"   # override để dùng binary k6 khác

SCRIPT="$REPO/load_test_barnbuddy.js"
REPORT="$REPO/load_test.md"
K6_LOG="$REPO/load_test_k6.log"
SUMMARY="$REPO/load_test_summary.json"

STARTED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
HOSTNAME_="$(hostname -s 2>/dev/null || hostname)"

if [ ! -f "$SCRIPT" ]; then
  echo "❌ Không tìm thấy $SCRIPT"
  exit 1
fi

rm -f "$SUMMARY"

# ─────────────────────────────────────────────────────────────────────────
# 1. BOT_TOKEN
# ─────────────────────────────────────────────────────────────────────────
echo "── 1. Biến môi trường ────────────────────────────────────"

ENV_TOKEN=""
if [ -f "$REPO/.env" ]; then
  ENV_TOKEN="$(grep -m1 '^TELEGRAM_BOT_TOKEN=' "$REPO/.env" 2>/dev/null \
    | cut -d= -f2- | tr -d '"'"'"'' | tr -d '[:space:]')"
fi
BOT_TOKEN="${BOT_TOKEN:-$ENV_TOKEN}"

CONTAINER_TOKEN=""
if command -v docker >/dev/null 2>&1; then
  CONTAINER_TOKEN="$(docker exec barnbuddy_backend printenv TELEGRAM_BOT_TOKEN 2>/dev/null || true)"
fi

# So khớp CHỈ khi đọc được cả hai. 'unknown-*' không phải lỗi cứng —
# container có thể không chạy, lúc đó backend cũng chết và ping sẽ chặn.
if [ -z "$BOT_TOKEN" ]; then
  TOKEN_MATCH="missing-host"
elif [ -z "$CONTAINER_TOKEN" ]; then
  TOKEN_MATCH="unknown-no-container"
elif [ "$BOT_TOKEN" = "$CONTAINER_TOKEN" ]; then
  TOKEN_MATCH="yes"
else
  TOKEN_MATCH="no"
fi

mask() { [ -n "$1" ] && printf '%s…' "${1:0:8}" || printf '<rỗng>'; }

echo "  BOT_TOKEN (host)      : $(mask "$BOT_TOKEN")"
echo "  BOT_TOKEN (container) : $(mask "$CONTAINER_TOKEN")"
echo "  Match                 : $TOKEN_MATCH"
echo "  BASE_URL              : $BASE_URL"

# ─────────────────────────────────────────────────────────────────────────
# 2. Backend health
# ─────────────────────────────────────────────────────────────────────────
echo
echo "── 2. Backend health ─────────────────────────────────────"

PING_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$BASE_URL/api/ping" 2>/dev/null || true)"
[ -z "$PING_CODE" ] && PING_CODE="000"
echo "  GET $BASE_URL/api/ping → $PING_CODE"

# ─────────────────────────────────────────────────────────────────────────
# 3. Chọn runner
# ─────────────────────────────────────────────────────────────────────────
echo
echo "── 3. Runner k6 ──────────────────────────────────────────"

RUNNER=""
K6_VERSION="n/a"

if [ -n "$RUN_K6_CMD" ]; then
  RUNNER="custom"
  K6_VERSION="$($RUN_K6_CMD version 2>/dev/null | head -1 || echo 'custom k6')"
elif command -v k6 >/dev/null 2>&1; then
  RUNNER="host"
  K6_VERSION="$(k6 version 2>/dev/null | head -1 || echo 'k6')"
elif command -v docker >/dev/null 2>&1; then
  RUNNER="docker"
  K6_VERSION="$(docker run --rm grafana/k6 version 2>/dev/null | head -1 || echo 'grafana/k6')"
fi

echo "  Runner : ${RUNNER:-<không có>}"
echo "  Version: $K6_VERSION"

# ─────────────────────────────────────────────────────────────────────────
# 4. Gate
# ─────────────────────────────────────────────────────────────────────────
PRECOND_FAIL=""
if [ -z "$BOT_TOKEN" ]; then
  PRECOND_FAIL="Thiếu BOT_TOKEN (env host và .env đều rỗng)"
elif [ "$TOKEN_MATCH" = "no" ]; then
  PRECOND_FAIL="BOT_TOKEN không khớp TELEGRAM_BOT_TOKEN của container backend — mọi request sẽ nhận 401 (HMAC sai)"
elif [ "$PING_CODE" != "200" ]; then
  PRECOND_FAIL="Backend không trả 200 ở /api/ping (nhận $PING_CODE). Kiểm tra cổng: main.ts dùng PORT, mặc định 3003"
elif [ -z "$RUNNER" ]; then
  PRECOND_FAIL="Không tìm thấy k6 (host) lẫn docker"
fi

K6_EXIT="n/a"

if [ -n "$PRECOND_FAIL" ]; then
  echo
  echo "⛔ Tiền đề không đạt: $PRECOND_FAIL"
  echo "   → Không chạy k6. load_test.md sẽ ghi trạng thái 'Chưa chạy'."
  STATUS="Chưa chạy"
  REASON="$PRECOND_FAIL"
else
  echo
  echo "── 4. Chạy k6 — PROFILE=$PROFILE VUS=$VUS THINK=${THINK}s ──"
  : > "$K6_LOG"

  if [ "$RUNNER" = "docker" ]; then
    # --network host để container thấy localhost:3003 của máy chủ
    docker run --rm -i --network host \
      -v "$REPO":/scripts -w /scripts \
      -e BOT_TOKEN -e BASE_URL -e PROFILE -e VUS -e THINK \
      grafana/k6 run --quiet load_test_barnbuddy.js 2>&1 | tee -a "$K6_LOG"
    K6_EXIT="${PIPESTATUS[0]}"
  elif [ "$RUNNER" = "custom" ]; then
    BOT_TOKEN="$BOT_TOKEN" BASE_URL="$BASE_URL" PROFILE="$PROFILE" VUS="$VUS" THINK="$THINK" \
      $RUN_K6_CMD run --quiet "$SCRIPT" 2>&1 | tee -a "$K6_LOG"
    K6_EXIT="${PIPESTATUS[0]}"
  else
    BOT_TOKEN="$BOT_TOKEN" BASE_URL="$BASE_URL" PROFILE="$PROFILE" VUS="$VUS" THINK="$THINK" \
      k6 run --quiet "$SCRIPT" 2>&1 | tee -a "$K6_LOG"
    K6_EXIT="${PIPESTATUS[0]}"
  fi

  echo
  echo "  k6 exit code: $K6_EXIT  (0 = PASSED, 99 = thresholds failed, khác = lỗi)"

  # k6: 0 = mọi threshold đạt; 99 = có threshold fail; còn lại = lỗi runtime/script
  if [ "$K6_EXIT" = "0" ]; then
    STATUS="PASSED"
    REASON=""
  elif [ "$K6_EXIT" = "99" ]; then
    STATUS="FAILED"
    REASON="Một hoặc nhiều threshold không đạt (xem bảng bên dưới)"
  else
    STATUS="Chưa chạy"
    REASON="k6 thoát với mã $K6_EXIT — xem load_test_k6.log"
  fi
fi

ENDED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

# ─────────────────────────────────────────────────────────────────────────
# 5. Sinh report
# ─────────────────────────────────────────────────────────────────────────
python3 - \
  "$PROFILE" "$VUS" "$BASE_URL" "$HOSTNAME_" "$STARTED_AT" "$ENDED_AT" \
  "$RUNNER" "$K6_VERSION" "$STATUS" "$REASON" "$K6_EXIT" \
  "$TOKEN_MATCH" "$PING_CODE" \
  "$SUMMARY" "$REPORT" "$K6_LOG" <<'PYEOF'
import json
import os
import sys

(
    profile, vus, base_url, host, started, ended,
    runner, k6_version, status, reason, k6_exit,
    token_match, ping_code,
    summary_path, report_path, log_path,
) = sys.argv[1:17]

data = None
if os.path.exists(summary_path):
    try:
        with open(summary_path, encoding='utf-8') as fh:
            data = json.load(fh)
    except (json.JSONDecodeError, OSError):
        data = None

DASH = '—'

def values(metric_name: str) -> dict:
    if not data:
        return {}
    entry = data.get('metrics', {}).get(metric_name) or {}
    return entry.get('values', {}) or {}

def raw(metric_name: str, key: str, default=DASH):
    return values(metric_name).get(key, default)

def pct(metric_name: str, key: str, default=DASH) -> str:
    v = values(metric_name).get(key)
    return f'{v * 100:.3f}%' if isinstance(v, (int, float)) else default

def ms(metric_name: str, key: str, default=DASH) -> str:
    v = values(metric_name).get(key)
    return f'{v:.2f}' if isinstance(v, (int, float)) else default

def num(metric_name: str, key: str, default=DASH) -> str:
    v = values(metric_name).get(key)
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v) if v is not None else default

# ── Trạng thái header ────────────────────────────────────────────────────
BADGE = {
    'PASSED':    '✅ THRESHOLDS PASSED',
    'FAILED':    '❌ THRESHOLDS FAILED',
    'Chưa chạy': '⚪ CHƯA CHẠY',
}.get(status, '⚪ CHƯA CHẠY')

out = []
w = out.append

w('# 📊 LOAD TEST REPORT — BANDIT BUDDY (K6)')
w('')
w(f'> **Trạng thái:** {BADGE}')
w('> **Nguồn:** `load_test_barnbuddy.js` — số liệu dưới đây được sinh trực tiếp')
w('> từ `load_test_summary.json` do K6 ghi ra, không nhập tay.')
if status == 'Chưa chạy' and reason:
    w('>')
    w(f'> **Lý do:** {reason}')
w('')
w('---')
w('')

# ── 1. Thông tin lần chạy ────────────────────────────────────────────────
w('## 1. Thông tin lần chạy')
w('')
w('| Trường | Giá trị |')
w('|---|---|')
w(f'| Host | `{host}` |')
w(f'| Bắt đầu (UTC) | `{started}` |')
w(f'| Kết thúc (UTC) | `{ended}` |')
w(f'| Profile | `{profile}` |')
w(f'| VUS yêu cầu | `{vus}` |')
w(f'| BASE_URL | `{base_url}` |')
w(f'| Runner | `{runner}` |')
w(f'| K6 version | `{k6_version}` |')
w(f'| k6 exit code | `{k6_exit}` |')
w(f'| VUs đỉnh thực tế | `{num("vus_max", "max")}` |')
w('')

# ── 2. Tiền đề ───────────────────────────────────────────────────────────
w('## 2. Tiền đề (preconditions)')
w('')
w('| Kiểm tra | Kết quả | Ý nghĩa |')
w('|---|---|---|')
tok_meaning = {
    'yes':                 'BOT_TOKEN khớp container backend — HMAC sẽ pass',
    'no':                  'KHÔNG khớp — mọi request sẽ 401',
    'missing-host':        'Không đọc được token ở host và .env',
    'unknown-no-container':'Không đọc được env container (có thể container tên khác)',
}.get(token_match, token_match)
ping_meaning = 'Backend sống' if ping_code == '200' else 'Backend không phản hồi đúng'
w(f'| BOT_TOKEN ↔ container | `{token_match}` | {tok_meaning} |')
w(f'| GET /api/ping | `{ping_code}` | {ping_meaning} |')
w('')
if status == 'Chưa chạy':
    w(f'> Không chạy K6 vì: **{reason or "chưa rõ"}**')
    w('')
w('---')
w('')

# ── 3. Thresholds ────────────────────────────────────────────────────────
w('## 3. Kết quả Thresholds')
w('')

threshold_rows = []
if data:
    for metric_name, entry in (data.get('metrics') or {}).items():
        for expr, res in (entry.get('thresholds') or {}).items():
            ok = bool(res.get('ok'))
            threshold_rows.append((metric_name, expr, ok))

if threshold_rows:
    w('| Metric | Threshold | Kết quả |')
    w('|---|---|---|')
    for metric_name, expr, ok in threshold_rows:
        w(f'| `{metric_name}` | `{expr}` | {"✅ PASS" if ok else "❌ FAIL"} |')
    w('')
    failed = [f'`{m}` {e}' for m, e, ok in threshold_rows if not ok]
    if failed:
        w(f'**Vi phạm:** {", ".join(failed)}')
    else:
        w('**Không có threshold nào bị vi phạm.**')
else:
    w('_Chưa có dữ liệu — K6 chưa chạy hoặc không ghi được summary._')
w('')
w('---')
w('')

# ── 4. Metrics hạ tầng ───────────────────────────────────────────────────
w('## 4. Metrics hạ tầng')
w('')
w('| Metric | Giá trị |')
w('|---|---|')
w(f'| `http_req_failed` (rate) | {pct("http_req_failed", "rate")} |')
w(f'| `http_req_duration` p95 (ms) | {ms("http_req_duration", "p(95)")} |')
w(f'| `http_req_duration` p99 (ms) | {ms("http_req_duration", "p(99)")} |')
w(f'| `http_req_duration` avg (ms) | {ms("http_req_duration", "avg")} |')
w(f'| `http_req_duration` max (ms) | {ms("http_req_duration", "max")} |')
w(f'| `http_reqs` (tổng) | {num("http_reqs", "count")} |')
w(f'| `http_reqs` (req/s) | {raw("http_reqs", "rate")} |')
w(f'| `iteration_duration` p95 (ms) | {ms("iteration_duration", "p(95)")} |')
w(f'| `iterations` (tổng) | {num("iterations", "count")} |')
w('')

# ── 5. Metrics nghiệp vụ ─────────────────────────────────────────────────
w('## 5. Custom metrics (nghiệp vụ)')
w('')
w('| Metric | Giá trị | Ghi chú |')
w('|---|---|---|')
w(f'| `business_errors` (rate) | {pct("business_errors", "rate")} | 5xx/401/403 — không tính 400 nghiệp vụ |')
w(f'| `steal_wins` | {num("steal_wins", "count")} | Chỉ tăng khi seed victim + `VICTIM_USER_ID`/`VICTIM_PLOT_IDS` được set |')
w(f'| `steal_dog_bites` | {num("steal_dog_bites", "count")} | Số lần bị chó cắn |')
w(f'| `plants_planted` | {num("plants_planted", "count")} | Số lần plant trả 201 |')
w(f'| `reads_completed` | {num("reads_completed", "count")} | Số request đọc hoàn tất |')
w('')

# ── 6. Nhận xét ──────────────────────────────────────────────────────────
w('## 6. Nhận xét & khuyến nghị')
w('')

if status == 'PASSED':
    w(f'- Mọi threshold đạt ở profile `{profile}` với {vus} VUs.')
    w('- Bước tiếp theo hợp lý: chạy `PROFILE=stress VUS=50` để tìm điểm gãy,')
    w('  sau đó `PROFILE=soak VUS=200 HOLD=30m` để phát hiện rò rỉ connection pool.')
elif status == 'FAILED':
    w('- Có threshold không đạt. Đọc bảng mục 3 để biết metric nào.')
    w('- Nếu `http_req_failed` cao nhưng không có 5xx → kiểm tra rate limiter:')
    w('  `ThrottlerGuard` đếm theo `req.ip`, K6 chạy 1 IP nguồn nên 50 VUs chia sẻ')
    w('  100 req/phút toàn cục và 3 req/giây cho `/action/steal`.')
    w('- Nếu chỉ `steal`/`harvest` vượt p95 → lock contention trên `farm_plots`:')
    w('  `steal` mở `SERIALIZABLE` + `FOR UPDATE` trên `farm_plots` rồi `users`.')
else:
    w('- K6 chưa chạy thành công, nên không có dữ liệu để đánh giá.')
    w('- Khắc phục tiền đề ở mục 2 rồi chạy lại script.')
    w('')

w('### Lưu ý khi diễn giải')
w('')
w('- `http_req_failed` chỉ tính **5xx/timeout** — script đã gọi')
w('  `http.setResponseCallback(expectedStatuses({min:200,max:499}))`.')
w('  400 nghiệp vụ ("crop not ripe", "daily steal limit") **không** tính là lỗi hạ tầng.')
w('- Nhánh `steal` tự bỏ qua nếu `VICTIM_USER_ID`/`VICTIM_PLOT_IDS` không được set.')
w('  `steal_wins`/`steal_dog_bites` đều 0 trong trường hợp đó là do thiếu env,')
w('  không phải do DB chậm.')
w('')

# ── Phụ lục: raw log ─────────────────────────────────────────────────────
w('---')
w('')
w('## Phụ lục: Raw K6 output')
w('')
if os.path.exists(log_path):
    with open(log_path, encoding='utf-8', errors='replace') as fh:
        tail = fh.read().strip().splitlines()[-120:]
    if tail:
        w('```text')
        out.extend(tail)
        w('```')
    else:
        w('_File log rỗng._')
else:
    w('_Không có `load_test_k6.log`._')
w('')

with open(report_path, 'w', encoding='utf-8') as fh:
    fh.write('\n'.join(out))
    fh.write('\n')

print(f'✅ Đã ghi báo cáo: {report_path}')
print(f'   Trạng thái   : {status}')
PYEOF
