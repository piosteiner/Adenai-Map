// The CMS is the GM's alone (2026-11-08: the art library would spoil the campaign for the players): only an
// account with a GM role counts as logged in — for reading the CMS's data as for changing it, for the minutes'
// settings and the proposals. The players' accounts can't log in to the CMS (routes/auth.js); a player's session
// from before counts as none.
const GM_ROLES = ['admin', 'gm'];
const isGm = (req) => !!(req.session && req.session.authenticated && GM_ROLES.includes(req.session.role));

const requireAuth = (req, res, next) => {
  if (isGm(req)) {
    next();
  } else {
    res.status(401).json({
      error: 'Authentication required',
      message: 'Log in with the GM account'
    });
  }
};

// Everything under /api is the GM's, except what the public map uses (server.js mounts this before the routes):
// the data files (/api/data), the players' proposals (/api/pending) and the minutes (/api/protocols, their own
// password), and logging in. A route added later is closed unless it is listed here.
const PUBLIC_API = ['/data', '/pending', '/protocols', '/login', '/logout', '/auth-status', '/test'];
const gmOnlyApi = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  if (PUBLIC_API.some((p) => req.path === p || req.path.startsWith(`${p}/`))) return next();
  return requireAuth(req, res, next);
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

// Dynamics-specific middleware for API protection
const authenticateDynamicsAPI = (req, res, next) => {
    // For GET requests to dynamics (read-only), allow public access for the admin interface
    if (req.method === 'GET') {
        return next(); // Allow public read access to load dynamics in admin
    }
    
    // All other operations (POST, PUT, DELETE) require admin authentication
    return requireAuth(req, res, next);
};

module.exports = {
    GM_ROLES,
    isGm,
    requireAuth,
    gmOnlyApi,
    authenticateJourneyAPI,
    authenticateDynamicsAPI
};