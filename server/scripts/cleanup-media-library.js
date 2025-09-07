#!/usr/bin/env node

/**
 * Remove character and event data from media-library.json
 * These should be managed in their dedicated files (characters.json, events.json)
 */

require('dotenv').config();
const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const REPO_OWNER = 'piosteiner';
const REPO_NAME = 'Adenai-Map';
const FILE_PATH = 'public/data/media-library.json';

async function cleanupMediaLibrary() {
  try {
    console.log('🔍 Fetching current media-library.json...');
    
    // Get current file
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: FILE_PATH,
    });

    const currentContent = JSON.parse(Buffer.from(fileData.content, 'base64').toString());
    
    console.log('📊 Current structure:');
    console.log('- Galleries:', Object.keys(currentContent.galleries || {}).length);
    console.log('- Characters:', Object.keys(currentContent.characters || {}).length);
    console.log('- Events:', Object.keys(currentContent.events || {}).length);
    console.log('- Images:', Object.keys(currentContent.images || {}).length);
    
    // Create cleaned version - keep only media-related data
    const cleanedContent = {
      galleries: currentContent.galleries || {},
      images: currentContent.images || {},
      lastUpdated: new Date().toISOString()
    };
    
    console.log('\n🧹 Cleaning up media-library.json...');
    console.log('- Removing characters section (belongs in characters.json)');
    console.log('- Removing events section (belongs in events.json or similar)');
    console.log('- Keeping galleries and images sections');
    
    // Update file on GitHub
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: FILE_PATH,
      message: 'Clean up media-library.json: remove character/event data, focus on media assets',
      content: Buffer.from(JSON.stringify(cleanedContent, null, 2)).toString('base64'),
      sha: fileData.sha,
    });

    console.log('\n✅ Successfully cleaned up media-library.json');
    console.log('📋 Final structure:');
    console.log('- Galleries:', Object.keys(cleanedContent.galleries).length);
    console.log('- Images:', Object.keys(cleanedContent.images).length);
    console.log('\n💡 Character data is still available in characters.json');
    console.log('💡 Consider creating events.json for event data if needed');
    
  } catch (error) {
    console.error('❌ Error cleaning up media library:', error.message);
    process.exit(1);
  }
}

// Run the cleanup
cleanupMediaLibrary();
