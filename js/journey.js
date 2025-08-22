// Dynamic Journey Loader - Clean Version
// Loads journey data directly from CMS without fallback

let journeyLayers = [];

// Dynamic journey loader
async function loadJourneys() {
    try {
        // Load from CMS using singular endpoint
        const response = await fetch('https://adenai-admin.piogino.ch/api/journey');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const journeys = await response.json();
        console.log(`✅ Loaded ${journeys.length} journey(s) from CMS`);
        
        // Clear existing journeys
        clearJourneys();
        
        // Render each active journey
        journeys.forEach(journey => {
            if (!journey.active) {
                console.log(`⏭️  Skipping inactive journey: ${journey.name}`);
                return;
            }
            
            const pathData = buildPathFromSegments(journey.segments);
            const journeyLayer = L.curve(pathData, {
                color: journey.color,
                weight: isMobile() ? journey.weightMobile : journey.weight,
                dashArray: isMobile() ? journey.dashArrayMobile : journey.dashArray,
                opacity: journey.opacity,
            }).addTo(map);
            
            // Enhanced popup with journey info
            const lastUpdate = new Date(journey.updatedAt).toLocaleDateString('de-DE');
            journeyLayer.bindPopup(`
                <div class="journey-popup">
                    <h4>${journey.name}</h4>
                    ${journey.description ? `<p>${journey.description}</p>` : ''}
                    <small>${journey.segments.length} Segmente • ${lastUpdate}</small>
                </div>
            `);
            
            // Store reference for cleanup
            journeyLayers.push(journeyLayer);
            
            console.log(`✨ Rendered: ${journey.name} (${journey.segments.length} segments)`);
        });
        
    } catch (error) {
        console.error('❌ Could not load journeys from CMS:', error);
        // Optionally show user-friendly error
        showJourneyError(error.message);
    }
}

function buildPathFromSegments(segments) {
    const pathData = [];
    for (const segment of segments) {
        pathData.push(segment.type);
        pathData.push([segment.coords[0], segment.coords[1]]);
        if (segment.type === 'Q' && segment.control) {
            pathData.push([segment.control[0], segment.control[1]]);
        }
    }
    return pathData;
}

function clearJourneys() {
    journeyLayers.forEach(layer => {
        if (map.hasLayer(layer)) {
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
    // Optional: Show error to user
    console.warn('🚫 Journey loading failed:', message);
    
    // You could add a visual error indicator here if desired
    // For example, a small notification in the corner
}

// Refresh function for manual updates
async function refreshJourneys() {
    console.log('🔄 Refreshing journeys...');
    await loadJourneys();
}

// Initialize when map is ready
function initJourneys() {
    if (typeof map !== 'undefined' && map) {
        loadJourneys();
        console.log('🚀 Journey system initialized');
    } else {
        // Wait for map to be ready
        setTimeout(initJourneys, 500);
    }
}

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initJourneys);
} else {
    initJourneys();
}

// Add basic CSS for popups
const style = document.createElement('style');
style.textContent = `
.journey-popup h4 {
    margin: 0 0 8px 0;
    color: #333;
}
.journey-popup p {
    margin: 0 0 8px 0;
    font-style: italic;
    color: #666;
}
.journey-popup small {
    color: #888;
    font-size: 0.8em;
}
`;
document.head.appendChild(style);

// Export functions for external use
window.refreshJourneys = refreshJourneys;
window.loadJourneys = loadJourneys;