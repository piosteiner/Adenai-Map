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
        
        // Dispatch map initialization event for other systems
        setTimeout(() => {
            document.dispatchEvent(new CustomEvent('adenaiMapInitialized'));
            Logger.info('🗺️ Map initialization event dispatched');
        }, 100);
    }

    setupTheme() {
        // Theme toggle functionality
        const toggleBtn = document.createElement("button");
        toggleBtn.id = "themeToggle";
        toggleBtn.textContent = "🌙";
        toggleBtn.title = "Toggle Dark Mode";
        toggleBtn.style.position = "absolute";
        toggleBtn.style.top = "10px";
        toggleBtn.style.right = "10px";
        toggleBtn.style.zIndex = "1001";
        toggleBtn.style.width = "50px";  // Make it square
        toggleBtn.style.height = "50px"; // Make it square
        toggleBtn.style.fontSize = "24px"; // Bigger icon
        toggleBtn.style.padding = "0"; // Remove padding for perfect square
        toggleBtn.style.border = "none";
        toggleBtn.style.borderRadius = "8px"; // Slightly larger border radius
        toggleBtn.style.cursor = "pointer";
        toggleBtn.style.display = "flex"; // Center the icon
        toggleBtn.style.alignItems = "center"; // Center vertically
        toggleBtn.style.justifyContent = "center"; // Center horizontally
        toggleBtn.style.backgroundColor = "rgba(255, 255, 255, 0.9)"; // Slight background
        toggleBtn.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.2)"; // Add shadow
        toggleBtn.style.transition = "all 0.2s ease"; // Smooth transitions

        document.body.appendChild(toggleBtn);

        // Add hover effects
        toggleBtn.addEventListener('mouseenter', () => {
            toggleBtn.style.transform = 'scale(1.05)';
            toggleBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
        });

        toggleBtn.addEventListener('mouseleave', () => {
            toggleBtn.style.transform = 'scale(1)';
            toggleBtn.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.2)';
        });

        toggleBtn.addEventListener('mousedown', () => {
            toggleBtn.style.transform = 'scale(0.95)';
        });

        toggleBtn.addEventListener('mouseup', () => {
            toggleBtn.style.transform = 'scale(1.05)';
        });

        const userPref = localStorage.getItem("theme");
        const systemPref = window.matchMedia("(prefers-color-scheme: dark)").matches;

        let currentTheme;
        if (userPref) {
            currentTheme = userPref;
            document.documentElement.setAttribute("data-theme", userPref);
        } else {
            currentTheme = systemPref ? "dark" : "light";
            document.documentElement.setAttribute("data-theme", currentTheme);
        }

        // Function to update toggle button icon based on current theme
        const updateToggleIcon = (theme) => {
            if (theme === "dark") {
                toggleBtn.textContent = "☀️"; // Sun icon for dark mode (click to go light)
                toggleBtn.title = "Switch to Light Mode";
                toggleBtn.style.backgroundColor = "rgba(40, 40, 40, 0.9)"; // Dark background
                toggleBtn.style.color = "#ffffff"; // White text/icon
            } else {
                toggleBtn.textContent = "🌙"; // Moon icon for light mode (click to go dark)
                toggleBtn.title = "Switch to Dark Mode";
                toggleBtn.style.backgroundColor = "rgba(255, 255, 255, 0.9)"; // Light background
                toggleBtn.style.color = "#000000"; // Dark text/icon
            }
        };

        // Set initial icon
        updateToggleIcon(currentTheme);

        toggleBtn.addEventListener("click", () => {
            const current = document.documentElement.getAttribute("data-theme");
            const newTheme = current === "dark" ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", newTheme);
            localStorage.setItem("theme", newTheme);
            
            // Update button icon
            updateToggleIcon(newTheme);
        });
    }    initializeMap() {
        // Flip Y axis: move origin to bottom-left (Originally 0,0 was on top left)
        this.mapCRS = L.extend({}, L.CRS.Simple, {
            transformation: new L.Transformation(1, 0, -1, this.imageHeight)
        });

        // Initialize the map using that CRS
        this.map = L.map('map', {
            crs: this.mapCRS,
            minZoom: -1,
            maxZoom: 3,
            zoomSnap: 0.02,    // Allow smoother fractional zoom levels
            zoomDelta: 0.5,  // Smaller steps when using +/- buttons or keyboard
            wheelPxPerZoomLevel: 120, // Optional: slower scroll-based zoom
            zoomControl: false // Disable default top-left zoom control
        });

        // Custom zoom control will be added after map initialization

        // Overlay the image and fit bounds
        const imageBounds = [[0, 0], [this.imageHeight, this.imageWidth]];
        L.imageOverlay('adenai_map_01.jpg', imageBounds).addTo(this.map);
        this.map.fitBounds(imageBounds);

        // Set movement bounds - restrict to 80% map height distance from edges
        const mapHeight = this.imageHeight;
        const mapWidth = this.imageWidth;
        const restrictionDistance = mapHeight * 0.8; // 80% of the map height
        
        const maxBounds = [
            [-restrictionDistance, -restrictionDistance], // Southwest (bottom-left)
            [mapHeight + restrictionDistance, mapWidth + restrictionDistance] // Northeast (top-right)
        ];
        
        this.map.setMaxBounds(maxBounds);
        this.map.options.maxBoundsViscosity = 1.0; // Prevent any movement outside bounds

        Logger.info(`🗺️ Map bounds restricted to: ${restrictionDistance}px beyond map edges`);

        // Add custom zoom control
        try {
            // this.setupCustomZoomControl(); // Commented out to remove zoom slider
            Logger.success('✅ Custom zoom control disabled by user request');
        } catch (error) {
            Logger.error('❌ Failed to setup custom zoom control:', error);
        }

        // Set dragging container
        this.map.dragging._draggable._container = this.map.getContainer();
        
        // 🔥 ADD THIS LINE - Fix for journey system
        window.map = this.map;
        
        Logger.success('🗺️ Leaflet map initialized:', this.map);
    }

    // 🔥 NEW METHOD: Expose map globally for compatibility with existing journey system
    exposeMapGlobally() {
        // Set global map reference for journey.js and other modules that expect it
        window.map = this.map;
        
        // Also expose mapCore globally (already done in constructor, but being explicit)
        window.mapCore = this;
        
        // Add debug info
        Logger.info('🌍 Global map references set:');
        Logger.info('  window.map:', window.map);
        Logger.info('  window.mapCore:', window.mapCore);
        Logger.info('  Map has addLayer method:', typeof window.map?.addLayer === 'function');
        
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
            Logger.error('🚨 Map setup issues:', issues);
            return false;
        }
        
        Logger.success('✅ Map setup validation passed');
        return true;
    }

    setupCustomZoomControl() {
        Logger.debug('🔧 Setting up custom zoom control...');
        Logger.debug('Map object:', this.map);
        Logger.debug('Map type:', typeof this.map);
        
        if (!this.map) {
            Logger.error('❌ Map object is not available');
            return;
        }
        // Create zoom control container
        const zoomContainer = document.createElement('div');
        zoomContainer.className = 'custom-zoom-control';
        
        // Create zoom percentage display
        const zoomDisplay = document.createElement('div');
        zoomDisplay.className = 'zoom-display';
        zoomDisplay.textContent = this.getZoomPercentage();
        
        // Create zoom slider container
        const sliderContainer = document.createElement('div');
        sliderContainer.className = 'zoom-slider-container';
        
        // Create zoom slider
        const zoomSlider = document.createElement('input');
        zoomSlider.type = 'range';
        zoomSlider.className = 'zoom-slider';
        zoomSlider.min = this.map.getMinZoom();
        zoomSlider.max = this.map.getMaxZoom();
        zoomSlider.step = 0.1;
        zoomSlider.value = this.map.getZoom();
        
        // Create zoom labels
        const minLabel = document.createElement('span');
        minLabel.className = 'zoom-label zoom-min';
        minLabel.textContent = '-';
        
        const maxLabel = document.createElement('span');
        maxLabel.className = 'zoom-label zoom-max';
        maxLabel.textContent = '+';
        
        // Assemble slider container
        sliderContainer.appendChild(minLabel);
        sliderContainer.appendChild(zoomSlider);
        sliderContainer.appendChild(maxLabel);
        
        // Assemble main container
        zoomContainer.appendChild(zoomDisplay);
        zoomContainer.appendChild(sliderContainer);
        
        // Add to map
        document.body.appendChild(zoomContainer);
        
        // Event listeners
        zoomSlider.addEventListener('input', (e) => {
            const zoomLevel = parseFloat(e.target.value);
            this.map.setZoom(zoomLevel);
        });
        
        // Update slider when map zoom changes
        this.map.on('zoomend', () => {
            zoomSlider.value = this.map.getZoom();
            zoomDisplay.textContent = this.getZoomPercentage();
        });
        
        // Initial display update
        zoomDisplay.textContent = this.getZoomPercentage();
        
        Logger.success('🎚️ Custom zoom control initialized');
    }
    
    getZoomPercentage() {
        const currentZoom = this.map.getZoom();
        const minZoom = this.map.getMinZoom();
        const maxZoom = this.map.getMaxZoom();
        
        // Calculate percentage (0% at minZoom, 100% at maxZoom)
        const percentage = ((currentZoom - minZoom) / (maxZoom - minZoom)) * 100;
        return `${Math.round(percentage)}%`;
    }
}

// Create global map core instance after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Logger.init('🚀 DOM loaded, initializing MapCore...');
    window.mapCore = new MapCore();
    
    // Validate setup after a short delay to ensure everything is ready
    setTimeout(() => {
        if (window.mapCore) {
            const isValid = window.mapCore.validateMapSetup();
            if (isValid) {
                Logger.success('🎉 Map core ready for journey system!');
            }
        }
    }, 100);
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapCore;
}