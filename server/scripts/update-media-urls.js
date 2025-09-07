require('dotenv').config();
const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

async function updateMediaUrls() {
  try {
    console.log('🔄 Starting media URL update...');
    console.log('🔗 Connected to', process.env.GITHUB_USERNAME + '/' + process.env.GITHUB_REPO);
    
    // Fetch current media library
    console.log('📥 Fetching current media library...');
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner: process.env.GITHUB_USERNAME,
      repo: process.env.GITHUB_REPO,
      path: 'public/data/media-library.json'
    });

    const mediaLibrary = JSON.parse(Buffer.from(fileData.content, 'base64').toString());
    console.log('📊 Found', Object.keys(mediaLibrary).length, 'media entries');

    let updatedCount = 0;
    const baseUrl = process.env.MEDIA_BASE_URL || 'https://adenai-admin.piogino.ch';

    // Update URLs in media library
    for (const [mediaId, mediaEntry] of Object.entries(mediaLibrary.images || mediaLibrary)) {
      let hasUpdates = false;
      
      if (mediaEntry.sizes) {
        for (const [sizeName, sizeData] of Object.entries(mediaEntry.sizes)) {
          if (sizeData.url && sizeData.url.startsWith('/media/')) {
            const oldUrl = sizeData.url;
            sizeData.url = `${baseUrl}${oldUrl}`;
            hasUpdates = true;
            console.log(`  🔄 Updated ${mediaId} ${sizeName}: ${oldUrl} → ${sizeData.url}`);
          }
        }
      }
      
      if (hasUpdates) {
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      // Upload updated media library
      console.log('📤 Uploading updated media library...');
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: process.env.GITHUB_USERNAME,
        repo: process.env.GITHUB_REPO,
        path: 'public/data/media-library.json',
        message: 'Update media URLs to use admin server domain',
        content: Buffer.from(JSON.stringify(mediaLibrary, null, 2)).toString('base64'),
        sha: fileData.sha
      });

      console.log('📊 Update Summary:');
      console.log('✅ Successfully updated:', updatedCount, 'media entries');
      console.log('✨ Media URLs now point to admin server!');
    } else {
      console.log('✨ No updates needed - all URLs already have full domains');
    }

  } catch (error) {
    console.error('❌ Error updating media URLs:', error.message);
    process.exit(1);
  }
}

updateMediaUrls();
