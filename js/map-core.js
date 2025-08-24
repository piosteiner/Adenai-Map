// map-core.js - Core Map Functionality and Setup
class MapCore {
    constructor() {
        this.imageWidth = 2048;
        this.imageHeight = 1536;
        this.isMobile = window.innerWidth < 768;
        this.map = null;
        this.mapCRS = null;
        this.init();
    }

    init() {
        this.setupTheme();
        this.initializeMap();
        this.setupCoordinateDisplay();
        this.setupDragHandling();
        
        // 🔥 FIX: Expose map globally for journey system and other modules
        this.exposeMapGlobally();
    }

    setupTheme() {
        // Theme toggle functionality
        window.addEventListener("DOMContentLoaded", () => {
            const toggleBtn = document.createElement("button");
            toggleBtn.id = "themeToggle";
            toggleBtn.textContent = "🌙";
            toggleBtn.title = "Toggle Dark Mode";
            toggleBtn.style.position = "absolute";
            toggleBtn.style.top = "10px";
            toggleBtn.style.right = "10px";
            toggleBtn.style.zIndex = "1001";
            toggleBtn.style.padding = "6px 10px";
            toggleBtn.style.border = "none";
            toggleBtn.style.borderRadius = "4px";
            toggleBtn.style.cursor = "pointer";

            document.body.appendChild(toggleBtn);

            const userPref = localStorage.getItem("theme");
            const systemPref = window.matchMedia("(prefers-color-scheme: dark)").matches;

            if (userPref) {
                document.documentElement.setAttribute("data-theme", userPref);
            } else {
                document.documentElement.setAttribute("data-theme", systemPref ? "dark" : "light");
            }

            toggleBtn.addEventListener("click", () => {
                const current = document.documentElement.getAttribute("data-theme");
                const newTheme = current === "dark" ? "light" : "dark";
                document.documentElement.setAttribute("data-theme", newTheme);
                localStorage.setItem("theme", newTheme);
            });
        });
    }

    initializeMap() {
        // Flip Y axis: move origin to bottom-left (Originally 0,0 was on top left)
        this.mapCRS = L.extend({}, L.CRS.Simple, {
            transformation: new L.Transformation(1, 0, -1, this.imageHeight)
        });

        // Initialize the map using that CRS
        this.map = L.map('map', {
            crs: this.mapCRS,
            minZoom: -1,
            maxZoom: 3,
            zoomSnap: 0.1,    // Allow smoother fractional zoom levels
            zoomDelta: 1,  // Smaller steps when using +/- buttons or keyboard
            wheelPxPerZoomLevel: 120, // Optional: slower scroll-based zoom
            zoomControl: false // Disable default top-left zoom control
        });

        // Add zoom buttons in the bottom right
        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);

        // Overlay the image and fit bounds
        const imageBounds = [[0, 0], [this.imageHeight, this.imageWidth]];
        L.imageOverlay('adenai_map_01.jpg', imageBounds).addTo(this.map);
        this.map.fitBounds(imageBounds);

        // Set dragging container
        this.map.dragging._draggable._container = this.map.getContainer();
        
        // 🔥 ADD THIS LINE - Fix for journey system
        window.map = this.map;
        
        console.log('🗺️ Leaflet map initialized:', this.map);
    }

    // 🔥 NEW METHOD: Expose map globally for compatibility with existing journey system
    exposeMapGlobally() {
        // Set global map reference for journey.js and other modules that expect it
        window.map = this.map;
        
        // Also expose mapCore globally (already done in constructor, but being explicit)
        window.mapCore = this;
        
        // Add debug info
        console.log('🌍 Global map references set:');
        console.log('  window.map:', window.map);
        console.log('  window.mapCore:', window.mapCore);
        console.log('  Map has addLayer method:', typeof window.map?.addLayer === 'function');
        
        // Dispatch event for modules waiting for map to be ready
        document.dispatchEvent(new CustomEvent('leafletMapReady', {
            detail: { map: this.map, mapCore: this }
        }));
    }

    setupCoordinateDisplay() {
        // Show coordinates on mouse move
        this.map.on('mousemove', (e) => {
            const x = Math.round(e.latlng.lng); // X = lng
            const y = Math.round(e.latlng.lat); // Y = lat
            const coordsElement = document.getElementById('coords');
            if (coordsElement) {
                coordsElement.textContent = `X: ${x}, Y: ${y}`;
            }
        });
    }

    setupDragHandling() {
        // Allow dragging through popups and modals on mobile
        this.map.getContainer().addEventListener('touchstart', (e) => {
            if (e.target.closest('.leaflet-popup-content') || e.target.closest('.gallery-modal')) {
                this.map.dragging.enable(); // re-enable dragging
            }
        }, { passive: true });

        // Optional: fix for desktop too
        this.map.getContainer().addEventListener('mousedown', (e) => {
            if (e.target.closest('.leaflet-popup-content') || e.target.closest('.gallery-modal')) {
                this.map.dragging.enable();
            }
        });

        // Allow map dragging on popups and modals (mobile and desktop)
        const dragZones = ['.leaflet-popup-content', '.gallery-modal'];

        dragZones.forEach(selector => {
            document.addEventListener('touchstart', e => {
                if (e.target.closest(selector)) {
                    this.map.dragging.enable();  // Re-enable drag even if it started on popup
                }
            }, { passive: true });

            document.addEventListener('mousedown', e => {
                if (e.target.closest(selector)) {
                    this.map.dragging.enable();
                }
            });
        });
    }

    // Create standard icons
    createIcon(iconUrl, size = null) {
        const iconSize = size || (this.isMobile ? [40, 40] : [28, 28]);
        const iconAnchor = [iconSize[0] / 2, iconSize[1] / 2];
        
        return L.icon({
            iconUrl: iconUrl,
            iconSize: iconSize,
            iconAnchor: iconAnchor,
            popupAnchor: [0, -iconAnchor[1]]
        });
    }

    // Utility function to sanitize filenames
    sanitizeFilename(name) {
        return name
            .toLowerCase()
            .replace(/ä/g, 'ae')
            .replace(/ö/g, 'oe')
            .replace(/ü/g, 'ue')
            .replace(/ß/g, 'ss')
            .replace(/[^a-z0-9]/g, '');
    }

    // Get map instance
    getMap() {
        return this.map;
    }

    // Get mobile status
    getIsMobile() {
        return this.isMobile;
    }

    // Get image dimensions
    getDimensions() {
        return {
            width: this.imageWidth,
            height: this.imageHeight
        };
    }

    // 🔥 NEW: Validation method to check if map is properly set up
    validateMapSetup() {
        const issues = [];
        
        if (!this.map) {
            issues.push('Leaflet map not initialized');
        }
        
        if (!window.map) {
            issues.push('Global map reference not set');
        }
        
        if (window.map && typeof window.map.addLayer !== 'function') {
            issues.push('Global map is not a valid Leaflet map object');
        }
        
        if (window.map !== this.map) {
            issues.push('Global map reference does not match internal map');
        }
        
        if (issues.length > 0) {
            console.error('🚨 Map setup issues:', issues);
            return false;
        }
        
        console.log('✅ Map setup validation passed');
        return true;
    }
}

// Create global map core instance
window.mapCore = new MapCore();

// 🔥 ADDITIONAL: Validate setup after a short delay to ensure everything is ready
setTimeout(() => {
    if (window.mapCore) {
        const isValid = window.mapCore.validateMapSetup();
        if (isValid) {
            console.log('🎉 Map core ready for journey system!');
        }
    }
}, 100);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapCore;
}