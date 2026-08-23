#!/bin/bash

export PYTHONPATH=$(pwd)

echo "=================================================="
echo "🚀 Starting Full MaternalCare Stack..."
echo "=================================================="

# Cleanup old background uvicorn processes if ports are occupied
echo "[0/3] Cleaning up old background ports (8000/8001)..."
fuser -k 8000/tcp 8001/tcp 2>/dev/null || true
pkill -f uvicorn 2>/dev/null || true
sleep 1

# Function to clean up processes on exit
cleanup() {
    echo ""
    echo "=================================================="
    echo "🛑 Shutting down MaternalCare Services..."
    echo "=================================================="
    kill $(jobs -p) 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 1. Run database migration in background
echo "[1/3] Database migration check initiated..."
python3 core_backend/migrate_db.py &

# 2. Start Core Backend on port 8000
echo "[2/3] Starting Core Backend Service on http://localhost:8000..."
python3 -m uvicorn core_backend.main:app --host 0.0.0.0 --port 8000 --reload &

# 3. Start AI Service on port 8001
echo "[3/3] Starting AI & RAG Service on http://localhost:8001..."
python3 -m uvicorn ai_service.main:app --host 0.0.0.0 --port 8001 --reload &

sleep 2

echo ""
echo "=================================================="
echo "✅ MATERNALCARE FULL STACK IS LIVE!"
echo "=================================================="
echo "🔹 Core API Server:       http://localhost:8000 (Docs: http://localhost:8000/docs)"
echo "🔹 AI RAG Service:        http://localhost:8001 (Docs: http://localhost:8001/docs)"
echo "🔹 Public Passport Route: http://localhost:8000/m/med_pass_free_test_12345"
echo "🔹 To start Frontend:     npm start (or npm run web)"
echo "=================================================="
echo "Press Ctrl+C to stop all services."
echo ""

wait
