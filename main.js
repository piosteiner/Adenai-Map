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
  maxZoom: 3
});

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

const DotOrange = L.icon({
  iconUrl: 'icons/dot_orange.svg',  // Path to your icon file
  iconSize: [32, 32],                 // Size in pixels
  iconAnchor: [16, 16],               // Bottom center of the icon
  popupAnchor: [0, -32]               // Popup appears above the icon
});

const VsuzH_Journey = L.curve( // CAREFUL: First Y followed by X coordinate
  [
    'M', [1041, 1240], // Silbergrat 
    'Q', [1062, 1287], [1044, 1338], // Weg nach Toftgard
    'Q', [1054, 1371], [1083, 1392], // Toftgard
    'Q', [1106, 1340], [1094, 1310], // Toftgarder Wald
    'Q', [1109, 1276], [1129, 1285], // Weg zu Fitcher
    'Q', [1142, 1295], [1145, 1281], // Fitchers Turm
    'Q', [1156, 1221], [1171, 1219], // Nach Zurak'thar
    'Q', [1158, 1274], [1145, 1281], // Zurück zu Fitchers Turm
    'Q', [1129, 1329], [1094, 1310], // Zurück nach Toftgard
    'Q', [1080, 1456], [1084, 1488], // Flussfahrt 1
    'Q', [1000, 1581], [1008, 1700], // Flussfahrt 2 & Ankunft in Valaris
    'Q', [989, 1693], [985, 1724], // Abreise aus Valaris
    'Q', [993, 1909], [1039, 1974], // Reise nach Motu Motu
    'Q', [1059, 1988], [1061, 2008], // Zur Sternenzirkel Insel
    'Q', [1041, 1962], [1005, 1977], // Reise nach Luvatu
    'Q', [966, 2012], [924, 1927], // Reise Nach Atlantis
    'L', [967, 2032], // Aufstieg von Atlantis
    'L', [824, 2037], // Rückkehr aufs Meer
    'Q', [747, 2031], [708, 1983], // Küste von Upeto
    'Q', [584, 2000], [488, 1957], // Reise nach Basapo
    'Q', [489, 1867], [556, 1869] // Reise nach Akonechie
  ],
  {
    color: 'orange',
    weight: 4,
    dashArray: '10,6',
    opacity: 0.9,
  }
).addTo(map);

VsuzH_Journey.bindPopup("VsuzH Reise");

const journeyArrows = L.polylineDecorator(VsuzH_Journey, {
  patterns: [
    {
      offset: '5%',      // Start a little into the line
      repeat: '20%',     // Repeat every 20%
      symbol: L.Symbol.arrowHead({
        pixelSize: 14,
        polygon: true,
        pathOptions: {
          fillOpacity: 1,
          weight: 0,
          color: 'orange'
        }
      })
    }
  ]
}).addTo(map);

//Load GeoJSON places
fetch('data/places.geojson')
  .then(response => response.json())
  .then(data => {
    L.geoJSON(data, {
      pointToLayer: function (feature, latlng) {
        return L.marker(latlng, { icon: DotOrange });
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
