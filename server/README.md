# 🎮 Adenai Campaign Admin Server

> **Server-Side Backend API** for Adenai Campaign Management System

A Node.js/Express backend server that provides RESTful APIs for managing D&D campaign data with GitHub integration for data synchronization and deployment.

## ⚠️ **CRITICAL: Server Management Rules**

### 🎯 **Always Use PM2 - Never Manual Process Management**

**✅ CORRECT WAY:**
```bash
# When you make server-side changes (routes, server.js, etc.)
pm2 restart adenai-cms
```

**❌ WRONG WAY:**
```bash
# NEVER do this - unreliable and messy
pkill -f "node server.js"
kill [process_id]
node server.js  # Don't run directly in production
```

### Why This Matters
- **Reliability**: PM2 handles graceful restarts and process recovery
- **Consistency**: Single command for all server management
- **Production-Ready**: Built for server environments with proper logging
- **Clean**: No orphaned processes or port conflicts

**Remember**: The server runs under PM2 (`adenai-cms`), not as a direct Node.js process!

---

## Overview

This CMS allows you to manage locations, characters, journeys, and other campaign data through a web interface. All changes are automatically synced to a GitHub repository and deployed to GitHub Pages.

## Architecture

- **Backend**: Node.js + Express
- **Process Manager**: PM2 (for production)
- **Data Storage**: GitHub repository (`piosteiner/Adenai-Map`)
- **Frontend**: Static HTML/CSS/JS served from `admin-public/`
- **Deployment**: GitHub Pages integration via client-sync

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- PM2 installed globally: `npm install -g pm2`
- GitHub Personal Access Token with repo permissions

### Environment Setup

1. Clone and install dependencies:
```bash
cd /var/www/adenai-admin
npm install
```

2. Create `.env` file with required variables:
```bash
GITHUB_TOKEN=your_github_token_here
GITHUB_USERNAME=piosteiner
GITHUB_REPO=Adenai-Map
SESSION_SECRET=your_secret_key_here
PORT=3001
```

### Running the Application

**⚠️ IMPORTANT: Always use PM2, never `node server.js` directly in production**

```bash
# ✅ Start with PM2 (production)
pm2 start ecosystem.config.js

# ✅ Restart after code changes (PREFERRED method)
pm2 restart adenai-cms

# View logs and monitor
pm2 logs adenai-cms
pm2 monit

# Stop if needed
pm2 stop adenai-cms
```

**⚠️ NEVER do this in production:**
```bash
# ❌ These cause problems and conflicts
node server.js  # Don't run directly
pkill -f "node"  # Unreliable process killing
kill [pid] && npm start  # Messy manual management
```

### 🎯 **PM2 Restart Best Practices**

**✅ ALWAYS use PM2 restart instead of manual process management:**

```bash
# ✅ GOOD: Clean, reliable restart
pm2 restart adenai-cms

# ❌ AVOID: Manual process killing (messy, unreliable)
pkill -f "node server.js" && npm start
```

**Why PM2 restart is better:**
- **Clean process management** - PM2 handles the restart gracefully
- **Single command** - No need for multiple kill/start commands
- **Reliable** - Ensures the service stays running properly
- **Proper daemon management** - Maintains logging and monitoring
- **Production-ready** - Built for server environments

## When to Restart PM2 vs. No Restart Needed

### ❌ **PM2 Restart Required** (Server-side changes)

Changes to these files require `pm2 restart adenai-cms`:

- **Server files**: `server.js`, `ecosystem.config.js`
- **Route files**: `routes/*.js` (auth.js, locations.js, characters.js, etc.)
- **Middleware**: `middleware/*.js`
- **Configuration**: `config/*.js`
- **Environment variables**: `.env` file changes
- **Package dependencies**: After `npm install` with new packages

### ✅ **No Restart Needed** (Frontend changes)

These changes are served statically and take effect immediately:

- **CSS files**: `admin-public/css/**/*.css`
- **JavaScript files**: `admin-public/js/**/*.js`
- **HTML files**: `admin-public/*.html`
- **Static assets**: Images, fonts, etc. in `admin-public/`
- **Client-side configuration**: `admin-public/js/core/config.js`

