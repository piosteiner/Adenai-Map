const express = require('express');
const { validateUser, getUserInfo } = require('../config/users');
const { GM_ROLES, isGm } = require('../middleware/auth');
const router = express.Router();

// Login route
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  console.log('🔍 Login attempt:', { username, password: '***' });
  
  const user = validateUser(username, password);
  
  console.log('🔍 Validation result:', user);
  
  // the CMS is the GM's: another account is refused (its password may be right)
  if (user && !GM_ROLES.includes(user.role)) {
    console.log('⛔ Login refused (not the GM):', user.displayName);
    return res.status(403).json({ success: false, message: 'The CMS is for the GM only.' });
  }

  if (user) {
    req.session.authenticated = true;
    req.session.username = user.username;
    req.session.displayName = user.displayName;
    req.session.role = user.role;
    
    console.log('✅ Login successful for:', user.displayName);
    
    res.json({ 
      success: true, 
      message: 'Login successful',
      username: user.displayName,
      role: user.role
    });
  } else {
    console.log('❌ Login failed for:', username);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid credentials' 
    });
  }
});

// Logout route
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ success: false, message: 'Logout failed' });
    } else {
      res.json({ success: true, message: 'Logout successful' });
    }
  });
});

// Auth status check
// Auth status check — logged in means: as the GM (a player's session from before counts as none)
router.get('/auth-status', (req, res) => {
  const gm = isGm(req);
  res.json({
    authenticated: gm,
    username: gm ? (req.session.displayName || req.session.username) : null,
    role: gm ? req.session.role : null
  });
});

// Simple test route
router.get('/test-simple', (req, res) => {
  res.json({ message: 'Simple route works!', timestamp: new Date() });
});

module.exports = router;