import { ROUTES, state } from "./state.js";
import {
  initMap,
  clearMarkers,
  clearPreviewLine,
  clearRouteLine,
  clearStepMarkers,
  drawRouteMarkers,
  drawPreviewLine,
  drawRouteLine,
  updateStepMarkers
} from "./map.js";
import { fetchRouteData, flattenSteps } from "./routing.js";
import {
  dom,
  initRouteSelect,
  renderLoadedRouteInfo,
  renderRouteSummary,
  renderSteps,
  updateCurrentStepCard,
  updateStepButtons,
  resetNavigationUI
} from "./ui.js";

function resetNavigationState() {
  state.navigationSteps = [];
  state.currentStepIndex = 0;
  clearStepMarkers();
  resetNavigationUI();
}

function loadRoute() {
  const route = ROUTES[state.currentRouteKey];
  if (!route) return;

  clearMarkers();
  clearPreviewLine();
  clearRouteLine();
  resetNavigationState();

  drawRouteMarkers(route.points);
  drawPreviewLine(route.points);
  renderLoadedRouteInfo(route);
}

async function showRoute() {
  const route = ROUTES[state.currentRouteKey];
  if (!route || route.points.length < 2) {
    dom.routeInfo.textContent = "路線至少需要兩個點";
    return;
  }

  clearRouteLine();
  resetNavigationState();

  try {
    dom.routeInfo.textContent = "正在向 API 載入路線";

    const routeData = await fetchRouteData(route.points);
    const decodedLatLngs = routeData.decoded;

    clearPreviewLine();
    drawRouteLine(decodedLatLngs);

    state.navigationSteps = flattenSteps(routeData.legs);
    state.currentStepIndex = 0;

    renderSteps();
    updateCurrentStepCard();
    updateStepButtons();
    updateStepMarkers();

    renderRouteSummary(route.name, routeData.distance, routeData.duration, state.navigationSteps.length);
  } catch (error) {
    console.error(error);
    dom.routeInfo.textContent = "載入路線失敗，請稍後再試";
  }
}

function goPrevStep() {
  if (state.navigationSteps.length === 0) return;
  if (state.currentStepIndex <= 0) return;

  state.currentStepIndex -= 1;
  renderSteps();
  updateCurrentStepCard();
  updateStepButtons();
  updateStepMarkers();
}

function goNextStep() {
  if (state.navigationSteps.length === 0) return;
  if (state.currentStepIndex >= state.navigationSteps.length - 1) return;

  state.currentStepIndex += 1;
  renderSteps();
  updateCurrentStepCard();
  updateStepButtons();
  updateStepMarkers();
}

function bindEvents() {
  dom.loadRouteBtn.addEventListener("click", loadRoute);
  dom.showRouteBtn.addEventListener("click", showRoute);
  dom.prevStepBtn.addEventListener("click", goPrevStep);
  dom.nextStepBtn.addEventListener("click", goNextStep);
}

initMap();
initRouteSelect();
bindEvents();
loadRoute();