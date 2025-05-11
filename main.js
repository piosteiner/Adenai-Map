const imageWidth = 2048;
const imageHeight = 1536;

// 🟢 Define the custom CRS first
const mapCRS = L.extend({}, L.CRS.Simple, {
  transformation: new L.Transformation(1, -imageWidth / 2, -1, imageHeight / 2)
});

// 🟢 Then use the CRS to create the map
const map = L.map('map', {
  crs: mapCRS,
  minZoom: -2
});

// Set bounds based on image size
const imageBounds = [[0, 0], [imageHeight, imageWidth]];
L.imageOverlay('adenai_map_01.jpg', imageBounds).addTo(map);
map.fitBounds(imageBounds);

// Show mouse coordinates (centered, correctly flipped)
map.on('mousemove', function (e) {
  const x = Math.round(e.latlng.lng); // X
  const y = Math.round(e.latlng.lat); // Y
  document.getElementById('coords').textContent = `X: ${x}, Y: ${y}`;
});

// Optional test marker at center
L.marker([0, 0]).addTo(map).bindPopup("Center of the map (0, 0)").openPopup();

// Load GeoJSON places
fetch('data/places.geojson')
  .then(response => response.json())
  .then(data => {
    L.geoJSON(data, {
      pointToLayer: function (feature, latlng) {
        return L.marker(latlng);
      },
      onEachFeature: function (feature, layer) {
        if (feature.properties && feature.properties.name) {
          layer.bindPopup(
            `<b>${feature.properties.name}</b><br>${feature.properties.description}`
          );
        }
      }
    }).addTo(map);
  })
  .catch(error => console.error('Error loading GeoJSON:', error));
