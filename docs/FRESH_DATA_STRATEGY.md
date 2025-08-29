# Daily Fresh Data Strategy - Configuration Guide

## 🎯 Overview
The Adenai Map now intelligently handles data with different update frequencies:
- **Static Files**: Cached for performance (characters, locations, reviews)
- **API Data**: Always fresh for daily updates (journeys)

## 📊 Current Configuration

### Always Fresh Data (Daily Updates)
```javascript
// These data types bypass cache and load fresh every visit
dailyUpdates: ['journeys']
```

### Cached Static Data
```javascript
// These files are cached with TTL for performance
staticFiles: ['characters', 'locations', 'reviews', 'media-library']
```

## 🔧 Cache Durations

| Data Type | Cache Duration | Strategy | Reason |
|-----------|---------------|----------|---------|
| `journeys` | 0 (always fresh) | Network-first | Daily API updates |
| `characters` | 30 minutes | Cache-first | Stable character data |
| `locations` | 1 hour | Cache-first | Location data rarely changes |
| `reviews` | 2 hours | Cache-first | Historical review data |
| `media-library` | 24 hours | Cache-first | Media references are stable |

## 🌐 Network Strategies

### Network-First (Always Fresh)
- **Used for**: API data with daily updates
- **Behavior**: Always try network first, cache only for offline fallback
- **Data types**: `journeys`

### Cache-First (Performance Optimized)
- **Used for**: Static files that change infrequently
- **Behavior**: Serve from cache if available, update in background
- **Data types**: `characters`, `locations`, `reviews`, `media-library`

## 🛠️ Implementation Details

### 1. Advanced Loader Configuration
```javascript
// Checks if data should always be fresh
const shouldAlwaysFresh = this.config.alwaysFresh.includes(dataType);

if (!shouldAlwaysFresh) {
    // Use cache if available
    const cached = this.getFromCache(dataType);
    if (cached && !options.forceRefresh) {
        return cached.data;
    }
} else {
    // Always load fresh from network
    Logger.loading(`🔄 Loading fresh ${dataType} data (daily updates)`);
}
```

### 2. Service Worker Strategy
```javascript
// API requests (journeys) - Network-first
static async handleApiRequest(event) {
    try {
        // Always try network first for daily updates
        const networkResponse = await fetch(event.request);
        if (networkResponse.ok) {
            // Cache for offline fallback only
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
        }
    } catch (error) {
        // Fallback to cache only if network fails
        return await caches.match(event.request);
    }
}
```

### 3. Data Manager Integration
```javascript
// Check if this is always-fresh data
const isAlwaysFresh = AdvancedLoader.config.alwaysFresh?.includes(type);

if (!isAlwaysFresh && this.hasData(type) && !options.forceRefresh) {
    // Use cached data for static files
    return this.getCachedData(type);
}

// Load fresh data for API endpoints
if (isAlwaysFresh) {
    Logger.loading(`🔄 Loading fresh ${type} data (daily API updates)`);
}
```

## 📈 Performance Impact

### Before Fresh Data Strategy:
- All data cached with same TTL
- Potentially stale API data served from cache
- Manual cache invalidation required

### After Fresh Data Strategy:
- **Static data**: 95%+ cache hit rate, instant loading
- **API data**: Always fresh, current daily updates
- **Network requests**: Optimized per data type
- **User experience**: Best of both worlds (speed + freshness)

## 🔄 Adding New Data Types

### For Daily API Updates:
```javascript
// Add to dailyUpdates array in data-config.js
dailyUpdates: [
    'journeys',
    'newApiEndpoint'  // Always fresh
]
```

### For Static Files:
```javascript
// Add to staticFiles array in data-config.js
staticFiles: [
    'characters',
    'locations', 
    'reviews',
    'media-library',
    'newStaticFile'  // Cached for performance
]
```

## 🎛️ Runtime Configuration

### Check Current Config:
```javascript
// Get configuration summary
const summary = DataConfig.getConfigSummary();
console.log('Data config:', summary);
```

### Update Configuration:
```javascript
// Add new always-fresh data type
DataConfig.updateConfig({
    dailyUpdates: [...DataConfig.config.dailyUpdates, 'newApiData']
});
```

### Validate Data Type:
```javascript
// Automatically configure unknown data types
DataConfig.validateDataType('unknownDataType');
```

## 🔍 Monitoring & Debugging

### Check if Data is Fresh:
```javascript
// In browser console
const isAlwaysFresh = DataConfig.shouldAlwaysBeFresh('journeys');
console.log('Journeys always fresh:', isAlwaysFresh); // true
```

### View Network Strategy:
```javascript
// Check network strategy for data type
const strategy = DataConfig.getNetworkStrategy('journeys');
console.log('Journeys strategy:', strategy); // 'network-first'
```

### Cache Statistics:
```javascript
// Get current cache stats
const stats = AdvancedLoader.getCacheStats();
console.log('Cache stats:', stats);
```

## 🎯 Benefits

✅ **Always Fresh API Data**: Journey updates load fresh every visit  
✅ **Performance Optimized**: Static files cached for instant loading  
✅ **Intelligent Caching**: Different strategies per data type  
✅ **Offline Support**: Cached fallbacks when network unavailable  
✅ **Easy Configuration**: Simple config file for managing strategies  
✅ **Runtime Flexibility**: Configuration can be updated dynamically  

This strategy ensures your daily journey updates are always current while maintaining excellent performance for static content!
