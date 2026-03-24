const fs = require("fs");
const path = require("path");
const { mockCongestionState } = require("./state");

const MOCK_CONGESTION_FILE = path.join(
  process.cwd(),
  "data",
  "mock-congestion.json",
);
const MVI_GEOJSON_FILE = path.join(process.cwd(), "data", "MVI.geojson");
const REGIONS_GEOJSON_FILE = path.join(
  process.cwd(),
  "data",
  "regions.geojson",
);
const CORREDORES_GEOJSON_FILE = path.join(
  process.cwd(),
  "data",
  "corredores.geojson",
);

let corridorsCache = null;

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const DEFAULT_PAST_PERIODS = toPositiveInt(
  process.env.CONGESTION_PAST_PERIODS,
  8,
);
const DEFAULT_FUTURE_PERIODS = toPositiveInt(
  process.env.CONGESTION_FUTURE_PERIODS,
  8,
);
const DEFAULT_PREDICTION_JITTER = (() => {
  const parsed = Number(process.env.CONGESTION_PREDICTION_JITTER);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0.12;
})();
const DEFAULT_PREDICTION_TREND = (() => {
  const parsed = Number(process.env.CONGESTION_PREDICTION_TREND_PER_STEP);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0.03;
})();

/**
 * @typedef {Object} MockPredictionRegion
 * @property {string} areaId
 * @property {string} name
 */

/**
 * @typedef {Object} MockPredictionSegment
 * @property {number} mviCodigo
 * @property {number} id
 * @property {string} areaId
 * @property {string} title
 * @property {[number, number][]} coordinates
 * @property {number} velocity
 * @property {number} level
 * @property {number} delay
 * @property {string} day
 * @property {string} hour
 * @property {string} timeslot
 */

/**
 * @typedef {Object} MockPredictionHistoryPoint
 * @property {string} timeslot
 * @property {string} label
 * @property {string} day
 * @property {number} velocity
 * @property {number} level
 * @property {number} delay
 * @property {number} jams
 */

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeLineString = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return [];
  }

  const normalizedPath = coordinates
    .map((coordinate) => {
      if (!Array.isArray(coordinate) || coordinate.length < 2) {
        return null;
      }

      const lng = toFiniteNumber(coordinate[0]);
      const lat = toFiniteNumber(coordinate[1]);

      if (lng === null || lat === null) {
        return null;
      }

      return [lng, lat];
    })
    .filter(Boolean);

  return normalizedPath.length >= 2 ? [normalizedPath] : [];
};

const normalizeMultiLineString = (coordinates) => {
  if (!Array.isArray(coordinates)) {
    return [];
  }

  return coordinates
    .map((lineCoordinates) => normalizeLineString(lineCoordinates))
    .flat();
};

const getMockCongestionCorridors = () => {
  if (corridorsCache) {
    return corridorsCache;
  }

  const payload = safeReadJSON(CORREDORES_GEOJSON_FILE);
  const features = Array.isArray(payload?.features) ? payload.features : [];

  const items = features
    .map((feature, index) => {
      const geometry = feature?.geometry;
      const properties = feature?.properties || {};
      const type = geometry?.type;

      let paths = [];

      if (type === "LineString") {
        paths = normalizeLineString(geometry.coordinates);
      } else if (type === "MultiLineString") {
        paths = normalizeMultiLineString(geometry.coordinates);
      }

      if (paths.length === 0) {
        return null;
      }

      return {
        id: feature?.id ?? properties.FID ?? index,
        fid: toFiniteNumber(properties.FID) ?? index,
        name: String(properties.CORREDOR || `Corredor ${index + 1}`),
        paths,
      };
    })
    .filter(Boolean);

  corridorsCache = {
    generatedAt: new Date().toISOString(),
    totalItems: items.length,
    items,
  };

  return corridorsCache;
};

const getLineMidpoint = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return null;
  }

  const midpointIndex = Math.floor(coordinates.length / 2);
  const candidate = coordinates[midpointIndex];

  if (!Array.isArray(candidate) || candidate.length < 2) {
    return null;
  }

  const lng = toFiniteNumber(candidate[0]);
  const lat = toFiniteNumber(candidate[1]);

  if (lng === null || lat === null) {
    return null;
  }

  return [lng, lat];
};

