import { ROUTES, state } from "./state.js";

export const dom = {
  routeSelect: document.getElementById("routeSelect"),
  loadRouteBtn: document.getElementById("loadRouteBtn"),
  showRouteBtn: document.getElementById("showRouteBtn"),
  prevStepBtn: document.getElementById("prevStepBtn"),
  nextStepBtn: document.getElementById("nextStepBtn"),
  routeInfo: document.getElementById("routeInfo"),
  currentStepCard: document.getElementById("currentStepCard"),
  stepsList: document.getElementById("stepsList")
};

export function initRouteSelect() {
  const keys = Object.keys(ROUTES);

  keys.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = ROUTES[key].name;
    dom.routeSelect.appendChild(option);
  });

  if (keys.length > 0) {
    state.currentRouteKey = keys[0];
    dom.routeSelect.value = state.currentRouteKey;
  }

  dom.routeSelect.addEventListener("change", () => {
    state.currentRouteKey = dom.routeSelect.value;
  });
}

export function renderLoadedRouteInfo(route) {
  dom.routeInfo.innerHTML = `
    <strong>已載入路線：</strong>${route.name}
    <br>
    <strong>路線節點：</strong>
    <ol class="route-point-list">
      ${route.points.map((point) => `<li>${point.name}</li>`).join("")}
    </ol>
    <div>現在可以按「顯示路線」去向 API 取得實際步行路徑。</div>
  `;
}

export function renderRouteSummary(routeName, distance, duration, stepCount) {
  const totalKm = (distance / 1000).toFixed(2);
  const totalMin = Math.round(duration / 60);

  dom.routeInfo.innerHTML = `
    <strong>路線名稱：</strong>${routeName}<br>
    <strong>總距離：</strong>${totalKm} 公里<br>
    <strong>預估時間：</strong>${totalMin} 分鐘<br>
    <strong>總步驟數：</strong>${stepCount} 步
  `;
}

export function renderSteps() {
  dom.stepsList.innerHTML = "";

  state.navigationSteps.forEach((step, index) => {
    const li = document.createElement("li");
    li.textContent = step.instruction;

    if (index === state.currentStepIndex) {
      li.classList.add("active-step");
    }

    dom.stepsList.appendChild(li);
  });
}

export function updateCurrentStepCard() {
  if (state.navigationSteps.length === 0) {
    dom.currentStepCard.textContent = "目前沒有導航步驟";
    return;
  }

  const step = state.navigationSteps[state.currentStepIndex];

  dom.currentStepCard.innerHTML = `
    <strong>目前步驟：</strong><br>
    ${step.instruction}
  `;
}

export function updateStepButtons() {
  const hasSteps = state.navigationSteps.length > 0;

  dom.prevStepBtn.disabled = !hasSteps || state.currentStepIndex === 0;
  dom.nextStepBtn.disabled =
    !hasSteps || state.currentStepIndex === state.navigationSteps.length - 1;
}

export function resetNavigationUI() {
  dom.stepsList.innerHTML = "";
  dom.currentStepCard.textContent = "目前沒有導航步驟";
  dom.prevStepBtn.disabled = true;
  dom.nextStepBtn.disabled = true;
}