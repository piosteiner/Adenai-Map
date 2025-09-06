// admin-public/js/core/form-init.js - Initialize form select options from config

document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing form select options...');
    
    // Populate location region select
    const regionSelect = document.getElementById('location-region-select');
    if (regionSelect) {
        regionSelect.innerHTML = AdenaiConfig.generateSelectOptions('locationRegions');
        console.log('Populated location regions');
    }
    
    // Populate location type select
    const typeSelect = document.getElementById('location-type-select');
    if (typeSelect) {
        typeSelect.innerHTML = AdenaiConfig.generateSelectOptions('locationTypes');
        console.log('Populated location types');
    }
    
    // Populate character status select
    const statusSelect = document.getElementById('character-status-select');
    if (statusSelect) {
        statusSelect.innerHTML = AdenaiConfig.generateSelectOptions('characterStatus');
        console.log('Populated character status');
    }
    
    // Populate character relationship select
    const relationshipSelect = document.getElementById('character-relationship-select');
    if (relationshipSelect) {
        relationshipSelect.innerHTML = AdenaiConfig.generateSelectOptions('characterRelationships');
        console.log('Populated character relationships');
    }
    
    // Populate movement type select
    const movementTypeSelect = document.getElementById('movement-type');
    if (movementTypeSelect) {
        movementTypeSelect.innerHTML = AdenaiConfig.generateSelectOptions('movementTypes');
        console.log('Populated movement types');
    }
    
    console.log('Form initialization complete');
    
    // Add migration button event listener
    const migrateBtn = document.getElementById('migrate-characters-btn');
    if (migrateBtn) {
        migrateBtn.addEventListener('click', async () => {
            showMigrationConfirmation();
        });
        console.log('Migration button initialized');
    }

    // Add reset and migrate button event listener
    const resetMigrateBtn = document.getElementById('reset-migrate-characters-btn');
    if (resetMigrateBtn) {
        resetMigrateBtn.addEventListener('click', async () => {
            showResetMigrationConfirmation();
        });
        console.log('Reset and migration button initialized');
    }

    // Add test character paths button event listener
    const testPathsBtn = document.getElementById('test-character-paths-btn');
    if (testPathsBtn) {
        testPathsBtn.addEventListener('click', async () => {
            await testCharacterPathsAPI();
        });
        console.log('Test character paths button initialized');
    }

    // Migration confirmation popup function
    function showMigrationConfirmation() {
        // Check if user is authenticated first
        if (!window.adminAuth || !window.adminAuth.requireAuth()) {
            window.adminUI.showToast('Please log in first to perform migration', 'error');
            return;
        }
        
        // Create modal backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'modal';
        backdrop.style.display = 'block';
        backdrop.style.zIndex = '10000';
        
        // Create modal content
        backdrop.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>🔄 Character Data Migration</h3>
                </div>
                
                <div class="modal-body" style="padding: 1.5em;">
                    <p><strong>What does this migration do?</strong></p>
                    <ul style="margin: 1em 0; padding-left: 1.5em;">
                        <li>Adds missing <code>currentLocation</code> objects for characters</li>
                        <li>Initializes <code>movementHistory</code> arrays if missing</li>
                        <li>Adds timestamps (<code>createdAt</code>, <code>updatedAt</code>) to characters</li>
                        <li>Resolves coordinates for place of origin locations</li>
                    </ul>
                    
                    <p><strong>When should you use this?</strong></p>
                    <ul style="margin: 1em 0; padding-left: 1.5em;">
                        <li>After restoring from an old backup</li>
                        <li>If character popups are missing information</li>
                        <li>When adding new character data structure features</li>
                    </ul>
                    
                    <div style="background: #f0f8ff; border: 1px solid #b3d9ff; border-radius: 4px; padding: 1em; margin: 1em 0;">
                        <strong>⚠️ Note:</strong> This will update your character data file on GitHub. 
                        Make sure you have a backup if needed.
                    </div>
                </div>
                
                <div class="form-actions" style="padding: 1em 1.5em;">
                    <button id="confirm-migration" class="btn-primary">✅ Yes, Run Migration</button>
                    <button id="cancel-migration" class="btn-secondary" style="margin-left: 0.5em;">❌ No, Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(backdrop);
        
        // Add event listeners
        document.getElementById('confirm-migration').addEventListener('click', async () => {
            document.body.removeChild(backdrop);
            
            // Show loading state
            window.adminUI.showToast('Starting character data migration...', 'info');
            
            // Run the migration
            const result = await window.adminCharacters.operations.migrateCharacterData();
            if (result && result.migratedCount > 0) {
                // Refresh the current tab if we're on characters
                if (window.location.hash === '#characters' || !window.location.hash) {
                    await window.adminCharacters.loadCharacters();
                }
            }
        });
        
        document.getElementById('cancel-migration').addEventListener('click', () => {
            document.body.removeChild(backdrop);
        });
        
        // Close on backdrop click
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                document.body.removeChild(backdrop);
            }
        });
    }
    
    // Reset and migration confirmation popup function
    function showResetMigrationConfirmation() {
        // Check if user is authenticated first
        if (!window.adminAuth || !window.adminAuth.requireAuth()) {
            window.adminUI.showToast('Please log in first to perform reset and migration', 'error');
            return;
        }
        
        // Create modal backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'modal';
        backdrop.style.display = 'block';
        backdrop.style.zIndex = '10000';
        
        // Create modal content
        backdrop.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>🔄 Reset & Fix Character Data</h3>
                </div>
                
                <div class="modal-body" style="padding: 1.5em;">
                    <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 1em; margin-bottom: 1em;">
                        <strong>⚠️ CAUTION: This will reset all character currentLocation data!</strong>
                    </div>
                    
                    <p><strong>What does this operation do?</strong></p>
                    <ol style="margin: 1em 0; padding-left: 1.5em;">
                        <li><strong>RESET:</strong> Removes all <code>currentLocation</code> data from characters</li>
                        <li><strong>MIGRATE:</strong> Correctly rebuilds <code>currentLocation</code> based on proper logic</li>
                        <li><strong>RESPECT MOVEMENT HISTORY:</strong> Only uses <code>placeOfOrigin</code> as fallback when no movements exist</li>
                    </ol>
                    
                    <p><strong>This fixes the incorrect migration where:</strong></p>
                    <ul style="margin: 1em 0; padding-left: 1.5em;">
                        <li>Characters with movement history had their <code>currentLocation</code> incorrectly set to <code>placeOfOrigin</code></li>
                        <li>Movement paths were being ignored in favor of birth location</li>
                    </ul>
                    
                    <div style="background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 4px; padding: 1em; margin: 1em 0;">
                        <strong>✅ After this fix:</strong> Characters will have correct current locations based on their actual movement history, with place of origin only used as a fallback for characters without any movements.
                    </div>
                </div>
                
                <div class="form-actions" style="padding: 1em 1.5em;">
                    <button id="confirm-reset-migration" class="btn-danger">🔄 Yes, Reset & Fix Data</button>
                    <button id="cancel-reset-migration" class="btn-secondary" style="margin-left: 0.5em;">❌ No, Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(backdrop);
        
        // Add event listeners
        document.getElementById('confirm-reset-migration').addEventListener('click', async () => {
            document.body.removeChild(backdrop);
            
            // Show loading state
            window.adminUI.showToast('Starting character data reset and migration...', 'info');
            
            // Run the reset and migration
            try {
                const response = await window.adminCharacters.auth.authenticatedFetch(`${window.adminCharacters.operations.apiBaseUrl}/reset-and-migrate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                const result = await response.json();
                
                if (result.success) {
                    window.adminUI.showToast(result.message, 'success');
                    
                    if (result.resetCount > 0 || result.migratedCount > 0) {
                        // Show detailed changes
                        console.log('Reset and migration changes:', result.changes);
                        
                        // Reload character data
                        await window.adminCharacters.loadCharacters();
                        
                        // Show detailed results
                        const changesList = result.changes.join('\n• ');
                        const detailMessage = `Reset and migration completed!\n\nReset: ${result.resetCount} characters\nMigrated: ${result.migratedCount} characters\n\nChanges:\n• ${changesList}`;
                        window.adminUI.showToast(detailMessage, 'success', 15000); // Show for 15 seconds
                    }
                } else {
                    window.adminUI.showToast('Reset and migration failed', 'error');
                }
            } catch (error) {
                console.error('Reset and migration failed:', error);
                
                // Show more detailed error information
                let errorMessage = 'Reset and migration failed';
                if (error.message.includes('Authentication required')) {
                    errorMessage = 'Please log in first to perform reset and migration';
                } else if (error.message.includes('Session expired')) {
                    errorMessage = 'Session expired, please log in again';
                } else if (error.message.includes('HTTP')) {
                    errorMessage = `Reset and migration failed: ${error.message}`;
                } else {
                    errorMessage = `Reset and migration failed: ${error.message}`;
                }
                
                window.adminUI.showToast(errorMessage, 'error');
            }
        });
        
        document.getElementById('cancel-reset-migration').addEventListener('click', () => {
            document.body.removeChild(backdrop);
        });
        
        // Close on backdrop click
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                document.body.removeChild(backdrop);
            }
        });
    }

    // Test Character Paths API function
    async function testCharacterPathsAPI() {
        window.adminUI.showToast('Testing Character Paths API...', 'info');
        
        try {
            // Test the stats endpoint first
            const statsResponse = await fetch('/api/character-paths/stats');
            const statsData = await statsResponse.json();
            
            console.log('Character Paths Stats:', statsData);
            
            // Test the main endpoint
            const pathsResponse = await fetch('/api/character-paths');
            const pathsData = await pathsResponse.json();
            
            console.log('Character Paths Data:', pathsData);
            
            // Display success message with stats
            const pathCount = Object.keys(pathsData.paths || {}).length;
            const totalCharacters = pathsData.metadata?.statistics?.totalCharacters || 0;
            
            window.adminUI.showToast(`✅ Character Paths API Working!\\n📊 ${pathCount} paths generated from ${totalCharacters} characters\\n🔗 Data size: ${JSON.stringify(pathsData).length} bytes`, 'success');
            
        } catch (error) {
            console.error('Character Paths API test failed:', error);
            window.adminUI.showToast(`❌ API test failed: ${error.message}`, 'error');
        }
    }
});

// Also provide a function to refresh options if needed dynamically
window.refreshFormOptions = function() {
    const selects = [
        { id: 'location-region-select', config: 'locationRegions' },
        { id: 'location-type-select', config: 'locationTypes' },
        { id: 'character-status-select', config: 'characterStatus' },
        { id: 'character-relationship-select', config: 'characterRelationships' },
        { id: 'movement-type', config: 'movementTypes' }
    ];
    
    selects.forEach(({ id, config }) => {
        const select = document.getElementById(id);
        if (select) {
            const currentValue = select.value;
            select.innerHTML = AdenaiConfig.generateSelectOptions(config, currentValue);
        }
    });
    
    console.log('Refreshed all form options');
};
