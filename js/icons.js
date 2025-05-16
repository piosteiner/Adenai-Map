//Ship Icon
const shipBounds = [
  [1032 - 30, 1916 - 30],  // Southwest corner
  [1032 + 30, 1916 + 30]   // Northeast corner
];

//Ship Icon
L.imageOverlay('images/vsuzh_ship_draft_mirrored.png', shipBounds, {
  interactive: false
}).addTo(map);


//Atlantis Icon 1 and 2
const atlantisGeneral1 = [
  [975 - 40, 2210 - 40],  // Southwest corner
  [975 + 40, 2210 + 40]   // Northeast corner
];

const atlantisGeneral2 = [
  [1200 - 40, 2210 - 40],  // Southwest corner
  [1200 + 40, 2210 + 40]   // Northeast corner
];

const atlantisImage = 'images/atlantis_general.png';
const atlantisOptions = { interactive: false };

L.imageOverlay(atlantisImage, atlantisGeneral1, atlantisOptions).addTo(map);
L.imageOverlay(atlantisImage, atlantisGeneral2, atlantisOptions).addTo(map);