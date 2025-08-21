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

module.exports = {
  requireAuth
};