#!/bin/bash
# ===========================================
# ADENAI SERVER GITHUB SYNC SCRIPT
# ===========================================
# Simple script to sync your working server to GitHub

set -e  # Exit on any error

echo "🔄 Syncing Adenai Server to GitHub..."

# Configuration
TEMP_DIR="/tmp/adenai-github-sync"
SERVER_SOURCE="/var/www/adenai-admin"
COMMIT_MSG="${1:-Update server code}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📁 Setting up sync workspace...${NC}"

# Clean up and prepare
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

echo -e "${BLUE}📥 Cloning GitHub repository...${NC}"
git clone https://github.com/piosteiner/Adenai-Map.git .

echo -e "${BLUE}🔄 Syncing server files...${NC}"

# Make sure server directories exist
mkdir -p server/{admin-interface,routes,middleware,scripts,config,docs,data,client-sync}

# Remove old server files (but keep the directory structure)
rm -rf server/admin-interface/* server/routes/* server/middleware/* server/scripts/*
rm -f server/server.js server/package.json

# Copy current server files (excluding sensitive data)
echo -e "${YELLOW}📋 Copying server files...${NC}"

# Core files
cp "$SERVER_SOURCE/server.js" server/
cp "$SERVER_SOURCE/package.json" server/
cp "$SERVER_SOURCE/README.md" server/

# Directories - check if source exists before copying
if [ -d "$SERVER_SOURCE/admin-interface" ]; then
    cp -r "$SERVER_SOURCE/admin-interface/"* server/admin-interface/
else
    echo "No admin-interface directory found"
fi

if [ -d "$SERVER_SOURCE/routes" ]; then
    cp -r "$SERVER_SOURCE/routes/"* server/routes/
else
    echo "No routes directory found"
fi

if [ -d "$SERVER_SOURCE/middleware" ]; then
    cp -r "$SERVER_SOURCE/middleware/"* server/middleware/
else
    echo "No middleware directory found"
fi

if [ -d "$SERVER_SOURCE/scripts" ]; then
    cp -r "$SERVER_SOURCE/scripts/"* server/scripts/
else
    echo "No scripts directory found"
fi

# Config template (not the real config with secrets)
if [ -f "$SERVER_SOURCE/config/users.js.template" ]; then
    cp "$SERVER_SOURCE/config/users.js.template" server/config/
else
    echo "No config template found"
fi

# Update documentation if it exists
if [ -d "$SERVER_SOURCE/docs" ]; then
    cp -r "$SERVER_SOURCE/docs/"* server/docs/
else
    echo "No docs directory found"
fi

# Copy data directory structure (preserve .gitkeep files)
if [ -d "$SERVER_SOURCE/data" ]; then
    if [ -f "$SERVER_SOURCE/data/.gitkeep" ]; then
        cp "$SERVER_SOURCE/data/.gitkeep" server/data/
    fi
else
    echo "No data directory found"
fi

# Copy client-sync directory structure (preserve .gitkeep files)
if [ -d "$SERVER_SOURCE/client-sync" ]; then
    if [ -f "$SERVER_SOURCE/client-sync/.gitkeep" ]; then
        cp "$SERVER_SOURCE/client-sync/.gitkeep" server/client-sync/
    fi
else
    echo "No client-sync directory found"
fi

# Copy deployment scripts to GitHub
echo -e "${YELLOW}📋 Adding deployment scripts to GitHub...${NC}"
cp "$SERVER_SOURCE/deploy-from-github.sh" server/
cp "$SERVER_SOURCE/sync-to-github.sh" server/

echo -e "${BLUE}📝 Committing changes...${NC}"

# Configure git if needed
git config user.email "piosteiner@gmail.com" 2>/dev/null || true
git config user.name "Pio Steiner" 2>/dev/null || true

# Check if there are changes
if git diff --quiet server/ && git diff --cached --quiet server/; then
    echo -e "${YELLOW}ℹ️  No changes to sync${NC}"
else
    git add server/
    git commit -m "$COMMIT_MSG"
    
    echo -e "${BLUE}🚀 Pushing to GitHub...${NC}"
    git push origin main
    
    echo -e "${GREEN}✅ Server code synced to GitHub!${NC}"
fi

# Cleanup
cd /
rm -rf "$TEMP_DIR"

echo -e "${GREEN}🎉 Sync complete!${NC}"
echo -e "${BLUE}🔗 View at: https://github.com/piosteiner/Adenai-Map/tree/main/server${NC}"