**Tip**: Simply refresh your browser to see frontend changes!

### Why This Matters

- **Frontend changes**: Just refresh the browser (F5) - no server restart needed
- **Backend changes**: Require restart because Node.js caches modules in memory
- **Unnecessary restarts**: Waste time and can briefly interrupt service

**Rule of thumb**: If you're editing files in `admin-public/`, no restart needed!

# Restart after code changes
pm2 restart adenai-cms

# View logs
pm2 logs adenai-cms

# Monitor processes
pm2 monit
```

### Development vs Production

| Environment | Command | Use Case |
|------------|---------|----------|
| **Production** | `pm2 start ecosystem.config.js` | Server deployment, auto-restart, clustering |
| **Development** | `node server.js` | Local testing only |

## Project Structure

```
adenai-admin/
├── server.js                 # Main Express server
├── ecosystem.config.js       # PM2 configuration
├── package.json              # Dependencies and scripts
├── .env                      # Environment variables (not in git)
├── admin-public/             # Static frontend files
│   ├── index.html           # Main admin interface
│   ├── css/                 # Stylesheets
│   └── js/                  # Frontend JavaScript
│       ├── core/            # Core utilities
│       │   ├── config.js    # Centralized configuration
│       │   ├── auth.js      # Authentication
│       │   └── ui.js        # UI utilities
│       └── modules/         # Feature modules
├── routes/                  # API route handlers
│   ├── auth.js             # Authentication routes
│   ├── locations.js        # Location management
│   ├── characters.js       # Character management
│   ├── journey.js          # Journey tracking
│   └── changelog.js        # Change logging
├── middleware/             # Express middleware
├── client-sync/           # Files for GitHub deployment
├── config/               # Configuration files
└── data/                # Local data storage
```

## API Endpoints

### Public APIs
- `GET /api/locations` - Fetch all locations from GitHub
- `GET /api/characters` - Fetch all characters from GitHub
- `GET /api/config/locationTypes` - Get location type definitions
- `GET /api/config/regions` - Get region definitions

### Authenticated APIs
- `POST /api/locations` - Create/update locations
- `POST /api/characters` - Create/update characters
- `POST /api/journey` - Add journey entries
- `GET /api/changelog` - View change history

## Configuration System

The centralized configuration system (`admin-public/js/core/config.js`) provides:

- **Location Types**: city, town, village, landmark, etc.
- **Regions**: Predefined campaign regions
- **Character Status**: alive, dead, unknown, etc.
- **Character Relationships**: ally, enemy, neutral, etc.
- **Movement Types**: travel, mission, stay, etc.

This ensures consistency across forms and prevents hardcoded values.

## GitHub Integration

### Repository Structure
```
Adenai-Map/
├── public/
│   └── data/
│       ├── places.geojson    # Location data (54 locations)
│       ├── characters.json   # Character data (8 characters)
│       └── reviews.json      # Additional data
└── js/
    └── config.js            # Deployed configuration
```

### Sync Process
1. CMS makes changes via web interface
2. Data is committed to GitHub repository
3. GitHub Pages automatically deploys changes
4. Live site updates at `https://adenai.piogino.ch`

## Troubleshooting

### Common Issues

**API returns empty data despite GitHub having content:**
- Check if PM2 is running: `pm2 list`
- Restart PM2: `pm2 restart adenai-cms`
- Verify GitHub token permissions

**Routes not working (404 errors):**
- Ensure PM2 is running the latest code
- Check for syntax errors: `node -c server.js`
- Verify route registration in `server.js`

**Port conflicts:**
- Check what's running on port 3001: `lsof -i :3001`
- Stop conflicting processes before starting PM2

### Debug Commands

```bash
# Check if server loads without errors
node -c server.js

# Test GitHub API connection
node -e "
const { Octokit } = require('@octokit/rest');
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
octokit.rest.repos.get({ owner: 'piosteiner', repo: 'Adenai-Map' })
  .then(() => console.log('✅ GitHub connection works'))
  .catch(e => console.error('❌ GitHub error:', e.message));
"

# Test API endpoints
curl -s http://localhost:3001/api/locations | head -5
curl -s http://localhost:3001/api/characters | head -5
```

