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
import { getCurrentUserLatLng } from "./location.js";

let currentRouteKey = null;
const ROUTE_START_ACCESS_DISTANCE = 50;

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

  const routingPoints = getRoutingPointsWithOptionalAccess(route);

  drawRoutePreview(routingPoints);
  renderLoadedRouteInfo(route);

  if (routingPoints.hasAccessSegment) {
    dom.routeInfo.innerHTML += `
      <div><strong>起點導航：</strong>你目前離路線起點超過 ${ROUTE_START_ACCESS_DISTANCE} 公尺，已加入前往路線起點的導引線段。</div>
    `;
  }

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

    const routingPoints = getRoutingPointsWithOptionalAccess(route);
    const routeData = await fetchWalkingRoute(routingPoints);
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

function getRoutingPointsWithOptionalAccess(route) {
  const userLatLng = getCurrentUserLatLng();
  const routeStart = route.points[0];
  const points = [...route.points];

  points.hasAccessSegment = false;

  if (!userLatLng || !routeStart) {
    return points;
  }

  const distanceToStart = getDistanceMeters(
    userLatLng,
    [routeStart.lat, routeStart.lng]
  );

  if (distanceToStart <= ROUTE_START_ACCESS_DISTANCE) {
    return points;
  }

  const userStartPoint = {
    name: "你目前的位置",
    lat: userLatLng[0],
    lng: userLatLng[1]
  };

  const pointsWithAccess = [userStartPoint, ...route.points];
  pointsWithAccess.hasAccessSegment = true;

  return pointsWithAccess;
}

function getDistanceMeters(pointA, pointB) {
  const earthRadiusMeters = 6371000;

  const lat1 = toRadians(pointA[0]);
  const lat2 = toRadians(pointB[0]);
  const deltaLat = toRadians(pointB[0] - pointA[0]);
  const deltaLng = toRadians(pointB[1] - pointA[1]);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
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
