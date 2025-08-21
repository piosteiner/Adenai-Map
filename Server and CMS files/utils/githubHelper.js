// utils/githubHelper.js - Enhanced GitHub operations with better commit messages
const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;

// Enhanced save function with detailed commit messages
async function saveToGitHub(type, name, data, action, user, changes = []) {
  try {
    const fileName = `${type}/${name}.json`;
    const content = JSON.stringify(data, null, 2);
    const encodedContent = Buffer.from(content).toString('base64');

    // Generate enhanced commit message
    const commitMessage = generateEnhancedCommitMessage(action, type, name, user, changes);

    let sha = null;
    
    // Get existing file SHA if updating
    if (action === 'update') {
      try {
        const { data: existingFile } = await octokit.rest.repos.getContent({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          path: fileName
        });
        sha = existingFile.sha;
      } catch (error) {
        if (error.status !== 404) throw error;
        // File doesn't exist, treat as create
        action = 'create';
      }
    }

    // Create or update file
    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: fileName,
      message: commitMessage,
      content: encodedContent,
      sha: sha
    });

    return {
      success: true,
      sha: response.data.content.sha,
      commitMessage: commitMessage,
      action: action
    };

  } catch (error) {
    console.error(`Error saving ${type} ${name} to GitHub:`, error);
    throw new Error(`Failed to save ${type}: ${error.message}`);
  }
}

// Delete from GitHub with enhanced commit message
async function deleteFromGitHub(type, name, user, reason = '') {
  try {
    const fileName = `${type}/${name}.json`;

    // Get file SHA
    const { data: file } = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: fileName
    });

    const commitMessage = generateEnhancedCommitMessage('delete', type, name, user, [reason]);

    // Delete file
    const response = await octokit.rest.repos.deleteFile({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: fileName,
      message: commitMessage,
      sha: file.sha
    });

    return {
      success: true,
      commitMessage: commitMessage,
      action: 'delete'
    };

  } catch (error) {
    console.error(`Error deleting ${type} ${name} from GitHub:`, error);
    throw new Error(`Failed to delete ${type}: ${error.message}`);
  }
}

// Generate enhanced commit messages
function generateEnhancedCommitMessage(action, type, name, user, changes = []) {
  const capitalizedAction = action.charAt(0).toUpperCase() + action.slice(1);
  const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
  
  let message = `${capitalizedAction} ${type}: ${name} (by ${user})`;

  // Add description based on changes
  if (changes && changes.length > 0) {
    const description = generateChangeDescription(action, changes);
    message += ` - ${description}`;
  } else {
    // Default descriptions
    const defaultDescriptions = {
      create: `Initial ${type} creation`,
      update: `Updated ${type} details`,
      delete: `Removed ${type} from campaign`
    };
    message += ` - ${defaultDescriptions[action] || 'Modified content'}`;
  }

  return message;
}

// Generate human-readable change descriptions
function generateChangeDescription(action, changes) {
  if (action === 'create') {
    return 'Initial creation with all details';
  }

  if (action === 'delete') {
    return changes.length > 0 ? changes[0] : 'Removed from campaign';
  }

  if (action === 'update' && changes.length > 0) {
    const descriptions = [];
    
    changes.forEach(change => {
      if (typeof change === 'string') {
        descriptions.push(change);
      } else if (change.field && change.type) {
        switch (change.type) {
          case 'modified':
            descriptions.push(`updated ${change.field}`);
            break;
          case 'added':
            descriptions.push(`added ${change.field}`);
            break;
          case 'removed':
            descriptions.push(`removed ${change.field}`);
            break;
        }
      }
    });

    if (descriptions.length > 0) {
      if (descriptions.length === 1) {
        return `Changed ${descriptions[0]}`;
      } else if (descriptions.length === 2) {
        return `Changed ${descriptions[0]} and ${descriptions[1]}`;
      } else {
        return `Changed ${descriptions.slice(0, -1).join(', ')} and ${descriptions[descriptions.length - 1]}`;
      }
    }
  }

  return 'Updated content';
}

// Helper to detect changes between old and new data
function detectChanges(oldData, newData) {
  const changes = [];
  
  if (!oldData) return ['Initial creation'];

  // Compare key fields
  const fieldsToCheck = ['name', 'description', 'type', 'notes', 'stats', 'inventory'];
  
  fieldsToCheck.forEach(field => {
    if (oldData[field] !== newData[field]) {
      if (!oldData[field] && newData[field]) {
        changes.push({ field, type: 'added' });
      } else if (oldData[field] && !newData[field]) {
        changes.push({ field, type: 'removed' });
      } else if (oldData[field] !== newData[field]) {
        changes.push({ field, type: 'modified' });
      }
    }
  });

  return changes;
}

// Load data from GitHub
async function loadFromGitHub(type, name) {
  try {
    const fileName = `${type}/${name}.json`;
    
    const { data } = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: fileName
    });

    const content = Buffer.from(data.content, 'base64').toString('utf8');
    return JSON.parse(content);

  } catch (error) {
    if (error.status === 404) {
      return null; // File doesn't exist
    }
    throw new Error(`Failed to load ${type}: ${error.message}`);
  }
}

// List all items of a type
async function listFromGitHub(type) {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: type
    });

    if (!Array.isArray(data)) return [];

    const items = [];
    for (const file of data) {
      if (file.name.endsWith('.json')) {
        const name = file.name.replace('.json', '');
        const content = await loadFromGitHub(type, name);
        if (content) {
          items.push({ name, ...content });
        }
      }
    }

    return items;

  } catch (error) {
    if (error.status === 404) {
      return []; // Directory doesn't exist yet
    }
    throw new Error(`Failed to list ${type}: ${error.message}`);
  }
}

module.exports = {
  saveToGitHub,
  deleteFromGitHub,
  loadFromGitHub,
  listFromGitHub,
  detectChanges,
  generateEnhancedCommitMessage
};