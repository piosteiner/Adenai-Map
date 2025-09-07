#!/usr/bin/env node

require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');

async function updateMediaLibraryDatabase() {
  console.log('🔄 Starting media library database update...');
  
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
    console.log(`📊 Found ${mediaImages.length} media entries in database`);
    
    // Create mapping from old timestamps to new clean IDs based on our migration
    const timestampToCleanId = {
      '1757235629299': '6jugrtuo6jq5', // theo.png
      '1757247474927': 'g7b7j6jhzs5f', // Petrel Kormorant.png
      '1757248806900': 'tryy7cw94miy', // ChatGPT Image Sep 7, 2025, 02_38_43 PM.png
      '1757249948756': '0r2kk9zndrgw'  // ChatGPT Image Sep 7, 2025, 01_01_09 PM.png
    };
    
    // Update media library entries
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const media of mediaImages) {
      console.log(`\n🔍 Processing: ${media.id}`);
      
      // Check if this media has old URLs (instead of looking for timestamps in ID)
      let hasOldUrls = false;
      if (media.sizes) {
        for (const [sizeName, sizeData] of Object.entries(media.sizes)) {
          if (sizeData.url && sizeData.url.match(/\/media\/\d+/)) {
            hasOldUrls = true;
            break;
          }
        }
      }
      
      if (!hasOldUrls) {
        console.log(`  ⏭️  URLs already use clean naming`);
        skippedCount++;
        continue;
      }
      
      // Extract the clean base ID from the current media ID
      const baseIdMatch = media.id.match(/^[^-]+-([a-z0-9]{12})$/);
      if (!baseIdMatch) {
        console.log(`  ⚠️  Cannot extract base ID from ${media.id}`);
        skippedCount++;
        continue;
      }
      
      const newBaseId = baseIdMatch[1];
      console.log(`  🔄 Updating URLs for base ID: ${newBaseId}`);
      
      // Update the sizes filenames and URLs
      if (media.sizes) {
        for (const [sizeName, sizeData] of Object.entries(media.sizes)) {
          if (sizeData.filename) {
            // Map thumbnail to thumb to match our actual files
            const actualSize = sizeName === 'thumbnail' ? 'thumb' : sizeName;
            const newFilename = `${newBaseId}-${actualSize}.webp`;
            console.log(`    📁 ${sizeData.filename} → ${newFilename}`);
            sizeData.filename = newFilename;
          }
          
          // Also update the URL if it exists
          if (sizeData.url) {
            const actualSize = sizeName === 'thumbnail' ? 'thumb' : sizeName;
            const newUrl = `/media/${newBaseId}-${actualSize}.webp`;
            console.log(`    🔗 ${sizeData.url} → ${newUrl}`);
            sizeData.url = newUrl;
          }
        }
      }
      
      // Update the media entry
      media.lastModified = new Date().toISOString();
      
      updatedCount++;
    }
    
    // Update the lastUpdated timestamp
    mediaLibraryData.lastUpdated = new Date().toISOString();
    
    // Update the media library on GitHub
    if (updatedCount > 0) {
      console.log(`\n💾 Updating media library on GitHub...`);
      
      const updatedContent = JSON.stringify(mediaLibraryData, null, 2);
      
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: 'public/data/media-library.json',
        message: 'Update media filenames to use clean naming convention',
        content: Buffer.from(updatedContent).toString('base64'),
        sha: currentFile.sha
      });
      
      console.log(`✅ Media library updated on GitHub`);
    }
    
    // Summary
    console.log(`\n📊 Update Summary:`);
    console.log(`✅ Successfully updated: ${updatedCount} entries`);
    console.log(`⏭️  Skipped: ${skippedCount} entries`);
    
    if (updatedCount > 0) {
      console.log(`\n🎉 Database update completed!`);
      console.log(`✨ All media entries now reference the clean filenames`);
      console.log(`🔄 Remember to restart the server: pm2 restart adenai-cms`);
    } else {
      console.log(`\n✨ No updates needed - all entries already use clean naming`);
    }
    
  } catch (error) {
    console.error('❌ Database update failed:', error);
  }
}

// Run the update
if (require.main === module) {
  updateMediaLibraryDatabase().catch(console.error);
}

module.exports = { updateMediaLibraryDatabase };
