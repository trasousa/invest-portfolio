pl#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v uv >/dev/null 2>&1; then
  echo "[setup] The 'uv' package manager is required. Install it from https://github.com/astral-sh/uv"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[setup] npm is required. Install Node.js 18+ from https://nodejs.org/en/download"
  exit 1
fi

echo "[setup] Installing backend dependencies with uv"
pushd "$ROOT_DIR/backend" >/dev/null
uv sync
if [[ -f .env.example && ! -f .env ]]; then
  cp .env.example .env
  echo "[setup] Created backend .env from template"
fi
popd >/dev/null

echo "[setup] Installing frontend dependencies with npm"
pushd "$ROOT_DIR/frontend" >/dev/null
npm install
if [[ -f .env.example && ! -f .env.local ]]; then
  cp .env.example .env.local
  echo "[setup] Created frontend .env.local from template"
fi
popd >/dev/null

cat <<'EOF'
[setup] All dependencies installed ✅
[setup] Start the dev servers with:
    ./scripts/dev.sh
EOF
