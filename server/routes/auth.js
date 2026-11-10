const express = require('express');
const { validateUser, getUserInfo } = require('../config/users');
const { GM_ROLES, isGm } = require('../middleware/auth');
const router = express.Router();

// Wrong passwords per address: 8, then a 15-minute pause (as the protocol unlock; 2026-11-10). Checked before
// bcrypt, so a flood of guesses costs the server nothing; expired entries are swept so the map stays small.
const failures = new Map();
const blocked = (ip) => { const f = failures.get(ip); return !!f && f.count >= 8 && Date.now() < f.until; };
function failed(ip) {
  const now = Date.now();
  const f = failures.get(ip);
  failures.set(ip, { count: (f && now < f.until ? f.count : 0) + 1, until: now + 15 * 60000 });
  if (failures.size > 10000) for (const [k, v] of failures) if (v.until < now) failures.delete(k);
}

// Login route
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (blocked(req.ip)) {
    return res.status(429).json({ success: false, message: 'Too many wrong passwords — try again in 15 minutes.' });
  }

  const user = await validateUser(username, password);
  
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
    
    failures.delete(req.ip);
    console.log('✅ Login successful for:', user.displayName);
    
    res.json({ 
      success: true, 
      message: 'Login successful',
      username: user.displayName,
      role: user.role
    });
  } else {
    failed(req.ip);
    console.log('❌ Login failed for:', String(username || '').slice(0, 40));
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