## Security Notes

- **Environment Variables**: Never commit `.env` to version control
- **GitHub Token**: Use minimal required permissions (repo access only)
- **Session Secret**: Use a strong, unique secret for production
- **HTTPS**: Consider using HTTPS in production with proper SSL certificates

## Why PM2?

PM2 provides several advantages over running `node server.js` directly:

1. **Process Management**: Automatic restart on crashes
2. **Clustering**: Can run multiple instances for load balancing
3. **Log Management**: Centralized logging and rotation
4. **Monitoring**: Built-in process monitoring
5. **Zero-Downtime Deployments**: Graceful restarts
6. **Persistent**: Survives server reboots with `pm2 startup`

## Development Workflow

### For Frontend Changes (CSS, JS, HTML)
1. Make changes to files in `admin-public/`
2. **No restart needed** - just refresh browser (F5)
3. Test functionality in browser
4. Commit changes when satisfied

### For Backend Changes (Routes, Server Logic)
1. Make changes to server files (routes/, middleware/, server.js, etc.)
2. **Restart required**: `pm2 restart adenai-cms` (PREFERRED METHOD)
3. Test API endpoints: `curl http://localhost:3001/api/locations`
4. Monitor for errors: `pm2 logs adenai-cms`
5. **Sync to GitHub**: `./sync-to-github.sh "Description of changes"`

**⚠️ Important**: Always use `pm2 restart adenai-cms` instead of manual `pkill` commands!

## 🔄 GitHub Repository Sync

### Quick Sync to GitHub
Your server code is mirrored to GitHub for better Copilot integration and backup:

```bash
# After making server changes, sync to GitHub:
./sync-to-github.sh "Added new API endpoints"

# Or just use default message:
./sync-to-github.sh
```

### What Gets Synced
- ✅ **Server code**: server.js, routes/, middleware/
- ✅ **Admin interface**: All admin UI files
- ✅ **Documentation**: README, API docs
- ✅ **Configuration templates**: .env.example, config templates

### What Stays Private (Never Synced)
- ❌ **Environment variables**: .env file with secrets
- ❌ **User uploads**: uploads/ directory
- ❌ **Application logs**: logs/ directory
- ❌ **Node modules**: Downloaded packages
- ❌ **Real credentials**: config/users.js

### GitHub Repository Structure
Your synced code appears in the main repository:
```
https://github.com/piosteiner/Adenai-Map/
├── public/          # Client-side map (existing)
├── src/             # Client source code (existing)  
├── server/          # Your server code (synced)
│   ├── server.js
│   ├── routes/
│   ├── admin-interface/
│   └── docs/
└── docs/            # Shared documentation
```

### Benefits
- 🧠 **Enhanced Copilot**: Sees both client and server code for better suggestions
- 📱 **Unified Development**: Work on client knowing server structure
- 🔒 **Secure Backup**: Code backed up without exposing secrets
- 🤝 **Collaboration Ready**: Easy for others to understand full stack

### Quick Testing Commands
```bash
# Test server syntax without starting
node -c server.js

# Test frontend changes (no restart needed)
# Just open browser and refresh: http://localhost:3001

# Test backend changes (after PM2 restart)
curl -s http://localhost:3001/api/locations | head -5
curl -s http://localhost:3001/api/characters | head -5

# Sync changes to GitHub
./sync-to-github.sh "Updated API endpoints"
```

## Contributing

When making changes:
1. Test routes work correctly
2. Use PM2 for all production deployments
3. **Sync to GitHub**: `./sync-to-github.sh "Description of changes"`
4. Update this README if adding new features
5. Document any new environment variables
6. Test GitHub integration after changes

---

**🏗️ REPOSITORY TYPE: SERVER-SIDE BACKEND**

This repository contains the **backend API server** for the Adenai Campaign Management System. 

- **Frontend/Client**: See separate repository for React/Vue/etc. client code
- **Backend/Server**: This repository (Node.js/Express APIs)
- **Deployment**: Server hosts APIs, client consumes them

---
