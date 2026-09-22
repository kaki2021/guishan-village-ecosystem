#!/usr/bin/env bash
set -euo pipefail

TASK_ROOT="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "$TASK_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$TASK_ROOT/.env"
  set +a
fi

: "${WECHAT_CLI_PATH:?请在 .env 中设置 WECHAT_CLI_PATH}"
: "${WECHAT_CLOUD_ENV_ID:?请在 .env 中设置 WECHAT_CLOUD_ENV_ID}"

FUNCTION_NAME="${1:-}"
if [[ -z "$FUNCTION_NAME" ]]; then
  echo "用法: ./uploadCloudFunction.sh <云函数目录名>" >&2
  exit 1
fi

PROJECT_PATH="${PROJECT_PATH:-$TASK_ROOT}"
"$WECHAT_CLI_PATH" cloud functions deploy \
  --e "$WECHAT_CLOUD_ENV_ID" \
  --n "$FUNCTION_NAME" \
  --r \
  --project "$PROJECT_PATH"
