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
  clearRouteLine();

  if (route.useManualPath) {
    renderLoadedManualRouteInfo(route, routingPoints);
  } else {
    renderLoadedRouteInfo(route);
  }

  if (!route.useManualPath && routingPoints.hasAccessSegment) {
    dom.routeInfo.innerHTML += `
      <div><strong>起點導航：</strong>你目前離路線起點超過 ${ROUTE_START_ACCESS_DISTANCE} 公尺，已加入前往路線起點的導引線段。</div>
    `;
  }

  dom.showRouteBtn.disabled = false;
}

function renderLoadedManualRouteInfo(route, routingPoints) {
  const dom = getDom();
  const hasAccessSegment = routingPoints.hasAccessSegment;
  const routePoints = hasAccessSegment ? routingPoints.slice(1) : routingPoints;

  dom.routeInfo.innerHTML = `
    <strong>已載入路線：</strong>${route.name}
    <br>
    <strong>模式：</strong>手動路線，不使用 OSRM 自動導航
    <br>
    <strong>路線節點：</strong>
    <ol class="route-point-list">
      ${routePoints.map((point) => `<li>${point.name}</li>`).join("")}
    </ol>
    <div>現在可以按「顯示路線」產生手動導航步驟。</div>
  `;
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

  if (route.useManualPath) {
    showManualRoute(route);
    return;
  }

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

function showManualRoute(route) {
  const routingPoints = getRoutingPointsWithOptionalAccess(route);
  const routeLatLngs = route.points.map((point) => [point.lat, point.lng]);
  const fullLatLngs = routingPoints.map((point) => [point.lat, point.lng]);

  clearPreviewLine();
  drawActualRoute(routeLatLngs);

  if (routingPoints.hasAccessSegment) {
    drawRoutePreview(routingPoints.slice(0, 2));
  }

  const manualRouteData = buildManualRouteData(routingPoints);
  const navigationSteps = setNavigationSteps(manualRouteData.legs);

  updateNavigationView();
  renderManualRouteSummary(route, routingPoints, navigationSteps.length);

  if (routingPoints.hasAccessSegment) {
    const dom = getDom();
    dom.routeInfo.innerHTML += `
      <div><strong>起點導航：</strong>你目前離路線起點超過 ${ROUTE_START_ACCESS_DISTANCE} 公尺，已用預覽線段標示目前位置到路線起點。</div>
    `;
  }
}

function buildManualRouteData(points) {
  const steps = points.slice(0, -1).map((point, index) => {
    const nextPoint = points[index + 1];
    const distance = getDistanceMeters(
      [point.lat, point.lng],
      [nextPoint.lat, nextPoint.lng]
    );

    return {
      name: nextPoint.name,
      distance,
      duration: distance / 1.2,
      maneuver: {
        type: index === 0 ? "depart" : "continue",
        modifier: "straight",
        location: [point.lng, point.lat]
      },
      geometry: encodeSimplePolyline([
        [point.lat, point.lng],
        [nextPoint.lat, nextPoint.lng]
      ])
    };
  });

  const lastPoint = points[points.length - 1];

  steps.push({
    name: lastPoint.name,
    distance: 0,
    duration: 0,
    maneuver: {
      type: "arrive",
      modifier: "straight",
      location: [lastPoint.lng, lastPoint.lat]
    },
    geometry: encodeSimplePolyline([
      [lastPoint.lat, lastPoint.lng],
      [lastPoint.lat, lastPoint.lng]
    ])
  });

  const totalDistance = steps.reduce((sum, step) => sum + step.distance, 0);
  const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0);

  return {
    distance: totalDistance,
    duration: totalDuration,
    legs: [
      {
        distance: totalDistance,
        duration: totalDuration,
        steps
      }
    ]
  };
}

function renderManualRouteSummary(route, points, stepCount) {
  const dom = getDom();
  const totalMeters = points.slice(0, -1).reduce((sum, point, index) => {
    return sum + getDistanceMeters(
      [point.lat, point.lng],
      [points[index + 1].lat, points[index + 1].lng]
    );
  }, 0);

  dom.routeInfo.innerHTML = `
    <strong>路線名稱：</strong>${route.name}<br>
    <strong>模式：</strong>手動路線，不使用 OSRM 自動導航<br>
    <strong>總距離：</strong>${(totalMeters / 1000).toFixed(2)} 公里<br>
    <strong>總步驟數：</strong>${stepCount} 步
  `;
}

function encodeSimplePolyline(latlngs, precision = 5) {
  let previousLat = 0;
  let previousLng = 0;
  let result = "";
  const factor = Math.pow(10, precision);

  latlngs.forEach(([lat, lng]) => {
    const currentLat = Math.round(lat * factor);
    const currentLng = Math.round(lng * factor);

    result += encodePolylineValue(currentLat - previousLat);
    result += encodePolylineValue(currentLng - previousLng);

    previousLat = currentLat;
    previousLng = currentLng;
  });

  return result;
}

function encodePolylineValue(value) {
  let encodedValue = value < 0 ? ~(value << 1) : value << 1;
  let result = "";

  while (encodedValue >= 0x20) {
    result += String.fromCharCode((0x20 | (encodedValue & 0x1f)) + 63);
    encodedValue >>= 5;
  }

  result += String.fromCharCode(encodedValue + 63);
  return result;
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
