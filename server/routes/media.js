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

const MEDIA_LIBRARY_PATH = 'public/data/media-library.json';

// Read-modify-write media-library.json on GitHub. If another commit landed in
// between (409 sha mismatch, e.g. several quick deletes), re-read and retry.
// `mutate` edits the library in place and returns a result, or null to skip the write.
async function updateMediaLibrary(mutate, message, retries = 3) {
  for (let attempt = 0; ; attempt++) {
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: MEDIA_LIBRARY_PATH
    });

    const mediaLibrary = JSON.parse(Buffer.from(currentFile.content, 'base64').toString());
    if (!mediaLibrary.images) {
      mediaLibrary.images = {};
    }

    const result = mutate(mediaLibrary);
    if (result === null) {
      return null;
    }
    mediaLibrary.lastUpdated = new Date().toISOString();

    try {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: MEDIA_LIBRARY_PATH,
        message: typeof message === 'function' ? message(result) : message,
        content: Buffer.from(JSON.stringify(mediaLibrary, null, 2)).toString('base64'),
        sha: currentFile.sha
      });
      return result;
    } catch (error) {
      if (error.status !== 409 || attempt >= retries) {
        throw error;
      }
      console.warn(`media-library.json changed concurrently, retrying (${attempt + 1}/${retries})`);
    }
  }
}

// Tags are written as lib/tags.js says by every route here; the library's older tags are brought in line at start
// (normalizeLibraryTags)
const { normalizeTags } = require('../lib/tags');

async function normalizeLibraryTags() {
  const changed = await updateMediaLibrary((library) => {
    let n = 0;
    for (const m of Object.values(library.images)) {
      if (!Array.isArray(m.tags)) continue;
      const tags = normalizeTags(m.tags);
      if (JSON.stringify(tags) !== JSON.stringify(m.tags)) { m.tags = tags; n += 1; }
    }
    return n || null; // nothing to change: no write
  }, (n) => `Tags in lower case, settled spellings (${n} images)`);
  if (changed) console.log(`media: tags of ${changed} images normalised`);
}

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

// Helper function to optimize images: WebP in four sizes plus a capped "original".
// Each size gets its own sharp pipeline — a reused one keeps its resize, which made every earlier "original" a 1200 px
// copy of "large" at quality 95. rotate() applies the EXIF orientation (phone photos), the rest of EXIF is dropped.
// An image no larger than "large" stores no extra original: sizes.original is the large file.
const ORIGINAL_MAX = 2048;
const WEBP_QUALITY = 82;

async function optimizeImage(inputPath, outputDir, baseId) {
  const optimized = {};
  const write = async (name, maxSide) => {
    const filename = `${baseId}-${name}.webp`;
    const outputPath = path.join(outputDir, filename);
    const info = await sharp(inputPath)
      .rotate()
      .resize(maxSide, maxSide, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(outputPath);
    return { filename, path: outputPath, width: info.width, height: info.height };
  };

  const metadata = await sharp(inputPath).metadata();
  const longSide = Math.max(metadata.width || 0, metadata.height || 0);

  for (const [sizeName, config] of Object.entries(IMAGE_SIZES)) {
    optimized[sizeName] = await write(sizeName, config.width);
  }
  optimized.original = longSide > IMAGE_SIZES.large.width
    ? await write('original', ORIGINAL_MAX)
    : { ...optimized.large };

  return optimized;
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
          tags: normalizeTags(tags),
          uploadDate: new Date().toISOString(),
          sizes: {},
          fileSize: file.size,
          mimeType: file.mimetype
        };
        
        // Add size information
        for (const [sizeName, sizeInfo] of Object.entries(optimized)) {
          const mediaBaseUrl = process.env.MEDIA_BASE_URL || '';
          mediaEntry.sizes[sizeName] = {
            filename: sizeInfo.filename,
            url: `${mediaBaseUrl}/media/${sizeInfo.filename}`, // Full URL for cross-domain access
            width: sizeInfo.width || sizeInfo.size?.width,
            height: sizeInfo.height || sizeInfo.size?.height
          };
        }
        
        processedMedia.push(mediaEntry);
        
        // Clean up original upload
        await fs.unlink(file.path);
        
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        await fs.unlink(file.path).catch(() => {}); // no leftover in temp_media_upload
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
      await updateMediaLibrary(mediaLibrary => {
        processedMedia.forEach(media => {
          mediaLibrary.images[media.id] = media;
        });
        return processedMedia;
      }, `Add ${processedMedia.length} new media files via CMS`);
      
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
    
    const updated = await updateMediaLibrary(mediaLibrary => {
      const media = mediaLibrary.images;
      if (!media[id]) {
        return null;
      }

      media[id] = {
        ...media[id],
        title: title || '',
        caption: caption || '',
        credits: credits.trim(),
        category: category || 'general',
        tags: normalizeTags(tags),
        lastModified: new Date().toISOString()
      };
      return media[id];
    }, `Update metadata for media ${id}`);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Media item not found'
      });
    }

    res.json({
      success: true,
      message: 'Media metadata updated successfully',
      media: updated
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
    
    const mediaToDelete = await updateMediaLibrary(mediaLibrary => {
      const media = mediaLibrary.images[mediaId];
      if (!media) {
        return null;
      }
      delete mediaLibrary.images[mediaId];
      return media;
    }, media => `Delete media: ${media.title || media.caption || media.originalName || mediaId}`);

    if (!mediaToDelete) {
      return res.status(404).json({
        success: false,
        error: 'Media not found'
      });
    }

    // Delete physical files only once the library no longer references them
    for (const sizeInfo of Object.values(mediaToDelete.sizes || {})) {
      const filePath = path.join('uploads/optimized', sizeInfo.filename);
      await fs.unlink(filePath).catch(() => {}); // Ignore if file doesn't exist
    }

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

module.exports = { router, initGitHub, optimizeImage, normalizeTags, normalizeLibraryTags };