const isPointInRing = (pointLng, pointLat, ring) => {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersects =
      yi > pointLat !== yj > pointLat &&
      pointLng < ((xj - xi) * (pointLat - yi)) / (yj - yi || 1e-12) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

const isPointInPolygonCoordinates = (
  pointLng,
  pointLat,
  polygonCoordinates,
) => {
  if (!Array.isArray(polygonCoordinates) || polygonCoordinates.length === 0) {
    return false;
  }

  const outerRing = polygonCoordinates[0];
  if (!Array.isArray(outerRing) || outerRing.length < 3) {
    return false;
  }

  if (!isPointInRing(pointLng, pointLat, outerRing)) {
    return false;
  }

  for (
    let holeIndex = 1;
    holeIndex < polygonCoordinates.length;
    holeIndex += 1
  ) {
    const holeRing = polygonCoordinates[holeIndex];
    if (
      Array.isArray(holeRing) &&
      holeRing.length >= 3 &&
      isPointInRing(pointLng, pointLat, holeRing)
    ) {
      return false;
    }
  }

  return true;
};

const isPointInGeometry = (pointLng, pointLat, geometry) => {
  if (!geometry || !geometry.type || !geometry.coordinates) {
    return false;
  }

  if (geometry.type === "Polygon") {
    return isPointInPolygonCoordinates(
      pointLng,
      pointLat,
      geometry.coordinates,
    );
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygonCoordinates) =>
      isPointInPolygonCoordinates(pointLng, pointLat, polygonCoordinates),
    );
  }

  return false;
};

const safeReadJSON = (filePath) => {
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content);
};

const assignAreasToMviSegments = (mviByCode, regionFeatures) => {
  const areaByMviCode = new Map();

  for (const [mviCode, mviEntry] of mviByCode.entries()) {
    const midpoint = getLineMidpoint(mviEntry.coordinates);
    if (!midpoint) {
      continue;
    }

    const [lng, lat] = midpoint;
    let areaId = null;

    for (const region of regionFeatures) {
      if (isPointInGeometry(lng, lat, region.geometry)) {
        areaId = String(region.properties?.area_id ?? "unknown");
        break;
      }
    }

    if (areaId) {
      areaByMviCode.set(mviCode, areaId);
    }
  }

  return areaByMviCode;
};

const inferStepMinutes = (timeframes) => {
  if (!Array.isArray(timeframes) || timeframes.length < 2) {
    return 15;
  }

  const first = new Date(timeframes[0]).getTime();
  const second = new Date(timeframes[1]).getTime();

  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    return 15;
  }

  const diffMinutes = Math.round((second - first) / (1000 * 60));
  return Number.isFinite(diffMinutes) && diffMinutes > 0 ? diffMinutes : 15;
};

const toIsoString = (timeMs) => new Date(timeMs).toISOString();

const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);

const deterministicUnitRandom = (seed) => {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
};

const getTimeslotOffsetFromReference = (timeslot) => {
  if (
    !mockCongestionState.referenceTimeslot ||
    !mockCongestionState.stepMinutes
  ) {
    return 0;
  }

  const timeslotMs = new Date(timeslot).getTime();
  const referenceMs = new Date(mockCongestionState.referenceTimeslot).getTime();
  const stepMs = mockCongestionState.stepMinutes * 60 * 1000;

  if (
    !Number.isFinite(timeslotMs) ||
    !Number.isFinite(referenceMs) ||
    !Number.isFinite(stepMs) ||
    stepMs <= 0
  ) {
    return 0;
  }

  return Math.round((timeslotMs - referenceMs) / stepMs);
};

const applyPredictionVariation = ({
  mviCodigo,
  timeslot,
  velocity,
  level,
  delay,
  jams,
}) => {
  const offset = getTimeslotOffsetFromReference(timeslot);
  if (offset === 0) {
    return {
      velocity,
      level,
      delay,
      jams,
    };
  }

  const uncertainty = DEFAULT_PREDICTION_JITTER + Math.abs(offset) * 0.02;
  const trend = offset > 0 ? offset * DEFAULT_PREDICTION_TREND : offset * 0.01;

  const velocityNoise =
    (deterministicUnitRandom(`${mviCodigo}|${timeslot}|velocity`) - 0.5) * 2;
  const levelNoise =
    (deterministicUnitRandom(`${mviCodigo}|${timeslot}|level`) - 0.5) * 2;
  const delayNoise =
    (deterministicUnitRandom(`${mviCodigo}|${timeslot}|delay`) - 0.5) * 2;
  const jamsNoise =
    (deterministicUnitRandom(`${mviCodigo}|${timeslot}|jams`) - 0.5) * 2;

  const velocityFactor = clampNumber(
    1 - trend + velocityNoise * uncertainty,
    0.35,
    1.45,
  );
  const levelFactor = clampNumber(
    1 + trend * 0.9 + levelNoise * uncertainty * 0.9,
    0.5,
    2.1,
  );
  const delayFactor = clampNumber(
    1 + trend * 1.25 + delayNoise * uncertainty * 1.1,
    0.4,
    2.8,
  );
  const jamsFactor = clampNumber(
    1 + trend + jamsNoise * uncertainty * 1.25,
    0.25,
    3.2,
  );

  return {
    velocity: Number(Math.max(0, velocity * velocityFactor).toFixed(2)),
    level: Number(clampNumber(level * levelFactor, 0, 5).toFixed(2)),
    delay: Number(Math.max(0, delay * delayFactor).toFixed(2)),
    jams: Math.max(0, Math.round(jams * jamsFactor)),
  };
};

