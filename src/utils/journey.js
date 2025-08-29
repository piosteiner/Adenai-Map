// Dynamic Journey Loader - Improved Version
// Enhanced with better map detection and error handling

let journeyLayers = [];

// 🔥 IMPROVED: Get map with fallback options
function getMap() {
    // Try multiple ways to access the map
    let map = window.map || 
              window.mapCore?.map || 
              window.mapCore?.getMap?.() ||
              window.adenaiMap?.getLeafletMap?.() ||
              null;
    
    // Validate the map object
    if (map && typeof map.addLayer === 'function') {
        return map;
    }
    
    // If we have a map but it's not valid, log debug info
    if (map) {
        console.error('❌ Invalid map object found:', {
            type: map.constructor.name,
            hasAddLayer: typeof map.addLayer,
            methods: Object.getOwnPropertyNames(map).filter(name => typeof map[name] === 'function')
        });
    }
    
    return null;
}

// 🔥 IMPROVED: Wait for map to be available
async function waitForMap(maxAttempts = 50) {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        const map = getMap();
        if (map) {
            console.log('✅ Map found for journeys:', map.constructor.name);
            return map;
        }
        
        console.log(`⏳ Waiting for map... (${attempts + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    throw new Error('Map not available after timeout');
}

// Dynamic journey loader
async function loadJourneys() {
    try {
        console.log('🔄 Loading journeys from CMS...');
        
        // 🔥 Wait for map to be available
        const map = await waitForMap();
        if (!map) {
            throw new Error('No valid Leaflet map available for journey rendering');
        }
        
        // Load from CMS using HttpUtils
        const journeys = await HttpUtils.fetchJSON('https://adenai-admin.piogino.ch/api/journey', {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        Logger.success(`Loaded ${journeys.length} journey(s) from CMS`);
        Logger.journey('Journey data:', journeys);
        
        // Clear existing journeys
        clearJourneys();
        
        // Render each active journey
        journeys.forEach((journey, index) => {
            if (!journey.active) {
                console.log(`⏭️ Skipping inactive journey: ${journey.name}`);
                return;
            }
            
            try {
                console.log(`🎨 Rendering journey: ${journey.name}`);
                const pathData = buildPathFromSegments(journey.segments);
                console.log('Path data:', pathData);
                
                if (pathData.length === 0) {
                    console.warn(`⚠️ No valid path data for journey: ${journey.name}`);
                    return;
                }
                
                const journeyLayer = L.curve(pathData, {
                    color: journey.color || '#ff6600',
                    weight: isMobile() ? (journey.weightMobile || 6) : (journey.weight || 4),
                    dashArray: isMobile() ? (journey.dashArrayMobile || '16,10') : (journey.dashArray || '10,6'),
                    opacity: journey.opacity || 0.7,
                });

                // Add to map with validation
                if (map && typeof map.addLayer === 'function') {
                    journeyLayer.addTo(map);
                    
                    // Enhanced popup with journey info
                    const lastUpdate = journey.updatedAt ? new Date(journey.updatedAt).toLocaleDateString('de-DE') : 'Unknown';
                    journeyLayer.bindPopup(`
                        <div class="journey-popup">
                            <h4>${escapeHtml(journey.name)}</h4>
                            ${journey.description ? `<p>${escapeHtml(journey.description)}</p>` : ''}
                            <small>${journey.segments ? journey.segments.length : 0} Segmente • ${lastUpdate}</small>
                        </div>
                    `);
                    
                    // Store reference for cleanup
                    journeyLayers.push(journeyLayer);
                    
                    console.log(`✨ Rendered: ${journey.name} (${journey.segments ? journey.segments.length : 0} segments)`);
                } else {
                    console.error('❌ Map not available for journey rendering');
                }
                
            } catch (renderError) {
                console.error(`❌ Error rendering journey ${journey.name}:`, renderError);
            }
        });
        
        console.log(`🎉 Successfully rendered ${journeyLayers.length} active journeys`);
        
    } catch (error) {
        console.error('❌ Could not load journeys from CMS:', error);
        // Show user-friendly error
        showJourneyError(error.message);
    }
}

function buildPathFromSegments(segments) {
    if (!segments || !Array.isArray(segments)) {
        console.warn('⚠️ Invalid segments data');
        return [];
    }
    
    const pathData = [];
    
    for (const segment of segments) {
        if (!segment.coords || !Array.isArray(segment.coords) || segment.coords.length !== 2) {
            console.warn('⚠️ Invalid segment coordinates:', segment);
            continue;
        }
        
        // Add the segment type (M, L, Q, etc.)
        pathData.push(segment.type || 'L');
        
        // Add the main coordinates
        pathData.push([segment.coords[0], segment.coords[1]]);
        
        // For quadratic curves (Q), add control point
        if (segment.type === 'Q' && segment.control && Array.isArray(segment.control) && segment.control.length === 2) {
            pathData.push([segment.control[0], segment.control[1]]);
        }
    }
    
    console.log(`🔧 Built path data with ${pathData.length} elements from ${segments.length} segments`);
    return pathData;
}

function clearJourneys() {
    console.log('🧹 Clearing existing journeys...');
    const map = getMap();
    
    journeyLayers.forEach(layer => {
        if (map && map.hasLayer && map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    });
    journeyLayers = [];
}

function isMobile() {
    return window.innerWidth <= 768 || 
           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function showJourneyError(message) {
    console.warn('🚫 Journey loading failed:', message);
    
    // Create a simple error notification
    const errorDiv = document.createElement('div');
    errorDiv.className = 'journey-error-notification';
    errorDiv.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; background: #f44336; color: white; padding: 12px 16px; border-radius: 4px; z-index: 10000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
            <strong>⚠️ Journey Loading Failed</strong><br>
            <small>${escapeHtml(message)}</small>
        </div>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 10000);
}

// Refresh function for manual updates
async function refreshJourneys() {
    console.log('🔄 Refreshing journeys...');
    await loadJourneys();
}

// 🔥 IMPROVED: Initialize with better error handling
async function initJourneys() {
    try {
        console.log('🚀 Initializing journey system...');
        
        // Wait for map with timeout
        const map = await waitForMap();
        
        if (map) {
            console.log('🚀 Map ready, loading journeys...');
            await loadJourneys();
            console.log('✅ Journey system initialized successfully');
        } else {
            throw new Error('Map not available for journey initialization');
        }
        
    } catch (error) {
        console.error('❌ Failed to initialize journey system:', error);
        showJourneyError(`Initialization failed: ${error.message}`);
    }
}

// Auto-initialize based on document state
function startJourneySystem() {
    console.log('🎯 Starting journey system...');
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initJourneys);
    } else {
        // DOM is already ready
        initJourneys();
    }
}

// Utility function for HTML escaping
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Enhanced CSS for popups and notifications
const journeyStyles = document.createElement('style');
journeyStyles.textContent = `
.journey-popup h4 {
    margin: 0 0 8px 0;
    color: #333;
    font-size: 1.1em;
}
.journey-popup p {
    margin: 0 0 8px 0;
    font-style: italic;
    color: #666;
    font-size: 0.9em;
}
.journey-popup small {
    color: #888;
    font-size: 0.8em;
}

.journey-error-notification {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
`;

// Add styles to head if not already present
if (!document.getElementById('journey-styles')) {
    journeyStyles.id = 'journey-styles';
    document.head.appendChild(journeyStyles);
}

// Start the system
startJourneySystem();

// Export functions for external use
window.refreshJourneys = refreshJourneys;
window.loadJourneys = loadJourneys;
window.clearJourneys = clearJourneys;

// 🔥 IMPROVED: Debug function with more detailed info
window.debugJourneys = function() {
    const map = getMap();
    
    console.log('🔍 Journey Debug Info:');
    console.log('- Layers loaded:', journeyLayers.length);
    console.log('- Map available:', !!map);
    console.log('- Map type:', map?.constructor?.name || 'N/A');
    console.log('- Map methods:', {
        addLayer: typeof map?.addLayer,
        removeLayer: typeof map?.removeLayer,
        hasLayer: typeof map?.hasLayer
    });
    console.log('- Mobile mode:', isMobile());
    console.log('- Layers:', journeyLayers);
    console.log('- Global references:', {
        windowMap: !!window.map,
        mapCore: !!window.mapCore,
        adenaiMap: !!window.adenaiMap
    });
    
    // Try to validate each layer
    if (journeyLayers.length > 0) {
        console.log('- Layer validation:');
        journeyLayers.forEach((layer, i) => {
            console.log(`  Layer ${i}:`, {
                type: layer.constructor.name,
                onMap: map ? map.hasLayer(layer) : 'unknown'
            });
        });
    }
    
    return {
        layersCount: journeyLayers.length,
        mapAvailable: !!map,
        mapValid: !!(map && typeof map.addLayer === 'function')
    };
};

// 🔥 NEW: Manual map detection for debugging
window.detectMaps = function() {
    console.log('🔍 Detecting all available maps:');
    console.log('- window.map:', window.map, window.map?.constructor?.name);
    console.log('- window.mapCore:', window.mapCore);
    console.log('- window.mapCore.map:', window.mapCore?.map, window.mapCore?.map?.constructor?.name);
    console.log('- window.adenaiMap:', window.adenaiMap);
    console.log('- getMap() result:', getMap());
    
    // Look for any Leaflet map instances
    const allMaps = [];
    for (let key in window) {
        if (window[key] && typeof window[key] === 'object' && window[key].constructor?.name === 'Map') {
            allMaps.push({ key, map: window[key] });
        }
    }
    console.log('- All Leaflet Map instances found:', allMaps);
    
    return { allMaps, currentMap: getMap() };
};

console.log('📚 Enhanced journey system script loaded successfully');