//Map Expansion
const mapextension1 = [
  [850 - 450, 2248 - 200],  // Southwest corner
  [850 + 450, 2248 + 200]   // Northeast corner
];

//Map Expansion
L.imageOverlay('images/mapextension_east.PNG', mapextension1, {
  interactive: false
}).addTo(map);

//Goblin Hole
const goblinhole = [
  [1040 - 20, 1472 - 20],  // Southwest corner
  [1040 + 20, 1472 + 20]   // Northeast corner
];

//Goblin Hole
L.imageOverlay('images/goblin_hole.PNG', goblinhole, {
  interactive: false
}).addTo(map);

//Ship to Motu Motu
const ship1 = [
  [1032 - 30, 1916 - 30],  // Southwest corner
  [1032 + 30, 1916 + 30]   // Northeast corner
];

//Ship to Motu Motu
L.imageOverlay('images/vsuzh_ship_mirrored.PNG', ship1, {
  interactive: false
}).addTo(map);

//Ship flying down
const ship2 = [
  [1040 - 40, 2297 - 40],  // Southwest corner
  [1040 + 40, 2297 + 40]   // Northeast corner
];

//Ship flying down
L.imageOverlay('images/vsuzh_ship_fly.PNG', shipfly, {
  interactive: false
}).addTo(map);

//Ship to Upeto
const shipfly = [
  [817 - 30, 2137 - 30],  // Southwest corner
  [817 + 30, 2137 + 30]   // Northeast corner
];

//Ship to Upeto
L.imageOverlay('images/vsuzh_ship.PNG', ship2, {
  interactive: false
}).addTo(map);

//Atlantis Underwater
const atlantisBubble = [
  [975 - 40, 2210 - 40],  // Southwest corner
  [975 + 40, 2210 + 40]   // Northeast corner
];

//Atlantis Underwater
L.imageOverlay('images/atlantis_bubble.PNG', atlantisBubble, {
  interactive: false
}).addTo(map);

//Atlantis Flying
const atlantisClouds = [
  [1200 - 40, 2210 - 40],  // Southwest corner
  [1200 + 40, 2210 + 40]   // Northeast corner
];

//Atlantis Flying
L.imageOverlay('images/atlantis_clouds.PNG', atlantisClouds, {
  interactive: false
}).addTo(map);



//Atlantis Icon 1 and 2
//const atlantisGeneral1 = [
//  [975 - 40, 2210 - 40],  // Southwest corner
//  [975 + 40, 2210 + 40]   // Northeast corner
//];

//const atlantisGeneral2 = [
//  [1200 - 40, 2210 - 40],  // Southwest corner
//  [1200 + 40, 2210 + 40]   // Northeast corner
//];

//const atlantisImage = 'images/atlantis_general.png';
//const atlantisOptions = { interactive: false };

//L.imageOverlay(atlantisImage, atlantisGeneral1, atlantisOptions).addTo(map);
//L.imageOverlay(atlantisImage, atlantisGeneral2, atlantisOptions).addTo(map);