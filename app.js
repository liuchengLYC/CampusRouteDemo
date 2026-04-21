// ================================
// 1. Route data
// ================================
const ROUTES = {
    nthu_demo: {
      name: "台大正門 → 電機系館 → 社科院",
      points: [
        { name: "台大正門", lat: 25.016935262663143, lng: 121.53393017463715 },
        { name: "電機系館", lat: 25.01862, lng: 121.54229 },
        { name: "社科院", lat: 25.0195, lng: 121.5440 }
      ]
    },
    route_2: {
      name: "總圖 → 博理館",
      points: [
        { name: "總圖", lat: 25.0178, lng: 121.5408 },
        { name: "博理館", lat: 25.0187, lng: 121.5430 }
      ]
    }
  };
  
  // ================================
  // 2. Global states
  // ================================
  let map;
  let baseLayer; // 用於清除地圖時保留基礎圖層
  let markers = [];
  let previewLine = null;
  let routeLine = null;
  let currentRouteKey = null;
  let navigationSteps = [];
  let currentStepIndex = 0;
  
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
  // 3. Initialize map
  // ================================
  function initMap() {
    map = L.map("map").setView([25.0173, 121.5397], 16);
  
    baseLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors"
    });
  
    baseLayer.addTo(map);
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
  // 5. Clear map layers
  // ================================
  function clearMarkers() {
    markers.forEach((marker) => map.removeLayer(marker));
    markers = [];
  }
  
  function clearPreviewLine() {
    if (previewLine) {
      map.removeLayer(previewLine);
      previewLine = null;
    }
  }
  
  function clearRouteLine() {
    if (routeLine) {
      map.removeLayer(routeLine);
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
  }
  
  // ================================
  // 6. Load map: display dots and lines
  // ================================
  function loadRoute() {
    const route = ROUTES[currentRouteKey];
    if (!route) return;
  
    // 先清掉上一條已顯示的路線與中繼點
    clearMarkers();
    clearPreviewLine();
    clearRouteLine();
    resetNavigation();
  
    const latlngs = route.points.map((point) => [point.lat, point.lng]);
  
    // 把這次新載入路線的所有中繼點標出來
    route.points.forEach((point, index) => {
      const marker = L.marker([point.lat, point.lng])
        .addTo(map)
        .bindPopup(`${index + 1}. ${point.name}`);
      markers.push(marker);
    });
  
    // 用虛線先預覽各節點連線
    previewLine = L.polyline(latlngs, {
      dashArray: "5, 5",
      color: "blue"
    }).addTo(map);
  
    map.fitBounds(previewLine.getBounds(), { padding: [30, 30] });
  
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
  
      routeLine = L.polyline(decoded).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [30, 30] });
  
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
      routeInfo.textContent = "載入路線失敗，請稍後再試";
    }
  }
  
  // ================================
  // 9. flatten API information into array
  // ================================
  function flattenSteps(legs) {
    const result = [];
  
    legs.forEach((leg, legIndex) => {
      leg.steps.forEach((step, stepIndex) => {
        result.push({
          legIndex: legIndex + 1,
          stepIndex: stepIndex + 1,
          maneuver: step.maneuver?.type || "前進",
          roadName: step.name || "未命名道路",
          distance: Math.round(step.distance),
          instruction: formatInstruction(step, legIndex + 1, stepIndex + 1)
        });
      });
    });
  
    return result;
  }
  
  function formatInstruction(step, legNumber, stepNumber) {
    const maneuver = step.maneuver?.type || "前進";
    const roadName = step.name ? `（${step.name}）` : "";
    const distance = `${Math.round(step.distance)} 公尺`;
    return `第 ${legNumber} 段 - 第 ${stepNumber} 步：${maneuver} ${roadName}，前進 ${distance}`;
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
  }
  
  function goNextStep() {
    if (navigationSteps.length === 0) return;
    if (currentStepIndex >= navigationSteps.length - 1) return;
  
    currentStepIndex += 1;
    renderSteps();
    updateCurrentStepCard();
    updateStepButtons();
  }
  
  function updateStepButtons() {
    const hasSteps = navigationSteps.length > 0;
    prevStepBtn.disabled = !hasSteps || currentStepIndex === 0;
    nextStepBtn.disabled = !hasSteps || currentStepIndex === navigationSteps.length - 1;
  }
  
  // ================================
  // 13. Binding events
  // ================================
  loadRouteBtn.addEventListener("click", loadRoute);
  showRouteBtn.addEventListener("click", showRoute);
  prevStepBtn.addEventListener("click", goPrevStep);
  nextStepBtn.addEventListener("click", goNextStep);
  
  // ================================
  // 14. Activate
  // ================================
  initMap();
  initRouteSelect();
  loadRoute();