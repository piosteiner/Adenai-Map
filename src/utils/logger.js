// logger.js - Centralized Logging Utilities

class Logger {
    static success(message, data = null) {
        console.log(`✅ ${message}`, data ? data : '');
    }

    static error(message, error = null) {
        console.error(`❌ ${message}`, error ? error : '');
        if (error?.stack) {
            console.error('Stack trace:', error.stack);
        }
    }

    static warning(message, data = null) {
        console.warn(`⚠️ ${message}`, data ? data : '');
    }

    static info(message, data = null) {
        console.log(`ℹ️ ${message}`, data ? data : '');
    }

    static loading(message) {
        console.log(`⏳ ${message}`);
    }

    static system(systemName, message, data = null) {
        console.log(`🎯 [${systemName}] ${message}`, data ? data : '');
    }

    static api(message, data = null) {
        console.log(`🌐 [API] ${message}`, data ? data : '');
    }

    static journey(message, data = null) {
        console.log(`🗺️ [Journey] ${message}`, data ? data : '');
    }

    static character(message, data = null) {
        console.log(`👤 [Character] ${message}`, data ? data : '');
    }

    static movement(message, data = null) {
        console.log(`🛤️ [Movement] ${message}`, data ? data : '');
    }

    static panel(message, data = null) {
        console.log(`📋 [Panel] ${message}`, data ? data : '');
    }

    static cleanup(message) {
        console.log(`🧹 ${message}`);
    }

    static refresh(message) {
        console.log(`🔄 ${message}`);
    }

    static stats(title, stats) {
        console.log(`📊 ${title}:`, stats);
    }

    static init(message, data = null) {
        console.log(`🚀 ${message}`, data ? data : '');
    }

    static cache(message, data = null) {
        console.log(`📋 ${message}`, data ? data : '');
    }

    static debug(message, data = null) {
        console.log(`🔍 ${message}`, data ? data : '');
    }

    static warn(message, data = null) {
        console.warn(`⚠️ ${message}`, data ? data : '');
    }
    
    static media(message, data = null) {
        console.log(`🎵 [Media] ${message}`, data ? data : '');
    }
    
    static location(message, data = null) {
        console.log(`📍 [Location] ${message}`, data ? data : '');
    }
}

// Make available globally
window.Logger = Logger;

Logger.loading('📝 Logger utilities loaded successfully');
