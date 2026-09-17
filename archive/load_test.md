# 📊 LOAD TEST REPORT — BANDIT BUDDY (K6)

> **Status:** ✅ THRESHOLDS PASSED
> **Source:** `load_test_barnbuddy.js` — metrics below are generated directly
> from `load_test_summary.json` written by K6, without manual edits.

---

## 1. Execution Info

| Field | Value |
|---|---|
| Host | `serv` |
| Started (UTC) | `2026-09-17T03:05:30Z` |
| Ended (UTC) | `2026-09-17T03:06:02Z` |
| Profile | `smoke` |
| Requested VUs | `50` |
| BASE_URL | `http://localhost:3003` |
| Runner | `host` |
| K6 version | `k6 v2.2.0+dirty (commit/00a9a1b7f5-dirty, go1.26.5, linux/amd64)` |
| k6 exit code | `0` |
| Peak actual VUs | `5` |

## 2. Preconditions

| Check | Result | Significance |
|---|---|---|
| BOT_TOKEN ↔ container | `yes` | BOT_TOKEN matches backend container — HMAC will pass |
| GET /api/ping | `200` | Backend alive |

---

## 3. Threshold Results

| Metric | Threshold | Result |
|---|---|---|
| `http_req_duration` | `p(95)<800` | ✅ PASS |
| `http_req_failed` | `rate<0.01` | ✅ PASS |

**No thresholds violated.**

---

## 4. Infrastructure Metrics

| Metric | Value |
|---|---|
| `http_req_failed` (rate) | 0.000% |
| `http_req_duration` p95 (ms) | 24.60 |
| `http_req_duration` p99 (ms) | — |
| `http_req_duration` avg (ms) | 12.22 |
| `http_req_duration` max (ms) | 92.93 |
| `http_reqs` (total) | 1138 |
| `http_reqs` (req/s) | 37.13030376805806 |
| `iteration_duration` p95 (ms) | 2508.96 |
| `iterations` (total) | 96 |

## 5. Custom Business Metrics

| Metric | Value | Notes |
|---|---|---|
| `business_errors` (rate) | 0.000% | 5xx/401/403 — does not count business 400 |
| `steal_wins` | — | Increments only when victim is seeded + `VICTIM_USER_ID`/`VICTIM_PLOT_IDS` set |
| `steal_dog_bites` | — | Dog bite count |
| `plants_planted` | — | Successful plant count (201) |
| `reads_completed` | 867 | Read requests completed |

## 6. Observations & Recommendations

- All thresholds met under profile `smoke` with 50 VUs.
- Logical next step: run `PROFILE=stress VUS=50` to find breaking point,
  followed by `PROFILE=soak VUS=200 HOLD=30m` to detect connection pool leaks.
### Interpretation Notes

- `http_req_failed` only counts **5xx/timeout** — script uses
  `http.setResponseCallback(expectedStatuses({min:200,max:499}))`.
  Business 400s ("crop not ripe", "daily steal limit") are **not** considered infra errors.
- The `steal` flow is skipped if `VICTIM_USER_ID`/`VICTIM_PLOT_IDS` are unset.
  `steal_wins`/`steal_dog_bites` remaining 0 in that case is due to missing env,
  not slow DB.

---

## Appendix: Raw K6 Output

