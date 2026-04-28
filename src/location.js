// ================================
// User location tracking
// ================================
// Watch browser geolocation and display the user's current position on the
// route map.

import { getDom } from "./ui.js";
import { canGoNextStep, getCurrentStep, goNextStep } from "./navigation.js";

let userMarker = null;
let watchId = null;
let hasReceivedLocation = false;
let currentUserLatLng = null;

export const AUTO_STEP_SWITCH_DISTANCE = 18;

export function trackUserLocation(routeMap) {
  const dom = getDom();

  if (!navigator.geolocation) {
    dom.currentStepCard.innerHTML = `
      <strong>定位不支援：</strong><br>
      你的瀏覽器不支援定位功能，仍然可以使用手動瀏覽導航步驟。
    `;
    return;
  }

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      hasReceivedLocation = true;

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const latlng = [lat, lng];
      currentUserLatLng = latlng;
      autoAdvanceStepIfNeeded(latlng);

      if (userMarker) {
        userMarker.setLatLng(latlng);
        return;
      }

      userMarker = L.circleMarker(latlng, {
        radius: 9,
        color: "green",
        fillColor: "green",
        fillOpacity: 0.9,
        weight: 3
      })
        .addTo(routeMap)
        .bindPopup("你目前的位置");

      userMarker.openPopup();
      routeMap.setView(latlng, Math.max(routeMap.getZoom(), 17));
    },
    (error) => {
      console.warn("Geolocation failed:", error);

      // Some browsers may report TIMEOUT or POSITION_UNAVAILABLE after a
      // successful update. If the user marker already exists, keep it and do
      // not overwrite the navigation card with an error message.
      if (hasReceivedLocation) return;

      const isPermissionDenied = error.code === error.PERMISSION_DENIED;
      const title = isPermissionDenied ? "定位未啟用" : "暫時無法取得定位";
      const detail = isPermissionDenied
        ? "請允許瀏覽器定位權限，或繼續使用手動瀏覽導航步驟。"
        : "瀏覽器尚未回傳位置，請稍後再試，或繼續使用手動瀏覽導航步驟。";

      dom.currentStepCard.innerHTML = `
        <strong>${title}：</strong><br>
        ${detail}
      `;
    },
    {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 15000
    }
  );
}

export function stopTrackingUserLocation() {
  if (watchId === null) return;

  navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

export function getCurrentUserLatLng() {
  return currentUserLatLng;
}

function autoAdvanceStepIfNeeded(userLatLng) {
  const currentStep = getCurrentStep();

  if (!currentStep || !currentStep.endLocation) return;
  if (!canGoNextStep()) return;

  const distance = getDistanceMeters(userLatLng, currentStep.endLocation);

  if (distance <= AUTO_STEP_SWITCH_DISTANCE) {
    goNextStep();
  }
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