#!/usr/bin/env node

require('dotenv').config();
const { Octokit } = require('@octokit/rest');

async function updateCharacterImageUrls() {
  console.log('🔄 Starting character image URL update...');
  
  try {
    // Initialize GitHub API using environment variables
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    
    const REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'piosteiner';
    const REPO_NAME = process.env.GITHUB_REPO_NAME || 'Adenai-Map';
    
    console.log(`🔗 Connected to ${REPO_OWNER}/${REPO_NAME}`);
    
    // Get current characters data from GitHub
    console.log('📥 Fetching current characters data...');
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/characters.json'
    });
    
    const currentContent = Buffer.from(currentFile.content, 'base64').toString();
    let charactersData = JSON.parse(currentContent);
    
    const characters = charactersData.characters || [];
    console.log(`📊 Found ${characters.length} characters in database`);
    
    // Create mapping from old timestamps to new clean IDs based on our migration
    const oldToNewImageMapping = {
      // Old /media/ URLs to new clean URLs
      '/media/1757235628678-theo_small.webp': '/media/6jugrtuo6jq5-small.webp',
      '/media/1757235628678-theo_medium.webp': '/media/6jugrtuo6jq5-medium.webp',
      '/media/1757235628678-theo_large.webp': '/media/6jugrtuo6jq5-large.webp',
      '/media/1757235628678-theo_thumb.webp': '/media/6jugrtuo6jq5-thumb.webp',
      '/media/1757235628678-theo_original.webp': '/media/6jugrtuo6jq5-original.webp',
      
      '/media/1757247474286-Petrel_Kormorant_small.webp': '/media/g7b7j6jhzs5f-small.webp',
      '/media/1757247474286-Petrel_Kormorant_medium.webp': '/media/g7b7j6jhzs5f-medium.webp',
      '/media/1757247474286-Petrel_Kormorant_large.webp': '/media/g7b7j6jhzs5f-large.webp',
      '/media/1757247474286-Petrel_Kormorant_thumb.webp': '/media/g7b7j6jhzs5f-thumb.webp',
      '/media/1757247474286-Petrel_Kormorant_original.webp': '/media/g7b7j6jhzs5f-original.webp',
      
      '/media/1757248806291-ChatGPT_Image_Sep_7__2025__02_38_43_PM_small.webp': '/media/tryy7cw94miy-small.webp',
      '/media/1757248806291-ChatGPT_Image_Sep_7__2025__02_38_43_PM_medium.webp': '/media/tryy7cw94miy-medium.webp',
      '/media/1757248806291-ChatGPT_Image_Sep_7__2025__02_38_43_PM_large.webp': '/media/tryy7cw94miy-large.webp',
      '/media/1757248806291-ChatGPT_Image_Sep_7__2025__02_38_43_PM_thumb.webp': '/media/tryy7cw94miy-thumb.webp',
      '/media/1757248806291-ChatGPT_Image_Sep_7__2025__02_38_43_PM_original.webp': '/media/tryy7cw94miy-original.webp',
      
      '/media/1757249948180-ChatGPT_Image_Sep_7__2025__01_01_09_PM_small.webp': '/media/0r2kk9zndrgw-small.webp',
      '/media/1757249948180-ChatGPT_Image_Sep_7__2025__01_01_09_PM_medium.webp': '/media/0r2kk9zndrgw-medium.webp',
      '/media/1757249948180-ChatGPT_Image_Sep_7__2025__01_01_09_PM_large.webp': '/media/0r2kk9zndrgw-large.webp',
      '/media/1757249948180-ChatGPT_Image_Sep_7__2025__01_01_09_PM_thumb.webp': '/media/0r2kk9zndrgw-thumb.webp',
      '/media/1757249948180-ChatGPT_Image_Sep_7__2025__01_01_09_PM_original.webp': '/media/0r2kk9zndrgw-original.webp'
    };
    
    // Also handle domain changes from adenai-admin.piogino to adenai.piogino
    const updateDomainUrl = (url) => {
      if (url && url.includes('adenai-admin.piogino')) {
        return url.replace('adenai-admin.piogino', 'adenai.piogino');
      }
      return url;
    };
    
    // Update character image URLs
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const character of characters) {
      console.log(`\n🔍 Processing: ${character.name} (${character.id})`);
      
      if (!character.image) {
        console.log(`  ⏭️  No image URL`);
        skippedCount++;
        continue;
      }
      
      let originalImage = character.image;
      let updatedImage = character.image;
      let wasUpdated = false;
      
      // Check for old media URLs that need clean ID updates
      if (oldToNewImageMapping[character.image]) {
        updatedImage = oldToNewImageMapping[character.image];
        wasUpdated = true;
        console.log(`  🔄 Updated media URL: ${originalImage} → ${updatedImage}`);
      }
      // Check for domain updates
      else if (character.image.includes('adenai-admin.piogino')) {
        updatedImage = updateDomainUrl(character.image);
        wasUpdated = true;
        console.log(`  🔄 Updated domain: ${originalImage} → ${updatedImage}`);
      }
      // Check for other old /media/ URLs with timestamps
      else if (character.image.match(/\/media\/\d+/)) {
        console.log(`  ⚠️  Found old media URL but no mapping: ${character.image}`);
        skippedCount++;
        continue;
      }
      else {
        console.log(`  ✅ URL already clean: ${character.image}`);
        skippedCount++;
        continue;
      }
      
      if (wasUpdated) {
        character.image = updatedImage;
        character.updatedAt = new Date().toISOString();
        updatedCount++;
      }
    }
    
    // Update the lastUpdated timestamp
    charactersData.lastUpdated = new Date().toISOString();
    
    // Update the characters data on GitHub
    if (updatedCount > 0) {
      console.log(`\n💾 Updating characters data on GitHub...`);
      
      const updatedContent = JSON.stringify(charactersData, null, 2);
      
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: 'public/data/characters.json',
        message: 'Update character image URLs to use clean naming convention',
        content: Buffer.from(updatedContent).toString('base64'),
        sha: currentFile.sha
      });
      
      console.log(`✅ Characters data updated on GitHub`);
    }
    
    // Summary
    console.log(`\n📊 Update Summary:`);
    console.log(`✅ Successfully updated: ${updatedCount} characters`);
    console.log(`⏭️  Skipped: ${skippedCount} characters`);
    
    if (updatedCount > 0) {
      console.log(`\n🎉 Character image URL update completed!`);
      console.log(`✨ All character image URLs now use clean naming or correct domain`);
      console.log(`🔄 Remember to restart the server: pm2 restart adenai-cms`);
    } else {
      console.log(`\n✨ No updates needed - all character image URLs already clean`);
    }
    
  } catch (error) {
    console.error('❌ Character URL update failed:', error);
  }
}

// Run the update
if (require.main === module) {
  updateCharacterImageUrls().catch(console.error);
}

module.exports = { updateCharacterImageUrls };
