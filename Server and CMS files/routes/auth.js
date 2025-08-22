const express = require('express');
const { validateUser, getUserInfo } = require('../config/users');
const router = express.Router();

// Login route
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  console.log('🔍 Login attempt:', { username, password: '***' });
  
  const user = validateUser(username, password);
  
  console.log('🔍 Validation result:', user);
  
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
router.get('/auth-status', (req, res) => {
  res.json({
    authenticated: !!(req.session && req.session.authenticated),
    username: req.session?.displayName || req.session?.username || null,
    role: req.session?.role || null
  });
});

// Add this TEMPORARY debug route at the bottom of routes/auth.js
router.get('/debug-users', (req, res) => {
  try {
    const { getAllUsers } = require('../config/users');
    const users = getAllUsers();
    res.json({ success: true, users: users });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Simple test route
router.get('/test-simple', (req, res) => {
  res.json({ message: 'Simple route works!', timestamp: new Date() });
});

module.exports = router;
