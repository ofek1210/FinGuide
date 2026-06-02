#!/usr/bin/env bash
# Single entry point: install deps if missing, sanity-check env, run backend + frontend together.
set -e
cd "$(dirname "$0")"

if [ ! -d node_modules ] || [ ! -d backend/node_modules ] || [ ! -d frontend/node_modules ]; then
  echo "→ installing dependencies (first run)…"
  npm run install:all
fi

if [ ! -f backend/.env ]; then
  echo "✗ backend/.env missing."
  echo "  cp backend/.env.example backend/.env  →  fill in MONGODB_URI + JWT_SECRET, then re-run."
  exit 1
fi

exec npm run dev
