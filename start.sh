#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

# ── Backend ──────────────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 not found"; exit 1
fi

if [ ! -d "$BACKEND/.venv" ]; then
  echo "Creating Python venv..."
  python3 -m venv "$BACKEND/.venv"
fi

source "$BACKEND/.venv/bin/activate"
echo "Installing Python dependencies..."
pip install -q -r "$BACKEND/requirements.txt"

echo "Starting FastAPI backend on http://localhost:8000 ..."
cd "$BACKEND"
python run.py &
BACKEND_PID=$!
cd "$ROOT"

# ── Frontend ─────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "WARNING: node not found, skipping frontend dev server"
else
  cd "$FRONTEND"
  if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
  fi
  echo "Starting React dev server on http://localhost:5173 ..."
  npm run dev &
  FRONTEND_PID=$!
  cd "$ROOT"
fi

echo ""
echo "════════════════════════════════════════"
echo "  HEALTH QUEST running!"
echo "  Backend  → http://localhost:8000"
echo "  Frontend → http://localhost:5173"
echo "  API docs → http://localhost:8000/docs"
echo "════════════════════════════════════════"
echo ""
echo "Press Ctrl+C to stop both servers"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT INT TERM
wait
