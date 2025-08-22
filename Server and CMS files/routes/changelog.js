// routes/changelog.js - Fixed version without path issues, filtering out GM changes
const express = require('express');
const { Octokit } = require('@octokit/rest');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const GITHUB_OWNER = process.env.GITHUB_USERNAME;
const GITHUB_REPO = process.env.GITHUB_REPO;

// Helper function to load reviews data
async function loadReviews() {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: 'data/reviews.json'
    });
    
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.status === 404) {
      // File doesn't exist, return empty structure
      return {
        version: "1.0",
        reviews: [],
        lastUpdated: new Date().toISOString()
      };
    }
    throw error;
  }
}

// Helper function to save reviews data
async function saveReviews(reviewsData) {
  try {
    // Get current file SHA if it exists
    let currentSha = null;
    try {
      const { data: currentFile } = await octokit.rest.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: 'data/reviews.json'
      });
      currentSha = currentFile.sha;
    } catch (error) {
      if (error.status !== 404) throw error;
    }

    reviewsData.lastUpdated = new Date().toISOString();
    const content = JSON.stringify(reviewsData, null, 2);

    const commitData = {
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: 'data/reviews.json',
      message: 'Update review status',
      content: Buffer.from(content).toString('base64')
    };

    if (currentSha) {
      commitData.sha = currentSha;
    }

    await octokit.rest.repos.createOrUpdateFileContents(commitData);
    return true;
  } catch (error) {
    console.error('Error saving reviews:', error);
    throw error;
  }
}