const getLastClosedSlotMs = (nowMs, stepMinutes) => {
  const stepMs = stepMinutes * 60 * 1000;
  return Math.floor((nowMs - stepMs) / stepMs) * stepMs;
};

const resolveReferenceTimeslotWindow = (
  sortedTimeframes,
  stepMinutes,
  pastPeriods,
  futurePeriods,
) => {
  if (!Array.isArray(sortedTimeframes) || sortedTimeframes.length === 0) {
    return {
      referenceTimeslot: null,
      windowedTimeframes: [],
    };
  }

  const parsedEntries = sortedTimeframes.map((timeslot) => ({
    timeslot,
    timeMs: new Date(timeslot).getTime(),
  }));

  const hasInvalidDate = parsedEntries.some(
    (entry) => !Number.isFinite(entry.timeMs),
  );

  if (hasInvalidDate) {
    const nowMs = Date.now();
    const referenceMs = getLastClosedSlotMs(nowMs, stepMinutes);
    const timeslotSourceMap = new Map();
    const exposedTimeframes = [];

    for (let offset = -pastPeriods; offset <= futurePeriods; offset += 1) {
      const exposedTimeslot = toIsoString(
        referenceMs + offset * stepMinutes * 60 * 1000,
      );
      exposedTimeframes.push(exposedTimeslot);
      timeslotSourceMap.set(exposedTimeslot, sortedTimeframes[0]);
    }

    return {
      referenceTimeslot: toIsoString(referenceMs),
      sourceReferenceTimeslot: sortedTimeframes[0],
      sourceTimeframes: sortedTimeframes,
      windowedTimeframes: exposedTimeframes,
      timeslotSourceMap,
    };
  }

  const nowMs = Date.now();
  const closedCutoffMs = nowMs - stepMinutes * 60 * 1000;

  let referenceIndex = parsedEntries.findIndex(
    (entry) => entry.timeMs > closedCutoffMs,
  );

  if (referenceIndex === -1) {
    referenceIndex = parsedEntries.length - 1;
  } else {
    referenceIndex = Math.max(referenceIndex - 1, 0);
  }

  const stepMs = stepMinutes * 60 * 1000;
  const referenceMs = getLastClosedSlotMs(nowMs, stepMinutes);
  const exposedReferenceTimeslot = toIsoString(referenceMs);
  const timeslotSourceMap = new Map();
  const exposedTimeframes = [];

  for (let offset = -pastPeriods; offset <= futurePeriods; offset += 1) {
    const exposedTimeslot = toIsoString(referenceMs + offset * stepMs);
    const sourceIndex = Math.min(
      Math.max(referenceIndex + offset, 0),
      sortedTimeframes.length - 1,
    );

    exposedTimeframes.push(exposedTimeslot);
    timeslotSourceMap.set(exposedTimeslot, sortedTimeframes[sourceIndex]);
  }

  return {
    referenceTimeslot: exposedReferenceTimeslot,
    sourceReferenceTimeslot:
      sortedTimeframes[referenceIndex] || sortedTimeframes[0] || null,
    sourceTimeframes: sortedTimeframes,
    windowedTimeframes: exposedTimeframes,
    timeslotSourceMap,
  };
};

