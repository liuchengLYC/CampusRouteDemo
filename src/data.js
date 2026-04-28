// ================================
// Route and campus data
// ================================
// Keep static route definitions and campus point data in this file so the map,
// route, and UI modules can focus only on behavior.

export const ROUTES = {
  ntu_demo: {
    name: "文學院 → 機械新館 → 電機二館 → 森林系系館 → 管院一號館",
    points: [
      { name: "文學院", lat: 25.01787, lng: 121.53676 },
      { name: "機械新館", lat: 25.01904, lng: 121.53958 },
      { name: "電機二館", lat: 25.01862, lng: 121.54229 },
      { name: "森林系系館", lat: 25.01693, lng: 121.53947 },
      { name: "管院一號館", lat: 25.01389, lng: 121.53785 }
    ]
  },
  route_2: {
    name: "台大正門 → 電機系館 → 社科圖",
    points: [
      { name: "台大正門", lat: 25.016935262663143, lng: 121.53393017463715 },
      { name: "電機系館", lat: 25.01862, lng: 121.54229 },
      { name: "社科圖", lat: 25.02049, lng: 121.54244 }
    ]
  },
  route_3: {
    name: "總圖 → 博理館",
    points: [
      { name: "總圖", lat: 25.0178, lng: 121.54106 },
      { name: "博理館", lat: 25.01936, lng: 121.54231 }
    ]
  }
};

export const CAMPUS_POINTS = [
  { name: "台大正門", lat: 25.01693, lng: 121.53393 },
  { name: "總圖書館", lat: 25.0178, lng: 121.54106 },
  { name: "椰林大道", lat: 25.01734, lng: 121.53755 },
  { name: "電機二館", lat: 25.01862, lng: 121.54229 }
];
