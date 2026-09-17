#!/usr/bin/env bash
#
# run_load_test.sh — executes k6 and generates report /home/ubuntu/barnbuddy/load_test.md
#
# 4 Automated steps:
#   1. Read TELEGRAM_BOT_TOKEN from .env, verify match with barnbuddy_backend container env
#   2. Check backend health (/api/ping)
#   3. Run k6 with PROFILE (default smoke), redirect stdout to load_test_k6.log
#   4. Parse load_test_summary.json → generate load_test.md (REAL metrics)
#
# Usage:
#   chmod +x run_load_test.sh
#   ./run_load_test.sh                          # smoke (2 VU / 30s)
#   PROFILE=load VUS=50 ./run_load_test.sh      # load test
#
# If preconditions fail, script DOES NOT fabricate numbers: load_test.md records "Unexecuted"
# with specific reason.

set -uo pipefail

REPO="/home/ubuntu/barnbuddy"
cd "$REPO" || { echo "❌ Failed to enter $REPO"; exit 1; }

PROFILE="${PROFILE:-smoke}"
VUS="${VUS:-50}"
BASE_URL="${BASE_URL:-http://localhost:3003}"
THINK="${THINK:-1}"
RUN_K6_CMD="${RUN_K6_CMD:-}"   # override to use different k6 binary

SCRIPT="$REPO/load_test_barnbuddy.js"
REPORT="$REPO/load_test.md"
K6_LOG="$REPO/load_test_k6.log"
SUMMARY="$REPO/load_test_summary.json"

STARTED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
HOSTNAME_="$(hostname -s 2>/dev/null || hostname)"

if [ ! -f "$SCRIPT" ]; then
  echo "❌ Could not find $SCRIPT"
  exit 1
fi

rm -f "$SUMMARY"

# ─────────────────────────────────────────────────────────────────────────
# 1. BOT_TOKEN
# ─────────────────────────────────────────────────────────────────────────
echo "── 1. Environment Variables ──────────────────────────────"

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

# Compare ONLY when both can be read. 'unknown-*' is not a hard error —
# container might not be running, in which case backend is down and ping will block.
if [ -z "$BOT_TOKEN" ]; then
  TOKEN_MATCH="missing-host"
elif [ -z "$CONTAINER_TOKEN" ]; then
  TOKEN_MATCH="unknown-no-container"
elif [ "$BOT_TOKEN" = "$CONTAINER_TOKEN" ]; then
  TOKEN_MATCH="yes"
else
  TOKEN_MATCH="no"
fi

mask() { [ -n "$1" ] && printf '%s…' "${1:0:8}" || printf '<empty>'; }

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
# 3. Select runner
# ─────────────────────────────────────────────────────────────────────────
echo
echo "── 3. k6 Runner ──────────────────────────────────────────"

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

echo "  Runner : ${RUNNER:-<none>}"
echo "  Version: $K6_VERSION"

# ─────────────────────────────────────────────────────────────────────────
# 4. Gate
# ─────────────────────────────────────────────────────────────────────────
PRECOND_FAIL=""
if [ -z "$BOT_TOKEN" ]; then
  PRECOND_FAIL="Missing BOT_TOKEN (host env and .env are both empty)"
elif [ "$TOKEN_MATCH" = "no" ]; then
  PRECOND_FAIL="BOT_TOKEN does not match TELEGRAM_BOT_TOKEN in backend container — all requests will receive 401 (invalid HMAC)"
elif [ "$PING_CODE" != "200" ]; then
  PRECOND_FAIL="Backend did not return 200 on /api/ping (received $PING_CODE). Check port: main.ts uses PORT, default 3003"
elif [ -z "$RUNNER" ]; then
  PRECOND_FAIL="Could not find k6 (host) or docker"
fi

K6_EXIT="n/a"

if [ -n "$PRECOND_FAIL" ]; then
  echo
  echo "⛔ Precondition not met: $PRECOND_FAIL"
  echo "   → Skipping k6 execution. load_test.md will record status 'Unexecuted'."
  STATUS="Unexecuted"
  REASON="$PRECOND_FAIL"
