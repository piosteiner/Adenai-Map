// routes/activity.js - Fixed for your environment variables
const express = require('express');
const { Octokit } = require('@octokit/rest');
const router = express.Router();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Use the CORRECT environment variables that match your server.js
const GITHUB_OWNER = process.env.GITHUB_USERNAME; // Fixed: was GITHUB_OWNER
const GITHUB_REPO = process.env.GITHUB_REPO;

// Get recent activity across all content
router.get('/recent', async (req, res) => {
  try {
    const limit = req.query.limit || 20;
    
    // Fetch recent commits
    const { data: commits } = await octokit.rest.repos.listCommits({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      per_page: limit
    });

    // Parse commits into activity feed
    const activities = commits.map(commit => {
      const message = commit.commit.message;
      const author = commit.commit.author.name;
      const date = commit.commit.author.date;
      
      // Parse enhanced commit messages
      const activity = parseCommitMessage(message, author, date, commit.sha);
      return activity;
    }).filter(activity => activity !== null);

    res.json({ success: true, activities });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get history for specific item
router.get('/:type/:name/history', async (req, res) => {
  try {
    const { type, name } = req.params;
    const limit = req.query.limit || 10;

    // Map type to actual file path
    let filePath;
    if (type === 'locations') {
      filePath = 'data/places.geojson';
    } else if (type === 'characters') {
      filePath = 'data/characters.json';
    } else {
      return res.status(400).json({ success: false, error: 'Invalid type' });
    }

    // Fetch commits that touch this file and mention the specific item
    const { data: commits } = await octokit.rest.repos.listCommits({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      per_page: limit
    });

    // Filter commits that mention this specific item in the message
    const relevantCommits = commits.filter(commit => {
      const message = commit.commit.message.toLowerCase();
      const itemName = name.toLowerCase();
      return message.includes(itemName);
    });

    const history = relevantCommits.map(commit => {
      const message = commit.commit.message;
      const author = commit.commit.author.name;
      const date = commit.commit.author.date;
      
      return parseCommitMessage(message, author, date, commit.sha);
    }).filter(item => item !== null);

    res.json({ success: true, history, itemName: name, itemType: type });
  } catch (error) {
    console.error('Error fetching item history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get activity statistics
router.get('/stats', async (req, res) => {
  try {
    const days = req.query.days || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: commits } = await octokit.rest.repos.listCommits({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      since: since.toISOString(),
      per_page: 100
    });

    // Calculate stats
    const stats = {
      totalChanges: commits.length,
      userActivity: {},
      typeActivity: {
        locations: 0,
        characters: 0,
        other: 0
      },
      dailyActivity: {}
    };

    commits.forEach(commit => {
      const message = commit.commit.message;
      const author = commit.commit.author.name;
      const date = new Date(commit.commit.author.date).toDateString();

      // Count by user
      stats.userActivity[author] = (stats.userActivity[author] || 0) + 1;

      // Count by type based on commit message content
      if (message.includes('location') || message.includes('Location') || message.includes('places.geojson')) {
        stats.typeActivity.locations++;
      } else if (message.includes('character') || message.includes('Character') || message.includes('characters.json')) {
        stats.typeActivity.characters++;
      } else {
        stats.typeActivity.other++;
      }

      // Count by day
      stats.dailyActivity[date] = (stats.dailyActivity[date] || 0) + 1;
    });

    res.json({ success: true, stats, period: `${days} days` });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Parse enhanced commit messages
function parseCommitMessage(message, author, date, sha) {
  try {
    // Enhanced commit message format:
    // "Create location: Rivendell (by Nici) - Initial location creation"
    // "Update character: Gandalf (by Luisa) - Updated character details"
    // "Delete location: Old Tavern (by GM) - Removed from campaign"

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
