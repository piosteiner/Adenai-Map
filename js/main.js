window.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.createElement("button");
  toggleBtn.id = "themeToggle";
  toggleBtn.textContent = "🌙";
  toggleBtn.title = "Toggle Dark Mode";
  toggleBtn.style.position = "absolute";
  toggleBtn.style.top = "10px";
  toggleBtn.style.right = "10px";
  toggleBtn.style.zIndex = "1001";
  toggleBtn.style.padding = "6px 10px";
  toggleBtn.style.border = "none";
  toggleBtn.style.borderRadius = "4px";
  toggleBtn.style.cursor = "pointer";

  document.body.appendChild(toggleBtn);

  const userPref = localStorage.getItem("theme");
  const systemPref = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (userPref) {
    document.documentElement.setAttribute("data-theme", userPref);
  } else {
    document.documentElement.setAttribute("data-theme", systemPref ? "dark" : "light");
  }

  toggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const newTheme = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  });
});

//Defining image dimensions
const imageWidth = 2048;
const imageHeight = 1536;

//Flip Y axis: move origin to bottom-left (Originally 0,0 was on top left)
const mapCRS = L.extend({}, L.CRS.Simple, {
  transformation: new L.Transformation(1, 0, -1, imageHeight)
});

//Initialize the map using that CRS
const map = L.map('map', {
  crs: mapCRS,
  minZoom: -1,
  maxZoom: 3,
  zoomSnap: 0.1,    // Allow smoother fractional zoom levels
  zoomDelta: 1,  // Smaller steps when using +/- buttons or keyboard
  wheelPxPerZoomLevel: 120, // Optional: slower scroll-based zoom
  zoomControl: false // Disable default top-left zoom control
});

//Adds the zoom buttons in the bottom right.
L.control.zoom({
  position: 'bottomright' // Change to 'topright', 'bottomleft', etc. if you prefer
}).addTo(map);

//Overlay the image and fit bounds
const imageBounds = [[0, 0], [imageHeight, imageWidth]];
L.imageOverlay('adenai_map_01.jpg', imageBounds).addTo(map);
map.fitBounds(imageBounds);

//Show coordinates on mouse move (corrected for centered CRS)
map.on('mousemove', function (e) {
  const x = Math.round(e.latlng.lng); // X = lng
  const y = Math.round(e.latlng.lat); // Y = lat
  document.getElementById('coords').textContent = `X: ${x}, Y: ${y}`;
});

//Mobile settings
const isMobile = window.innerWidth < 768;

//Define places icon
const DotOrange = L.icon({
  iconUrl: 'icons/dot_orange.svg',
  iconSize: isMobile ? [48, 48] : [32, 32],
  iconAnchor: isMobile ? [24, 24] : [16, 16],
  popupAnchor: [0, -32]
});

// Character data storage
let characterData = [];
let characterLayers = [];

// Enhanced icons for different types
const CharacterIcon = L.icon({
  iconUrl: 'icons/character.svg',
  iconSize: isMobile ? [40, 40] : [28, 28],
  iconAnchor: isMobile ? [20, 20] : [14, 14],
  popupAnchor: [0, -20]
});

