#!/usr/bin/env node
// scripts/sync-config-to-github.js - Push config directly to GitHub repository

const fs = require('fs');
const path = require('path');

// This will use your existing GitHub setup from the CMS
async function syncConfigToGitHub() {
    try {
        console.log('🔄 Syncing config to GitHub repository...');
        
        // Read the current config
        const adminConfigPath = path.join(__dirname, '../admin-public/js/core/config.js');
        let configContent = fs.readFileSync(adminConfigPath, 'utf8');
        
        // Add header for the main site
        const siteHeader = `// js/config.js - Shared configuration for Adenai campaign
// Auto-synced from admin CMS - DO NOT EDIT MANUALLY  
// Last updated: ${new Date().toISOString()}
// This file provides consistent labels and values across the entire campaign

`;
        
        // Replace header
        configContent = configContent.replace(
            /^\/\/.*?\n\n/,
            siteHeader
        );
        
        // Write to client-sync for the CMS to push to GitHub
        const clientSyncPath = path.join(__dirname, '../client-sync/config.js');
        fs.writeFileSync(clientSyncPath, configContent);
        
        console.log('✅ Config written to client-sync/config.js');
        console.log('💡 Your CMS will push this to GitHub on the next sync');
        console.log('🌐 Your site will then use the updated config automatically');
        
        return true;
        
    } catch (error) {
        console.error('❌ Error syncing config:', error.message);
        return false;
    }
}

// Run the sync
syncConfigToGitHub();
