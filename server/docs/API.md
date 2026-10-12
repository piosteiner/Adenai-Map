# 📡 API Documentation

## Base URL
```
http://your-server:3001/api
```

## Authentication

Most endpoints require authentication via session cookies. Login first:

```bash
curl -X POST http://your-server:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your_password"}' \
  -c cookies.txt

# Use cookies for subsequent requests
curl -H "Content-Type: application/json" \
  -b cookies.txt \
  http://your-server:3001/api/locations
```

## Endpoints

### Authentication
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/login` | Authenticate user | ❌ |
| POST | `/api/logout` | End session | ✅ |
| GET | `/api/status` | Check auth status | ❌ |

### Locations
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/locations` | List all locations | ❌ |
| POST | `/api/locations` | Create location | ✅ |
| PUT | `/api/locations/:id` | Update location | ✅ |
| DELETE | `/api/locations/:id` | Delete location | ✅ |

### Characters  
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/characters` | List all characters with location groups | ❌ |
| GET | `/api/characters/:id` | Get single character | ❌ |
| GET | `/api/characters/location/:locationName` | Get characters at specific location | ❌ |
| POST | `/api/characters` | Create character | ✅ |
| PUT | `/api/characters/:id` | Update character | ✅ |
| DELETE | `/api/characters/:id` | Delete character | ✅ |

### Character Paths
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/character-paths` | List movement data | ✅ |
| POST | `/api/character-paths` | Add movement | ✅ |
| PUT | `/api/character-paths/:id` | Update movement | ✅ |
| DELETE | `/api/character-paths/:id` | Delete movement | ✅ |

### Journey Management
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/journey` | List journey entries | ✅ |
| POST | `/api/journey` | Create journey entry | ✅ |
| PUT | `/api/journey/:id` | Update journey entry | ✅ |
| DELETE | `/api/journey/:id` | Delete journey entry | ✅ |

### Changelog
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/changelog` | View change history | ✅ |
| POST | `/api/changelog` | Add changelog entry | ✅ |

### Configuration
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/config/locationTypes` | Get location types | ❌ |
| GET | `/api/config/regions` | Get regions | ❌ |
| POST | `/api/config` | Update config | ✅ |

### System
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/test` | Test GitHub connection | ❌ |
| GET | `/health` | Health check | ❌ |

## Data Formats

### Location Object
```json
{
  "id": "loc_001",
  "name": "Dragon's Peak",
  "type": "landmark", 
  "region": "northern-mountains",
  "coordinates": [42.123, -71.456],
  "description": "Ancient dragon lair",
  "notes": "Party visited on session 5",
  "created": "2024-01-15T10:30:00Z",
  "updated": "2024-01-20T14:22:00Z"
}
```

### Character Object  
```json
{
  "id": "char_001",
  "name": "Thorin Ironbeard",
  "status": "alive",
  "relationship": "ally", 
  "race": "Dwarf",
  "class": "Fighter",
  "location": "loc_001",
  "description": "Veteran warrior",
  "notes": "Helped party in Dragon's Peak",
  "created": "2024-01-15T10:30:00Z",
  "updated": "2024-01-20T14:22:00Z"
}
```

### Movement Object
```json
{
  "id": "move_001", 
  "characterId": "char_001",
  "fromLocation": "loc_001",
  "toLocation": "loc_002",
  "movementType": "travel",
  "date": "2024-01-20",
  "notes": "Escorting merchant caravan",
  "sessionNumber": 6
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Authentication required",
  "code": 401
}
```

### 404 Not Found
```json
{
  "success": false, 
  "error": "Resource not found",
  "code": 404
}
```

### 500 Server Error  
```json
{
  "success": false,
  "error": "Internal server error", 
  "details": "GitHub API connection failed",
  "code": 500
}
```

## Rate Limits

- **GitHub API**: 5000 requests/hour per token
- **File uploads**: 5MB max size per file
- **Session timeout**: 24 hours

## Examples

### Create a new location
```bash
curl -X POST http://localhost:3001/api/locations \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Mystic Forest",
    "type": "forest", 
    "region": "eastern-woods",
    "coordinates": [41.234, -70.567],
    "description": "Enchanted woodland"
  }'
```

### Update character status
```bash
curl -X PUT http://localhost:3001/api/characters/char_001 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "status": "dead",
    "notes": "Fell in battle against the dragon"
  }'
```

### Add character movement
```bash
curl -X POST http://localhost:3001/api/character-paths \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "characterId": "char_001",
    "fromLocation": "loc_001", 
    "toLocation": "loc_002",
    "movementType": "mission",
    "date": "2024-01-25",
    "sessionNumber": 7
  }'
```

## New Location-Based Character Features

### Enhanced Characters Response

The `/api/characters` endpoint now includes location-based character groupings:

```json
{
  "version": "1.0",
  "characters": [
    {
      "id": "char_001",
      "name": "Thorin Ironbeard",
      "computedCurrentLocation": "Silbergrat",
      "computedPosition": [1041, 1240],
      "computedMovementCount": 3,
      "computedLastMovementDate": "2024-01-20",
      // ... other character fields
    }
  ],
  "locationGroups": {
    "Silbergrat": [
      {
        "id": "char_001",
        "name": "Thorin Ironbeard",
        "status": "alive",
        "relationship": "ally",
        "image": "/uploads/thorin.jpg",
        "title": "Dwarf Warrior",
        "computedPosition": [1041, 1240],
        "lastMovementDate": "2024-01-20",
        "movementCount": 3
      }
    ],
    "Toftgard": [
      {
        "id": "char_002",
        "name": "Elara Moonwhisper",
        // ... character summary
      }
    ]
  }
}
```

### Characters by Location

Get characters at a specific location:

```bash
curl http://localhost:3001/api/characters/location/Silbergrat
```

Response:
```json
{
  "success": true,
  "location": "Silbergrat",
  "characters": [
    {
      "id": "char_001",
      "name": "Thorin Ironbeard",
      "status": "alive",
      "relationship": "ally",
      "image": "/uploads/thorin.jpg",
      "title": "Dwarf Warrior",
      "computedPosition": [1041, 1240],
      "lastMovementDate": "2024-01-20",
      "movementCount": 3,
      "description": "Veteran warrior",
      "faction": "Ironforge Clan"
    }
  ],
  "totalCharacters": 1
}
```