// Relationship-based character icons
const RelationshipIcons = {
  ally: L.icon({
    iconUrl: 'icons/character_ally.svg',
    iconSize: isMobile ? [40, 40] : [28, 28],
    iconAnchor: isMobile ? [20, 20] : [14, 14],
    popupAnchor: [0, -20],
    className: 'character-marker'
  }),
  friendly: L.icon({
    iconUrl: 'icons/character_ally.svg',
    iconSize: isMobile ? [40, 40] : [28, 28],
    iconAnchor: isMobile ? [20, 20] : [14, 14],
    popupAnchor: [0, -20],
    className: 'character-marker'
  }),
  enemy: L.icon({
    iconUrl: 'icons/character_enemy.svg',
    iconSize: isMobile ? [40, 40] : [28, 28],
    iconAnchor: isMobile ? [20, 20] : [14, 14],
    popupAnchor: [0, -20],
    className: 'character-marker'
  }),
  hostile: L.icon({
    iconUrl: 'icons/character_enemy.svg',
    iconSize: isMobile ? [40, 40] : [28, 28],
    iconAnchor: isMobile ? [20, 20] : [14, 14],
    popupAnchor: [0, -20],
    className: 'character-marker'
  }),
  neutral: L.icon({
    iconUrl: 'icons/character_neutral.svg',
    iconSize: isMobile ? [40, 40] : [28, 28],
    iconAnchor: isMobile ? [20, 20] : [14, 14],
    popupAnchor: [0, -20],
    className: 'character-marker'
  }),
  suspicious: L.icon({
    iconUrl: 'icons/character_neutral.svg',
    iconSize: isMobile ? [40, 40] : [28, 28],
    iconAnchor: isMobile ? [20, 20] : [14, 14],
    popupAnchor: [0, -20],
    className: 'character-marker'
  })
};

function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}

//Store markers for search
let geoFeatureLayers = [];
let searchIndex = [];

// Load character data
async function loadCharacters() {
  try {
    const response = await fetch('data/characters.json');
    const data = await response.json();
    characterData = data.characters || [];
    
    console.log(`✅ Loaded ${characterData.length} characters`);
    addCharactersToMap();
    updateSearchIndexWithCharacters();
    
    // Initialize character panel after data is loaded
    if (typeof initCharacterPanel === 'function') {
      initCharacterPanel();
    }
  } catch (error) {
    console.error('❌ Error loading characters:', error);
  }
}

// Simplified character mapping - no more location matching needed!
function addCharactersToMap() {
  characterData.forEach(character => {
    // Skip characters without coordinates
    if (!character.coordinates) {
      console.warn(`Character ${character.name} has no coordinates`);
      return;
    }
    
    // Use stored coordinates directly
    const [lng, lat] = character.coordinates;
    
    // Add small random offset so multiple characters at same location don't overlap
    const offsetLat = lat + (Math.random() - 0.5) * 20;
    const offsetLng = lng + (Math.random() - 0.5) * 20;
    
    // Choose icon based on relationship
    const icon = RelationshipIcons[character.relationship] || CharacterIcon;
    
    // Create character marker
    const marker = L.marker([offsetLat, offsetLng], { icon })
      .bindPopup(createCharacterPopup(character))
      .addTo(map);
    
    characterLayers.push({ marker, character });
  });
}

// Create character popup content
function createCharacterPopup(character) {
  const statusEmoji = {
    alive: '😊',
    dead: '💀',
    missing: '❓',
    unknown: '🤷'
  };
  
  const relationshipColor = {
    ally: '#4CAF50',
    friendly: '#8BC34A',
    neutral: '#FFC107',
    suspicious: '#FF9800',
    hostile: '#FF5722',
    enemy: '#F44336'
  };
  
  const imageHtml = character.image ? 
    `<img src="${character.image}" alt="${character.name}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; float: right; margin-left: 10px;">` : '';
  
  return `
    <div class="character-popup">
      ${imageHtml}
      <div class="popup-title" style="color: ${relationshipColor[character.relationship] || '#333'}">
        ${character.name}
      </div>
      ${character.title ? `<div style="font-style: italic; margin-bottom: 8px;">${character.title}</div>` : ''}
      <div style="margin-bottom: 8px;">
        <span style="background: ${relationshipColor[character.relationship] || '#ccc'}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8em;">
          ${character.relationship || 'unknown'}
        </span>
        <span style="margin-left: 8px;">
          ${statusEmoji[character.status] || '❓'} ${character.status || 'unknown'}
        </span>
      </div>
      ${character.faction ? `<div><strong>🏛️ Faction:</strong> ${character.faction}</div>` : ''}
      ${character.firstMet ? `<div><strong>📅 First Met:</strong> ${character.firstMet}</div>` : ''}
      ${character.description ? `<div style="margin-top: 8px;"><strong>📝 Description:</strong><br>${character.description}</div>` : ''}
      ${character.notes ? `<div style="margin-top: 8px;"><strong>📋 Notes:</strong><br>${character.notes}</div>` : ''}
    </div>
  `;
}

