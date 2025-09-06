#!/usr/bin/env node
// scripts/sync-to-main-site.js - Sync config to main adenai.piogino.ch site

const fs = require('fs');
const path = require('path');

// Update this path to match your actual adenai.piogino.ch directory
const MAIN_SITE_PATH = process.env.MAIN_SITE_PATH || '/path/to/adenai.piogino.ch';
const MAIN_SITE_CONFIG_PATH = path.join(MAIN_SITE_PATH, 'js/config.js');

const adminConfigPath = path.join(__dirname, '../admin-public/js/core/config.js');
const clientConfigPath = path.join(__dirname, '../client-sync/config.js');

try {
    console.log('🔄 Syncing config to main site...');
    
    // First sync from admin to client-sync
    let configContent = fs.readFileSync(adminConfigPath, 'utf8');
    
    // Add client-specific header
    const clientHeader = `// config.js - Shared configuration for Adenai campaign
// Auto-synced from admin system - DO NOT EDIT MANUALLY
// Last updated: ${new Date().toISOString()}

`;
    
    configContent = configContent.replace(
        /^\/\/.*?\n\n/,
        clientHeader
    );
    
    // Write to client-sync
    fs.writeFileSync(clientConfigPath, configContent);
    console.log('✅ Synced to client-sync folder');
    
    // Copy to main site if path exists
    if (fs.existsSync(MAIN_SITE_PATH)) {
        fs.writeFileSync(MAIN_SITE_CONFIG_PATH, configContent);
        console.log('✅ Synced to main site:', MAIN_SITE_CONFIG_PATH);
    } else {
        console.log('⚠️  Main site path not found:', MAIN_SITE_PATH);
        console.log('💡 Set MAIN_SITE_PATH environment variable or update the script');
    }
    
} catch (error) {
    console.error('❌ Error syncing config:', error.message);
    process.exit(1);
}
