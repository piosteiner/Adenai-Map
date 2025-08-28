// TEST CHARACTER PATHS - REMOVE WHEN API IS WORKING
// This file provides dummy character paths for testing when the API is unavailable

window.createTestCharacterPaths = function() {
    console.log('🧪 Creating test character paths for development...');
    
    if (!window.movementSystem) {
        console.error('❌ Movement system not available - waiting for initialization...');
        // Try again after a delay
        setTimeout(() => {
            if (window.movementSystem) {
                window.createTestCharacterPaths();
            } else {
                console.error('❌ Movement system still not available after waiting');
            }
        }, 1000);
        return;
    }
    
    // Clear existing paths
    window.movementSystem.clearCharacterPaths();
    
    // Create dummy path data in the format expected by the movement system
    const testPaths = [
        {
            character: {
                id: 'vsuzh',
                name: 'VsuzH',
                relationship: 'party',
                status: 'alive'
            },
            points: [
                { coordinates: [1000, 1500], date: '2024-01-01', location: 'Start Location' },
                { coordinates: [1100, 1600], date: '2024-01-02', location: 'Second Location' },
                { coordinates: [1200, 1700], date: '2024-01-03', location: 'Current Location' }
            ],
            pathLine: null,
            markers: [],
            isVisible: false
        },
        {
            character: {
                id: 'test_ally',
                name: 'Test Ally',
                relationship: 'ally',
                status: 'alive'
            },
            points: [
                { coordinates: [800, 1200], date: '2024-01-01', location: 'Ally Start' },
                { coordinates: [900, 1300], date: '2024-01-02', location: 'Ally Second' }
            ],
            pathLine: null,
            markers: [],
            isVisible: false
        }
    ];
    
    // Create Leaflet path lines and markers for each test path
    testPaths.forEach(pathData => {
        const coords = pathData.points.map(point => [point.coordinates[1], point.coordinates[0]]);
        
        // Create path line with server-compatible styling
        pathData.pathLine = L.polyline(coords, {
            color: pathData.character.relationship === 'party' ? '#584cffff' : '#28a745',
            weight: 2,
            opacity: 0.7,
            dashArray: '5,2'
        });
        
        // Create markers for each point
        pathData.markers = pathData.points.map((point, index) => {
            return L.circleMarker([point.coordinates[1], point.coordinates[0]], {
                radius: 6,
                fillColor: pathData.character.relationship === 'party' ? '#584cffff' : '#28a745',
                color: '#fff',
                weight: 2,
                fillOpacity: 0.8
            }).bindPopup(`
                <strong>${pathData.character.name}</strong><br>
                📍 ${point.location}<br>
                📅 ${point.date}<br>
                <em>Test Path Data</em>
            `);
        });
    });
    
    // Add paths to movement system
    window.movementSystem.characterPaths = testPaths;
    
    console.log(`✅ Created ${testPaths.length} test character paths`);
    console.log('💡 You can now test path display in the character panel');
    
    return testPaths;
};

// Auto-create test paths if API is unavailable
document.addEventListener('adenaiMapReady', () => {
    setTimeout(() => {
        if (window.movementSystem && window.movementSystem.characterPaths.length === 0) {
            console.log('🔧 No character paths loaded - creating test data...');
            window.createTestCharacterPaths();
        }
    }, 3000); // Increased delay to ensure everything is loaded
});

// Also listen for characters loaded event as backup
document.addEventListener('charactersLoaded', () => {
    setTimeout(() => {
        if (window.movementSystem && window.movementSystem.characterPaths.length === 0) {
            console.log('🔧 Characters loaded but no paths - creating test data...');
            window.createTestCharacterPaths();
        }
    }, 2000);
});

// Helper function to wait for movement system to be available
window.waitForMovementSystem = function() {
    return new Promise((resolve, reject) => {
        if (window.movementSystem) {
            resolve(window.movementSystem);
            return;
        }
        
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max
        
        const interval = setInterval(() => {
            attempts++;
            if (window.movementSystem) {
                clearInterval(interval);
                resolve(window.movementSystem);
            } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                reject(new Error('Movement system not available after 5 seconds'));
            }
        }, 100);
    });
};

console.log('🧪 Test character paths module loaded');

// Console helper functions available immediately
window.testMovement = async function() {
    try {
        const movementSystem = await window.waitForMovementSystem();
        console.log('✅ Movement system available:', movementSystem);
        
        console.log('📊 Current paths:', movementSystem.characterPaths.length);
        console.log('👁️ Visible paths:', movementSystem.visibleCharacterPaths.size);
        
        // Test API connection
        console.log('🌐 Testing API...');
        const apiResult = await movementSystem.testAPIConnection();
        console.log('API Result:', apiResult);
        
        return movementSystem;
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
};

window.createTestPaths = function() {
    window.createTestCharacterPaths();
};