// Enhanced search that includes characters
function updateSearchIndexWithCharacters() {
  characterData.forEach(character => {
    if (character.coordinates) {
      const [lng, lat] = character.coordinates;
      
      searchIndex.push({
        name: character.name,
        desc: `${character.title || ''} ${character.description || ''} ${character.notes || ''}`.trim(),
        latlng: { lat, lng },
        type: 'character',
        character: character
      });
    }
  });
}

// Enhanced search results rendering
function renderSearchResult(result) {
  if (result.type === 'character') {
    const character = result.character;
    const statusEmoji = {
      alive: '😊', dead: '💀', missing: '❓', unknown: '🤷'
    };
    
    return `
      <div class="dropdown-item character-result">
        ${character.image ? `<img src="${character.image}" alt="${character.name}" />` : '<div class="character-placeholder">👤</div>'}
        <div class="dropdown-text">
          <strong>${character.name}</strong>
          ${character.title ? `<em> - ${character.title}</em>` : ''}
          <br>
          <span>${statusEmoji[character.status] || '❓'} ${character.relationship || 'Unknown'} • ${character.location || 'Unknown location'}</span>
        </div>
      </div>
    `;
  } else {
    // Original location result
    const filename = sanitizeFilename(result.name);
    return `
      <div class="dropdown-item location-result">
        <img src="images/${filename}.jpg" alt="${result.name}" onerror="this.style.display='none'" />
        <div class="dropdown-text">
          <strong>📍 ${result.name}</strong><br>
          <span>${result.desc.replace(/(<([^>]+)>)/gi, '').substring(0, 100)}...</span>
        </div>
      </div>
    `;
  }
}