const initializeMockCongestionData = async () => {
  if (mockCongestionState.initialized) {
    return;
  }

  if (mockCongestionState.initPromise) {
    await mockCongestionState.initPromise;
    return;
  }

  mockCongestionState.initPromise = (async () => {
    console.log("🚦 [Mock Congestion] Initializing indexed data...");

    const congestionPayload = safeReadJSON(MOCK_CONGESTION_FILE);
    const mviPayload = safeReadJSON(MVI_GEOJSON_FILE);
    const regionsPayload = safeReadJSON(REGIONS_GEOJSON_FILE);

    const mviByCode = new Map();
    for (const feature of mviPayload.features || []) {
      const mviCode = toFiniteNumber(feature?.properties?.MVICODIGO);
      const geometry = feature?.geometry;

      if (mviCode === null || !geometry || geometry.type !== "LineString") {
        continue;
      }

      mviByCode.set(mviCode, {
        title: feature?.properties?.MVIETIQUET || `MVI ${mviCode}`,
        coordinates: geometry.coordinates,
      });
    }

    const regionFeatures = (regionsPayload.features || []).filter(
      (feature) =>
        feature?.geometry && feature?.properties?.area_id !== undefined,
    );

    const areaByMviCode = assignAreasToMviSegments(mviByCode, regionFeatures);

    const recordsByTimeslot = new Map();
    const rawRecordsByTimeslot = congestionPayload.data || {};
    const timeframes = Array.isArray(congestionPayload.timeframes)
      ? congestionPayload.timeframes
      : Object.keys(rawRecordsByTimeslot).sort();

    for (const timeslot of timeframes) {
      const rows = Array.isArray(rawRecordsByTimeslot[timeslot])
        ? rawRecordsByTimeslot[timeslot]
        : [];
      recordsByTimeslot.set(timeslot, rows);
    }

    const regionIndex = new Map();
    for (const feature of regionFeatures) {
      const areaId = String(feature.properties.area_id);
      regionIndex.set(areaId, {
        areaId,
        name: `Region ${areaId}`,
      });
    }

    const stepMinutes = inferStepMinutes(timeframes);
    const {
      referenceTimeslot,
      sourceReferenceTimeslot,
      sourceTimeframes,
      windowedTimeframes,
      timeslotSourceMap,
    } = resolveReferenceTimeslotWindow(
      timeframes,
      stepMinutes,
      DEFAULT_PAST_PERIODS,
      DEFAULT_FUTURE_PERIODS,
    );

    mockCongestionState.generatedAt =
      congestionPayload.generatedAt || new Date().toISOString();
    mockCongestionState.stepMinutes = stepMinutes;
    mockCongestionState.referenceTimeslot = referenceTimeslot;
    mockCongestionState.sourceReferenceTimeslot = sourceReferenceTimeslot;
    mockCongestionState.pastPeriods = DEFAULT_PAST_PERIODS;
    mockCongestionState.futurePeriods = DEFAULT_FUTURE_PERIODS;
    mockCongestionState.sourceTimeframes = sourceTimeframes;
    mockCongestionState.timeframes = windowedTimeframes;
    mockCongestionState.timeslotSourceMap = timeslotSourceMap;
    mockCongestionState.regions = Array.from(regionIndex.values()).sort(
      (a, b) => a.areaId.localeCompare(b.areaId, undefined, { numeric: true }),
    );
    mockCongestionState.recordsByTimeslot = recordsByTimeslot;
    mockCongestionState.mviByCode = mviByCode;
    mockCongestionState.areaByMviCode = areaByMviCode;
    mockCongestionState.responseCache = new Map();
    mockCongestionState.initialized = true;

    console.log(
      `✅ [Mock Congestion] Ready. timeframes=${timeframes.length}, regions=${mockCongestionState.regions.length}, mvi=${mviByCode.size}`,
    );
  })();

  await mockCongestionState.initPromise;
};

/**
 * @returns {{generatedAt: string | null, stepMinutes: number, referenceTimeslot: string | null, pastPeriods: number, futurePeriods: number, regions: MockPredictionRegion[], timeframes: string[]}}
 */
const getMockCongestionMetadata = () => ({
  generatedAt: mockCongestionState.generatedAt,
  stepMinutes: mockCongestionState.stepMinutes,
  referenceTimeslot: mockCongestionState.referenceTimeslot,
  pastPeriods: mockCongestionState.pastPeriods,
  futurePeriods: mockCongestionState.futurePeriods,
  regions: mockCongestionState.regions,
  timeframes: mockCongestionState.timeframes,
});

/**
 * @param {string} areaId
 * @param {string} timeslot
 * @returns {MockPredictionSegment[]}
 */
const resolveSourceTimeslot = (timeslot) =>
  mockCongestionState.timeslotSourceMap.get(timeslot) || timeslot;

