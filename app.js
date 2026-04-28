// ================================
// 1. Route data
// ================================
const ROUTES = {
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

const CAMPUS_POINTS = [
  { name: "台大正門", lat: 25.01693, lng: 121.53393 },
  { name: "總圖書館", lat: 25.0178, lng: 121.54106 },
  { name: "椰林大道", lat: 25.01734, lng: 121.53755 },
  { name: "電機二館", lat: 25.01862, lng: 121.54229 },
];

// ================================
// 2. Global states
// ================================
let routeMap;
let campusMap;
let baseLayer; // for switching between routeMap and campusMap
let markers = [];
let previewLine = null;
let routeLine = null;
let currentRouteKey = null;
let currentStepMarker = null;
let nextStepMarker = null;
let navigationSteps = [];
let currentStepIndex = 0;
let userMarker = null;
let watchId = null;

const AUTO_STEP_SWITCH_DISTANCE = 18;

// DOM
const routeSelect = document.getElementById("routeSelect");
const loadRouteBtn = document.getElementById("loadRouteBtn");
const showRouteBtn = document.getElementById("showRouteBtn");
const prevStepBtn = document.getElementById("prevStepBtn");
const nextStepBtn = document.getElementById("nextStepBtn");
const routeInfo = document.getElementById("routeInfo");
const currentStepCard = document.getElementById("currentStepCard");
const stepsList = document.getElementById("stepsList");

// ================================
// 3. Initialize maps
// ================================
function initMaps() {
  routeMap = L.map("routeMap").setView([25.0173, 121.5397], 16);
  campusMap = L.map("campusMap").setView([25.0173, 121.5397], 16);

  const tile = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  L.tileLayer(tile).addTo(routeMap);
  L.tileLayer(tile).addTo(campusMap);
}

// ================================
// 4. Initialize route list
// ================================
function initRouteSelect() {
  const keys = Object.keys(ROUTES);

  keys.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = ROUTES[key].name;
    routeSelect.appendChild(option);
  });

  if (keys.length > 0) {
    currentRouteKey = keys[0];
    routeSelect.value = currentRouteKey;
  }

  routeSelect.addEventListener("change", () => {
    currentRouteKey = routeSelect.value;
  });
}

// ================================
// 5. Clear routeMap layers
// ================================
function clearMarkers() {
  markers.forEach((marker) => routeMap.removeLayer(marker));
  markers = [];
}

function clearPreviewLine() {
  if (previewLine) {
    routeMap.removeLayer(previewLine);
    previewLine = null;
  }
}

function clearRouteLine() {
  if (routeLine) {
    routeMap.removeLayer(routeLine);
    routeLine = null;
  }
}

function resetNavigation() {
  navigationSteps = [];
  currentStepIndex = 0;
  stepsList.innerHTML = "";
  currentStepCard.textContent = "目前沒有導航步驟";
  prevStepBtn.disabled = true;
  nextStepBtn.disabled = true;

  if (currentStepMarker) {
    routeMap.removeLayer(currentStepMarker);
    currentStepMarker = null;
  }

  if (nextStepMarker) {
    routeMap.removeLayer(nextStepMarker);
    nextStepMarker = null;
  }
}

// ================================
// 6. Load routeMap: display dots and lines
// ================================
function loadRoute() {
  const route = ROUTES[currentRouteKey];
  if (!route) return;

  // CLear last showed route
  clearMarkers();
  clearPreviewLine();
  clearRouteLine();
  resetNavigation();

  const latlngs = route.points.map((point) => [point.lat, point.lng]);

  // Label all individual points with markers
  route.points.forEach((point, index) => {
    const marker = L.marker([point.lat, point.lng])
      .addTo(routeMap)
      .bindPopup(`${index + 1}. ${point.name}`);
    markers.push(marker);
  });

  // Draw preview line (dashed)
  previewLine = L.polyline(latlngs, {
    dashArray: "5, 5",
    color: "blue"
  }).addTo(routeMap);

  routeMap.fitBounds(previewLine.getBounds(), { padding: [30, 30] });

  routeInfo.innerHTML = `
    <strong>已載入路線：</strong>${route.name}
    <br>
    <strong>路線節點：</strong>
    <ol class="route-point-list">
      ${route.points.map((p) => `<li>${p.name}</li>`).join("")}
    </ol>
    <div>現在可以按「顯示路線」去向 API 取得實際步行路徑。</div>
  `;
}

// ================================
// 7. decode polyline
// ================================
function decodePolyline(str, precision = 5) {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];
  const factor = Math.pow(10, precision);

  while (index < str.length) {
    let result = 0;
    let shift = 0;
    let byte = null;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += deltaLat;

    result = 0;
    shift = 0;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += deltaLng;

    coordinates.push([lat / factor, lng / factor]);
  }

  return coordinates;
}

