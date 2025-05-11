const map = L.map('map', {
  crs: mapCRS,
  minZoom: -2
});

const imageWidth = 4096;
const imageHeight = 3072;
const imageBounds = [[0, 0], [imageHeight, imageWidth]];
const centerX = 4096 / 2; // = 2048
const centerY = 3072 / 2; // = 1536

const mapCRS = L.extend({}, L.CRS.Simple, {
  transformation: new L.Transformation(1, -2048, -1, 1536)
});


L.imageOverlay('adenai_map_01.jpg', imageBounds).addTo(map);
map.fitBounds(imageBounds);

map.on('mousemove', function (e) {
  // For CRS.Simple, use layerPoint to get pixel coordinates
  const coords = map.project(e.latlng, map.getZoom());
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

