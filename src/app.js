// ================================
// App entry point
// ================================
// Wire all modules together after the DOM is ready. Feature logic stays in the
// individual modules; this file only controls startup order and event binding.

import { CAMPUS_POINTS } from "./data.js";
import { initMaps, initCampusPoints } from "./map.js";
import { trackUserLocation } from "./location.js";
import { goNextStep, goPrevStep } from "./navigation.js";
import { initRouteSelect, loadRoute, showRoute } from "./route.js";
import {
  assertRequiredDom,
  getDom,
  initTabs,
  renderStartupError,
  switchTab
} from "./ui.js";

window.addEventListener("DOMContentLoaded", startApp);

function startApp() {
  try {
    const dom = getDom();
    assertRequiredDom(dom);

    initRouteSelect();

    const maps = initMaps();
    initCampusPoints(CAMPUS_POINTS, dom.campusLegend);
    initTabs(maps);

    switchTab("route", maps);
    trackUserLocation(maps.routeMap);

    dom.loadRouteBtn.addEventListener("click", loadRoute);
    dom.showRouteBtn.addEventListener("click", showRoute);
    dom.prevStepBtn.addEventListener("click", goPrevStep);
    dom.nextStepBtn.addEventListener("click", goNextStep);
  } catch (error) {
    renderStartupError(error);
  }
}
