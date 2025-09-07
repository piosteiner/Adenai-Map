#!/usr/bin/env node

require('dotenv').config();
const { Octokit } = require('@octokit/rest');

async function updateMediaLibraryStructure() {
  console.log('🔄 Starting media library structure update...');
  
  try {
    // Initialize GitHub API using environment variables
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    
    const REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'piosteiner';
    const REPO_NAME = process.env.GITHUB_REPO_NAME || 'Adenai-Map';
    
    console.log(`🔗 Connected to ${REPO_OWNER}/${REPO_NAME}`);
    
    // Get current media library from GitHub
    console.log('📥 Fetching current media library...');
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/media-library.json'
    });
    
    const currentContent = Buffer.from(currentFile.content, 'base64').toString();
    let mediaLibraryData = JSON.parse(currentContent);
    
    // Extract the images object
    if (!mediaLibraryData.images || typeof mediaLibraryData.images !== 'object') {
      console.log('❌ No images found in media library');
      return;
    }
    
    const mediaImages = Object.values(mediaLibraryData.images);
    console.log(`📊 Found ${mediaImages.length} media entries to update`);
    
    // Update media library entries
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const [mediaId, mediaEntry] of Object.entries(mediaLibraryData.images)) {
      console.log(`\n🔍 Processing: ${mediaId}`);
      
      let wasUpdated = false;
      
      // Check if it has the old 'alt' field and needs to be renamed to 'title'
      if (mediaEntry.hasOwnProperty('alt')) {
        console.log(`  🔄 Renaming 'alt' to 'title': "${mediaEntry.alt}"`);
        mediaEntry.title = mediaEntry.alt;
        delete mediaEntry.alt;
        wasUpdated = true;
      }
      
      // Check if it has 'originalName' field and remove it
      if (mediaEntry.hasOwnProperty('originalName')) {
        console.log(`  🗑️  Removing 'originalName': "${mediaEntry.originalName}"`);
        delete mediaEntry.originalName;
        wasUpdated = true;
      }
      
      // Ensure title exists (fallback to media ID base if missing)
      if (!mediaEntry.title) {
        const fallbackTitle = mediaId.replace(/^[^-]+-/, '').replace(/-/g, ' ');
        console.log(`  📝 Adding missing title: "${fallbackTitle}"`);
        mediaEntry.title = fallbackTitle;
        wasUpdated = true;
      }
      
      // Ensure caption field exists (even if empty)
      if (!mediaEntry.hasOwnProperty('caption')) {
        mediaEntry.caption = '';
        wasUpdated = true;
      }
      
      if (wasUpdated) {
        mediaEntry.lastModified = new Date().toISOString();
        updatedCount++;
        console.log(`  ✅ Updated structure`);
      } else {
        console.log(`  ⏭️  Already has correct structure`);
        skippedCount++;
      }
    }
    
    // Update the lastUpdated timestamp
    mediaLibraryData.lastUpdated = new Date().toISOString();
    
    // Update the media library on GitHub
    if (updatedCount > 0) {
      console.log(`\n💾 Updating media library structure on GitHub...`);
      
      const updatedContent = JSON.stringify(mediaLibraryData, null, 2);
      
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: 'public/data/media-library.json',
        message: 'Migrate media library structure: alt→title, remove originalName',
        content: Buffer.from(updatedContent).toString('base64'),
        sha: currentFile.sha
      });
      
      console.log(`✅ Media library structure updated on GitHub`);
    }
    
    // Summary
    console.log(`\n📊 Migration Summary:`);
    console.log(`✅ Successfully updated: ${updatedCount} entries`);
    console.log(`⏭️  Already current: ${skippedCount} entries`);
    
    if (updatedCount > 0) {
      console.log(`\n🎉 Structure migration completed!`);
      console.log(`✨ Media library now uses clean structure with 'title' field`);
      console.log(`🔄 Remember to restart the server: pm2 restart adenai-cms`);
    } else {
      console.log(`\n✨ No migration needed - all entries already have correct structure`);
    }
    
  } catch (error) {
    console.error('❌ Structure migration failed:', error);
  }
}

// Run the migration
if (require.main === module) {
  updateMediaLibraryStructure().catch(console.error);
}

module.exports = { updateMediaLibraryStructure };
