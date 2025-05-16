//Ship Icon 1/2
const shipBounds = [
  [1032 - 30, 1916 - 30],  // Southwest corner
  [1032 + 30, 1916 + 30]   // Northeast corner
];

//Ship Icon 2/2
L.imageOverlay('images/vsuzh_ship_draft_mirrored.png', shipBounds, {
  interactive: false
}).addTo(map);