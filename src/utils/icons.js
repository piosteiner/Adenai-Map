// Map Image Overlays - Initialized after map is ready
// Waits for map initialization before adding overlays

// Map Image Overlays - Initialized after map is ready
// Waits for map initialization before adding overlays

let overlaysAdded = false; // several ways below lead here (event, DOM ready, retries): the overlays only once

function initializeMapOverlays() {
    if (overlaysAdded) return true;
    return MapUtils.withMap((map) => {
        overlaysAdded = true;
        Logger.info('Initializing map image overlays...');

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

        //Gleissende Zitadelle — on another plane, below the map: its picture where its dot is, the edges fading into
        //the dark (the picture is a square painting, not a cut-out like Atlantis; map-core.css .overlay-plane)
        const gleissendeZitadelle = [
          [-108 - 55, 1402 - 55],  // Southwest corner
          [-108 + 55, 1402 + 55]   // Northeast corner
        ];

        //Gleissende Zitadelle
        L.imageOverlay('public/images/gleissende_zitadelle.webp', gleissendeZitadelle, {
          interactive: false,
          className: 'overlay-plane'
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

        Logger.success('Map image overlays initialized successfully');
        return true; // Return true to indicate success
        
    }, () => {
        Logger.warning('Map not ready yet, waiting for initialization...');
        return false; // Return false to indicate failure
    });
}// Initialize when map is ready - multiple fallback strategies
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
    Logger.info('Received adenaiMapInitialized event, attempting overlay initialization');
    tryInitializeOverlays();
});

// Listen for DOMContentLoaded as fallback
document.addEventListener('DOMContentLoaded', () => {
    Logger.info('DOM loaded, attempting overlay initialization');
    setTimeout(tryInitializeOverlays, 100);
});

// Immediate attempt if scripts load after map is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    Logger.info('Document already ready, attempting immediate overlay initialization');
    setTimeout(tryInitializeOverlays, 100);
}