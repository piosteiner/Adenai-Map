// admin-public/js/modules/journeys/map.js - Journey Map Module - Map initialization, rendering, and interaction

class JourneyMap {
    constructor(ui) {
        this.ui = ui;
        this.map = null;
        this.journeyLayers = new Map();
        this.tempSegments = [];
        this.editMode = false;
        this.resizeObservers = new Set();
        this.resizeTimeout = null;
        this.debugMode = true;
    }

    initializeMap() {
        const mapContainer = document.getElementById('journeys-map');
        if (!mapContainer) {
            throw new Error('Map container not found - check HTML structure');
        }
        
        if (this.map) {
            this.log('🗺️ Map already initialized, forcing resize...');
            this.forceMapResize();
            return;
        }

        try {
            this.log('🗺️ Initializing map with correct 4:3 aspect ratio...');
            
            // Force container to be visible and properly sized
            const container = mapContainer.parentElement;
            if (container) {
                container.style.display = 'block';
                container.style.visibility = 'visible';
            }
            
            // Check if Leaflet is available
            if (typeof L === 'undefined') {
                throw new Error('Leaflet library not loaded - check script includes');
            }
            
            // Use Simple CRS like main map with correct transformation
            this.map = L.map('journeys-map', {
                crs: L.CRS.Simple,
                minZoom: -2,
                maxZoom: 3,
                zoomControl: true,
                attributionControl: false
            });

            // Use exact same dimensions as main map (2048x1536)
            const bounds = [[0, 0], [1536, 2048]]; // [height, width] - matches main map
            
            // Try to load map image
            this.loadMapImage(bounds);

            this.map.fitBounds(bounds);
            
            // Setup click handler for adding segments
            this.map.on('click', (e) => {
                if (this.editMode) {
                    this.addMapPoint(e.latlng);
                }
            });

            // Force proper sizing with multiple attempts
            this.forceMapResize();
            
            // Setup resize observer for dynamic resizing
            this.setupMapResizeObserver();

            this.log('✅ Journey map initialized successfully with 4:3 aspect ratio');
        } catch (error) {
            console.error('❌ Error initializing map:', error);
            throw error;
        }
    }

    loadMapImage(bounds) {
        const imagePaths = [
            'images/adenai_map_01.jpg',
            '../images/adenai_map_01.jpg',
            '/images/adenai_map_01.jpg',
            'adenai_map_01.jpg',
            '../adenai_map_01.jpg',
        ];

        let pathIndex = 0;
        let succeeded = false;
        let currentOverlay = null;

        const tryLoadImage = () => {
            if (pathIndex >= imagePaths.length) {
                if (!succeeded) {
                    this.log('⚠️ All image paths failed, using placeholder');
                    this.createPlaceholderMap(bounds);
                }
                return;
            }

            const imagePath = imagePaths[pathIndex];
            this.log(`🔍 Trying image path ${pathIndex + 1}/${imagePaths.length}: ${imagePath}`);

            if (currentOverlay && this.map && this.map.hasLayer(currentOverlay) && !succeeded) {
                this.map.removeLayer(currentOverlay);
            }

            let loadedOrErrored = false;
            const overlay = L.imageOverlay(imagePath, bounds);

            const clearAndMark = () => {
                loadedOrErrored = true;
                if (timeoutId) clearTimeout(timeoutId);
            };

            overlay.once('load', () => {
                clearAndMark();
                if (succeeded) return;
                this.log(`✅ Map image loaded successfully: ${imagePath}`);
                succeeded = true;
                overlay.addTo(this.map);
                currentOverlay = overlay;

                // Resize after load
                setTimeout(() => this.forceMapResize(), 100);
            });

            overlay.once('error', () => {
                clearAndMark();
                this.log(`❌ Failed to load: ${imagePath}`);
                pathIndex++;
                tryLoadImage();
            });

            overlay.addTo(this.map);
            currentOverlay = overlay;

            const timeoutId = setTimeout(() => {
                if (!loadedOrErrored) {
                    this.log(`⏳ Timeout while loading: ${imagePath} — retrying next path`);
                    if (this.map && this.map.hasLayer(overlay)) {
                        this.map.removeLayer(overlay);
                    }
                    pathIndex++;
                    tryLoadImage();
                }
            }, 3000);
        };

        tryLoadImage();
    }

