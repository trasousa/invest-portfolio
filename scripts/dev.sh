#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

trap 'kill 0' EXIT

echo "[dev] Starting FastAPI backend on http://localhost:8000"
(cd "$ROOT_DIR/backend" && uv run uvicorn app.main:app --reload --port 8000) &
BACKEND_PID=$!

echo "[dev] Starting Vite frontend on http://localhost:5173"
(cd "$ROOT_DIR/frontend" && npm run dev -- --host) &
FRONTEND_PID=$!

wait -n "$BACKEND_PID" "$FRONTEND_PID"
