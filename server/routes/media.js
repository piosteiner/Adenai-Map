const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { requireAuth } = require('../middleware/auth');

// Initialize GitHub API (passed from main server)
let octokit, REPO_OWNER, REPO_NAME;

const initGitHub = (octokitInstance, repoOwner, repoName) => {
  octokit = octokitInstance;
  REPO_OWNER = repoOwner;
  REPO_NAME = repoName;
};

// Helper function to generate short unique IDs
function generateShortId() {
  return Math.random().toString(36).substr(2, 8) + Math.random().toString(36).substr(2, 4);
}

// Image size configurations
const IMAGE_SIZES = {
  thumb: { width: 150, height: 150 },
  small: { width: 300, height: 300 },
  medium: { width: 600, height: 600 },
  large: { width: 1200, height: 1200 }
};

// Configure multer for media uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = 'uploads/temp_media_upload';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const shortId = generateShortId();
    const ext = path.extname(file.originalname);
    cb(null, `temp_${shortId}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { 
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Max 10 files at once
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed!'));
    }
  }
});

// Helper function to optimize images
async function optimizeImage(inputPath, outputDir, baseId) {
  const optimized = {};
  
  try {
    // Get original image info
    const originalImage = sharp(inputPath);
    const metadata = await originalImage.metadata();
    
    // Generate different sizes
    for (const [sizeName, config] of Object.entries(IMAGE_SIZES)) {
      const outputFilename = `${baseId}-${sizeName}.webp`;
      const outputPath = path.join(outputDir, outputFilename);
      
      await originalImage
        .resize(config.width, config.height, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .webp({ quality: 85 })
        .toFile(outputPath);
        
      optimized[sizeName] = {
        filename: outputFilename,
        path: outputPath,
        size: config
      };
    }
    
    // Also create a high-quality original version
    const originalOutputPath = path.join(outputDir, `${baseId}-original.webp`);
    await originalImage
      .webp({ quality: 95 })
      .toFile(originalOutputPath);
      
    optimized.original = {
      filename: `${baseId}-original.webp`,
      path: originalOutputPath,
      width: metadata.width,
      height: metadata.height
    };
    
    return optimized;
  } catch (error) {
    console.error('Image optimization error:', error);
    throw error;
  }
}

// GET /api/media - List all media with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const { category, type, page = 1, limit = 20, search } = req.query;
    
    // Get media library from GitHub
    const { data } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/media-library.json'
    });
    
    const mediaLibrary = JSON.parse(Buffer.from(data.content, 'base64').toString());
    let media = mediaLibrary.images || {};
    
    // Apply filters
    let filteredMedia = Object.entries(media);
    
    if (category) {
      filteredMedia = filteredMedia.filter(([id, item]) => item.category === category);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredMedia = filteredMedia.filter(([id, item]) => 
        item.title?.toLowerCase().includes(searchLower) ||
        item.caption?.toLowerCase().includes(searchLower) ||
        item.credits?.toLowerCase().includes(searchLower) ||
        item.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    // Sort alphabetically by title (fallback to id if no title)
    filteredMedia.sort((a, b) => {
      const titleA = (a[1].title || a[0] || '').toLowerCase();
      const titleB = (b[1].title || b[0] || '').toLowerCase();
      if (titleA < titleB) return -1;
      if (titleA > titleB) return 1;
      return 0;
    });

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedMedia = filteredMedia.slice(startIndex, endIndex);

    res.json({
      success: true,
      media: Object.fromEntries(paginatedMedia),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredMedia.length,
        totalPages: Math.ceil(filteredMedia.length / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch media library'
    });
  }
});

// POST /api/media/upload - Upload and process new media
router.post('/upload', requireAuth, upload.array('images', 10), async (req, res) => {
  try {
    const { category = 'general', tags = '', caption = '', title = '', credits = '' } = req.body;
    const uploadedFiles = req.files;
    
    // Validate required credits field
    if (!credits || credits.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Credits/Attribution is required for all image uploads'
      });
    }
    
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }
    
    const processedMedia = [];
    const optimizedDir = 'uploads/optimized';
    await fs.mkdir(optimizedDir, { recursive: true });
    
    for (const file of uploadedFiles) {
      try {
        // Generate clean base ID for this upload
        const baseId = generateShortId();
        
        // Optimize images
        const optimized = await optimizeImage(file.path, optimizedDir, baseId);
        
        // Generate media ID
        const mediaId = `${category}-${baseId}`;
        
        // Prepare media entry
        const mediaEntry = {
          id: mediaId,
          category,
          title: title || path.parse(file.originalname).name,
          caption: caption,
          credits: credits.trim(),
          tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
          uploadDate: new Date().toISOString(),
          sizes: {},
          fileSize: file.size,
          mimeType: file.mimetype
        };
        
        // Add size information
        for (const [sizeName, sizeInfo] of Object.entries(optimized)) {
          mediaEntry.sizes[sizeName] = {
            filename: sizeInfo.filename,
            url: `/media/${sizeInfo.filename}`, // Will be served from your VPS
            width: sizeInfo.width || sizeInfo.size?.width,
            height: sizeInfo.height || sizeInfo.size?.height
          };
        }
        
        processedMedia.push(mediaEntry);
        
        // Clean up original upload
        await fs.unlink(file.path);
        
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        // Continue with other files
      }
    }
    
    if (processedMedia.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to process any uploaded files'
      });
    }
    
    // Update media library in GitHub
    try {
      // Get current media library
      const { data: currentFile } = await octokit.rest.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: 'public/data/media-library.json'
      });
      
      const mediaLibrary = JSON.parse(Buffer.from(currentFile.content, 'base64').toString());
      
      // Add new media entries
      if (!mediaLibrary.images) {
        mediaLibrary.images = {};
      }
      
      processedMedia.forEach(media => {
        mediaLibrary.images[media.id] = media;
      });
      
      // Update last modified
      mediaLibrary.lastUpdated = new Date().toISOString();
      
      // Commit to GitHub
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: 'public/data/media-library.json',
        message: `Add ${processedMedia.length} new media files via CMS`,
        content: Buffer.from(JSON.stringify(mediaLibrary, null, 2)).toString('base64'),
        sha: currentFile.sha
      });
      
      res.json({
        success: true,
        message: `Successfully uploaded and processed ${processedMedia.length} files`,
        media: processedMedia,
        totalProcessed: processedMedia.length,
        category
      });
      
    } catch (githubError) {
      console.error('GitHub update error:', githubError);
      res.status(500).json({
        success: false,
        error: 'Files processed but failed to update GitHub',
        details: githubError.message
      });
    }
    
  } catch (error) {
    console.error('Media upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Upload failed',
      details: error.message
    });
  }
});

// GET /api/media/categories - Get available categories
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      'characters',
      'locations', 
      'maps',
      'items',
      'creatures',
      'sessions',
      'general'
    ];
    
    res.json({
      success: true,
      categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

// Get single media item
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get media from GitHub
    const response = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/media-library.json'
    });
    
    const mediaLibrary = JSON.parse(Buffer.from(response.data.content, 'base64').toString());
    const media = mediaLibrary.images || {};
    
    const mediaItem = media[id];
    
    if (!mediaItem) {
      return res.status(404).json({
        success: false,
        error: 'Media item not found'
      });
    }
    
    res.json({
      success: true,
      media: mediaItem
    });
  } catch (error) {
    console.error('Error getting media item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get media item'
    });
  }
});

// Update media metadata
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, caption, credits, category, tags } = req.body;
    
    // Validate required fields
    if (!credits || credits.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Credits field is required'
      });
    }
    
    // Get current media data from GitHub
    const response = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/media-library.json'
    });
    
    const mediaLibrary = JSON.parse(Buffer.from(response.data.content, 'base64').toString());
    const media = mediaLibrary.images || {};
    
    if (!media[id]) {
      return res.status(404).json({
        success: false,
        error: 'Media item not found'
      });
    }
    
    // Update metadata
    media[id] = {
      ...media[id],
      title: title || '',
      caption: caption || '',
      credits: credits.trim(),
      category: category || 'general',
      tags: Array.isArray(tags) ? tags : [],
      lastModified: new Date().toISOString()
    };
    
    // Update the media library structure
    mediaLibrary.images = media;
    
    // Update GitHub
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/media-library.json',
      message: `Update metadata for media ${id}`,
      content: Buffer.from(JSON.stringify(mediaLibrary, null, 2)).toString('base64'),
      sha: response.data.sha
    });
    
    res.json({
      success: true,
      message: 'Media metadata updated successfully',
      media: media[id]
    });
  } catch (error) {
    console.error('Error updating media metadata:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update media metadata'
    });
  }
});

// DELETE /api/media/:id - Delete media
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const mediaId = req.params.id;
    
    // Get current media library
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/media-library.json'
    });
    
    const mediaLibrary = JSON.parse(Buffer.from(currentFile.content, 'base64').toString());
    
    if (!mediaLibrary.images || !mediaLibrary.images[mediaId]) {
      return res.status(404).json({
        success: false,
        error: 'Media not found'
      });
    }
    
    const mediaToDelete = mediaLibrary.images[mediaId];
    
    // Delete physical files
    try {
      for (const sizeInfo of Object.values(mediaToDelete.sizes)) {
        const filePath = path.join('uploads/optimized', sizeInfo.filename);
        await fs.unlink(filePath).catch(() => {}); // Ignore if file doesn't exist
      }
    } catch (fileError) {
      console.warn('Some files could not be deleted:', fileError);
    }
    
    // Remove from media library
    delete mediaLibrary.images[mediaId];
    mediaLibrary.lastUpdated = new Date().toISOString();
    
    // Update GitHub
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'public/data/media-library.json',
      message: `Delete media: ${mediaToDelete.originalName}`,
      content: Buffer.from(JSON.stringify(mediaLibrary, null, 2)).toString('base64'),
      sha: currentFile.sha
    });
    
    res.json({
      success: true,
      message: 'Media deleted successfully'
    });
    
  } catch (error) {
    console.error('Media deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete media'
    });
  }
});

module.exports = { router, initGitHub };
