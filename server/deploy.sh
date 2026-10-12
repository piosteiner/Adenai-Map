#!/bin/bash
# Deploy the latest main to this server: pull, install deps if needed, restart.
set -euo pipefail
cd "$(dirname "$0")"

lock_before=$(sha1sum package-lock.json)
git pull --ff-only
if [ "$(sha1sum package-lock.json)" != "$lock_before" ]; then
  echo "📦 package-lock.json changed, installing dependencies..."
  npm ci --omit=dev
fi

node --check server.js
pm2 restart adenai-cms
sleep 2
curl -sf http://localhost:3001/health > /dev/null && echo "✅ Deployed and healthy" || { echo "❌ Health check failed: pm2 logs adenai-cms"; exit 1; }
