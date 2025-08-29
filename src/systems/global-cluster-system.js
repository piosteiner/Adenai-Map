/**
 * Global Cluster System
 * Handles clustering of overlapping markers from all sources (movement paths, locations, etc.)
 */

class GlobalClusterSystem {
    constructor() {
        this.clusters = new Map(); // Map of coordinate keys to cluster data
        this.allMarkers = new Map(); // Map of marker instances to their metadata
        this.clusterMarkers = new Map(); // Map of cluster markers on the map
        this.clusterDistance = 30; // Distance in pixels to consider markers as overlapping
        
        // Listen for markers being added from different systems
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Listen for location markers being loaded
        document.addEventListener('locationsLoaded', (e) => {
            setTimeout(() => this.rebuildClusters(), 100);
        });

        // Listen for movement markers being loaded
        document.addEventListener('movementMarkersLoaded', (e) => {
            setTimeout(() => this.rebuildClusters(), 100);
        });

        // Listen for character path visibility changes
        document.addEventListener('characterPathVisibilityChanged', (e) => {
            setTimeout(() => this.rebuildClusters(), 100);
        });
    }

    /**
     * Register a marker with the clustering system
     * @param {L.Marker} marker - The Leaflet marker
     * @param {Object} metadata - Metadata about the marker
     */
    registerMarker(marker, metadata) {
        if (!marker || !metadata) return;

        const markerId = this.generateMarkerId(marker);
        metadata.id = markerId;
        metadata.marker = marker;
        
        this.allMarkers.set(markerId, metadata);
        
        // Store original click handler if it exists
        if (marker.listens('click')) {
            metadata.originalClickHandler = marker._events.click;
        }
    }

    /**
     * Unregister a marker from the clustering system
     * @param {L.Marker} marker - The Leaflet marker to unregister
     */
    unregisterMarker(marker) {
        const markerId = this.generateMarkerId(marker);
        this.allMarkers.delete(markerId);
    }

