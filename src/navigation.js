// ================================
// Navigation steps and instructions
// ================================
// Convert OSRM step data into readable instructions, keep track of the current
// step, and update the step list/card/buttons.

import { clearStepMarkers, updateStepMarkers } from "./map.js";
import { getDom } from "./ui.js";

let navigationSteps = [];
let currentStepIndex = 0;

export function resetNavigation() {
  const dom = getDom();

  navigationSteps = [];
  currentStepIndex = 0;

  dom.stepsList.innerHTML = "";
  dom.currentStepCard.textContent = "目前沒有導航步驟";
  dom.prevStepBtn.disabled = true;
  dom.nextStepBtn.disabled = true;

  clearStepMarkers();
}

export function setNavigationSteps(legs) {
  navigationSteps = flattenSteps(legs);
  currentStepIndex = 0;
  return navigationSteps;
}

export function updateNavigationView() {
  renderSteps();
  updateCurrentStepCard();
  updateStepButtons();
  updateStepMarkers(navigationSteps[currentStepIndex]);
}

export function goPrevStep() {
  if (navigationSteps.length === 0 || currentStepIndex <= 0) return;

  currentStepIndex -= 1;
  updateNavigationView();
}

export function goNextStep() {
  if (
    navigationSteps.length === 0 ||
    currentStepIndex >= navigationSteps.length - 1
  ) {
    return;
  }

  currentStepIndex += 1;
  updateNavigationView();
}

export function getCurrentStep() {
  if (navigationSteps.length === 0) return null;
  return navigationSteps[currentStepIndex] || null;
}

export function canGoNextStep() {
  return navigationSteps.length > 0 && currentStepIndex < navigationSteps.length - 1;
}

export function decodePolyline(str, precision = 5) {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];
  const factor = Math.pow(10, precision);

  while (index < str.length) {
    let result = 0;
    let shift = 0;
    let byte = null;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += deltaLat;

    result = 0;
    shift = 0;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += deltaLng;

    coordinates.push([lat / factor, lng / factor]);
  }

  return coordinates;
}

function flattenSteps(legs) {
  const result = [];

  legs.forEach((leg, legIndex) => {
    leg.steps.forEach((step, stepIndex) => {
      const startLocation = step.maneuver?.location
        ? [step.maneuver.location[1], step.maneuver.location[0]]
        : null;

      const endLocation = getStepEndLocation(leg.steps, stepIndex);

      result.push({
        legIndex: legIndex + 1,
        stepIndex: stepIndex + 1,
        maneuver: step.maneuver?.type || "continue",
        modifier: step.maneuver?.modifier || "",
        roadName: step.name || "未命名道路",
        distance: Math.round(step.distance),
        instruction: formatInstruction(step, legIndex + 1, stepIndex + 1),
        startLocation,
        endLocation
      });
    });
  });

  return result;
}

function getStepEndLocation(steps, stepIndex) {
  const step = steps[stepIndex];

  if (stepIndex < steps.length - 1) {
    const nextStep = steps[stepIndex + 1];
    if (nextStep.maneuver?.location) {
      return [nextStep.maneuver.location[1], nextStep.maneuver.location[0]];
    }
  }

  if (step.geometry) {
    const decodedStep = decodePolyline(step.geometry);
    if (decodedStep.length > 0) {
      return decodedStep[decodedStep.length - 1];
    }
  }

  return null;
}

function formatInstruction(step, legNumber, stepNumber) {
  const type = step.maneuver?.type || "continue";
  const modifier = step.maneuver?.modifier || "";
  const rawRoadName = (step.name || "").trim();
  const distance = Math.round(step.distance);

  const roadNameText = rawRoadName ? `「${rawRoadName}」` : "";
  const distanceText = distance > 0 ? `，前進 ${distance} 公尺` : "";

  let actionText = "";

  switch (type) {
    case "depart":
      actionText = rawRoadName
        ? `從${roadNameText}出發`
        : "從目前位置出發";
      break;

    case "turn": {
      const turnText = getTurnText(modifier);
      actionText = rawRoadName
        ? `${turnText}進入${roadNameText}`
        : turnText;
      break;
    }

    case "new name":
      actionText = rawRoadName
        ? `繼續直行，接著進入${roadNameText}`
        : "繼續直行";
      break;

    case "continue":
      actionText = rawRoadName
        ? `沿著${roadNameText}直行`
        : "繼續直行";
      break;

    case "arrive":
      actionText = rawRoadName ? `抵達${roadNameText}` : "已抵達目的地";
      return `第 ${legNumber} 段 第 ${stepNumber} 步：${actionText}`;

    default:
      actionText = rawRoadName
        ? `沿著${roadNameText}前進`
        : "繼續前進";
      break;
  }

  return `第 ${legNumber} 段 第 ${stepNumber} 步：${actionText}${distanceText}`;
}

function getTurnText(modifier) {
  if (modifier === "left") return "左轉";
  if (modifier === "right") return "右轉";
  if (modifier === "slight left") return "稍微左轉";
  if (modifier === "slight right") return "稍微右轉";
  if (modifier === "sharp left") return "大幅左轉";
  if (modifier === "sharp right") return "大幅右轉";
  if (modifier === "straight") return "直行";
  return "轉彎";
}

function renderSteps() {
  const dom = getDom();
  dom.stepsList.innerHTML = "";

  navigationSteps.forEach((step, index) => {
    const li = document.createElement("li");
    li.textContent = step.instruction;

    if (index === currentStepIndex) {
      li.classList.add("active-step");
    }

    dom.stepsList.appendChild(li);
  });
}

function updateCurrentStepCard() {
  const dom = getDom();

  if (navigationSteps.length === 0) {
    dom.currentStepCard.textContent = "目前沒有導航步驟";
    return;
  }

  const step = navigationSteps[currentStepIndex];
  dom.currentStepCard.innerHTML = `
    <strong>目前步驟：</strong><br>
    ${step.instruction}
  `;
}

function updateStepButtons() {
  const dom = getDom();
  const hasSteps = navigationSteps.length > 0;

  dom.prevStepBtn.disabled = !hasSteps || currentStepIndex === 0;
  dom.nextStepBtn.disabled =
    !hasSteps || currentStepIndex === navigationSteps.length - 1;
}
