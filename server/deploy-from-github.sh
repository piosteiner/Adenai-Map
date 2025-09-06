#!/bin/bash
# Deploy server changes from GitHub to VPS
echo "🚀 Deploying from GitHub..."
cd /tmp && rm -rf adenai-deploy
git clone https://github.com/piosteiner/Adenai-Map.git adenai-deploy
cd adenai-deploy/server
pm2 stop adenai-cms
cp /var/www/adenai-admin/.env .
rsync -av --exclude='.env' --exclude='node_modules' . /var/www/adenai-admin/
cd /var/www/adenai-admin && npm install
pm2 restart adenai-cms
echo "✅ Deployment complete!"