const getCongestionRowsForAreaAndTimeslot = (areaId, timeslot) => {
  const cacheKey = `${areaId}|${timeslot}`;
  const cached = mockCongestionState.responseCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const sourceTimeslot = resolveSourceTimeslot(timeslot);

  if (!sourceTimeslot) {
    return [];
  }

  const timeslotRows =
    mockCongestionState.recordsByTimeslot.get(sourceTimeslot) || [];
  const day = timeslot.split("T")[0] || "";
  const hour = (() => {
    const timePart = timeslot.split("T")[1] || "";
    const hourPart = timePart.split(":")[0] || "00";
    const minutePart = timePart.split(":")[1] || "00";
    return `${hourPart}:${minutePart}`;
  })();

  const items = [];

  for (const row of timeslotRows) {
    const mviCodigo = toFiniteNumber(row?.mviCodigo);
    if (mviCodigo === null) {
      continue;
    }

    const rowAreaId = mockCongestionState.areaByMviCode.get(mviCodigo);
    if (!rowAreaId || rowAreaId !== areaId) {
      continue;
    }

    const mviData = mockCongestionState.mviByCode.get(mviCodigo);
    if (
      !mviData ||
      !Array.isArray(mviData.coordinates) ||
      mviData.coordinates.length < 2
    ) {
      continue;
    }

    const baseVelocity = toFiniteNumber(row?.velMean) ?? 0;
    const baseLevel = toFiniteNumber(row?.levelMean) ?? 0;
    const baseDelay = toFiniteNumber(row?.delaySum) ?? 0;
    const varied = applyPredictionVariation({
      mviCodigo,
      timeslot,
      velocity: baseVelocity,
      level: baseLevel,
      delay: baseDelay,
      jams: 0,
    });

    items.push({
      mviCodigo,
      id: mviCodigo,
      areaId,
      title: mviData.title,
      coordinates: mviData.coordinates,
      velocity: varied.velocity,
      level: varied.level,
      delay: varied.delay,
      day,
      hour,
      timeslot,
    });
  }

  mockCongestionState.responseCache.set(cacheKey, items);
  return items;
};

/**
 * @param {string|number} mviCodigo
 * @param {string|null} areaId
 * @returns {MockPredictionHistoryPoint[]}
 */
const getCongestionSegmentHistory = (mviCodigo, areaId) => {
  const numericCode = toFiniteNumber(mviCodigo);
  if (numericCode === null) {
    return [];
  }

  const resolvedAreaId = mockCongestionState.areaByMviCode.get(numericCode);
  if (areaId && resolvedAreaId && String(areaId) !== String(resolvedAreaId)) {
    return [];
  }

  return mockCongestionState.timeframes
    .map((timeslot) => {
      const sourceTimeslot = resolveSourceTimeslot(timeslot);
      const rows =
        mockCongestionState.recordsByTimeslot.get(sourceTimeslot) || [];
      const match = rows.find(
        (row) => toFiniteNumber(row?.mviCodigo) === numericCode,
      );

      if (!match) {
        return null;
      }

      const day = timeslot.split("T")[0] || "";
      const timePart = timeslot.split("T")[1] || "";
      const hourPart = timePart.split(":")[0] || "00";
      const minutePart = timePart.split(":")[1] || "00";

      const baseVelocity = toFiniteNumber(match.velMean) ?? 0;
      const baseLevel = toFiniteNumber(match.levelMean) ?? 0;
      const baseDelay = toFiniteNumber(match.delaySum) ?? 0;
      const baseJams = toFiniteNumber(match.countJams) ?? 0;
      const varied = applyPredictionVariation({
        mviCodigo: numericCode,
        timeslot,
        velocity: baseVelocity,
        level: baseLevel,
        delay: baseDelay,
        jams: baseJams,
      });

      return {
        timeslot,
        label: `${hourPart}:${minutePart}`,
        day,
        velocity: varied.velocity,
        level: varied.level,
        delay: varied.delay,
        jams: varied.jams,
      };
    })
    .filter(Boolean);
};

const isValidMockTimeslot = (timeslot) =>
  mockCongestionState.timeframes.includes(timeslot) ||
  mockCongestionState.sourceTimeframes.includes(timeslot);

module.exports = {
  initializeMockCongestionData,
  getMockCongestionMetadata,
  getMockCongestionCorridors,
  getCongestionRowsForAreaAndTimeslot,
  getCongestionSegmentHistory,
  isValidMockTimeslot,
};
