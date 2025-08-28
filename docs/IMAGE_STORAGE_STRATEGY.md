# Image Storage Strategy for Adenai Map CMS

## Recommended Approach: Git-Based with Optimization

### Why Git-Based Storage is Best for Your Setup:

1. **Simplicity**: Your current GitHub Pages deployment stays the same
2. **Reliability**: Images never break or disappear
3. **Version Control**: Track image changes with your content
4. **Cost**: Free with GitHub (up to reasonable limits)
5. **CDN**: GitHub Pages provides fast global delivery

### Implementation Strategy:

#### 1. Repository Structure
```
public/
  images/
    characters/          # Character portraits
      petrel-kormorant.png
      tasbor.png
      abu-sasion.png
    galleries/           # Gallery collections
      valaris-map/
        overview.png
        districts.png
      basapo-wanted/
        poster1.png
        poster2.png
    events/              # Event illustrations
      kunos-defeat.png
      basapo-visit.png
    icons/               # UI icons (existing)
    maps/                # Map assets (existing)
```

#### 2. CMS Upload Workflow
```
┌─────────────────┐    ┌──────────────┐    ┌─────────────┐
│   User uploads  │───▶│ CMS processes│───▶│ Git commit  │
│   via web form  │    │ & optimizes  │    │ & deploy    │
└─────────────────┘    └──────────────┘    └─────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │ Image saved  │
                       │ to repo path │
                       └──────────────┘
```

#### 3. File Size Management

**Image Optimization Pipeline:**
```javascript
// CMS processing before Git commit
const processImage = async (uploadedFile) => {
  // Resize if too large
  if (uploadedFile.size > 500000) { // 500KB
    resizedImage = await resizeImage(uploadedFile, { maxWidth: 800 });
  }
  
  // Compress
  optimizedImage = await compressImage(resizedImage, { quality: 0.8 });
  
  // Generate filename
  const filename = generateSafeFilename(uploadedFile.name);
  
  return {
    path: `public/images/${category}/${filename}`,
    data: optimizedImage
  };
};
```

#### 4. Git Integration Process

**Automated Git Workflow:**
```bash
# CMS server script after image upload
cd /path/to/adenai-map-repo
git pull origin main
cp /tmp/uploaded-image.png public/images/characters/
git add public/images/characters/uploaded-image.png
git add public/data/media-library.json  # Updated with new entry
git commit -m "Add character image: uploaded-image.png"
git push origin main
# GitHub Actions deploys automatically
```

#### 5. Alternative: Git LFS for Large Files

If you have many large images, consider Git LFS:

```bash
# Setup Git LFS for images
git lfs track "*.png"
git lfs track "*.jpg" 
git lfs track "*.jpeg"
git add .gitattributes
```

**Benefits:**
- Large files stored separately from Git history
- Repository stays fast
- Still version controlled
- GitHub provides 1GB free LFS storage

### Configuration Examples:

#### media-library.json paths:
```json
{
  "characters": {
    "petrel-kormorant": {
      "name": "Petrel Kormorant",
      "image": "public/images/characters/petrel-kormorant.png",
      "status": "alive"
    }
  },
  "galleries": {
    "valaris-map": {
      "title": "Valaris Stadtplan",
      "images": [
        {
          "src": "public/images/galleries/valaris-map/overview.png",
          "alt": "Valaris Overview"
        }
      ]
    }
  }
}
```

#### CMS Upload Form:
```html
<form enctype="multipart/form-data" action="/api/upload-image" method="POST">
  <select name="category">
    <option value="characters">Character Portrait</option>
    <option value="galleries">Gallery Image</option>
    <option value="events">Event Illustration</option>
  </select>
  <input type="file" name="image" accept="image/*" required>
  <input type="text" name="alt" placeholder="Alt text" required>
  <button type="submit">Upload & Commit</button>
</form>
```

### File Size Guidelines:

- **Character Portraits**: 200KB max, 400x400px recommended
- **Gallery Images**: 500KB max, 800px max width
- **Event Illustrations**: 300KB max, 600px max width
- **Total Repository**: Stay under 500MB for best performance

### Backup Strategy:

1. **Primary**: Git repository (GitHub)
2. **Secondary**: CMS server local copy
3. **Archive**: Periodic ZIP exports of images folder

### Monitoring:

```bash
# Check repository size
git count-objects -vH

# List largest files
git rev-list --objects --all | grep "$(git verify-pack -v .git/objects/pack/*.idx | sort -k 3 -nr | head -10 | awk '{print$1}')"
```

## Alternative: CDN + Git References

If you later need more storage:

1. **Store images**: On CDN (Cloudinary, AWS S3, etc.)
2. **Store references**: In Git repository
3. **media-library.json**: Contains CDN URLs

```json
{
  "characters": {
    "petrel-kormorant": {
      "image": "https://cdn.adenai.com/characters/petrel-kormorant.png"
    }
  }
}
```

## Conclusion

**For your D&D campaign**: Stick with Git-based storage because:
- Your content volume is manageable
- Simplicity trumps complexity for a campaign site
- GitHub Pages is reliable and free
- Version control for images is actually valuable for campaign content

The CMS just needs to:
1. Optimize uploaded images
2. Save to correct folder structure
3. Commit to Git repository
4. Update media-library.json references
