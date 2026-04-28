// ================================
// Route loading and OSRM requests
// ================================
// Connect the selected route data with map rendering, OSRM route fetching, and
// navigation state updates.

import { ROUTES } from "./data.js";
import {
  clearMarkers,
  clearPreviewLine,
  clearRouteLine,
  drawActualRoute,
  drawRoutePreview,
  hasLoadedRoute
} from "./map.js";
import {
  decodePolyline,
  resetNavigation,
  setNavigationSteps,
  updateNavigationView
} from "./navigation.js";
import { getDom, renderLoadedRouteInfo, renderRouteSummary } from "./ui.js";

let currentRouteKey = null;

export function initRouteSelect() {
  const dom = getDom();
  const keys = Object.keys(ROUTES);

  dom.routeSelect.innerHTML = "";

  keys.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = ROUTES[key].name;
    dom.routeSelect.appendChild(option);
  });

  if (keys.length > 0) {
    currentRouteKey = keys[0];
    dom.routeSelect.value = currentRouteKey;
  }

  dom.showRouteBtn.disabled = true;
  dom.routeInfo.textContent = "請先選擇路線並按「載入路線」。";

  dom.routeSelect.addEventListener("change", () => {
    currentRouteKey = dom.routeSelect.value;
    clearMarkers();
    clearPreviewLine();
    clearRouteLine();
    resetNavigation();
    dom.showRouteBtn.disabled = true;
    dom.routeInfo.textContent = "路線已變更，請先按「載入路線」。";
  });
}

export function loadRoute() {
  const dom = getDom();
  const route = ROUTES[currentRouteKey];
  if (!route) return;

  clearMarkers();
  clearPreviewLine();
  clearRouteLine();
  resetNavigation();

  drawRoutePreview(route.points);
  renderLoadedRouteInfo(route);
  dom.showRouteBtn.disabled = false;
}

export async function showRoute() {
  const dom = getDom();

  if (!hasLoadedRoute()) {
    dom.routeInfo.textContent = "請先按「載入路線」，再按「顯示路線」。";
    return;
  }

  const route = ROUTES[currentRouteKey];

  if (!route || route.points.length < 2) {
    dom.routeInfo.textContent = "路線至少需要兩個點";
    return;
  }

  clearRouteLine();
  resetNavigation();

  try {
    dom.routeInfo.innerHTML = "正在向 API 載入路線";

    const routeData = await fetchWalkingRoute(route.points);
    const decodedRoute = decodePolyline(routeData.geometry);

    clearPreviewLine();
    drawActualRoute(decodedRoute);

    const navigationSteps = setNavigationSteps(routeData.legs);
    updateNavigationView();
    renderRouteSummary(route, routeData, navigationSteps.length);
  } catch (error) {
    console.error(error);
    dom.routeInfo.textContent = `載入路線失敗：${error.message}`;
  }
}

async function fetchWalkingRoute(points) {
  const coords = points
    .map((point) => `${point.lng},${point.lat}`)
    .join(";");

  const url = `https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=polyline&steps=true`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`OSRM API 回應失敗：${response.status}`);
  }

  const data = await response.json();

  if (!data.routes || data.routes.length === 0) {
    throw new Error("找不到可用路線");
  }

  return data.routes[0];
}
