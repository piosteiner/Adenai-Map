// Global Clustering Test Script
// Run this in the browser console after the map has loaded

function testGlobalClustering() {
    console.log('🧪 Testing Global Clustering System...');
    
    // Check if the system exists
    const globalClusterSystem = window.adenaiMap?.systems?.globalClusterSystem;
    if (!globalClusterSystem) {
        console.error('❌ Global cluster system not found');
        return false;
    }
    console.log('✅ Global cluster system found');
    
    // Check if the map is available
    const map = window.mapCore?.getMap();
    if (!map) {
        console.error('❌ Map not found');
        return false;
    }
    console.log('✅ Map found');
    
    // Check if location system is loaded
    const locationSystem = window.locationSystem || window.locationsSystem;
    if (!locationSystem) {
        console.error('❌ Location system not found');
        return false;
    }
    console.log('✅ Location system found');
    
    // Check if movement system is loaded
    const movementSystem = window.movementSystem;
    if (!movementSystem) {
        console.error('❌ Movement system not found');
        return false;
    }
    console.log('✅ Movement system found');
    
    // Get clustering statistics
    const stats = globalClusterSystem.getStats();
    console.log('📊 Clustering Statistics:', stats);
    
    // Test enable/disable
    console.log('🔄 Testing enable/disable...');
    globalClusterSystem.disable();
    setTimeout(() => {
        globalClusterSystem.enable();
        console.log('✅ Enable/disable test completed');
    }, 1000);
    
    // Test UI button
    const clusterButton = document.getElementById('toggle-global-clustering');
    if (clusterButton) {
        console.log('✅ Clustering toggle button found');
        console.log('Button classes:', clusterButton.classList.toString());
    } else {
        console.warn('⚠️ Clustering toggle button not found');
    }
    
    console.log('🎉 Global clustering test completed!');
    return true;
}

// Auto-run test if called directly
if (typeof window !== 'undefined' && window.adenaiMap?.systems?.globalClusterSystem) {
    testGlobalClustering();
} else {
    console.log('⏳ Waiting for systems to load...');
    document.addEventListener('adenaiMapReady', () => {
        setTimeout(testGlobalClustering, 1000);
    });
}

// Make test available globally
window.testGlobalClustering = testGlobalClustering;
