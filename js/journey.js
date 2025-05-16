const VsuzH_Journey = L.curve(
  [
    'M', [1041, 1240], //Start in Silbergrat
    'Q', [1062, 1287], [1044, 1338], //Weg nach Toftgard
    'Q', [1054, 1371], [1083, 1392], //Ankunft in Toftgard
    'Q', [1106, 1340], [1094, 1310], //In den Toftgarder Forst
    'Q', [1109, 1276], [1129, 1285], //Weg zu Fitchers Turm
    'Q', [1142, 1295], [1145, 1281], //Ankunft zu Fitchers Turm
    'Q', [1156, 1221], [1171, 1219], //In die Ruine von Zurak'thar
    'Q', [1158, 1274], [1145, 1281], //Zurück zu Fitcher
    'Q', [1129, 1329], [1083, 1392], //Zurück nach Toftgard
    'Q', [1080, 1456], [1084, 1488], //Flussreise Teil 1
    'L', [1061, 1508], //Flussreise Teil 2
    'L', [1053, 1481], //Landung
    'L', [1040, 1472], //Zum Goblin Loch
    'L', [1053, 1481], //Zurück zur Landung
    'L', [1061, 1508], //Zurück auf den Fluss
    'Q', [1000, 1581], [1008, 1700], //Flussreise Teil 2
    'Q', [989, 1693], [985, 1724],
    'Q', [993, 1909], [1039, 1974],
    'Q', [1059, 1988], [1061, 2008],
    'Q', [1041, 1962], [1005, 1977],
    'Q', [975, 1985], [996, 2015],
    'L', [1028, 2069],
    'L', [927, 2069],
    'Q', [723, 2041], [708, 1983],
    'Q', [564, 2014], [488, 1957],
    'Q', [489, 1867], [556, 1869]
  ],
  {
    color: 'orange',
    weight: isMobile ? 6 : 4,
    dashArray: isMobile ? '16,10' : '10,6',
    opacity: 0.7,
  }
).addTo(map);

VsuzH_Journey.bindPopup("VsuzH Reise");
