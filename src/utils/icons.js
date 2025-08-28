// Map Image Overlays - Initialized after map is ready
// Waits for map initialization before adding overlays

// Map Image Overlays - Initialized after map is ready
// Waits for map initialization before adding overlays

function initializeMapOverlays() {
    // Get map reference using modern approach
    let map = null;
    
    if (window.mapCore && typeof window.mapCore.getMap === 'function') {
        map = window.mapCore.getMap();
        console.log('🖼️ Got map from mapCore.getMap()');
    } else if (window.map) {
        map = window.map;
        console.log('🖼️ Got map from window.map');
    }
    
    if (!map) {
        console.warn('🖼️ Map not ready yet, waiting for initialization...');
        return false; // Return false to indicate failure
    }

    console.log('🖼️ Initializing map image overlays...');

    try {
        //Map Expansion
        const mapextension1 = [
          [850 - 450, 2248 - 200],  // Southwest corner
          [850 + 450, 2248 + 200]   // Northeast corner
        ];

        //Map Expansion
        L.imageOverlay('public/images/mapextension_east.png', mapextension1, {
          interactive: false
        }).addTo(map);

        ///---------------------

        //Goblin Hole
        const goblinhole = [
          [1040 - 20, 1472 - 20],  // Southwest corner
          [1040 + 20, 1472 + 20]   // Northeast corner
        ];

        //Goblin Hole
        L.imageOverlay('public/images/goblin_hole.png', goblinhole, {
          interactive: false
        }).addTo(map);

        ///---------------------

        //Ship to Motu Motu
        const ship1 = [
          [1032 - 30, 1916 - 30],  // Southwest corner
          [1032 + 30, 1916 + 30]   // Northeast corner
        ];

        //Ship to Motu Motu
        L.imageOverlay('public/images/vsuzh_ship_mirrored.png', ship1, {
          interactive: false
        }).addTo(map);

        ///---------------------

        //Ship flying down
        const shipfly = [
          [1040 - 40, 2297 - 40],  // Southwest corner
          [1040 + 40, 2297 + 40]   // Northeast corner
        ];

        //Ship flying down
        L.imageOverlay('public/images/vsuzh_ship_fly.png', shipfly, {
          interactive: false
        }).addTo(map);

        ///---------------------

        //Ship to Upeto
        const ship2 = [
          [817 - 30, 2137 - 30],  // Southwest corner
          [817 + 30, 2137 + 30]   // Northeast corner
        ];

        //Ship to Upeto
        L.imageOverlay('public/images/vsuzh_ship.png', ship2, {
          interactive: false
        }).addTo(map);

        ///---------------------

        //Atlantis Underwater
        const atlantisBubble = [
          [975 - 40, 2210 - 40],  // Southwest corner
          [975 + 40, 2210 + 40]   // Northeast corner
        ];

        //Atlantis Underwater
        L.imageOverlay('public/images/atlantis_bubble.png', atlantisBubble, {
          interactive: false
        }).addTo(map);

        ///---------------------

        //Atlantis Flying
        const atlantisClouds = [
          [1200 - 40, 2210 - 40],  // Southwest corner
          [1200 + 40, 2210 + 40]   // Northeast corner
        ];

        //Atlantis Flying
        L.imageOverlay('public/images/atlantis_clouds.png', atlantisClouds, {
          interactive: false
        }).addTo(map);

        ///---------------------

        //Atlantis Icon 1 and 2
        //const atlantisGeneral1 = [
        //  [975 - 40, 2210 - 40],  // Southwest corner
        //  [975 + 40, 2210 + 40]   // Northeast corner
        //];

        //const atlantisGeneral2 = [
        //  [1200 - 40, 2210 - 40],  // Southwest corner
        //  [1200 + 40, 2210 + 40]   // Northeast corner
        //];

        //const atlantisImage = 'public/images/atlantis_general.png';
        //const atlantisOptions = { interactive: false };

        //L.imageOverlay(atlantisImage, atlantisGeneral1, atlantisOptions).addTo(map);
        //L.imageOverlay(atlantisImage, atlantisGeneral2, atlantisOptions).addTo(map);

        console.log('✅ Map image overlays initialized successfully');
        return true; // Return true to indicate success
        
    } catch (error) {
        console.error('❌ Error initializing map overlays:', error);
        return false; // Return false to indicate failure
    }
}

// Initialize when map is ready - multiple fallback strategies
function tryInitializeOverlays() {
    if (initializeMapOverlays()) {
        return; // Success, stop trying
    }
    
    // If failed, try again after short delay
    setTimeout(() => {
        if (initializeMapOverlays()) {
            return; // Success on retry
        }
        
        // Final attempt after longer delay
        setTimeout(() => {
            initializeMapOverlays();
        }, 2000);
    }, 500);
}

// Listen for map initialization event
document.addEventListener('adenaiMapInitialized', () => {
    console.log('🖼️ Received adenaiMapInitialized event, attempting overlay initialization');
    tryInitializeOverlays();
});

// Listen for DOMContentLoaded as fallback
document.addEventListener('DOMContentLoaded', () => {
    console.log('🖼️ DOM loaded, attempting overlay initialization');
    setTimeout(tryInitializeOverlays, 100);
});

// Immediate attempt if scripts load after map is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('🖼️ Document already ready, attempting immediate overlay initialization');
    setTimeout(tryInitializeOverlays, 100);
}