else
  echo
  echo "── 4. Running k6 — PROFILE=$PROFILE VUS=$VUS THINK=${THINK}s ──"
  : > "$K6_LOG"

  if [ "$RUNNER" = "docker" ]; then
    # --network host so container can reach host localhost:3003
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
  echo "  k6 exit code: $K6_EXIT  (0 = PASSED, 99 = thresholds failed, other = error)"

  # k6: 0 = all thresholds passed; 99 = threshold failed; others = runtime/script error
  if [ "$K6_EXIT" = "0" ]; then
    STATUS="PASSED"
    REASON=""
  elif [ "$K6_EXIT" = "99" ]; then
    STATUS="FAILED"
    REASON="One or more thresholds failed (see table below)"
  else
    STATUS="Unexecuted"
    REASON="k6 exited with code $K6_EXIT — see load_test_k6.log"
  fi
fi

ENDED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

# ─────────────────────────────────────────────────────────────────────────
# 5. Generate report
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

# ── Status header ────────────────────────────────────────────────────────
BADGE = {
    'PASSED':     '✅ THRESHOLDS PASSED',
    'FAILED':     '❌ THRESHOLDS FAILED',
    'Unexecuted': '⚪ UNEXECUTED',
}.get(status, '⚪ UNEXECUTED')

out = []
w = out.append

w('# 📊 LOAD TEST REPORT — BANDIT BUDDY (K6)')
w('')
w(f'> **Status:** {BADGE}')
w('> **Source:** `load_test_barnbuddy.js` — metrics below are generated directly')
w('> from `load_test_summary.json` written by K6, without manual edits.')
if status == 'Unexecuted' and reason:
    w('>')
    w(f'> **Reason:** {reason}')
w('')
w('---')
w('')

# ── 1. Execution Info ────────────────────────────────────────────────────
w('## 1. Execution Info')
w('')
w('| Field | Value |')
w('|---|---|')
w(f'| Host | `{host}` |')
w(f'| Started (UTC) | `{started}` |')
w(f'| Ended (UTC) | `{ended}` |')
w(f'| Profile | `{profile}` |')
w(f'| Requested VUs | `{vus}` |')
w(f'| BASE_URL | `{base_url}` |')
w(f'| Runner | `{runner}` |')
w(f'| K6 version | `{k6_version}` |')
w(f'| k6 exit code | `{k6_exit}` |')
w(f'| Peak actual VUs | `{num("vus_max", "max")}` |')
w('')

# ── 2. Preconditions ─────────────────────────────────────────────────────
w('## 2. Preconditions')
w('')
w('| Check | Result | Significance |')
w('|---|---|---|')
tok_meaning = {
    'yes':                 'BOT_TOKEN matches backend container — HMAC will pass',
    'no':                  'MISMATCH — all requests will 401',
    'missing-host':        'Cannot read token on host and .env',
    'unknown-no-container':'Cannot read container env (container name may differ)',
}.get(token_match, token_match)
ping_meaning = 'Backend alive' if ping_code == '200' else 'Backend not responding correctly'
w(f'| BOT_TOKEN ↔ container | `{token_match}` | {tok_meaning} |')
w(f'| GET /api/ping | `{ping_code}` | {ping_meaning} |')
w('')
if status == 'Unexecuted':
    w(f'> Did not run K6 because: **{reason or "unknown"}**')
    w('')
w('---')
w('')

# ── 3. Thresholds ────────────────────────────────────────────────────────
w('## 3. Threshold Results')
w('')

threshold_rows = []
if data:
    for metric_name, entry in (data.get('metrics') or {}).items():
        for expr, res in (entry.get('thresholds') or {}).items():
            ok = bool(res.get('ok'))
            threshold_rows.append((metric_name, expr, ok))

if threshold_rows:
    w('| Metric | Threshold | Result |')
    w('|---|---|---|')
    for metric_name, expr, ok in threshold_rows:
        w(f'| `{metric_name}` | `{expr}` | {"✅ PASS" if ok else "❌ FAIL"} |')
    w('')
    failed = [f'`{m}` {e}' for m, e, ok in threshold_rows if not ok]
    if failed:
        w(f'**Violations:** {", ".join(failed)}')
    else:
        w('**No thresholds violated.**')
else:
    w('_No data — K6 did not run or summary could not be written._')
w('')
w('---')
w('')

