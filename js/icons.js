//Map Expansion
const mapextension1 = [
  [1050 - 1024, 3072 - 1024],  // Southwest corner
  [1050 + 1024, 3072 + 1024]   // Northeast corner
];

//2048p Expansion
L.imageOverlay('images/mapextension.PNG', mapextension1, {
  interactive: false
}).addTo(map);

//Ship Icon
const ship1 = [
  [1032 - 30, 1916 - 30],  // Southwest corner
  [1032 + 30, 1916 + 30]   // Northeast corner
];

//Ship Icon
L.imageOverlay('images/vsuzh_ship_mirrored.PNG', ship1, {
  interactive: false
}).addTo(map);

//Ship Icon
const atlantisBubble = [
  [975 - 40, 2210 - 40],  // Southwest corner
  [975 + 40, 2210 + 40]   // Northeast corner
];

//Ship Icon
L.imageOverlay('images/atlantis_bubble.PNG', atlantisBubble, {
  interactive: false
}).addTo(map);

//Ship Icon
const atlantisClouds = [
  [1200 - 40, 2210 - 40],  // Southwest corner
  [1200 + 40, 2210 + 40]   // Northeast corner
];

//Ship Icon
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