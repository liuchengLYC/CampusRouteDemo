// ================================
// User location tracking
// ================================
// Watch browser geolocation and display the user's current position on the
// route map.

import { getDom } from "./ui.js";

let userMarker = null;
let watchId = null;

export const AUTO_STEP_SWITCH_DISTANCE = 18;

export function trackUserLocation(routeMap) {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser");
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      if (userMarker) {
        userMarker.setLatLng([lat, lng]);
        return;
      }

      userMarker = L.circleMarker([lat, lng], {
        radius: 8,
        color: "green",
        fillColor: "green",
        fillOpacity: 0.9
      })
        .addTo(routeMap)
        .bindPopup("你目前的位置");
    },
    (error) => {
      const dom = getDom();
      console.warn("Geolocation failed:", error);
      dom.currentStepCard.innerHTML = `
        <strong>定位未啟用：</strong><br>
        你仍然可以使用手動瀏覽導航步驟。
      `;
    },
    {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 5000
    }
  );
}

export function stopTrackingUserLocation() {
  if (!watchId) return;

  navigator.geolocation.clearWatch(watchId);
  watchId = null;
}
