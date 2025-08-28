// Map Image Overlays - Initialized after map is ready
// Waits for map initialization before adding overlays

function initializeMapOverlays() {
    // Check if map is available
    if (typeof window.map === 'undefined' || !window.map) {
        console.warn('🖼️ Map not ready yet, waiting for initialization...');
        return;
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
        }).addTo(window.map);

        ///---------------------

        //Goblin Hole
        const goblinhole = [
          [1040 - 20, 1472 - 20],  // Southwest corner
          [1040 + 20, 1472 + 20]   // Northeast corner
        ];

        //Goblin Hole
        L.imageOverlay('public/images/goblin_hole.png', goblinhole, {
          interactive: false
        }).addTo(window.map);

        ///---------------------

        //Ship to Motu Motu
        const ship1 = [
          [1032 - 30, 1916 - 30],  // Southwest corner
          [1032 + 30, 1916 + 30]   // Northeast corner
        ];

        //Ship to Motu Motu
        L.imageOverlay('public/images/vsuzh_ship_mirrored.png', ship1, {
          interactive: false
        }).addTo(window.map);

        ///---------------------

        //Ship flying down
        const shipfly = [
          [1040 - 40, 2297 - 40],  // Southwest corner
          [1040 + 40, 2297 + 40]   // Northeast corner
        ];

        //Ship flying down
        L.imageOverlay('public/images/vsuzh_ship_fly.png', shipfly, {
          interactive: false
        }).addTo(window.map);

        ///---------------------

        //Ship to Upeto
        const ship2 = [
          [817 - 30, 2137 - 30],  // Southwest corner
          [817 + 30, 2137 + 30]   // Northeast corner
        ];

        //Ship to Upeto
        L.imageOverlay('public/images/vsuzh_ship.png', ship2, {
          interactive: false
        }).addTo(window.map);

        ///---------------------

        //Atlantis Underwater
        const atlantisBubble = [
          [975 - 40, 2210 - 40],  // Southwest corner
          [975 + 40, 2210 + 40]   // Northeast corner
        ];

        //Atlantis Underwater
        L.imageOverlay('public/images/atlantis_bubble.png', atlantisBubble, {
          interactive: false
        }).addTo(window.map);

        ///---------------------

        //Atlantis Flying
        const atlantisClouds = [
          [1200 - 40, 2210 - 40],  // Southwest corner
          [1200 + 40, 2210 + 40]   // Northeast corner
        ];

        //Atlantis Flying
        L.imageOverlay('public/images/atlantis_clouds.png', atlantisClouds, {
          interactive: false
        }).addTo(window.map);

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
        
    } catch (error) {
        console.error('❌ Error initializing map overlays:', error);
    }
}

// Initialize when map is ready
if (typeof window.map !== 'undefined' && window.map) {
    // Map already available
    initializeMapOverlays();
} else {
    // Wait for map initialization event
    document.addEventListener('adenaiMapInitialized', initializeMapOverlays);
    
    // Fallback: try again after a short delay
    setTimeout(() => {
        if (typeof window.map !== 'undefined' && window.map && document.getElementById('map')) {
            initializeMapOverlays();
        }
    }, 500);
}