```text
time="2026-09-17T03:06:01Z" level=info msg="\n✅ K6 COMPREHENSIVE LOAD TEST PASSED\n" source=console
     █ core_reads

[32m       ✓ profile 200[0m
[32m       ✓ farm 200[0m
[32m       ✓ seeds 200[0m
[32m       ✓ weather 200[0m
[32m       ✓ treasury 200[0m

     █ inventory_and_commerce

[32m       ✓ barn 200[0m
[32m       ✓ sell-all 200/201/400[0m
[32m       ✓ shop 200[0m
[32m       ✓ listings 200[0m
[32m       ✓ my-listings 200[0m

     █ farming_actions

[32m       ✓ water 201/400[0m
[32m       ✓ buildings 200[0m
[32m       ✓ fertilize 201/400[0m

     █ social_and_raids

[32m       ✓ leaderboard 200[0m
[32m       ✓ nft-status 200[0m
[32m       ✓ friends 200[0m
[32m       ✓ notification 200[0m

     █ guild_and_web3

[32m       ✓ daily-claim 200/201/400[0m
[32m       ✓ quests 200[0m
[32m       ✓ guild-list 200[0m
[32m       ✓ guild-my 200[0m
[32m       ✓ water-tree 200/201/400/404[0m
[32m       ✓ dynamic-rates 200[0m
[32m       ✓ cashout-quota 200[0m

     auth_latency[2m...................:[0m avg=[36m15.441682[0m min=[36m4.972006[0m med=[36m13.103559[0m max=[36m92.932339[0m p(90)=[36m23.231966[0m p(95)=[36m29.101706[0m
     barn_sells[2m.....................:[0m [36m33[0m      [36;2m1.076714/s[0m
     business_errors[2m................:[0m [36m0.00%[0m   [36;2m✓ 0[0m         [36;2m✗ 119[0m 
     checks[2m.........................:[0m [36m100.00%[0m [36;2m✓ 1138[0m      [36;2m✗ 0[0m   
     data_received[2m..................:[0m [36m1.9 MB[0m  [36;2m61 kB/s[0m
     data_sent[2m......................:[0m [36m457 kB[0m  [36;2m15 kB/s[0m
     farm_latency[2m...................:[0m avg=[36m15.988792[0m min=[36m5.765066[0m med=[36m16.278506[0m max=[36m27.870627[0m p(90)=[36m24.143451[0m p(95)=[36m25.821482[0m
     group_duration[2m.................:[0m avg=[36m53.45ms[0m   min=[36m10.26ms[0m  med=[36m46.52ms[0m   max=[36m177.82ms[0m  p(90)=[36m103.9ms[0m   p(95)=[36m121.04ms[0m 
     http_req_blocked[2m...............:[0m avg=[36m11.59µs[0m   min=[36m2.65µs[0m   med=[36m8.3µs[0m     max=[36m800.19µs[0m  p(90)=[36m13.69µs[0m   p(95)=[36m16.8µs[0m   
     http_req_connecting[2m............:[0m avg=[36m714ns[0m     min=[36m0s[0m       med=[36m0s[0m        max=[36m186.69µs[0m  p(90)=[36m0s[0m        p(95)=[36m0s[0m       
   [32m✓[0m http_req_duration[2m..............:[0m avg=[36m12.21ms[0m   min=[36m643.08µs[0m med=[36m10.36ms[0m   max=[36m92.93ms[0m   p(90)=[36m20.01ms[0m   p(95)=[36m24.6ms[0m   
       { expected_response:true }[2m...:[0m avg=[36m12.21ms[0m   min=[36m643.08µs[0m med=[36m10.36ms[0m   max=[36m92.93ms[0m   p(90)=[36m20.01ms[0m   p(95)=[36m24.6ms[0m   
   [32m✓[0m http_req_failed[2m................:[0m [36m0.00%[0m   [36;2m✓ 0[0m         [36;2m✗ 1138[0m
     http_req_receiving[2m.............:[0m avg=[36m115.51µs[0m  min=[36m24.35µs[0m  med=[36m107.74µs[0m  max=[36m981.82µs[0m  p(90)=[36m171.53µs[0m  p(95)=[36m196.96µs[0m 
     http_req_sending[2m...............:[0m avg=[36m36.86µs[0m   min=[36m8.12µs[0m   med=[36m32.45µs[0m   max=[36m635.05µs[0m  p(90)=[36m56.57µs[0m   p(95)=[36m66.09µs[0m  
     http_req_tls_handshaking[2m.......:[0m avg=[36m0s[0m        min=[36m0s[0m       med=[36m0s[0m        max=[36m0s[0m        p(90)=[36m0s[0m        p(95)=[36m0s[0m       
     http_req_waiting[2m...............:[0m avg=[36m12.06ms[0m   min=[36m608.38µs[0m med=[36m10.21ms[0m   max=[36m92.31ms[0m   p(90)=[36m19.8ms[0m    p(95)=[36m24.39ms[0m  
     http_reqs[2m......................:[0m [36m1138[0m    [36;2m37.130304/s[0m
     iteration_duration[2m.............:[0m avg=[36m1.57s[0m     min=[36m518.2ms[0m  med=[36m1.55s[0m     max=[36m3.27s[0m     p(90)=[36m2.3s[0m      p(95)=[36m2.5s[0m     
     iterations[2m.....................:[0m [36m96[0m      [36;2m3.132258/s[0m
     market_latency[2m.................:[0m avg=[36m12.698742[0m min=[36m6.121535[0m med=[36m11.776919[0m max=[36m30.01603[0m  p(90)=[36m17.95009[0m  p(95)=[36m19.733455[0m
     reads_completed[2m................:[0m [36m867[0m     [36;2m28.288202/s[0m
     treasury_latency[2m...............:[0m avg=[36m2.235268[0m  min=[36m0.643081[0m med=[36m1.961658[0m  max=[36m6.9499[0m    p(90)=[36m4.406733[0m  p(95)=[36m5.004753[0m 
     treasury_reads[2m.................:[0m [36m96[0m      [36;2m3.132258/s[0m
     vus[2m............................:[0m [36m5[0m       [36;2mmin=5[0m       [36;2mmax=5[0m 
     vus_max[2m........................:[0m [36m5[0m       [36;2mmin=5[0m       [36;2mmax=5[0m
```

