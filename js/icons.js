//Ship Icon 1/2
const shipBounds = [
  [1032 - 30, 1916 - 30],  // Southwest corner
  [1032 + 30, 1916 + 30]   // Northeast corner
];

//Ship Icon 2/2
L.imageOverlay('images/vsuzh_ship_draft_mirrored.png', shipBounds, {
  interactive: false
}).addTo(map);


//Atlantis Icon 1/2
const atlantisGeneral = [
  [975 - 40, 2210 - 40],  // Southwest corner
  [975 + 40, 2210 + 40]   // Northeast corner
];

//Atlantis Icon 2/2
L.imageOverlay('images/atlantis_general.png', atlantisGeneral, {
  interactive: false
}).addTo(map);