    createPlaceholderMap(bounds) {
        this.log('🔍 Creating placeholder map background');
        
        const placeholderOverlay = L.imageOverlay(
            'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="2048" height="1536" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#ccc" stroke-width="1"/>
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="#f0f8ff"/>
                    <rect width="100%" height="100%" fill="url(#grid)"/>
                    <text x="1024" y="768" text-anchor="middle" font-family="Arial" font-size="48" fill="#666">
                        Adenai Map Placeholder
                    </text>
                    <text x="1024" y="820" text-anchor="middle" font-family="Arial" font-size="24" fill="#999">
                        Click to add journey segments
                    </text>
                </svg>
            `),
            bounds
        ).addTo(this.map);
        
        this.showNotification('Map image not found - using placeholder', 'warning');
        
        setTimeout(() => this.forceMapResize(), 100);
    }

    forceMapResize() {
        if (!this.map) {
            this.log('⚠️ Cannot resize map - map not initialized');
            return;
        }
        
        // Ensure container is properly sized and has correct aspect ratio
        const container = document.getElementById('journeys-map');
        if (container) {
            const parent = container.parentElement;
            if (parent) {
                const computedStyle = window.getComputedStyle(parent);
                const width = parseFloat(computedStyle.width);
                const height = parseFloat(computedStyle.height);
                const ratio = width / height;
                const expectedRatio = 4/3;
                
                this.log(`📏 Container dimensions: ${width.toFixed(0)}px × ${height.toFixed(0)}px`);
                this.log(`📏 Aspect ratio: ${ratio.toFixed(3)} (expected: ${expectedRatio.toFixed(3)})`);
                
                if (Math.abs(ratio - expectedRatio) > 0.1) {
                    console.warn(`⚠️ Container aspect ratio ${ratio.toFixed(2)} doesn't match expected 4:3 ratio (${expectedRatio.toFixed(2)})`);
                }
            }
        }
        
        // Multiple resize attempts with different timings
        const resizeTimes = [0, 50, 100, 200, 500, 1000];
        
        resizeTimes.forEach((delay, index) => {
            setTimeout(() => {
                if (this.map) {
                    this.map.invalidateSize({
                        animate: false,
                        pan: false,
                        reset: true
                    });
                    this.log(`🔄 Map resize attempt ${index + 1} at ${delay}ms`);
                    
                    if (index === resizeTimes.length - 1) {
                        this.log('✅ Map resize sequence completed');
                        this.validateMapState();
                    }
                }
            }, delay);
        });
    }

    validateMapState() {
        if (!this.map) return;
        
        try {
            const mapSize = this.map.getSize();
            const mapBounds = this.map.getBounds();
            
            this.log('📏 Map validation:');
            this.log(`  - Size: ${mapSize.x}×${mapSize.y}px`);
            this.log(`  - Bounds: ${JSON.stringify(mapBounds)}`);
            this.log(`  - Zoom: ${this.map.getZoom()}`);
            this.log(`  - Center: ${JSON.stringify(this.map.getCenter())}`);
            
            const aspectRatio = mapSize.x / mapSize.y;
            const expectedRatio = 4/3;
            
            if (Math.abs(aspectRatio - expectedRatio) < 0.1) {
                this.log('✅ Map aspect ratio is correct');
            } else {
                console.warn(`⚠️ Map aspect ratio ${aspectRatio.toFixed(2)} differs from expected ${expectedRatio.toFixed(2)}`);
            }
            
        } catch (error) {
            console.warn('⚠️ Could not validate map state:', error.message);
        }
    }

    setupMapResizeObserver() {
        if (!window.ResizeObserver || !this.map) {
            this.log('⚠️ ResizeObserver not available or map not initialized');
            return;
        }
        
        const mapContainer = document.getElementById('journeys-map');
        if (!mapContainer) return;
        
        const containers = [mapContainer, mapContainer.parentElement];
        
        containers.forEach((container, index) => {
            if (container && !container.journeyResizeObserver) {
                const observer = new ResizeObserver((entries) => {
                    if (this.map) {
                        if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
                        this.resizeTimeout = setTimeout(() => {
                            this.map.invalidateSize(true);
                            this.log(`🔄 Map resized via ResizeObserver (container ${index + 1})`);
                        }, 50);
                    }
                });
                
                observer.observe(container);
                container.journeyResizeObserver = observer;
                this.resizeObservers.add(observer);
                this.log(`👁️ ResizeObserver setup for container ${index + 1}`);
            }
        });
    }

    renderJourneyOnMap(journey) {
        if (!journey || !journey.segments || !journey.segments.length) {
            this.log('⚠️ No segments to render on map');
            return;
        }

        try {
            this.log(`🗺️ Rendering ${journey.segments.length} segments on map`);
            const pathData = this.buildPathData(journey.segments);
            
            if (pathData.length === 0) {
                this.log('⚠️ No valid coordinates found in segments');
                return;
            }
            
            const journeyLine = L.polyline(pathData, {
                color: journey.color || '#ff6600',
                weight: journey.weight || 4,
                dashArray: journey.dashArray || '10,6',
                opacity: journey.opacity || 0.7
            }).addTo(this.map);

            journeyLine.bindPopup(this.escapeHtml(journey.name));
            this.journeyLayers.set(journey.id, journeyLine);

            // Add segment markers
            this.addSegmentMarkers(journey);
            
            this.log('✅ Journey rendered on map successfully');

        } catch (error) {
            console.error('❌ Error rendering journey on map:', error);
            throw error;
        }
    }

    buildPathData(segments) {
        const latlngs = [];
        
        for (const segment of segments) {
            if (segment.coords && Array.isArray(segment.coords) && segment.coords.length === 2) {
                latlngs.push([segment.coords[0], segment.coords[1]]);
            } else {
                this.log('⚠️ Invalid segment coordinates:', segment);
            }
        }
        
        this.log(`🔧 Built path data with ${latlngs.length} points`);
        return latlngs;
    }

    addSegmentMarkers(journey) {
        if (!journey || !journey.segments) return;

        journey.segments.forEach((segment, index) => {
            if (!segment.coords || segment.coords.length !== 2) return;
            
            const marker = L.marker([segment.coords[0], segment.coords[1]], {
                icon: L.divIcon({
                    className: 'segment-marker',
                    html: `<div style="background: #007bff; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 0.8em; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${index + 1}</div>`,
                    iconSize: [20, 20]
                })
            }).addTo(this.map);

            marker.bindPopup(`
                <div>
                    <strong>Segment ${index + 1}</strong><br>
                    <em>${this.escapeHtml(segment.description) || 'No description'}</em><br>
                    Type: ${segment.type}<br>
                    Coords: [${segment.coords[0]}, ${segment.coords[1]}]
                    ${segment.control ? `<br>Control: [${segment.control[0]}, ${segment.control[1]}]` : ''}
                </div>
            `);
        });
    }

    clearMap() {
        if (!this.map) return;
        
        this.journeyLayers.forEach(layer => {
            this.map.removeLayer(layer);
        });
        this.journeyLayers.clear();
        
        // Remove all markers
        this.map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                this.map.removeLayer(layer);
            }
        });
    }

    // Edit mode functions
    startEditMode() {
        this.editMode = true;
        this.tempSegments = [];
        this.showMapInstructions();
        if (this.map && this.map.getContainer) {
            this.map.getContainer().style.cursor = 'crosshair';
        }
    }

    stopEditMode() {
        this.editMode = false;
        this.hideMapInstructions();
        if (this.map && this.map.getContainer) {
            this.map.getContainer().style.cursor = '';
        }
        
        // Remove temporary markers
        this.tempSegments.forEach(segment => {
            if (this.map && segment.marker) {
                this.map.removeLayer(segment.marker);
            }
        });
        this.tempSegments = [];
    }

    addMapPoint(latlng) {
        if (!this.editMode) return;

        const coords = [Math.round(latlng.lat), Math.round(latlng.lng)];
        
        // Add temporary marker
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'temp-marker',
                html: '<div style="background: #ff9800; color: white; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; animation: pulse 1s infinite;">+</div>',
                iconSize: [16, 16]
            })
        }).addTo(this.map);

        this.tempSegments.push({ marker, coords });
        
        return { marker, coords };
    }

    getTempSegments() {
        return this.tempSegments;
    }

    clearTempSegments() {
        this.tempSegments.forEach(segment => {
            if (this.map && segment.marker) {
                this.map.removeLayer(segment.marker);
            }
        });
        this.tempSegments = [];
    }

    showMapInstructions() {
        const instructions = document.getElementById('map-instructions');
        if (instructions) {
            instructions.style.display = 'block';
        }
    }

    hideMapInstructions() {
        const instructions = document.getElementById('map-instructions');
        if (instructions) {
            instructions.style.display = 'none';
        }
    }

    // Cleanup method
    cleanup() {
        // Clear resize observers
        this.resizeObservers.forEach(observer => {
            observer.disconnect();
        });
        this.resizeObservers.clear();
        
        // Clear timeouts
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        
        // Clear map
        if (this.map) {
            this.clearMap();
            this.map.remove();
            this.map = null;
        }
        
        this.log('🧹 Journey Map cleaned up');
    }

    // Utility functions
    escapeHtml(text) {
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

    log(...args) {
        if (this.debugMode) {
            console.log('[JourneyMap]', ...args);
        }
    }

    showNotification(message, type = 'info') {
        // Use AdminUI notification system if available
        if (this.ui && typeof this.ui.showToast === 'function') {
            this.ui.showToast(message, type);
            return;
        }
        
        // Fallback to console
        console.log(`${type.toUpperCase()}: ${message}`);
    }

    // Debug utility
    getDebugInfo() {
        return {
            mapInitialized: !!this.map,
            editMode: this.editMode,
            tempSegments: this.tempSegments.length,
            resizeObservers: this.resizeObservers.size,
            journeyLayers: this.journeyLayers.size,
            mapSize: this.map ? this.map.getSize() : null,
            mapBounds: this.map ? this.map.getBounds() : null
        };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JourneyMap;
}