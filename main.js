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
  });

  var map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -2,
  maxZoom: 2,
  center: [384, 610], // [y, x] — center of the image
  zoom: 0
});

// Use image dimensions for bounds
var bounds = [[0,0], [768,1219]];
L.imageOverlay('images/map.png', bounds).addTo(map);  // Use your actual map image path
map.fitBounds(bounds);

