// ================================
// Leaflet map setup and visual layers
// ================================
// This module owns the two Leaflet map instances and every marker/polyline
// drawn on top of them.

let routeMap = null;
let campusMap = null;
let markers = [];
let previewLine = null;
let routeLine = null;
let currentStepMarker = null;
let nextStepMarker = null;
let isRouteLoaded = false;

export function initMaps() {
  if (!window.L) {
    throw new Error("Leaflet 尚未載入。請確認 Leaflet 的 CSS/JS 在 src/app.js 之前載入。");
  }

  routeMap = L.map("routeMap").setView([25.0173, 121.5397], 16);
  campusMap = L.map("campusMap").setView([25.0173, 121.5397], 16);

  const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const attribution = "&copy; OpenStreetMap contributors";

  L.tileLayer(tileUrl, { attribution }).addTo(routeMap);
  L.tileLayer(tileUrl, { attribution }).addTo(campusMap);

  return { routeMap, campusMap };
}

export function clearMarkers() {
  markers.forEach((marker) => routeMap.removeLayer(marker));
  markers = [];
  clearStepMarkers();
  isRouteLoaded = false;
}

export function clearPreviewLine() {
  if (!previewLine) return;
  routeMap.removeLayer(previewLine);
  previewLine = null;
}

export function clearRouteLine() {
  if (!routeLine) return;
  routeMap.removeLayer(routeLine);
  routeLine = null;
}

export function clearStepMarkers() {
  if (currentStepMarker) {
    routeMap.removeLayer(currentStepMarker);
    currentStepMarker = null;
  }

  if (nextStepMarker) {
    routeMap.removeLayer(nextStepMarker);
    nextStepMarker = null;
  }
}

export function drawRoutePreview(points) {
  clearPreviewLine();
  clearMarkers();

  const latlngs = points.map((point) => [point.lat, point.lng]);

  points.forEach((point, index) => {
    const marker = L.marker([point.lat, point.lng])
      .addTo(routeMap)
      .bindPopup(`${index + 1}. ${point.name}`);

    markers.push(marker);
  });

  previewLine = L.polyline(latlngs, {
    dashArray: "5, 5",
    color: "blue"
  }).addTo(routeMap);

  isRouteLoaded = true;

  routeMap.fitBounds(previewLine.getBounds(), { padding: [30, 30] });
  routeMap.invalidateSize();
}

export function drawActualRoute(decodedPolyline) {
  clearRouteLine();

  routeLine = L.polyline(decodedPolyline).addTo(routeMap);
  routeMap.fitBounds(routeLine.getBounds(), { padding: [30, 30] });
  routeMap.invalidateSize();
}

export function updateStepMarkers(step) {
  clearStepMarkers();
  if (!step) return;

  const { startLocation, endLocation } = step;

  if (startLocation) {
    routeMap.panTo(startLocation);

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

export function hasLoadedRoute() {
  return isRouteLoaded;
}

export function initCampusPoints(campusPoints, campusLegend) {
  campusLegend.innerHTML = "";

  campusPoints.forEach((point) => {
    L.circleMarker([point.lat, point.lng], {
      radius: 8,
      color: "blue",
      fillColor: "blue",
      fillOpacity: 0.8
    })
      .addTo(campusMap)
      .bindPopup(point.name);

    const li = document.createElement("li");
    li.innerHTML = `<span class="legend-dot"></span>${point.name}`;
    campusLegend.appendChild(li);
  });
}
