function decodePolyline(str, precision = 5) {
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
  
  export async function fetchRouteData(points) {
    const coords = points
      .map((point) => `${point.lng},${point.lat}`)
      .join(";");
  
    const url = `https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=polyline&steps=true`;
  
    const response = await fetch(url);
    const data = await response.json();
  
    if (!data.routes || data.routes.length === 0) {
      throw new Error("No route found");
    }
  
    const routeData = data.routes[0];
  
    return {
      decoded: decodePolyline(routeData.geometry),
      distance: routeData.distance,
      duration: routeData.duration,
      legs: routeData.legs
    };
  }
  
  export function flattenSteps(legs) {
    const result = [];
  
    legs.forEach((leg, legIndex) => {
      leg.steps.forEach((step, stepIndex) => {
        const startLocation = step.maneuver?.location
          ? [step.maneuver.location[1], step.maneuver.location[0]]
          : null;
  
        let endLocation = null;
  
        if (stepIndex < leg.steps.length - 1) {
          const nextStep = leg.steps[stepIndex + 1];
          if (nextStep.maneuver?.location) {
            endLocation = [
              nextStep.maneuver.location[1],
              nextStep.maneuver.location[0]
            ];
          }
        } else if (step.geometry) {
          const decodedStep = decodePolyline(step.geometry);
          if (decodedStep.length > 0) {
            endLocation = decodedStep[decodedStep.length - 1];
          }
        }
  
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
  
  export function formatInstruction(step, legNumber, stepNumber) {
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
        let turnText = "轉彎";
  
        if (modifier === "left") turnText = "左轉";
        else if (modifier === "right") turnText = "右轉";
        else if (modifier === "slight left") turnText = "稍微左轉";
        else if (modifier === "slight right") turnText = "稍微右轉";
        else if (modifier === "sharp left") turnText = "大幅左轉";
        else if (modifier === "sharp right") turnText = "大幅右轉";
        else if (modifier === "straight") turnText = "直行";
  
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
        actionText = rawRoadName
          ? `抵達${roadNameText}`
          : "已抵達目的地";
        return `第 ${legNumber} 段 第 ${stepNumber} 步：${actionText}`;
  
      default:
        actionText = rawRoadName
          ? `沿著${roadNameText}前進`
          : "繼續前進";
        break;
    }
  
    return `第 ${legNumber} 段 第 ${stepNumber} 步：${actionText}${distanceText}`;
  }