// ================================
// 8. Show route through API
// ================================
async function showRoute() {
  const route = ROUTES[currentRouteKey];
  if (!route || route.points.length < 2) {
    routeInfo.textContent = "路線至少需要兩個點";
    return;
  }

  clearRouteLine();
  resetNavigation();

  const coords = route.points
    .map((point) => `${point.lng},${point.lat}`)
    .join(";");

  const url = `https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=polyline&steps=true`;

  try {
    routeInfo.innerHTML = "正在向 API 載入路線";

    const response = await fetch(url);
    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      routeInfo.textContent = "找不到可用路線";
      return;
    }

    const routeData = data.routes[0];
    const decoded = decodePolyline(routeData.geometry);

    clearPreviewLine();

    routeLine = L.polyline(decoded).addTo(routeMap);
    routeMap.fitBounds(routeLine.getBounds(), { padding: [30, 30] });

    const totalKm = (routeData.distance / 1000).toFixed(2);
    const totalMin = Math.round(routeData.duration / 60);

    navigationSteps = flattenSteps(routeData.legs);
    currentStepIndex = 0;

    renderSteps();
    updateCurrentStepCard();

    routeInfo.innerHTML = `
      <strong>路線名稱：</strong>${route.name}<br>
      <strong>總距離：</strong>${totalKm} 公里<br>
      <strong>預估時間：</strong>${totalMin} 分鐘<br>
      <strong>總步驟數：</strong>${navigationSteps.length} 步
    `;

    updateStepButtons();
  } catch (error) {
    console.error(error);
    routeInfo.textContent = `載入路線失敗：${error.message}`;
  }
  updateStepMarkers();
}

// ================================
// 9. flatten API information into array
// ================================
function flattenSteps(legs) {
  const result = [];

  legs.forEach((leg, legIndex) => {
    leg.steps.forEach((step, stepIndex) => {
      const startLocation = step.maneuver?.location
        ? [step.maneuver.location[1], step.maneuver.location[0]]
        : null;

      let endLocation = null;

      // Use next step's maneuver location as end location, if available
      if (stepIndex < leg.steps.length - 1) {
        const nextStep = leg.steps[stepIndex + 1];
        if (nextStep.maneuver?.location) {
          endLocation = [
            nextStep.maneuver.location[1],
            nextStep.maneuver.location[0]
          ];
        }
      } else {
        // For the last step, use the last coordinate of the step geometry as end location
        if (leg.steps[stepIndex].geometry) {
          const decodedStep = decodePolyline(step.geometry);
          if (decodedStep.length > 0) {
            endLocation = decodedStep[decodedStep.length - 1];
          }
        }
      }

      result.push({
        legIndex: legIndex + 1,
        stepIndex: stepIndex + 1,
        maneuver: step.maneuver?.type || "continue",
        modifier: step.maneuver?.modifier || "",
        roadName: step.name || "未命名道路",
        distance: Math.round(step.distance),
        instruction: formatInstruction(step, legIndex + 1, stepIndex + 1),
        startLocation,
        endLocation
      });
    });
  });

  return result;
}

function formatInstruction(step, legNumber, stepNumber) {
  const type = step.maneuver?.type || "continue";
  const modifier = step.maneuver?.modifier || "";
  const rawRoadName = (step.name || "").trim();
  const distance = Math.round(step.distance);

  const roadNameText = rawRoadName ? `「${rawRoadName}」` : "";
  const distanceText = distance > 0 ? `，前進 ${distance} 公尺` : "";

  let actionText = "";

  switch (type) {
    case "depart":
      actionText = rawRoadName
        ? `從${roadNameText}出發`
        : "從目前位置出發";
      break;

    case "turn": {
      let turnText = "轉彎";
      if (modifier === "left") turnText = "左轉";
      else if (modifier === "right") turnText = "右轉";
      else if (modifier === "slight left") turnText = "稍微左轉";
      else if (modifier === "slight right") turnText = "稍微右轉";
      else if (modifier === "sharp left") turnText = "大幅左轉";
      else if (modifier === "sharp right") turnText = "大幅右轉";
      else if (modifier === "straight") turnText = "直行";

      actionText = rawRoadName
        ? `${turnText}進入${roadNameText}`
        : turnText;
      break;
    }

    case "new name":
      actionText = rawRoadName
        ? `繼續直行，接著進入${roadNameText}`
        : "繼續直行";
      break;

    case "continue":
      actionText = rawRoadName
        ? `沿著${roadNameText}直行`
        : "繼續直行";
      break;

    case "arrive":
      actionText = rawRoadName
        ? `抵達${roadNameText}`
        : "已抵達目的地";
      return `第 ${legNumber} 段 第 ${stepNumber} 步：${actionText}`;

    default:
      actionText = rawRoadName
        ? `沿著${roadNameText}前進`
        : "繼續前進";
      break;
  }

  return `第 ${legNumber} 段 第 ${stepNumber} 步：${actionText}${distanceText}`;
}

// ================================
// 10. Show all steps
// ================================
function renderSteps() {
  stepsList.innerHTML = "";

  navigationSteps.forEach((step, index) => {
    const li = document.createElement("li");
    li.textContent = step.instruction;

    if (index === currentStepIndex) {
      li.classList.add("active-step");
    }

    stepsList.appendChild(li);
  });
}

