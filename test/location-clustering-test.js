// Location Clustering Test Script
// Run this in the browser console after the map has loaded

function testLocationClustering() {
    console.log('🧪 Testing Location Clustering Integration...');
    
    // Check if movement system exists
    const movementSystem = window.movementSystem;
    if (!movementSystem) {
        console.error('❌ Movement system not found');
        return false;
    }
    console.log('✅ Movement system found');
    
    // Check if location system exists
    const locationSystem = window.locationSystem || window.locationsSystem;
    if (!locationSystem) {
        console.error('❌ Location system not found');
        return false;
    }
    console.log('✅ Location system found');
    
    // Check if movement markers system has the new method
    const markersSystem = movementSystem.markersSystem;
    if (!markersSystem || typeof markersSystem.findNearbyLocationMarkers !== 'function') {
        console.error('❌ Movement markers system missing findNearbyLocationMarkers method');
        return false;
    }
    console.log('✅ findNearbyLocationMarkers method found');
    
    // Get current markers
    const movementMarkers = movementSystem.movementMarkers || [];
    const locationMarkers = locationSystem.geoFeatureLayers || [];
    
    console.log(`📊 Current Status:
    - Movement markers: ${movementMarkers.length}
    - Location markers: ${locationMarkers.length}
    - Visible movement markers: ${movementMarkers.filter(m => m.isVisible).length}`);
    
    // Test proximity detection on a sample location
    if (locationMarkers.length > 0) {
        const testLocation = locationMarkers[0];
        const testCoords = testLocation.layer.getLatLng();
        console.log(`🎯 Testing proximity detection at: ${testLocation.name} (${testCoords.lat}, ${testCoords.lng})`);
        
        const nearbyLocations = markersSystem.findNearbyLocationMarkers(testCoords, 10);
        console.log(`📍 Found ${nearbyLocations.length} nearby locations within 10px`);
        
        // Test with larger radius
        const nearbyLocationsLarge = markersSystem.findNearbyLocationMarkers(testCoords, 100);
        console.log(`📍 Found ${nearbyLocationsLarge.length} nearby locations within 100px`);
    }
    
    // Look for mixed clusters
    const mixedClusters = movementMarkers.filter(m => 
        m.isVisible && 
        m.type === 'cluster' && 
        m.nearbyLocations && 
        m.nearbyLocations.length > 0
    );
    
    console.log(`🎯 Mixed clusters found: ${mixedClusters.length}`);
    mixedClusters.forEach((cluster, index) => {
        console.log(`  Cluster ${index + 1}: ${cluster.movements.length} movements + ${cluster.nearbyLocations.length} locations`);
    });
    
    // Check CSS classes
    const map = window.mapCore?.getMap();
    if (map) {
        const clusterElements = document.querySelectorAll('.mixed-cluster');
        console.log(`🎨 Mixed cluster elements in DOM: ${clusterElements.length}`);
        
        const locationIndicators = document.querySelectorAll('.location-indicator');
        console.log(`🔶 Location indicator elements in DOM: ${locationIndicators.length}`);
    }
    
    console.log('🎉 Location clustering test completed!');
    return true;
}

// Make test available globally
window.testLocationClustering = testLocationClustering;

// Auto-run test if called directly
if (typeof window !== 'undefined' && window.movementSystem?.markersSystem) {
    setTimeout(testLocationClustering, 1000);
} else {
    console.log('⏳ Waiting for systems to load...');
    document.addEventListener('adenaiMapReady', () => {
        setTimeout(testLocationClustering, 2000);
    });
}
