#!/usr/bin/env python3
"""Collapse the duplicate `export function handleSummary` in load_test_barnbuddy.js.

The file accreted two exports of the same name, so k6 refuses to parse it:
    SyntaxError: Duplicate export name handleSummary
and no run ever writes a report. Everything from the FIRST handleSummary onward
is replaced by one merged implementation covering all three output targets.

Idempotent: running it twice leaves the file unchanged.
"""
import sys
from pathlib import Path

TARGET = Path("/home/ubuntu/barnbuddy/load_test_barnbuddy.js")
MARKER = "export function handleSummary"

src = TARGET.read_text(encoding="utf-8")

first = src.find(MARKER)
if first == -1:
    sys.exit("handleSummary not found — file layout changed, refusing to touch it")

before = src[:first]

if src.count(MARKER) == 1:
    print("already merged — nothing to do")
    sys.exit(0)

# Keep everything above the first export, then append the single merged function.
# Nesting depth is tracked by k6 itself; we deliberately do not try to parse JS.
MERGED = '''
// k6 accepts exactly ONE export of this name. The script previously carried two
// (one for JSON + colored stdout, one for the Markdown report), which made k6
// refuse to parse the file at all — "Duplicate export name handleSummary" — so
// no run ever produced a report. This is the merged single implementation.
//
// Return-value contract:
//   'stdout'                              -> colored summary on screen
//   'load_test_summary.json'              -> metrics for run-over-run comparison
//   '/home/ubuntu/barnbuddy/load_test.md' -> plain-text report (no ANSI escapes)
export function handleSummary(data) {
  // Threshold verdict first, so a failing run is obvious even after the long
  // metric tables scroll past.
  const failures = [];
  for (const [metric, m] of Object.entries(data.metrics)) {
    if (m.thresholds) {
      for (const [threshold, result] of Object.entries(m.thresholds)) {
        if (!result.ok) failures.push(`${metric} ${threshold}`);
      }
    }
  }
  const pass = failures.length === 0;
  console.log(
    pass
      ? '\\n\\u2705 K6 THRESHOLDS PASSED\\n'
      : `\\n\\u274c K6 THRESHOLDS FAILED: ${failures.join(', ')}\\n`,
  );

  // enableColors:false strips ANSI escapes. Without it load_test.md receives raw
  // escape bytes that render as noise in editors and pollute git diffs.
  const plain = textSummary(data, { indent: ' ', enableColors: false });

  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'load_test_summary.json': JSON.stringify(data, null, 2),
    '/home/ubuntu/barnbuddy/load_test.md': plain,
  };
}
'''

TARGET.write_text(before.rstrip("\\n") + "\\n" + MERGED, encoding="utf-8")

remaining = (before + MERGED).count(MARKER)
print(f"OK: wrote {TARGET}")
print(f"     handleSummary exports now: {remaining}")
