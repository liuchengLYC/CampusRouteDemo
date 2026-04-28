// ================================
// DOM references and UI helpers
// ================================
// Keep all document lookups and small UI rendering helpers here. Other modules
// receive the DOM object from getDom() instead of reading elements at import time.

let cachedDom = null;

export function getDom() {
  if (cachedDom) return cachedDom;

  cachedDom = {
    routeSelect: document.getElementById("routeSelect"),
    loadRouteBtn: document.getElementById("loadRouteBtn"),
    showRouteBtn: document.getElementById("showRouteBtn"),
    prevStepBtn: document.getElementById("prevStepBtn"),
    nextStepBtn: document.getElementById("nextStepBtn"),
    routeInfo: document.getElementById("routeInfo"),
    currentStepCard: document.getElementById("currentStepCard"),
    stepsList: document.getElementById("stepsList"),
    campusLegend: document.getElementById("campusLegend"),
    routeTabBtn: document.getElementById("routeTabBtn"),
    campusTabBtn: document.getElementById("campusTabBtn"),
    routePanel: document.getElementById("routePanel"),
    campusPanel: document.getElementById("campusPanel"),
    routeMapEl: document.getElementById("routeMap"),
    campusMapEl: document.getElementById("campusMap")
  };

  return cachedDom;
}

export function assertRequiredDom(dom) {
  const missing = Object.entries(dom)
    .filter(([, element]) => !element)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`找不到必要的 HTML 元素：${missing.join(", ")}`);
  }
}

export function switchTab(type, maps) {
  const dom = getDom();
  const isRoute = type === "route";

  dom.routePanel.classList.toggle("active", isRoute);
  dom.campusPanel.classList.toggle("active", !isRoute);
  dom.routeMapEl.classList.toggle("active", isRoute);
  dom.campusMapEl.classList.toggle("active", !isRoute);
  dom.routeTabBtn.classList.toggle("active", isRoute);
  dom.campusTabBtn.classList.toggle("active", !isRoute);

  // Leaflet must recalculate its size after a hidden map becomes visible.
  setTimeout(() => {
    if (isRoute) maps.routeMap.invalidateSize();
    else maps.campusMap.invalidateSize();
  }, 0);
}

export function initTabs(maps) {
  const dom = getDom();

  dom.routeTabBtn.onclick = () => switchTab("route", maps);
  dom.campusTabBtn.onclick = () => switchTab("campus", maps);
}

export function renderLoadedRouteInfo(route) {
  const dom = getDom();

  dom.routeInfo.innerHTML = `
    <strong>已載入路線：</strong>${route.name}
    <br>
    <strong>路線節點：</strong>
    <ol class="route-point-list">
      ${route.points.map((point) => `<li>${point.name}</li>`).join("")}
    </ol>
    <div>現在可以按「顯示路線」去向 API 取得實際步行路徑。</div>
  `;
}

export function renderRouteSummary(route, routeData, stepCount) {
  const dom = getDom();
  const totalKm = (routeData.distance / 1000).toFixed(2);
  const totalMin = Math.round(routeData.duration / 60);

  dom.routeInfo.innerHTML = `
    <strong>路線名稱：</strong>${route.name}<br>
    <strong>總距離：</strong>${totalKm} 公里<br>
    <strong>預估時間：</strong>${totalMin} 分鐘<br>
    <strong>總步驟數：</strong>${stepCount} 步
  `;
}

export function renderStartupError(error) {
  const dom = getDom();
  const message = error?.message || String(error);

  console.error(error);

  if (dom.routeInfo) {
    dom.routeInfo.innerHTML = `
      <strong>初始化失敗：</strong><br>
      ${message}
    `;
  }
}
