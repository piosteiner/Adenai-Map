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
    'L', [1034, 1569], //Flussreise Teil 3
    'L', [1008, 1608], //Flussreise Teil 4
    'Q', [1010, 1648], [1008, 1700], //Ankunft in Valaris
    'Q', [989, 1693], [985, 1724], // Ausfahrt von Valaris
    'L', [1036, 2074], //Fahrt nach Motu Motu
    'Q', [1059,2082], [1070, 2106], //Fahrt zur Sternenzirkel Insel
    'Q', [1049,2101], [1036, 2074], //Fahrt zurück nach Motu Motu
    'L', [992, 2126], //Fahrt nach Luvatu
    'L', [975, 2210], //Fahrt zum Unterwasserparadies
    'L', [1200, 2210], //Aufstieg von Atlantis
    'Q', [1140, 2340], [888, 2275], //Rückkehr aufs Meer
    'Q', [723, 2041], [708, 1983], //Fahrt an die Küste von Upeto
    'Q', [564, 2014], [488, 1957], //Fahrt nach Basapo
    'Q', [489, 1867], [556, 1869] //Reise nach Ako
  ],
  {
    color: 'orange',
    weight: isMobile ? 6 : 4,
    dashArray: isMobile ? '16,10' : '10,6',
    opacity: 0.7,
  }
).addTo(map);

VsuzH_Journey.bindPopup("VsuzH Reise");
