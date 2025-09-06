# 🔧 Adenai Campaign Server

> **Backend API Server** for the Adenai Campaign Management System

This directory contains the Node.js/Express server that powers the campaign administration system.

## 🏗️ What's Here vs. Client

- **This Directory (`/server/`)**: Backend APIs, authentication, data management
- **Client Directory (`/public/`, `/src/`)**: Frontend map interface, user interactions
- **Shared (`/docs/`)**: API documentation, deployment guides

## 🚀 Quick Start

```bash
cd server/
npm install
cp .env.example .env
# Edit .env with your credentials
npm start
```

## 📡 API Endpoints

The server provides REST APIs for:
- **Location Management**: CRUD operations for campaign locations
- **Character Management**: Character tracking and relationships  
- **Movement Paths**: Character journey visualization
- **Authentication**: Admin session management
- **Data Sync**: GitHub integration for data persistence

## 🔗 Integration with Client

The client-side map (in `/public/`) connects to these server APIs:

```javascript
// Client code example
const response = await fetch('/api/characters');
const characters = await response.json();
```

## 📚 Documentation

- [`docs/API.md`](../docs/API.md) - Complete API reference
- [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) - Server deployment guide

## 🛠️ Development

- **Frontend changes** (CSS, client JS): No server restart needed
- **Backend changes** (routes, server.js): Restart required
- **PM2 recommended** for production deployment

---

**Note**: This is server-side code. For the interactive map interface, see the main repository root.
