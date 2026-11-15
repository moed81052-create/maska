/**
 * أدوات ومعادلات الحسابات الجغرافية لنطاقات التوصيل في أتيليه مسكة
 * تدعم الأشكال غير المتناسقة: الدوائر البيضاوية، المستطيلات الحرة، والمضلعات متعددة الأطراف
 */

// حساب المسافة الدقيقة بين نقطتين بالأمتار (معادلة هافيرسين)
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return Infinity;
  const R = 6371e3; // نصف قطر الأرض بالأمتار
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// خوارزمية فحص النقطة داخل المضلع (Ray-Casting Algorithm)
// تدعم أي شكل هندسي حر أو مضلع غير متناسق بأي عدد من الزوايا
export function isPointInPolygon(point, vs) {
  if (!point || !Array.isArray(vs) || vs.length < 3) return false;
  const x = Number(point[0]);
  const y = Number(point[1]);
  if (isNaN(x) || isNaN(y)) return false;

  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = Number(vs[i][0]);
    const yi = Number(vs[i][1]);
    const xj = Number(vs[j][0]);
    const yj = Number(vs[j][1]);

    const intersect = ((yi > y) !== (yj > y)) &&
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// توليد نقاط دائرة غير متناسقة / بيضاوية (Ellipse) بأبعاد حرة وزاوية دوران
export function generateEllipsePoints(centerLat, centerLng, radiusX, radiusY, rotationDeg = 0, numPoints = 36) {
  const points = [];
  const rotRad = (rotationDeg * Math.PI) / 180;
  const cosRot = Math.cos(rotRad);
  const sinRot = Math.sin(rotRad);
  const latCos = Math.cos((centerLat * Math.PI) / 180);

  for (let i = 0; i < numPoints; i++) {
    const theta = (i * 2 * Math.PI) / numPoints;
    const dx = radiusX * Math.cos(theta); // East-West (meters)
    const dy = radiusY * Math.sin(theta); // North-South (meters)

    const rotDx = dx * cosRot - dy * sinRot;
    const rotDy = dx * sinRot + dy * cosRot;

    const latDelta = rotDy / 111000;
    const lngDelta = rotDx / (111000 * latCos);

    points.push([
      Number((centerLat + latDelta).toFixed(6)),
      Number((centerLng + lngDelta).toFixed(6))
    ]);
  }
  return points;
}

// توليد أركان أولية لمربع / مستطيل حر قابل للسحب
export function generateInitialBoxPoints(centerLat, centerLng, widthMeters = 5000, heightMeters = 4000) {
  const latDelta = (heightMeters / 2) / 111000;
  const lngDelta = (widthMeters / 2) / (111000 * Math.cos((centerLat * Math.PI) / 180));

  return [
    [Number((centerLat + latDelta).toFixed(6)), Number((centerLng - lngDelta).toFixed(6))], // شمال غرب
    [Number((centerLat + latDelta).toFixed(6)), Number((centerLng + lngDelta).toFixed(6))], // شمال شرق
    [Number((centerLat - latDelta).toFixed(6)), Number((centerLng + lngDelta).toFixed(6))], // جنوب شرق
    [Number((centerLat - latDelta).toFixed(6)), Number((centerLng - lngDelta).toFixed(6))]  // جنوب غرب
  ];
}

// استخراج أو تحويل نقاط النطاق الجغرافي من كائن المنطقة
export function extractZonePoints(zone) {
  if (!zone) return null;

  // 1. فحص polygon_geojson
  if (zone.polygon_geojson) {
    try {
      const parsed = typeof zone.polygon_geojson === 'string'
        ? JSON.parse(zone.polygon_geojson)
        : zone.polygon_geojson;

      if (Array.isArray(parsed) && parsed.length >= 3) {
        return parsed.map(p => [Number(p[0]), Number(p[1])]);
      }
      if (parsed && Array.isArray(parsed.points) && parsed.points.length >= 3) {
        return parsed.points.map(p => [Number(p[0]), Number(p[1])]);
      }
      if (parsed && parsed.coordinates && Array.isArray(parsed.coordinates[0])) {
        return parsed.coordinates[0].map(p => [Number(p[1]), Number(p[0])]);
      }
    } catch (e) {
      console.warn('Error parsing polygon_geojson:', e);
    }
  }

  // 2. إذا كان مربعاً بدون نقاط مضلع صريحة، نولّد نقاط الأركان الأربعة
  const cLat = Number(zone.center_lat);
  const cLng = Number(zone.center_lng);
  const radius = Number(zone.radius_meters) || 3000;

  if (!isNaN(cLat) && !isNaN(cLng) && cLat !== 0 && cLng !== 0) {
    if (zone.shape_type === 'box') {
      const latDelta = radius / 111000;
      const lngDelta = radius / (111000 * Math.cos((cLat * Math.PI) / 180));
      return [
        [cLat + latDelta, cLng - lngDelta],
        [cLat + latDelta, cLng + lngDelta],
        [cLat - latDelta, cLng + lngDelta],
        [cLat - latDelta, cLng - lngDelta]
      ];
    }
  }

  return null;
}

// حساب المركز التقريبي لأي مضلع (Centroid)
export function calculatePolygonCenter(points) {
  if (!Array.isArray(points) || points.length === 0) return [32.8872, 13.1913];
  let sumLat = 0;
  let sumLng = 0;
  points.forEach(p => {
    sumLat += Number(p[0]);
    sumLng += Number(p[1]);
  });
  return [
    Number((sumLat / points.length).toFixed(6)),
    Number((sumLng / points.length).toFixed(6))
  ];
}

// حساب المساحة التقريبية للمضلع بالأمتار المربعة للمقارنة والمفاضلة عند التداخل
export function calculateApproxArea(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const lat1 = points[j][0] * 111000;
    const lng1 = points[j][1] * 111000 * Math.cos((points[j][0] * Math.PI) / 180);
    const lat2 = points[i][0] * 111000;
    const lng2 = points[i][1] * 111000 * Math.cos((points[i][0] * Math.PI) / 180);
    area += (lng1 * lat2) - (lat1 * lng2);
  }
  return Math.abs(area / 2);
}

// دالة فحص ما إذا كان العميل داخل النطاق (أياً كان نوع شكله: مضلع، دائرة، بيضاوية، مربع غير متناسق)
export function isCoordinateInsideZone(lat, lng, zone) {
  const points = extractZonePoints(zone);
  if (points && points.length >= 3) {
    return isPointInPolygon([lat, lng], points);
  }

  // إذا كانت دائرة عادية
  const cLat = Number(zone.center_lat);
  const cLng = Number(zone.center_lng);
  const radius = Number(zone.radius_meters) || 3000;

  if (isNaN(cLat) || isNaN(cLng) || cLat === 0 || cLng === 0) return false;

  const dist = calculateDistanceMeters(lat, lng, cLat, cLng);
  return dist <= radius;
}