# ── 4. Infrastructure Metrics ────────────────────────────────────────────
w('## 4. Infrastructure Metrics')
w('')
w('| Metric | Value |')
w('|---|---|')
w(f'| `http_req_failed` (rate) | {pct("http_req_failed", "rate")} |')
w(f'| `http_req_duration` p95 (ms) | {ms("http_req_duration", "p(95)")} |')
w(f'| `http_req_duration` p99 (ms) | {ms("http_req_duration", "p(99)")} |')
w(f'| `http_req_duration` avg (ms) | {ms("http_req_duration", "avg")} |')
w(f'| `http_req_duration` max (ms) | {ms("http_req_duration", "max")} |')
w(f'| `http_reqs` (total) | {num("http_reqs", "count")} |')
w(f'| `http_reqs` (req/s) | {raw("http_reqs", "rate")} |')
w(f'| `iteration_duration` p95 (ms) | {ms("iteration_duration", "p(95)")} |')
w(f'| `iterations` (total) | {num("iterations", "count")} |')
w('')

# ── 5. Business Metrics ──────────────────────────────────────────────────
w('## 5. Custom Business Metrics')
w('')
w('| Metric | Value | Notes |')
w('|---|---|---|')
w(f'| `business_errors` (rate) | {pct("business_errors", "rate")} | 5xx/401/403 — does not count business 400 |')
w(f'| `steal_wins` | {num("steal_wins", "count")} | Increments only when victim is seeded + `VICTIM_USER_ID`/`VICTIM_PLOT_IDS` set |')
w(f'| `steal_dog_bites` | {num("steal_dog_bites", "count")} | Dog bite count |')
w(f'| `plants_planted` | {num("plants_planted", "count")} | Successful plant count (201) |')
w(f'| `reads_completed` | {num("reads_completed", "count")} | Read requests completed |')
w('')

# ── 6. Observations & Recommendations ────────────────────────────────────
w('## 6. Observations & Recommendations')
w('')

if status == 'PASSED':
    w(f'- All thresholds met under profile `{profile}` with {vus} VUs.')
    w('- Logical next step: run `PROFILE=stress VUS=50` to find breaking point,')
    w('  followed by `PROFILE=soak VUS=200 HOLD=30m` to detect connection pool leaks.')
elif status == 'FAILED':
    w('- One or more thresholds failed. See Section 3 table for specific metrics.')
    w('- If `http_req_failed` is elevated without 5xx → check rate limiter:')
    w('  `ThrottlerGuard` counts per `req.ip`. Running K6 from 1 source IP causes 50 VUs to share')
    w('  100 req/min globally and 3 req/sec for `/action/steal`.')
    w('- If only `steal`/`harvest` exceed p95 → lock contention on `farm_plots`:')
    w('  `steal` acquires `SERIALIZABLE` + `FOR UPDATE` on `farm_plots` then `users`.')
else:
    w('- K6 did not complete successfully, no data available for evaluation.')
    w('- Resolve preconditions in Section 2 then re-run script.')
    w('')

w('### Interpretation Notes')
w('')
w('- `http_req_failed` only counts **5xx/timeout** — script uses')
w('  `http.setResponseCallback(expectedStatuses({min:200,max:499}))`.')
w('  Business 400s ("crop not ripe", "daily steal limit") are **not** considered infra errors.')
w('- The `steal` flow is skipped if `VICTIM_USER_ID`/`VICTIM_PLOT_IDS` are unset.')
w('  `steal_wins`/`steal_dog_bites` remaining 0 in that case is due to missing env,')
w('  not slow DB.')
w('')

# ── Appendix: raw log ────────────────────────────────────────────────────
w('---')
w('')
w('## Appendix: Raw K6 Output')
w('')
if os.path.exists(log_path):
    with open(log_path, encoding='utf-8', errors='replace') as fh:
        tail = fh.read().strip().splitlines()[-120:]
    if tail:
        w('```text')
        out.extend(tail)
        w('```')
    else:
        w('_Empty log file._')
else:
    w('_No `load_test_k6.log` found._')
w('')

with open(report_path, 'w', encoding='utf-8') as fh:
    fh.write('\n'.join(out))
    fh.write('\n')

print(f'✅ Report written: {report_path}')
print(f'   Status        : {status}')
PYEOF
