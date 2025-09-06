# 🚀 Deployment Guide

## Overview

This guide covers deploying both the client-side map and server-side admin system for the Adenai Campaign.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub Pages  │    │   VPS Server    │    │     GitHub      │
│                 │    │                 │    │   Repository    │
│  🌐 Client Map  │◄───┤  ⚙️ Admin APIs  │◄───┤  📁 Source Code │
│ adenai.piogino  │    │   Node.js/PM2   │    │  Adenai-Map     │
│      .ch        │    │   Port 3001     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Client Deployment (GitHub Pages)

### Automatic Deployment
GitHub Pages automatically serves from the `public/` directory:
- **Live URL**: https://adenai.piogino.ch
- **Auto-Deploy**: Every push to `main` branch
- **Source**: `public/` directory contents

### Manual Update Process
```bash
# 1. Make changes to client files
git add public/
git commit -m "Update map features"
git push origin main

# 2. GitHub Pages automatically deploys (2-3 minutes)
```

## Server Deployment (VPS)

### Prerequisites
- Ubuntu VPS with Node.js 16+
- PM2 installed globally: `npm install -g pm2`
- GitHub Personal Access Token

### Initial Server Setup

1. **Clone repository on server:**
```bash
cd /var/www/
git clone https://github.com/piosteiner/Adenai-Map.git adenai-admin
cd adenai-admin/server/
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
```bash
cp .env.example .env
nano .env
```

Required environment variables:
```bash
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_USERNAME=piosteiner
GITHUB_REPO=Adenai-Map
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_secure_password
SESSION_SECRET=your_long_random_secret_key
PORT=3001
NODE_ENV=production
```

4. **Start with PM2:**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow the instructions
```

### Server Update Process

When you push server changes to GitHub:

```bash
# On your VPS server
cd /var/www/adenai-admin/server/
git pull origin main
npm install  # If package.json changed
pm2 restart adenai-cms
```

### Automated Server Updates

Create a GitHub webhook or use this update script:

```bash
#!/bin/bash
# /var/www/adenai-admin/server/update-server.sh

echo "🔄 Updating Adenai Server..."
cd /var/www/adenai-admin/server/
git pull origin main
npm install
pm2 restart adenai-cms
echo "✅ Server updated and restarted!"
```

## Development Workflow

### 1. Client-Side Development
```bash
# Edit files in public/, src/
# Test locally: open public/index.html
# Push to GitHub for auto-deployment
git add public/ src/
git commit -m "Add new map features"
git push origin main
```

### 2. Server-Side Development
```bash
# Edit files in server/
# Test locally: cd server/ && npm start
# Push to GitHub, then update VPS
git add server/
git commit -m "Add new API endpoints"
git push origin main

# Then on VPS:
cd /var/www/adenai-admin/server/
git pull && pm2 restart adenai-cms
```

## Environment Management

### Development
- **Client**: Open `public/index.html` locally
- **Server**: `cd server/ && npm start` (port 3001)
- **Database**: Local JSON files

### Production
- **Client**: GitHub Pages auto-deployment
- **Server**: PM2 on VPS with production configs
- **Database**: GitHub repository storage

## Monitoring & Maintenance

### Server Health Checks
```bash
# Check PM2 status
pm2 list
pm2 logs adenai-cms

# Test API endpoints
curl http://your-vps:3001/health
curl http://your-vps:3001/api/test

# Check server resources
htop
df -h
```

### Log Management
```bash
# PM2 logs
pm2 logs adenai-cms --lines 50

# Server access logs
tail -f /var/log/nginx/access.log  # If using Nginx

# Application logs
tail -f /var/www/adenai-admin/server/logs/combined.log
```

### Backup Strategy

1. **Code**: Stored in GitHub (primary backup)
2. **Configuration**: 
   - `.env` file backed up securely (not in git)
   - `config/users.js` backed up securely
3. **User uploads**: Regular backup of `uploads/` directory
4. **Campaign data**: Stored in GitHub repository

## Security Considerations

### Server Security
- ✅ `.env` file excluded from git
- ✅ User credentials in environment variables
- ✅ Session-based authentication
- ✅ File upload restrictions (images only, 5MB limit)
- ✅ CORS configured for known domains

### Recommended Additions
- 🔧 HTTPS with Let's Encrypt
- 🔧 Nginx reverse proxy
- 🔧 Fail2ban for brute force protection
- 🔧 Regular security updates

## Troubleshooting

### Common Issues

**"API connection failed" on client:**
- Check if server is running: `pm2 list`
- Test API: `curl http://your-vps:3001/api/test`
- Check firewall: `ufw status`

**Server won't start:**
- Check syntax: `node -c server.js`
- Check logs: `pm2 logs adenai-cms`
- Verify environment: `env | grep GITHUB`

**GitHub integration failing:**
- Test token: Try API call manually
- Check permissions: Token needs `repo` access
- Verify repository exists and is accessible

**PM2 process not found:**
```bash
pm2 delete adenai-cms  # Remove old process
pm2 start ecosystem.config.js  # Start fresh
pm2 save  # Save configuration
```

### Performance Optimization

**Client-Side:**
- Enable gzip compression on web server
- Use CDN for static assets
- Optimize images and icons

**Server-Side:**
- Enable PM2 clustering: `instances: 'max'` in ecosystem.config.js
- Add Redis for session storage (for multiple instances)
- Implement request rate limiting

## SSL/HTTPS Setup (Optional)

```bash
# Install Certbot
sudo apt install certbot

# Get SSL certificate
sudo certbot certonly --standalone -d your-domain.com

# Configure Nginx with SSL
# (Add Nginx configuration example)
```

## Backup & Recovery

### Automated Backup Script
```bash
#!/bin/bash
# backup-adenai.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/adenai-$DATE"

mkdir -p "$BACKUP_DIR"

# Backup environment and config
cp /var/www/adenai-admin/server/.env "$BACKUP_DIR/"
cp /var/www/adenai-admin/server/config/users.js "$BACKUP_DIR/"

# Backup uploads
tar -czf "$BACKUP_DIR/uploads.tar.gz" /var/www/adenai-admin/server/uploads/

# Backup PM2 configuration
pm2 save
cp ~/.pm2/dump.pm2 "$BACKUP_DIR/"

echo "✅ Backup completed: $BACKUP_DIR"
```

---

🎯 **Key Points:**
- Client deploys automatically via GitHub Pages
- Server requires manual updates on VPS after GitHub pushes
- Always use PM2 for server process management
- Environment variables keep sensitive data secure
- GitHub repository serves as primary backup for code
