#!/usr/bin/env node

const { Octokit } = require('@octokit/rest');
require('dotenv').config();

// Initialize GitHub API
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const REPO_OWNER = 'piosteiner';
const REPO_NAME = 'Adenai-Map';
const MEDIA_BASE_URL = process.env.MEDIA_BASE_URL || 'https://adenai-admin.piogino.ch';

async function updateLocationUrls() {
  try {
    console.log('🔄 Starting location URL update...');
    console.log(`🔗 Connected to ${REPO_OWNER}/${REPO_NAME}`);
    
    // Fetch current locations
    console.log('📥 Fetching current locations...');
    const { data: locationFile } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/places.geojson',
      ref: 'main'
    });
    
    const locationsData = JSON.parse(Buffer.from(locationFile.content, 'base64').toString());
    console.log(`📊 Found ${locationsData.features?.length || 0} locations`);
    
    let updatedCount = 0;
    
    // Update location image URLs
    for (const location of locationsData.features || []) {
      if (location.properties?.image && location.properties.image.startsWith('/media/')) {
        const oldUrl = location.properties.image;
        const newUrl = `${MEDIA_BASE_URL}${oldUrl}`;
        location.properties.image = newUrl;
        updatedCount++;
        console.log(`  🔄 Updated ${location.properties.name}: ${oldUrl} → ${newUrl}`);
      }
    }
    
    if (updatedCount > 0) {
      console.log('📤 Uploading updated locations...');
      
      // Update the file in GitHub
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: 'public/data/places.geojson',
        message: `Update location image URLs to use full domain paths (${updatedCount} locations updated)`,
        content: Buffer.from(JSON.stringify(locationsData, null, 2)).toString('base64'),
        sha: locationFile.sha
      });
      
      console.log('📊 Update Summary:');
      console.log(`✅ Successfully updated: ${updatedCount} location entries`);
      console.log('✨ Location image URLs now point to admin server!');
    } else {
      console.log('ℹ️ No location URLs needed updating');
    }
    
  } catch (error) {
    console.error('❌ Error updating location URLs:', error.message);
    process.exit(1);
  }
}

updateLocationUrls();
