import { state } from "./state.js";

export function initMap() {
  state.map = L.map("map").setView([25.0173, 121.5397], 16);

  state.baseLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  });

  state.baseLayer.addTo(state.map);
}

export function clearMarkers() {
  state.markers.forEach((marker) => state.map.removeLayer(marker));
  state.markers = [];
}

export function clearPreviewLine() {
  if (state.previewLine) {
    state.map.removeLayer(state.previewLine);
    state.previewLine = null;
  }
}

export function clearRouteLine() {
  if (state.routeLine) {
    state.map.removeLayer(state.routeLine);
    state.routeLine = null;
  }
}

export function clearStepMarkers() {
  if (state.currentStepMarker) {
    state.map.removeLayer(state.currentStepMarker);
    state.currentStepMarker = null;
  }

  if (state.nextStepMarker) {
    state.map.removeLayer(state.nextStepMarker);
    state.nextStepMarker = null;
  }
}

export function drawRouteMarkers(points) {
  points.forEach((point, index) => {
    const marker = L.marker([point.lat, point.lng])
      .addTo(state.map)
      .bindPopup(`${index + 1}. ${point.name}`);

    state.markers.push(marker);
  });
}

export function drawPreviewLine(points) {
  const latlngs = points.map((point) => [point.lat, point.lng]);

  state.previewLine = L.polyline(latlngs, {
    dashArray: "5, 5",
    color: "blue"
  }).addTo(state.map);

  state.map.fitBounds(state.previewLine.getBounds(), { padding: [30, 30] });
}

export function drawRouteLine(latlngs) {
  state.routeLine = L.polyline(latlngs).addTo(state.map);
  state.map.fitBounds(state.routeLine.getBounds(), { padding: [30, 30] });
}

export function updateStepMarkers() {
  if (state.navigationSteps.length === 0) return;

  clearStepMarkers();

  const step = state.navigationSteps[state.currentStepIndex];
  if (!step) return;

  const { startLocation, endLocation } = step;

  if (startLocation) {
    state.currentStepMarker = L.circleMarker(startLocation, {
      radius: 10,
      color: "blue",
      fillColor: "blue",
      fillOpacity: 0.8
    })
      .addTo(state.map)
      .bindPopup(`目前位置：第 ${step.legIndex} 段 第 ${step.stepIndex} 步`);
  }

  if (endLocation) {
    state.nextStepMarker = L.circleMarker(endLocation, {
      radius: 10,
      color: "red",
      fillColor: "red",
      fillOpacity: 0.8
    })
      .addTo(state.map)
      .bindPopup(`這一步終點：第 ${step.legIndex} 段 第 ${step.stepIndex} 步`);
  }
}