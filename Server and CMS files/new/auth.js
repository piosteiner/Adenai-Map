// Authentication middleware for write operations
const requireAuth = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    next();
  } else {
    res.status(401).json({ 
      error: 'Authentication required',
      message: 'You must be logged in to perform this action'
    });
  }
};

// Journey-specific middleware for API protection
const authenticateJourneyAPI = (req, res, next) => {
    // For GET requests to journey (read-only), allow public access for the admin interface
    if (req.method === 'GET') {
        return next(); // Allow public read access to load journeys in admin
    }
    
    // All other operations (POST, PUT, DELETE) require admin authentication
    return requireAuth(req, res, next);
};

module.exports = {
    requireAuth,
    authenticateJourneyAPI
};