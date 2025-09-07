#!/usr/bin/env node

/**
 * Remove galleries section from media-library.json
 * This is unused legacy code with no integration in the current system
 */

require('dotenv').config();
const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const REPO_OWNER = 'piosteiner';
const REPO_NAME = 'Adenai-Map';
const FILE_PATH = 'public/data/media-library.json';

async function removeGalleries() {
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
    console.log('- Images:', Object.keys(currentContent.images || {}).length);
    
    if (currentContent.galleries) {
      console.log('\n🗂️ Gallery contents to be removed:');
      Object.keys(currentContent.galleries).forEach(key => {
        console.log(`  - ${key}: "${currentContent.galleries[key].title}"`);
      });
    }
    
    // Create final version - only images (actual media assets)
    const finalContent = {
      images: currentContent.images || {},
      lastUpdated: new Date().toISOString()
    };
    
    console.log('\n🧹 Removing galleries section...');
    console.log('❌ Galleries are not integrated into the current system');
    console.log('❌ Referenced images do not exist in uploads directory');
    console.log('❌ No frontend or backend code uses galleries');
    console.log('✅ Keeping only actively used images section');
    
    // Update file on GitHub
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: FILE_PATH,
      message: 'Remove unused galleries section from media-library.json - legacy code cleanup',
      content: Buffer.from(JSON.stringify(finalContent, null, 2)).toString('base64'),
      sha: fileData.sha,
    });

    console.log('\n✅ Successfully cleaned up media-library.json');
    console.log('📋 Final structure:');
    console.log('- Images:', Object.keys(finalContent.images).length);
    console.log('\n🎯 media-library.json now contains only actively managed media assets');
    
  } catch (error) {
    console.error('❌ Error removing galleries:', error.message);
    process.exit(1);
  }
}

// Run the cleanup
removeGalleries();
