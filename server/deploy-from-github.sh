#!/bin/bash
# ===========================================
# ADENAI SERVER DEPLOY FROM GITHUB SCRIPT
# ===========================================
# Deploy server changes from GitHub to VPS

set -e  # Exit on any error

echo "🚀 Deploying Adenai Server from GitHub..."

# Configuration
SERVER_DIR="/var/www/adenai-admin"
BACKUP_DIR="/tmp/adenai-admin-backup-$(date +%Y%m%d_%H%M%S)"
REPO_URL="https://github.com/piosteiner/Adenai-Map.git"
TEMP_DIR="/tmp/adenai-deploy"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Pre-deployment checklist...${NC}"

# Check if PM2 is running
if ! pm2 list | grep -q "adenai-cms"; then
    echo -e "${RED}❌ PM2 process 'adenai-cms' not found!${NC}"
    exit 1
fi

# Backup current environment files
echo -e "${YELLOW}💾 Backing up current configuration...${NC}"
mkdir -p "$BACKUP_DIR"
cp "$SERVER_DIR/.env" "$BACKUP_DIR/" 2>/dev/null || echo "No .env to backup"
cp "$SERVER_DIR/config/users.js" "$BACKUP_DIR/" 2>/dev/null || echo "No users.js to backup"

# Clone fresh copy from GitHub
echo -e "${BLUE}📥 Fetching latest code from GitHub...${NC}"
rm -rf "$TEMP_DIR"
git clone "$REPO_URL" "$TEMP_DIR"

# Check if server directory exists in repo
if [ ! -d "$TEMP_DIR/server" ]; then
    echo -e "${RED}❌ No /server directory found in repository!${NC}"
    exit 1
fi

echo -e "${BLUE}🔄 Deploying server files...${NC}"

# Stop the current server
echo -e "${YELLOW}⏸️  Stopping server...${NC}"
pm2 stop adenai-cms

# Backup current server (just in case)
if [ -d "$SERVER_DIR" ]; then
    echo -e "${YELLOW}📦 Creating backup of current server...${NC}"
    cp -r "$SERVER_DIR" "$BACKUP_DIR/server-backup"
fi

# Deploy new server files (but keep deployment scripts)
echo -e "${BLUE}📁 Copying new server files...${NC}"
rsync -av --delete \
    --exclude='.env' \
    --exclude='config/users.js' \
    --exclude='node_modules' \
    --exclude='logs' \
    --exclude='uploads' \
    --exclude='deploy-from-github.sh' \
    --exclude='sync-to-github.sh' \
    --exclude='cleanup-directory.sh' \
    "$TEMP_DIR/server/" "$SERVER_DIR/"

# Restore configuration files
echo -e "${YELLOW}⚙️  Restoring configuration...${NC}"
if [ -f "$BACKUP_DIR/.env" ]; then
    cp "$BACKUP_DIR/.env" "$SERVER_DIR/"
    echo "✅ Restored .env file"
else
    echo -e "${RED}⚠️  No .env file found! You'll need to create one.${NC}"
fi

if [ -f "$BACKUP_DIR/users.js" ]; then
    cp "$BACKUP_DIR/users.js" "$SERVER_DIR/config/"
    echo "✅ Restored users.js file"
fi

# Install/update dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
cd "$SERVER_DIR"
npm install

# Test server syntax
echo -e "${BLUE}🧪 Testing server syntax...${NC}"
if ! node -c server.js; then
    echo -e "${RED}❌ Server syntax check failed! Rolling back...${NC}"
    # Restore from backup
    rsync -av "$BACKUP_DIR/server-backup/" "$SERVER_DIR/"
    pm2 restart adenai-cms
    exit 1
fi

# Restart server
echo -e "${GREEN}🚀 Starting server...${NC}"
pm2 restart adenai-cms

# Wait a moment and check if it's running
sleep 3
if pm2 list | grep -q "adenai-cms.*online"; then
    echo -e "${GREEN}✅ Server deployed successfully!${NC}"
    
    # Test API endpoint
    echo -e "${BLUE}🧪 Testing API...${NC}"
    if curl -s http://localhost:3001/health > /dev/null; then
        echo -e "${GREEN}✅ API responding correctly${NC}"
    else
        echo -e "${YELLOW}⚠️  API test failed, but server is running${NC}"
    fi
else
    echo -e "${RED}❌ Server failed to start! Check logs: pm2 logs adenai-cms${NC}"
    exit 1
fi

# Cleanup
rm -rf "$TEMP_DIR"

echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo -e "${BLUE}📊 Server status:${NC}"
pm2 list | grep adenai-cms
echo -e "${BLUE}📝 View logs: pm2 logs adenai-cms${NC}"
echo -e "${BLUE}🌐 Test at: http://localhost:3001${NC}"

# Offer to clean up old backup
echo -e "${YELLOW}🗑️  Backup created at: $BACKUP_DIR${NC}"
echo -e "${YELLOW}💡 Clean up after confirming everything works: rm -rf $BACKUP_DIR${NC}"
