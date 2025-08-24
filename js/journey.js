// Dynamic Journey Loader - Clean Version
// Loads journey data directly from CMS without fallback

let journeyLayers = [];

// Dynamic journey loader
async function loadJourneys() {
    try {
        console.log('🔄 Loading journeys from CMS...');
        
        // Load from CMS using singular endpoint
        const response = await fetch('https://adenai-admin.piogino.ch/api/journey', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const journeys = await response.json();
        console.log(`✅ Loaded ${journeys.length} journey(s) from CMS`);
        console.log('Journey data:', journeys);
        
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

                // Check if map exists before adding
                if (typeof map !== 'undefined' && map) {
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
    journeyLayers.forEach(layer => {
        if (typeof map !== 'undefined' && map && map.hasLayer(layer)) {
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

// Initialize when map is ready
function initJourneys() {
    if (typeof map !== 'undefined' && map) {
        console.log('🚀 Map ready, initializing journey system...');
        loadJourneys();
        console.log('🚀 Journey system initialized');
    } else {
        console.log('⏳ Map not ready, waiting...');
        // Wait for map to be ready
        setTimeout(initJourneys, 500);
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

// Debug function
window.debugJourneys = function() {
    console.log('🔍 Journey Debug Info:');
    console.log('- Layers loaded:', journeyLayers.length);
    console.log('- Map available:', typeof map !== 'undefined' && !!map);
    console.log('- Mobile mode:', isMobile());
    console.log('- Layers:', journeyLayers);
};

console.log('📚 Journey system script loaded successfully');