// ================================
// 11. Update current step
// ================================
function updateCurrentStepCard() {
  if (navigationSteps.length === 0) {
    currentStepCard.textContent = "目前沒有導航步驟";
    return;
  }

  const step = navigationSteps[currentStepIndex];
  currentStepCard.innerHTML = `
    <strong>目前步驟：</strong><br>
    ${step.instruction}
  `;
}

function updateStepMarkers() {
  if (navigationSteps.length === 0) return;

  if (currentStepMarker) {
    routeMap.removeLayer(currentStepMarker);
    currentStepMarker = null;
  }

  if (nextStepMarker) {
    routeMap.removeLayer(nextStepMarker);
    nextStepMarker = null;
  }

  const step = navigationSteps[currentStepIndex];
  if (!step) return;

  const { startLocation, endLocation } = step;

  if (startLocation) {
    currentStepMarker = L.circleMarker(startLocation, {
      radius: 10,
      color: "blue",
      fillColor: "blue",
      fillOpacity: 0.8
    })
      .addTo(routeMap)
      .bindPopup(`目前位置：第 ${step.legIndex} 段 第 ${step.stepIndex} 步`);
  }

  if (endLocation) {
    nextStepMarker = L.circleMarker(endLocation, {
      radius: 10,
      color: "red",
      fillColor: "red",
      fillOpacity: 0.8
    })
      .addTo(routeMap)
      .bindPopup(`這一步終點：第 ${step.legIndex} 段 第 ${step.stepIndex} 步`);
  }
}

// ================================
// 12. Last/Next step
// ================================
function goPrevStep() {
  if (navigationSteps.length === 0) return;
  if (currentStepIndex <= 0) return;

  currentStepIndex -= 1;
  renderSteps();
  updateCurrentStepCard();
  updateStepButtons();
  updateStepMarkers(); 
}

function goNextStep() {
  if (navigationSteps.length === 0) return;
  if (currentStepIndex >= navigationSteps.length - 1) return;

  currentStepIndex += 1;
  renderSteps();
  updateCurrentStepCard();
  updateStepButtons();
  updateStepMarkers(); 
}

function updateStepButtons() {
  const hasSteps = navigationSteps.length > 0;
  prevStepBtn.disabled = !hasSteps || currentStepIndex === 0;
  nextStepBtn.disabled = !hasSteps || currentStepIndex === navigationSteps.length - 1;
}

// ================================
// 1３. User location tracking
// ================================

// Track user location in real-time
function trackUserLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser");
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // If marker already exists, just update position
      if (userMarker) {
        userMarker.setLatLng([lat, lng]);
      } else {
        // Create marker first time
        userMarker = L.circleMarker([lat, lng], {
          radius: 8,
          color: "green",
          fillColor: "green",
          fillOpacity: 0.9
        })
          .addTo(routeMap)
          .bindPopup("你目前的位置");
      }
    },
    (error) => {
      console.warn("Geolocation failed:", error);
      currentStepCard.innerHTML = `
        <strong>定位未啟用：</strong><br>
        你仍然可以使用手動瀏覽導航步驟。
      `;
    },
    {
      enableHighAccuracy: true, // Try to use GPS
      maximumAge: 1000,
      timeout: 5000
    }
  );
}

// ================================
// 14. Init campus points
// ================================
function initCampusPoints() {
  CAMPUS_POINTS.forEach(p => {
    L.circleMarker([p.lat, p.lng], {
      radius: 8,
      color: "blue",
      fillColor: "blue",
      fillOpacity: 0.8
    }).addTo(campusMap).bindPopup(p.name);

    const li = document.createElement("li");
    li.innerHTML = `<span class="legend-dot"></span>${p.name}`;
    document.getElementById("campusLegend").appendChild(li);
  });
}

// ================================
// 15. Tab switching logic
// ===============================
const routeTabBtn = document.getElementById("routeTabBtn");
const campusTabBtn = document.getElementById("campusTabBtn");

const routePanel = document.getElementById("routePanel");
const campusPanel = document.getElementById("campusPanel");

const routeMapEl = document.getElementById("routeMap");
const campusMapEl = document.getElementById("campusMap");

function switchTab(type) {
  const isRoute = type === "route";

  routePanel.classList.toggle("active", isRoute);
  campusPanel.classList.toggle("active", !isRoute);

  routeMapEl.classList.toggle("active", isRoute);
  campusMapEl.classList.toggle("active", !isRoute);

  routeTabBtn.classList.toggle("active", isRoute);
  campusTabBtn.classList.toggle("active", !isRoute);

  setTimeout(() => {
    if (isRoute) routeMap.invalidateSize();
    else campusMap.invalidateSize();
  }, 0);
}

routeTabBtn.onclick = () => switchTab("route");
campusTabBtn.onclick = () => switchTab("campus");

// ================================
// 16. Binding events
// ================================
loadRouteBtn.addEventListener("click", loadRoute);
showRouteBtn.addEventListener("click", showRoute);
prevStepBtn.addEventListener("click", goPrevStep);
nextStepBtn.addEventListener("click", goNextStep);

// ================================
// 17. Activate
// ================================
initMaps();
initCampusPoints();
initRouteSelect();
loadRoute();
switchTab("route");
trackUserLocation();