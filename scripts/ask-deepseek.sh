#!/usr/bin/env bash
# Usage: ./scripts/ask-deepseek.sh "your question or code snippet"
# Or pipe: cat some-file.ts | ./scripts/ask-deepseek.sh "review this code"

set -euo pipefail

# Load .env
ENV_FILE="$(dirname "$0")/../.env"
if [[ -f "$ENV_FILE" ]]; then
  export $(grep -v '^#' "$ENV_FILE" | grep 'DEEPSEEK_API_KEY' | xargs) 2>/dev/null || true
fi

if [[ -z "${DEEPSEEK_API_KEY:-}" ]]; then
  echo "ERROR: DEEPSEEK_API_KEY not set in .env" >&2
  exit 1
fi

# Build prompt: positional arg + optional stdin
PROMPT="${1:-}"
if [[ ! -t 0 ]]; then
  STDIN_CONTENT=$(cat)
  if [[ -n "$STDIN_CONTENT" ]]; then
    PROMPT="${PROMPT}

\`\`\`
${STDIN_CONTENT}
\`\`\`"
  fi
fi

if [[ -z "$PROMPT" ]]; then
  echo "Usage: $0 <question>" >&2
  exit 1
fi

PAYLOAD=$(jq -n \
  --arg model "deepseek-chat" \
  --arg content "$PROMPT" \
  '{
    model: $model,
    messages: [
      { role: "system", content: "You are an expert TypeScript/NestJS/Solidity engineer. Give concise, actionable answers. Prefer code over prose." },
      { role: "user", content: $content }
    ],
    max_tokens: 2048,
    temperature: 0.3
  }')

RESPONSE=$(curl -s https://api.deepseek.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" \
  -d "$PAYLOAD")

# Extract content or show error
echo "$RESPONSE" | jq -r '.choices[0].message.content // (.error.message // "Unknown error: \(.)")'
