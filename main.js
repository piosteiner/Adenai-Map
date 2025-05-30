window.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.createElement("button");
  toggleBtn.id = "themeToggle";
  toggleBtn.textContent = "🌓";
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
                latlng
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
                latlng
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
            latlng
          });
        }

        geoFeatureLayers.push({ layer, feature });
      }
    }).addTo(map);

    initSearch(); // Init search once all markers are set up
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
        const filename = sanitizeFilename(result.name);
        const item = document.createElement("div");
        item.className = "dropdown-item";
        item.innerHTML = `
          <img src="images/${filename}.jpg" alt="${result.name}" onerror="this.style.display='none'" />
          <div class="dropdown-text"><strong>${result.name}</strong><br>
         <span>${result.desc.replace(/(<([^>]+)>)/gi, '').substring(0, 100)}...</span></div>
          `;
        item.addEventListener("click", () => {
          const markerMatch = geoFeatureLayers.find(g => g.feature.properties.name === result.name);
          if (markerMatch) {
            map.setView(markerMatch.layer.getLatLng(), Math.max(map.getZoom(), 1));
            markerMatch.layer.openPopup();
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
