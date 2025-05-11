const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -2
});

const imageWidth = 4096;
const imageHeight = 3072;
const imageBounds = [[0, 0], [imageHeight, imageWidth]];

L.imageOverlay('adenai_map_01.jpg', imageBounds).addTo(map);
map.fitBounds(imageBounds);

map.on('mousemove', function (e) {
  // For CRS.Simple, use layerPoint to get pixel coordinates
  const coords = map.latLngToLayerPoint(e.latlng);
  const x = Math.round(coords.x);
  const y = Math.round(coords.y);
  document.getElementById('coords').textContent = `X: ${x}, Y: ${y}`;
});

// Load GeoJSON file and add to map
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