    /**
     * Generate a unique ID for a marker
     * @param {L.Marker} marker - The marker
     * @returns {string} Unique marker ID
     */
    generateMarkerId(marker) {
        const latlng = marker.getLatLng();
        const timestamp = Date.now();
        return `marker_${latlng.lat}_${latlng.lng}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get coordinate key for clustering
     * @param {L.LatLng} latlng - The coordinates
     * @returns {string} Coordinate key
     */
    getCoordinateKey(latlng) {
        // Round to avoid floating point precision issues
        const lat = Math.round(latlng.lat * 100000) / 100000;
        const lng = Math.round(latlng.lng * 100000) / 100000;
        return `${lat},${lng}`;
    }

    /**
     * Check if two markers are close enough to be clustered
     * @param {L.Marker} marker1 - First marker
     * @param {L.Marker} marker2 - Second marker
     * @returns {boolean} True if markers should be clustered
     */
    shouldCluster(marker1, marker2) {
        const map = window.mapCore?.getMap();
        if (!map) return false;

        const point1 = map.latLngToContainerPoint(marker1.getLatLng());
        const point2 = map.latLngToContainerPoint(marker2.getLatLng());
        
        const distance = Math.sqrt(
            Math.pow(point1.x - point2.x, 2) + 
            Math.pow(point1.y - point2.y, 2)
        );
        
        return distance <= this.clusterDistance;
    }

    /**
     * Rebuild all clusters based on currently visible markers
     */
    rebuildClusters() {
        const map = window.mapCore?.getMap();
        if (!map) return;

        console.log('🔄 Rebuilding global marker clusters...');

        // Clear existing clusters
        this.clearAllClusters();

        // Get all currently visible markers
        const visibleMarkers = this.getVisibleMarkers();
        console.log(`📊 Found ${visibleMarkers.length} visible markers to cluster`);

        if (visibleMarkers.length === 0) return;

        // Group markers by proximity
        const clusterGroups = this.groupMarkersByProximity(visibleMarkers);
        console.log(`📦 Created ${clusterGroups.length} cluster groups`);

        // Create cluster markers for groups with multiple markers
        clusterGroups.forEach((group, index) => {
            if (group.length > 1) {
                this.createClusterMarker(group, index);
            } else {
                // Single marker - ensure it's visible and has its original behavior
                const metadata = group[0];
                if (!map.hasLayer(metadata.marker)) {
                    metadata.marker.addTo(map);
                }
            }
        });

        console.log('✅ Global clustering complete');
    }

    /**
     * Get all currently visible markers from all systems
     * @returns {Array} Array of marker metadata objects
     */
    getVisibleMarkers() {
        const map = window.mapCore?.getMap();
        if (!map) return [];

        const visibleMarkers = [];

        // Get visible location markers
        if (window.locationSystem?.geoFeatureLayers) {
            window.locationSystem.geoFeatureLayers.forEach(locationData => {
                if (map.hasLayer(locationData.layer)) {
                    visibleMarkers.push({
                        marker: locationData.layer,
                        type: 'location',
                        data: locationData,
                        name: locationData.name,
                        coordinates: locationData.layer.getLatLng()
                    });
                }
            });
        }

        // Get visible movement markers
        if (window.movementSystem?.movementMarkers) {
            window.movementSystem.movementMarkers.forEach(markerData => {
                if (markerData.isVisible && map.hasLayer(markerData.marker)) {
                    visibleMarkers.push({
                        marker: markerData.marker,
                        type: 'movement',
                        subType: markerData.type, // 'single' or 'cluster'
                        data: markerData,
                        characterId: markerData.characterId,
                        name: `${markerData.characterId} Movement`,
                        coordinates: markerData.marker.getLatLng()
                    });
                }
            });
        }

        return visibleMarkers;
    }

    /**
     * Group markers by proximity for clustering
     * @param {Array} markers - Array of marker metadata
     * @returns {Array} Array of marker groups
     */
    groupMarkersByProximity(markers) {
        const groups = [];
        const processed = new Set();

        markers.forEach((markerData, index) => {
            if (processed.has(index)) return;

            const group = [markerData];
            processed.add(index);

            // Find all markers that should be clustered with this one
            markers.forEach((otherMarkerData, otherIndex) => {
                if (otherIndex === index || processed.has(otherIndex)) return;

                if (this.shouldCluster(markerData.marker, otherMarkerData.marker)) {
                    group.push(otherMarkerData);
                    processed.add(otherIndex);
                }
            });

            groups.push(group);
        });

        return groups;
    }

    /**
     * Create a cluster marker for a group of overlapping markers
     * @param {Array} markerGroup - Group of marker metadata objects
     * @param {number} clusterIndex - Index of this cluster
     */
    createClusterMarker(markerGroup, clusterIndex) {
        const map = window.mapCore?.getMap();
        if (!map || markerGroup.length === 0) return;

        // Calculate cluster center
        const center = this.calculateClusterCenter(markerGroup);
        
        // Hide individual markers
        markerGroup.forEach(markerData => {
            if (map.hasLayer(markerData.marker)) {
                map.removeLayer(markerData.marker);
            }
        });

        // Create cluster marker
        const clusterCount = markerGroup.length;
        const clusterHtml = `
            <div class="global-cluster-marker" style="
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                border: 2px solid #ffffff;
                border-radius: 50%;
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 12px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                cursor: pointer;
                position: relative;
            ">
                ${clusterCount}
                <div style="
                    position: absolute;
                    bottom: -2px;
                    right: -2px;
                    background: #f59e0b;
                    border-radius: 50%;
                    width: 12px;
                    height: 12px;
                    font-size: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid white;
                ">
                    ⚡
                </div>
            </div>
        `;

        const clusterIcon = L.divIcon({
            html: clusterHtml,
            className: 'global-cluster-icon',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });

        const clusterMarker = L.marker(center, { icon: clusterIcon });
        
        // Store cluster data
        clusterMarker._clusterData = {
            markers: markerGroup,
            index: clusterIndex,
            isFannedOut: false,
            fanMarkers: [],
            hoverTimeout: null
        };

        // Add hover events for fanning out
        clusterMarker.on('mouseover', () => {
            if (clusterMarker._clusterData.hoverTimeout) {
                clearTimeout(clusterMarker._clusterData.hoverTimeout);
            }
            this.fanOutCluster(clusterMarker);
        });
        
        clusterMarker.on('mouseout', () => {
            clusterMarker._clusterData.hoverTimeout = setTimeout(() => {
                this.fanInCluster(clusterMarker);
            }, 500);
        });
        
        // Add click event to bounce fanned markers
        clusterMarker.on('click', () => {
            if (clusterMarker._clusterData.isFannedOut && clusterMarker._clusterData.fanMarkers.length > 0) {
                this.bounceClusterFanMarkers(clusterMarker);
            }
        });

        // Add to map and track
        clusterMarker.addTo(map);
        this.clusterMarkers.set(`cluster_${clusterIndex}`, clusterMarker);

        console.log(`🎯 Created global cluster with ${clusterCount} markers at ${center.lat}, ${center.lng}`);
    }

    /**
     * Calculate the center point for a cluster
     * @param {Array} markerGroup - Group of marker metadata objects
     * @returns {L.LatLng} Center coordinates
     */
    calculateClusterCenter(markerGroup) {
        if (markerGroup.length === 1) {
            return markerGroup[0].coordinates;
        }

        let totalLat = 0;
        let totalLng = 0;

        markerGroup.forEach(markerData => {
            totalLat += markerData.coordinates.lat;
            totalLng += markerData.coordinates.lng;
        });

        return L.latLng(
            totalLat / markerGroup.length,
            totalLng / markerGroup.length
        );
    }

    /**
     * Fan out clustered markers on hover
     * @param {L.Marker} clusterMarker - The cluster marker
     */
    fanOutCluster(clusterMarker) {
        if (clusterMarker._clusterData.isFannedOut) return;
        
        const map = window.mapCore?.getMap();
        if (!map) return;
        
        clusterMarker._clusterData.isFannedOut = true;
        const markerGroup = clusterMarker._clusterData.markers;
        const centerLatLng = clusterMarker.getLatLng();
        
        // Spiral configuration
        const baseRadius = 40;
        const radiusIncrement = 20;
        const itemsPerRevolution = 6;
        
        markerGroup.forEach((markerData, index) => {
            // Calculate spiral position
            const revolutionIndex = Math.floor(index / itemsPerRevolution);
            const positionInRevolution = index % itemsPerRevolution;
            
            const angleStep = (2 * Math.PI) / itemsPerRevolution;
            const angle = (positionInRevolution * angleStep) - (Math.PI / 2);
            
            const radius = baseRadius + (revolutionIndex * radiusIncrement);
            
            const offsetX = Math.cos(angle) * radius;
            const offsetY = Math.sin(angle) * radius;
            
            const mapContainer = map.getContainer();
            const centerPoint = map.latLngToContainerPoint(centerLatLng);
            const fanPoint = L.point(centerPoint.x + offsetX, centerPoint.y + offsetY);
            const fanLatLng = map.containerPointToLatLng(fanPoint);
            
            // Create fan marker based on original marker type
            const fanMarker = this.createFanMarker(markerData, fanLatLng);
            
            // Add hover events to keep cluster fanned out
            fanMarker.on('mouseover', () => {
                if (clusterMarker._clusterData.hoverTimeout) {
                    clearTimeout(clusterMarker._clusterData.hoverTimeout);
                }
            });
            
            fanMarker.on('mouseout', () => {
                clusterMarker._clusterData.hoverTimeout = setTimeout(() => {
                    this.fanInCluster(clusterMarker);
                }, 300);
            });
            
            fanMarker.addTo(map);
            
            // Animate the fan out
            setTimeout(() => {
                const element = fanMarker.getElement();
                if (element) {
                    element.style.transform = 'scale(1)';
                    element.style.animation = 'fanOut 0.4s ease-out';
                }
            }, index * 60);
            
            clusterMarker._clusterData.fanMarkers.push(fanMarker);
        });
        
        // Keep the cluster marker visible and on top
        const clusterElement = clusterMarker.getElement();
        if (clusterElement) {
            clusterElement.style.zIndex = '1001';
        }
    }

    /**
     * Create a fan marker based on the original marker type
     * @param {Object} markerData - Original marker metadata
     * @param {L.LatLng} fanLatLng - Position for the fan marker
     * @returns {L.Marker} Fan marker
     */
    createFanMarker(markerData, fanLatLng) {
        const map = window.mapCore?.getMap();
        let fanMarker;

        if (markerData.type === 'location') {
            // Create location-style fan marker using the same icon
            const locationSystem = window.locationSystem || window.locationsSystem;
            const iconToUse = locationSystem?.dotOrangeIcon;
            
            if (iconToUse) {
                fanMarker = L.marker(fanLatLng, { icon: iconToUse });
            } else {
                // Fallback to default marker if icon not available
                fanMarker = L.marker(fanLatLng);
            }
            
            // Add click event to show location popup
            fanMarker.on('click', () => {
                const originalPopup = markerData.marker.getPopup();
                if (originalPopup) {
                    const popup = L.popup({
                        maxWidth: 400,
                        className: 'custom-popup'
                    })
                    .setLatLng(fanLatLng)
                    .setContent(originalPopup.getContent())
                    .openOn(map);
                }
            });
            
        } else if (markerData.type === 'movement') {
            // Create movement-style fan marker
            let markerHtml;
            let markerSize = [24, 24];
            
            if (markerData.subType === 'single') {
                const markerNumber = (markerData.data.movementData?.movement_nr || 0) + 1;
                const pathColor = window.movementSystem?.markersSystem?.getCharacterPathColor(markerData.characterId) || '#333333';
                
                markerHtml = `
                    <div class="movement-marker fan-marker" style="
                        background: ${pathColor};
                        --path-color: ${pathColor};
                        border-radius: 50%;
                        width: 24px;
                        height: 24px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-weight: bold;
                        font-size: 10px;
                        border: 2px solid white;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ">${markerNumber}</div>
                `;
            } else {
                // Cluster marker
                const count = markerData.data.movements?.length || 2;
                const pathColor = window.movementSystem?.markersSystem?.getCharacterPathColor(markerData.characterId) || '#333333';
                
                markerHtml = `
                    <div class="movement-marker fan-marker cluster-marker" style="
                        background: ${pathColor};
                        --path-color: ${pathColor};
                        border-radius: 50%;
                        width: 28px;
                        height: 28px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-weight: bold;
                        font-size: 9px;
                        border: 2px solid white;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ">${count}x</div>
                `;
                markerSize = [28, 28];
            }
            
            const fanIcon = L.divIcon({
                html: markerHtml,
                className: 'movement-marker-icon fan-icon',
                iconSize: markerSize,
                iconAnchor: [markerSize[0]/2, markerSize[1]/2]
            });

            fanMarker = L.marker(fanLatLng, { icon: fanIcon });
            
            // Add click event based on marker type
            fanMarker.on('click', () => {
                if (markerData.subType === 'single' && markerData.data.movementData) {
                    // Show movement popup
                    const characterName = markerData.characterId || 'Unknown';
                    const markerNumber = (markerData.data.movementData.movement_nr || 0) + 1;
                    
                    if (window.movementSystem?.markersSystem?.showMovementPopup) {
                        window.movementSystem.markersSystem.showMovementPopup(
                            markerData.data.movementData,
                            characterName,
                            markerNumber,
                            fanLatLng
                        );
                    }
                } else if (markerData.subType === 'cluster') {
                    // Fan out the original cluster at this position
                    const originalMarker = markerData.marker;
                    if (originalMarker._movements && window.movementSystem?.markersSystem?.fanOutClusteredMarkers) {
                        // Temporarily move original marker to fan position for sub-clustering
                        const originalPos = originalMarker.getLatLng();
                        originalMarker.setLatLng(fanLatLng);
                        
                        if (map.hasLayer(originalMarker)) {
                            map.removeLayer(originalMarker);
                        }
                        map.addLayer(originalMarker);
                        
                        window.movementSystem.markersSystem.fanOutClusteredMarkers(originalMarker);
                        
                        // Restore original position after brief delay
                        setTimeout(() => {
                            originalMarker.setLatLng(originalPos);
                            if (map.hasLayer(originalMarker)) {
                                map.removeLayer(originalMarker);
                            }
                        }, 100);
                    }
                }
            });
        }

        return fanMarker;
    }

    /**
     * Fan in clustered markers
     * @param {L.Marker} clusterMarker - The cluster marker
     */
    fanInCluster(clusterMarker) {
        if (!clusterMarker._clusterData.isFannedOut) return;
        
        const map = window.mapCore?.getMap();
        if (!map) return;
        
        // Animate fan in
        clusterMarker._clusterData.fanMarkers.forEach((fanMarker, index) => {
            setTimeout(() => {
                const element = fanMarker.getElement();
                if (element) {
                    element.style.transform = 'scale(0)';
                    element.style.animation = 'fanIn 0.2s ease-in';
                }
                
                // Remove marker after animation
                setTimeout(() => {
                    if (map.hasLayer(fanMarker)) {
                        map.removeLayer(fanMarker);
                    }
                }, 200);
            }, index * 30);
        });
        
        // Reset cluster marker z-index
        const clusterElement = clusterMarker.getElement();
        if (clusterElement) {
            clusterElement.style.zIndex = '600';
        }
        
        clusterMarker._clusterData.fanMarkers = [];
        clusterMarker._clusterData.isFannedOut = false;
    }

    /**
     * Bounce all fan markers to indicate they are clickable
     * @param {L.Marker} clusterMarker - The cluster marker
     */
    bounceClusterFanMarkers(clusterMarker) {
        if (!clusterMarker._clusterData.fanMarkers || clusterMarker._clusterData.fanMarkers.length === 0) return;
        
        clusterMarker._clusterData.fanMarkers.forEach((fanMarker, index) => {
            setTimeout(() => {
                const element = fanMarker.getElement();
                if (element) {
                    // Add bounce animation
                    element.style.animation = 'bounceAttention 0.6s ease-in-out';
                    
                    // Remove animation after it completes
                    setTimeout(() => {
                        if (element) {
                            element.style.animation = '';
                        }
                    }, 600);
                }
            }, index * 100);
        });
    }

    /**
     * Clear all cluster markers
     */
    clearAllClusters() {
        const map = window.mapCore?.getMap();
        if (!map) return;

        // Remove all cluster markers
        this.clusterMarkers.forEach((clusterMarker) => {
            // Fan in any expanded clusters first
            if (clusterMarker._clusterData?.isFannedOut) {
                this.fanInCluster(clusterMarker);
            }
            
            // Restore original markers
            if (clusterMarker._clusterData?.markers) {
                clusterMarker._clusterData.markers.forEach(markerData => {
                    if (!map.hasLayer(markerData.marker)) {
                        markerData.marker.addTo(map);
                    }
                });
            }
            
            // Remove cluster marker
            if (map.hasLayer(clusterMarker)) {
                map.removeLayer(clusterMarker);
            }
        });

        this.clusterMarkers.clear();
        this.clusters.clear();
    }

    /**
     * Enable global clustering
     */
    enable() {
        console.log('🌐 Enabling global marker clustering...');
        this.rebuildClusters();
    }

    /**
     * Disable global clustering
     */
    disable() {
        console.log('🌐 Disabling global marker clustering...');
        this.clearAllClusters();
    }

    /**
     * Get clustering statistics
     * @returns {Object} Clustering statistics
     */
    getStats() {
        const visibleMarkers = this.getVisibleMarkers();
        return {
            totalVisibleMarkers: visibleMarkers.length,
            activeClusters: this.clusterMarkers.size,
            clusterDistance: this.clusterDistance,
            locationMarkers: visibleMarkers.filter(m => m.type === 'location').length,
            movementMarkers: visibleMarkers.filter(m => m.type === 'movement').length
        };
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.GlobalClusterSystem = GlobalClusterSystem;
}