// Get changelog with review status (public, but filtered by user role)
router.get('/', async (req, res) => {
  try {
    const currentUser = req.session.displayName || req.session.username;
    const userRole = req.session.role || 'user';
    const limit = req.query.limit || 50;
    
    // Get recent commits
    const { data: commits } = await octokit.rest.repos.listCommits({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      per_page: limit
    });

    // Load review data
    const reviewsData = await loadReviews();
    const reviewsMap = {};
    reviewsData.reviews.forEach(review => {
      reviewsMap[review.commitSha] = review;
    });

    // Parse commits and add review status
    const changelog = commits.map(commit => {
      const sha = commit.sha;
      const message = commit.commit.message;
      const author = commit.commit.author.name;
      const date = commit.commit.author.date;
      
      // Parse commit message
      const activity = parseCommitMessage(message, author, date, sha);
      if (!activity) return null;

      // Get review information
      const review = reviewsMap[sha] || {
        status: 'untracked',
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: ''
      };

      // 🎯 FILTER OUT GM/ADMIN CHANGES
      // Hide changes that are auto-approved (GM/Admin changes)
      if (review.status === 'approved' && 
          review.reviewNotes === 'Auto-approved (GM/Admin)') {
        return null; // Skip GM/Admin changes
      }

      // Also filter out untracked commits from GitHub author (system commits)
      if (review.status === 'untracked' && 
          (author === 'piosteiner' || author.toLowerCase().includes('github'))) {
        return null; // Skip system/admin commits
      }

      return {
        ...activity,
        review: review,
        isOwnChange: currentUser && (activity.user === currentUser),
        canReview: userRole === 'gm' || userRole === 'admin'
      };
    }).filter(item => item !== null);

    res.json({ 
      success: true, 
      changelog,
      currentUser,
      userRole,
      totalItems: changelog.length
    });
  } catch (error) {
    console.error('Error fetching changelog:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Submit change for review (automatically called when changes are made)
router.post('/submit-review', requireAuth, async (req, res) => {
  try {
    const { commitSha, action, type, itemName, commitMessage } = req.body;
    const user = req.session.displayName || req.session.username || 'Unknown';
    const userRole = req.session.role || 'user';

    // Load current reviews
    const reviewsData = await loadReviews();

    // Check if review already exists
    const existingReview = reviewsData.reviews.find(r => r.commitSha === commitSha);
    if (existingReview) {
      return res.json({ success: true, message: 'Review already exists' });
    }

    // GM/Admin changes are auto-approved
    const autoApprove = userRole === 'gm' || userRole === 'admin';

    // Create new review entry
    const newReview = {
      commitSha,
      action,
      type,
      itemName,
      user,
      timestamp: new Date().toISOString(),
      status: autoApprove ? 'approved' : 'pending',
      reviewedBy: autoApprove ? user : null,
      reviewedAt: autoApprove ? new Date().toISOString() : null,
      reviewNotes: autoApprove ? 'Auto-approved (GM/Admin)' : '',
      commitMessage
    };

    reviewsData.reviews.unshift(newReview); // Add to beginning for chronological order

    // Save updated reviews
    await saveReviews(reviewsData);

    res.json({ 
      success: true, 
      review: newReview,
      message: autoApprove ? 'Change auto-approved' : 'Change submitted for review'
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update review status (GM/Admin only)
router.put('/review/:commitSha', requireAuth, async (req, res) => {
  try {
    const { commitSha } = req.params;
    const { status, reviewNotes } = req.body;
    const reviewer = req.session.displayName || req.session.username || 'Unknown';
    const userRole = req.session.role || 'user';

    // Check if user has permission to review
    if (userRole !== 'gm' && userRole !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Only GM/Admin can review changes' 
      });
    }

    // Validate status
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid status. Must be: pending, approved, or rejected' 
      });
    }

    // Load current reviews
    const reviewsData = await loadReviews();

    // Find the review to update
    const reviewIndex = reviewsData.reviews.findIndex(r => r.commitSha === commitSha);
    if (reviewIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: 'Review not found' 
      });
    }

    // Update review
    const review = reviewsData.reviews[reviewIndex];
    review.status = status;
    review.reviewedBy = reviewer;
    review.reviewedAt = new Date().toISOString();
    review.reviewNotes = reviewNotes || '';

    // Save updated reviews
    await saveReviews(reviewsData);

    res.json({ 
      success: true, 
      review,
      message: `Change ${status} successfully`
    });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get pending reviews (GM/Admin only)
router.get('/pending', requireAuth, async (req, res) => {
  try {
    const userRole = req.session.role || 'user';

    // Check if user has permission to see pending reviews
    if (userRole !== 'gm' && userRole !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Only GM/Admin can view pending reviews' 
      });
    }

    // Load reviews
    const reviewsData = await loadReviews();
    const pendingReviews = reviewsData.reviews.filter(r => r.status === 'pending');

    res.json({ 
      success: true, 
      pendingReviews,
      count: pendingReviews.length
    });
  } catch (error) {
    console.error('Error fetching pending reviews:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get current user's review statistics
router.get('/user-stats', async (req, res) => {
  try {
    const targetUser = req.session.displayName || req.session.username;
    const userRole = req.session.role || 'user';

    if (!targetUser) {
      return res.status(401).json({ 
        success: false, 
        error: 'Not authenticated' 
      });
    }

    // Load reviews
    const reviewsData = await loadReviews();
    const userReviews = reviewsData.reviews.filter(r => r.user === targetUser);

    const stats = {
      total: userReviews.length,
      pending: userReviews.filter(r => r.status === 'pending').length,
      approved: userReviews.filter(r => r.status === 'approved').length,
      rejected: userReviews.filter(r => r.status === 'rejected').length,
      recentChanges: userReviews.slice(0, 10)
    };

    res.json({ 
      success: true, 
      user: targetUser,
      stats
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get specific user's review statistics (GM/Admin only)
router.get('/user-stats/:username', requireAuth, async (req, res) => {
  try {
    const targetUser = req.params.username;
    const currentUser = req.session.displayName || req.session.username;
    const userRole = req.session.role || 'user';

    // Users can only see their own stats unless they're GM/Admin
    if (targetUser !== currentUser && userRole !== 'gm' && userRole !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'You can only view your own statistics' 
      });
    }

    // Load reviews
    const reviewsData = await loadReviews();
    const userReviews = reviewsData.reviews.filter(r => r.user === targetUser);

    const stats = {
      total: userReviews.length,
      pending: userReviews.filter(r => r.status === 'pending').length,
      approved: userReviews.filter(r => r.status === 'approved').length,
      rejected: userReviews.filter(r => r.status === 'rejected').length,
      recentChanges: userReviews.slice(0, 10)
    };

    res.json({ 
      success: true, 
      user: targetUser,
      stats
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Parse enhanced commit messages (same as activity.js)
function parseCommitMessage(message, author, date, sha) {
  try {
    const patterns = {
      create: /^Create (location|character): (.+) \(by (.+)\) - (.+)$/,
      update: /^Update (location|character): (.+) \(by (.+)\) - (.+)$/,
      delete: /^Delete (location|character): (.+) \(by (.+)\) - (.+)$/
    };

    let parsed = null;

    for (const [action, pattern] of Object.entries(patterns)) {
      const match = message.match(pattern);
      if (match) {
        parsed = {
          id: sha.substring(0, 7),
          action: action,
          type: match[1],
          itemName: match[2],
          user: match[3],
          description: match[4],
          timestamp: date,
          fullMessage: message
        };
        break;
      }
    }

    // Fallback for non-enhanced commits
    if (!parsed && message.trim()) {
      parsed = {
        id: sha.substring(0, 7),
        action: 'unknown',
        type: 'unknown',
        itemName: 'Unknown',
        user: author,
        description: message,
        timestamp: date,
        fullMessage: message
      };
    }

    return parsed;
  } catch (error) {
    console.error('Error parsing commit message:', error);
    return null;
  }
}

module.exports = router;