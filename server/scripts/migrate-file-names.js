#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Helper function to generate short unique IDs (same as in media.js)
function generateShortId() {
  return Math.random().toString(36).substr(2, 8) + Math.random().toString(36).substr(2, 4);
}

// Helper function to ensure unique IDs
async function generateUniqueId(existingIds) {
  let id;
  do {
    id = generateShortId();
  } while (existingIds.has(id));
  existingIds.add(id);
  return id;
}

async function migrateFileNames() {
  console.log('🔄 Starting file name migration...');
  
  const uploadsPath = path.join(__dirname, '../uploads/optimized');
  
  try {
    // Get list of files in uploads directory
    const files = await fs.readdir(uploadsPath);
    const imageFiles = files.filter(file => 
      file.endsWith('.webp') && 
      file.match(/^\d+/) // Files starting with timestamp
    );
    
    if (imageFiles.length === 0) {
      console.log('✨ No files found with old naming convention!');
      return;
    }
    
    console.log(`📊 Found ${imageFiles.length} files to migrate`);
    
    // Group files by their base name (removing size suffix)
    const fileGroups = {};
    
    for (const file of imageFiles) {
      // Extract timestamp and base name
      const match = file.match(/^(\d+)-(.+?)_(thumb|small|medium|large|original)\.webp$/);
      if (match) {
        const [, timestamp, baseName, size] = match;
        const groupKey = `${timestamp}-${baseName}`;
        
        if (!fileGroups[groupKey]) {
          fileGroups[groupKey] = {
            timestamp,
            baseName,
            files: []
          };
        }
        
        fileGroups[groupKey].files.push({
          oldName: file,
          size,
          oldPath: path.join(uploadsPath, file)
        });
      }
    }
    
    console.log(`📦 Grouped into ${Object.keys(fileGroups).length} media sets`);
    
    // Keep track of used IDs to avoid duplicates
    const usedIds = new Set();
    
    // Process each group
    let successCount = 0;
    let errorCount = 0;
    
    for (const [groupKey, group] of Object.entries(fileGroups)) {
      const newBaseId = await generateUniqueId(usedIds);
      
      console.log(`\n🔄 Migrating group: ${group.baseName}`);
      console.log(`   Old ID: ${group.timestamp}`);
      console.log(`   New ID: ${newBaseId}`);
      
      try {
        for (const file of group.files) {
          const newName = `${newBaseId}-${file.size}.webp`;
          const newPath = path.join(uploadsPath, newName);
          
          // Check if old file exists
          await fs.access(file.oldPath);
          
          // Rename the file
          await fs.rename(file.oldPath, newPath);
          console.log(`  ✅ ${file.oldName} → ${newName}`);
        }
        
        successCount++;
        
      } catch (error) {
        console.error(`  ❌ Error migrating ${groupKey}:`, error.message);
        errorCount++;
      }
    }
    
    // Summary
    console.log(`\n📊 Migration Summary:`);
    console.log(`✅ Successfully migrated: ${successCount} media sets`);
    console.log(`❌ Errors: ${errorCount}`);
    
    if (successCount > 0) {
      console.log(`\n🎉 File migration completed!`);
      console.log(`\n⚠️  IMPORTANT NOTES:`);
      console.log(`   • Physical files have been renamed with clean IDs`);
      console.log(`   • Media database still contains old references`);
      console.log(`   • You may need to re-upload media or update references manually`);
      console.log(`   • Consider this a fresh start for new uploads`);
      console.log(`\n🔄 Remember to restart the server: pm2 restart adenai-cms`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run the migration
if (require.main === module) {
  migrateFileNames().catch(console.error);
}

module.exports = { migrateFileNames };
