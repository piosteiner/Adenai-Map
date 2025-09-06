#!/usr/bin/env node
// scripts/sync-config.js - Sync config from admin to client-sync folder

const fs = require('fs');
const path = require('path');

const adminConfigPath = path.join(__dirname, '../admin-public/js/core/config.js');
const clientConfigPath = path.join(__dirname, '../client-sync/config.js');

try {
    console.log('🔄 Syncing config from admin to client-sync...');
    
    // Read the admin config
    let configContent = fs.readFileSync(adminConfigPath, 'utf8');
    
    // Add a header comment indicating it's synced
    const syncHeader = `// client-sync/config.js - Shared configuration for locations and other entities
// This file is automatically synced from admin-public/js/core/config.js
// DO NOT EDIT MANUALLY - Run 'npm run sync-config' to update

`;
    
    // Remove the original header and replace with sync header
    configContent = configContent.replace(
        /^\/\/.*?\n\n/,
        syncHeader
    );
    
    // Write to client-sync folder
    fs.writeFileSync(clientConfigPath, configContent);
    
    console.log('✅ Config synced successfully!');
    console.log(`   Source: ${adminConfigPath}`);
    console.log(`   Target: ${clientConfigPath}`);
    
} catch (error) {
    console.error('❌ Error syncing config:', error.message);
    process.exit(1);
}