// Character filter controls
function addCharacterControls() {
  const controlsHtml = `
    <div id="character-controls" style="position: absolute; top: 80px; left: 10px; z-index: 1000; background: var(--popup-bg); padding: 10px; border-radius: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
      <div style="margin-bottom: 8px; font-weight: bold;">👥 Characters</div>
      <label><input type="checkbox" id="show-characters" checked> Show Characters</label><br>
      <label><input type="checkbox" id="show-allies" checked> Allies</label><br>
      <label><input type="checkbox" id="show-enemies" checked> Enemies</label><br>
      <label><input type="checkbox" id="show-neutral" checked> Neutral</label>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', controlsHtml);
  
  // Add event listeners for filters
  document.getElementById('show-characters').addEventListener('change', toggleCharacters);
  document.getElementById('show-allies').addEventListener('change', () => filterCharacters(['ally', 'friendly']));
  document.getElementById('show-enemies').addEventListener('change', () => filterCharacters(['enemy', 'hostile']));
  document.getElementById('show-neutral').addEventListener('change', () => filterCharacters(['neutral', 'suspicious']));
}

function toggleCharacters() {
  const show = document.getElementById('show-characters').checked;
  characterLayers.forEach(({ marker }) => {
    if (show) {
      map.addLayer(marker);
    } else {
      map.removeLayer(marker);
    }
  });
}

function filterCharacters(relationships) {
  const checkbox = event.target;
  const show = checkbox.checked;
  
  characterLayers.forEach(({ marker, character }) => {
    if (relationships.includes(character.relationship)) {
      if (show) {
        map.addLayer(marker);
      } else {
        map.removeLayer(marker);
      }
    }
  });
}

//Load GeoJSON and bind markers + search
fetch('data/places.geojson')
  .then(response => response.json())
  .then(data => {
    const geoLayer = L.geoJSON(data, {
      pointToLayer: function (feature, latlng) {
        return L.marker(latlng, { icon: DotOrange });
      },
      onEachFeature: function (feature, layer) {
        const name = feature.properties.name || '';
        const desc = feature.properties.description || '';
        const url = feature.properties.contentUrl;
        const latlng = layer.getLatLng();

        if (url) {
          fetch(url)
            .then(response => {
              if (!response.ok) throw new Error('Fetch failed'); // Ensure fallback on 404 etc.
              return response.text();
            })
            .then(html => {
              // If HTML loaded successfully, show it in popup
              layer.bindPopup(
                `<div class="popup-title">${name}</div><div class="popup-desc">${html}</div>`
              );

              // Add to search index with stripped text
              searchIndex.push({
                name,
                desc: html.replace(/(<([^>]+)>)/gi, ''), // Remove HTML tags for search
                latlng,
                type: 'location'
              });
            })
            .catch(err => {
              // Fallback to local description if external content fails
              layer.bindPopup(
                `<div class="popup-title">${name}</div><div class="popup-desc">${desc}</div>`
              );

              searchIndex.push({
                name,
                desc,
                latlng,
                type: 'location'
              });
            });
        } else {
          // No contentUrl: use local description
          layer.bindPopup(
            `<div class="popup-title">${name}</div><div class="popup-desc">${desc}</div>`
          );

          searchIndex.push({
            name,
            desc,
            latlng,
            type: 'location'
          });
        }

        geoFeatureLayers.push({ layer, feature });
      }
    }).addTo(map);

    initSearch(); // Init search once all markers are set up
    
    // Load characters after locations are loaded
    setTimeout(() => {
      loadCharacters();
      addCharacterControls();
    }, 500);
  })
  .catch(error => console.error('Error loading GeoJSON:', error));

function initSearch() {
  const searchInput = document.getElementById("searchBox");
  const dropdown = document.getElementById("resultsDropdown");

  let selectedIndex = -1;

  searchInput.addEventListener("input", function () {
    const query = this.value.toLowerCase();
    dropdown.innerHTML = '';
    selectedIndex = -1;

    if (query === '') {
      dropdown.style.display = 'none';
      return;
    }

    const results = searchIndex.filter(m =>
      m.name.toLowerCase().includes(query) || m.desc.toLowerCase().includes(query)
    );

    if (results.length > 0) {
      results.forEach((result, index) => {
        const item = document.createElement("div");
        item.innerHTML = renderSearchResult(result);
        
        item.addEventListener("click", () => {
          if (result.type === 'character') {
            // For characters, find their marker and open popup
            const characterLayer = characterLayers.find(cl => 
              cl.character.name === result.character.name
            );
            if (characterLayer) {
              map.setView(characterLayer.marker.getLatLng(), Math.max(map.getZoom(), 1));
              characterLayer.marker.openPopup();
            }
          } else {
            // Original location behavior
            const markerMatch = geoFeatureLayers.find(g => 
              g.feature.properties.name === result.name
            );
            if (markerMatch) {
              map.setView(markerMatch.layer.getLatLng(), Math.max(map.getZoom(), 1));
              markerMatch.layer.openPopup();
            }
          }
          dropdown.style.display = 'none';
          searchInput.blur();
        });
        
        dropdown.appendChild(item);
      });
      dropdown.style.display = 'block';
    } else {
      const noResult = document.createElement("div");
      noResult.className = "dropdown-item";
      noResult.style.opacity = "0.6";
      noResult.style.fontStyle = "italic";
      noResult.textContent = "Keine Übereinstimmungen gefunden";
      dropdown.appendChild(noResult);
      dropdown.style.display = 'block';
    }
  });

  searchInput.addEventListener("keydown", function (e) {
    const items = dropdown.querySelectorAll(".dropdown-item:not(.no-match)");
    if (items.length === 0) return;

    if (e.key === "ArrowDown") {
      selectedIndex = (selectedIndex + 1) % items.length;
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      e.preventDefault();
    } else if (e.key === "Enter" && items[selectedIndex]) {
      items[selectedIndex].click();
      return;
    } else if (e.key === "Escape") {
      dropdown.style.display = 'none';
      selectedIndex = -1;
      return;
    }

    items.forEach((item, i) => {
      item.classList.toggle("active", i === selectedIndex);
      if (i === selectedIndex) {
        item.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  });

    // Hide dropdown when clicking outside the search container
  document.addEventListener("click", function (e) {
    const searchContainer = document.getElementById("search-container");
    if (!searchContainer.contains(e.target)) {
      dropdown.style.display = "none";
    }
  });

  // Re-open dropdown on focus if there's still a query
  searchInput.addEventListener("focus", function () {
    if (this.value.trim() !== '' && dropdown.children.length > 0) {
      dropdown.style.display = "block";
    }
  });
}

// Character panel functionality
function initCharacterPanel() {
  const panel = document.getElementById('character-panel');
  const toggleBtn = document.getElementById('toggle-panel');
  const grid = document.getElementById('character-grid');
  
  if (!panel || !toggleBtn || !grid) {
    console.warn('Character panel elements not found');
    return;
  }
  
  let isPanelOpen = false;
  
  toggleBtn.addEventListener('click', () => {
    isPanelOpen = !isPanelOpen;
    panel.classList.toggle('open', isPanelOpen);
    toggleBtn.textContent = isPanelOpen ? '✖️' : '📖';
  });
  
  // Populate character grid
  function populateCharacterGrid(characters = characterData) {
    grid.innerHTML = '';
    
    characters.forEach(character => {
      const card = document.createElement('div');
      card.className = 'character-card';
      card.innerHTML = `
        ${character.image ? `<img src="${character.image}" alt="${character.name}">` : ''}
        <div class="character-info">
          <h4>${character.name}</h4>
          ${character.title ? `<div class="title">${character.title}</div>` : ''}
          <div class="location">📍 ${character.location || 'Unknown'}</div>
          <div class="status-badge status-${character.status}">${character.status || 'unknown'}</div>
        </div>
      `;
      
      card.addEventListener('click', () => {
        // Find and focus character on map
        const characterLayer = characterLayers.find(cl => 
          cl.character.name === character.name
        );
        if (characterLayer) {
          map.setView(characterLayer.marker.getLatLng(), Math.max(map.getZoom(), 1));
          characterLayer.marker.openPopup();
          // Close panel on mobile
          if (window.innerWidth <= 768) {
            panel.classList.remove('open');
            toggleBtn.textContent = '📖';
            isPanelOpen = false;
          }
        }
      });
      
      grid.appendChild(card);
    });
  }
  
  // Filter functionality
  document.getElementById('relationship-filter')?.addEventListener('change', filterCharactersInPanel);
  document.getElementById('status-filter')?.addEventListener('change', filterCharactersInPanel);
  
  function filterCharactersInPanel() {
    const relationshipFilter = document.getElementById('relationship-filter')?.value || '';
    const statusFilter = document.getElementById('status-filter')?.value || '';
    
    let filtered = characterData;
    
    if (relationshipFilter) {
      filtered = filtered.filter(char => char.relationship === relationshipFilter);
    }
    
    if (statusFilter) {
      filtered = filtered.filter(char => char.status === statusFilter);
    }
    
    populateCharacterGrid(filtered);
  }
  
  // Initial population
  populateCharacterGrid();
}

window.addEventListener('load', initSearch);

map.dragging._draggable._container = map.getContainer();

// Allow dragging through popups and modals on mobile
map.getContainer().addEventListener('touchstart', function (e) {
  if (e.target.closest('.leaflet-popup-content') || e.target.closest('.gallery-modal')) {
    map.dragging.enable(); // re-enable dragging
  }
}, { passive: true });

// Optional: fix for desktop too
map.getContainer().addEventListener('mousedown', function (e) {
  if (e.target.closest('.leaflet-popup-content') || e.target.closest('.gallery-modal')) {
    map.dragging.enable();
  }
});

// Allow map dragging on popups and modals (mobile and desktop)
const dragZones = ['.leaflet-popup-content', '.gallery-modal'];

dragZones.forEach(selector => {
  document.addEventListener('touchstart', e => {
    if (e.target.closest(selector)) {
      map.dragging.enable();  // Re-enable drag even if it started on popup
    }
  }, { passive: true });

  document.addEventListener('mousedown', e => {
    if (e.target.closest(selector)) {
      map.dragging.enable();
    }
  });
});
