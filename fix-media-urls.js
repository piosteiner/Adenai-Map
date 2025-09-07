#!/usr/bin/env node

/**
 * Fix Media URLs Script
 * 
 * Updates character image URLs from relative /media/ paths 
 * to absolute https://adenai-admin.piogino.ch/media/ paths
 */

const fs = require('fs').promises;

const CHARACTERS_FILE = 'public/data/characters.json';
const MEDIA_LIBRARY_FILE = 'public/data/media-library.json';
const CORRECT_BASE_URL = 'https://adenai-admin.piogino.ch';

async function fixCharacterImageUrls() {
  console.log('🔧 Fixing character image URLs...\n');
  
  try {
    // Read characters file
    const charactersContent = await fs.readFile(CHARACTERS_FILE, 'utf8');
    const charactersData = JSON.parse(charactersContent);
    
    let updateCount = 0;
    
    // Update each character's image URL
    for (const character of charactersData.characters) {
      if (character.image && character.image.startsWith('/media/')) {
        const oldUrl = character.image;
        const newUrl = `${CORRECT_BASE_URL}${character.image}`;
        
        character.image = newUrl;
        character.updatedAt = new Date().toISOString();
        updateCount++;
        
        console.log(`✅ Updated ${character.name}`);
        console.log(`   Old: ${oldUrl}`);
        console.log(`   New: ${newUrl}\n`);
      }
    }
    
    if (updateCount > 0) {
      // Write updated characters file
      await fs.writeFile(CHARACTERS_FILE, JSON.stringify(charactersData, null, 2));
      console.log(`🎉 Successfully updated ${updateCount} character image URLs!`);
    } else {
      console.log('ℹ️  No character image URLs needed updating.');
    }
    
  } catch (error) {
    console.error('❌ Error fixing character URLs:', error.message);
  }
}

async function checkLocationFiles() {
  console.log('\n🔍 Checking location content files...\n');
  
  try {
    const locationDir = 'public/content/locations';
    const files = await fs.readdir(locationDir);
    const htmlFiles = files.filter(f => f.endsWith('.html'));
    
    let foundRelativeUrls = false;
    
    for (const file of htmlFiles) {
      const filePath = `${locationDir}/${file}`;
      const content = await fs.readFile(filePath, 'utf8');
      
      // Check for relative /media/ URLs
      if (content.includes('/media/') && !content.includes('adenai-admin.piogino.ch')) {
        console.log(`⚠️  ${file} contains relative /media/ URLs`);
        foundRelativeUrls = true;
      }
    }
    
    if (!foundRelativeUrls) {
      console.log('✅ All location files look good!');
    }
    
  } catch (error) {
    console.error('❌ Error checking location files:', error.message);
  }
}

async function validateMediaLibrary() {
  console.log('\n📊 Validating media library URLs...\n');
  
  try {
    const content = await fs.readFile(MEDIA_LIBRARY_FILE, 'utf8');
    const mediaData = JSON.parse(content);
    
    let correctUrls = 0;
    let incorrectUrls = 0;
    
    for (const [imageId, imageData] of Object.entries(mediaData.images || {})) {
      for (const [sizeName, sizeData] of Object.entries(imageData.sizes || {})) {
        if (sizeData.url) {
          if (sizeData.url.startsWith('https://adenai-admin.piogino.ch/media/')) {
            correctUrls++;
          } else {
            incorrectUrls++;
            console.log(`❌ Incorrect URL: ${imageId} (${sizeName}): ${sizeData.url}`);
          }
        }
      }
    }
    
    console.log(`✅ Correct URLs: ${correctUrls}`);
    console.log(`❌ Incorrect URLs: ${incorrectUrls}`);
    
    if (incorrectUrls === 0) {
      console.log('🎉 All media library URLs are correct!');
    }
    
  } catch (error) {
    console.error('❌ Error validating media library:', error.message);
  }
}

async function main() {
  console.log('🔧 ADENAI MAP: MEDIA URL FIXER');
  console.log('=' .repeat(40) + '\n');
  
  await fixCharacterImageUrls();
  await checkLocationFiles();
  await validateMediaLibrary();
  
  console.log('\n🎯 SUMMARY:');
  console.log('✅ Characters updated to use absolute URLs');
  console.log('✅ Media library URLs validated');
  console.log('✅ Location files checked');
  console.log('\nAll image URLs should now point to:');
  console.log('📍 https://adenai-admin.piogino.ch/media/[filename]');
}

if (require.main === module) {
  main().catch(console.error);
}
