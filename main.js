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
        layer.bindPopup(
          `<div class="popup-title">${name}</div><div class="popup-desc">${desc}</div>`
        );
        geoFeatureLayers.push({ layer, feature });
        searchIndex.push({
          name,
          desc,
          latlng: layer.getLatLng()
        });
      }
    }).addTo(map);

    initSearch();
  })
  .catch(error => console.error('Error loading GeoJSON:', error));

// Draw curved journey path
const VsuzH_Journey = L.curve(
  [
    'M', [1041, 1240],
    'Q', [1062, 1287], [1044, 1338],
    'Q', [1054, 1371], [1083, 1392],
    'Q', [1106, 1340], [1094, 1310],
    'Q', [1109, 1276], [1129, 1285],
    'Q', [1142, 1295], [1145, 1281],
    'Q', [1156, 1221], [1171, 1219],
    'Q', [1158, 1274], [1145, 1281],
    'Q', [1129, 1329], [1083, 1392],
    'Q', [1080, 1456], [1084, 1488],
    'Q', [1000, 1581], [1008, 1700],
    'Q', [989, 1693], [985, 1724],
    'Q', [993, 1909], [1039, 1974],
    'Q', [1059, 1988], [1061, 2008],
    'Q', [1041, 1962], [1005, 1977],
    'Q', [975, 1985], [996, 2015],
    'L', [1028, 2069],
    'L', [927, 2069],
    'Q', [723, 2041], [708, 1983],
    'Q', [564, 2014], [488, 1957],
    'Q', [489, 1867], [556, 1869]
  ],
  {
    color: 'orange',
    weight: isMobile ? 6 : 4,
    dashArray: isMobile ? '16,10' : '10,6',
    opacity: 0.7,
  }
).addTo(map);

VsuzH_Journey.bindPopup("VsuzH Reise");

function initSearch() {
  const searchInput = document.getElementById("searchBox");
  const dropdown = document.getElementById("resultsDropdown");

  let selectedIndex = -1;

  searchInput.addEventListener("keyup", function (e) {
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
        item.className = "dropdown-item";
        item.innerHTML = `
          <img src="images/${result.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.jpg" onerror="this.style.display='none'" />
          <div class="dropdown-text"><strong>${result.name}</strong><br><span>${result.desc.replace(/(<([^>]+)>)/gi, '').substring(0, 50)}...</span></div>
        `;
        item.addEventListener("click", () => {
          map.setView(result.latlng, Math.max(map.getZoom(), 1));
          L.popup().setLatLng(result.latlng).setContent(`<b>${result.name}</b><br>${result.desc}`).openOn(map);
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
    const items = dropdown.querySelectorAll(".dropdown-item");
    if (e.key === "ArrowDown") {
      selectedIndex = (selectedIndex + 1) % items.length;
    } else if (e.key === "ArrowUp") {
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
    } else if (e.key === "Enter" && items[selectedIndex]) {
      items[selectedIndex].click();
      return;
    } else if (e.key === "Escape") {
      dropdown.style.display = 'none';
      selectedIndex = -1;
    }

    items.forEach((item, i) => {
      item.classList.toggle("active", i === selectedIndex);
      if (i === selectedIndex) {
        item.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  });
}

window.addEventListener('load', initSearch);
