export interface CongestionPredictionRegion {
  areaId: string;
  name: string;
  areaType?: string;
}

export interface CongestionPredictionsMetadataResponse {
  data: {
    generatedAt: string;
    stepMinutes: number;
    referenceTimeslot: string | null;
    pastPeriods: number;
    futurePeriods: number;
    regions: CongestionPredictionRegion[];
    timeframes: string[];
    jamsTimeframes?: string[];
    expectedPeriods?: number;
    availablePeriods?: number;
    emptyPeriods?: number;
    jamsPeriodsAvailable?: number;
  };
}

export interface CongestionPredictionSegment {
  roadId: string;
  title: string;
  coordinates: [number, number][];
  velocity: number;
  level: number;
  hour: string;
  day: string;
  id: number;
  timeslot: string;
  areaId: string;
}

export interface CongestionPredictionsDataResponse {
  data: {
    generatedAt: string;
    timeslot: string;
    areaId: string;
    totalItems: number;
    items: CongestionPredictionSegment[];
  };
}

export interface CongestionPredictionHistoryPoint {
  timeslot: string;
  label: string;
  day: string;
  velocity: number | null;
  level: number | null;
  jams: number;
  hasData?: boolean;
  source?: string;
}

export interface CongestionPredictionSegmentHistoryResponse {
  data: {
    areaId: string | null;
    totalItems: number;
    items: CongestionPredictionHistoryPoint[];
  };
}

interface BackendMetadataResponse {
  data: {
    generatedAt: string;
    expectedLastSlot?: string;
    expectedPeriods?: number;
    availablePeriods?: number;
    emptyPeriods?: number;
    jamsPeriodsAvailable?: number;
    predictionTimeslots?: string[];
    jamsTimeslots?: string[];
    regions?: Array<{ areaId: string; name: string }>;
    slots?: Array<{ timeslot: string; hasHighCongestion?: boolean }>;
  };
}

interface BackendListAreasResponse {
  areas?: Array<{
    id_area: string;
    tipo_area: string;
    nombre_area: string;
  }>;
  data?: {
    areas?: Array<{
      id_area: string;
      tipo_area: string;
      nombre_area: string;
    }>;
  };
}

interface BackendPredictionItem {
  road_id: string;
  predicted_velocity: number;
  predicted_level: number;
  day?: string;
  hour?: string;
  timeslot: string;
}

interface BackendPredictionsResponse {
  data: {
    generatedAt: string;
    timeslot: string;
    areaId?: string;
    totalItems: number;
    items?: BackendPredictionItem[];
  };
}

export const CITYWIDE_PREDICTION_AREA_ID = "citywide";

interface BackendHistoryResponse {
  data: {
    roadId: string;
    totalItems: number;
    history_items?: Array<{
      road_id: string;
      timeslot: string;
      predicted_level?: number;
      predicted_velocity?: number;
      level_mean?: number;
      vel_mean?: number;
      count_jams?: number;
      source?: string;
    }>;
    future_items?: Array<{
      road_id: string;
      timeslot: string;
      predicted_level?: number;
      predicted_velocity?: number;
      level_mean?: number;
      vel_mean?: number;
      count_jams?: number;
      source?: string;
    }>;
  };
}

interface MviEntry {
  geometry?: {
    coordinates?: [number, number][];
  };
  properties?: {
    id_mvi?: string;
    MVIETIQUET?: string;
  };
}

const assertOk = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
};

const resolveBackendUrl = (backendUrl: string): string => {
  if (backendUrl && backendUrl.trim().length > 0) {
    return backendUrl;
  }

  return process.env.NEXT_PUBLIC_BACKEND_URL || "";
};

const BOGOTA_UTC_OFFSET = "-05:00";

const DATE_HAS_TIMEZONE_SUFFIX = /(Z|[+-]\d{2}:?\d{2})$/i;

const toDateInputWithBogotaFallback = (
  value: string | null | undefined,
): string => {
  if (!value) {
    return "";
  }

  const normalized = value.trim().replace(" ", "T");
  if (!normalized) {
    return "";
  }

  if (DATE_HAS_TIMEZONE_SUFFIX.test(normalized)) {
    return normalized;
  }

  return `${normalized}${BOGOTA_UTC_OFFSET}`;
};

const toMillisWithBogotaFallback = (
  value: string | null | undefined,
): number => {
  const dateInput = toDateInputWithBogotaFallback(value);
  if (!dateInput) {
    return Number.NaN;
  }

  return new Date(dateInput).getTime();
};

const normalizeTimeslot = (value: string | null | undefined): string => {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const hh = String(parsed.getHours()).padStart(2, "0");
  const min = String(parsed.getMinutes()).padStart(2, "0");
  const ss = String(parsed.getSeconds()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
};

const toDayAndHour = (
  timeslot: string,
): {
  day: string;
  hour: string;
} => {
  const normalized = normalizeTimeslot(timeslot);
  if (normalized.length >= 16) {
    return {
      day: normalized.slice(0, 10),
      hour: normalized.slice(11, 16),
    };
  }

  return { day: "", hour: "" };
};

const mviIndexPromises = new Map<string, Promise<Map<string, MviEntry>>>();

const resolveMviSourceUrl = (baseUrl: string): string => {
  const debugSource = process.env.NEXT_PUBLIC_MVI_SOURCE_URL?.trim();
  if (!debugSource) {
    return "/api-endpoints/mvi.json";
  }

  if (debugSource.startsWith("http://") || debugSource.startsWith("https://")) {
    return debugSource;
  }

  return debugSource.startsWith("/") ? debugSource : `/${debugSource}`;
};

const getMviIndex = async (
  backendUrl: string,
): Promise<Map<string, MviEntry>> => {
  const baseUrl = resolveBackendUrl(backendUrl);
  const mviUrl = resolveMviSourceUrl(baseUrl);
  const cacheKey = `${baseUrl || "relative"}::${mviUrl}`;

  if (!mviIndexPromises.has(cacheKey)) {
    const promise = fetch(mviUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`MVI request failed: ${response.status}`);
        }

        const contentType = response.headers.get("content-type") || "";
        const contentLength = response.headers.get("content-length") || "";

        const payloadText = await response.text();
        let payload: unknown;

        try {
          payload = JSON.parse(payloadText);
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            console.error("[MVI] Invalid JSON payload", {
              url: mviUrl,
              status: response.status,
              contentType,
              contentLength,
              payloadLength: payloadText.length,
              payloadStart: payloadText.slice(0, 200),
              payloadEnd: payloadText.slice(-200),
            });
          }

          throw error;
        }

        if (!Array.isArray(payload)) {
          const payloadType =
            payload === null
              ? "null"
              : typeof payload === "object"
                ? `object(${Object.keys(payload as Record<string, unknown>).join(",")})`
                : typeof payload;

          throw new Error(
            `MVI payload must be an array, received ${payloadType} (content-type: ${contentType || "unknown"})`,
          );
        }

        const entries = payload as MviEntry[];
        const map = new Map<string, MviEntry>();

        entries.forEach((entry: MviEntry) => {
          const id = entry?.properties?.id_mvi;
          if (!id) {
            return;
          }

          map.set(String(id), entry);
        });

        if (process.env.NODE_ENV !== "production") {
          console.info("[MVI] Loaded id_mvi count", {
            ids: map.size,
          });
        }

        return map;
      })
      .catch((error) => {
        console.error("Error loading MVI index:", error);
        return new Map<string, MviEntry>();
      });

    mviIndexPromises.set(cacheKey, promise);
  }

  return mviIndexPromises.get(cacheKey) as Promise<Map<string, MviEntry>>;
};

const mapMetadata = (
  payload: BackendMetadataResponse,
): CongestionPredictionsMetadataResponse["data"] => {
  const slots = payload.data.slots || [];
  const rawPredictionTimeslots = payload.data.predictionTimeslots || [];
  const rawJamsTimeslots = payload.data.jamsTimeslots || [];

  const timeframes = (
    rawPredictionTimeslots.length > 0
      ? rawPredictionTimeslots
      : slots.map((slot) => slot.timeslot)
  )
    .map((timeslot) => normalizeTimeslot(timeslot))
    .filter(Boolean);

  const jamsTimeframes = rawJamsTimeslots
    .map((timeslot) => normalizeTimeslot(timeslot))
    .filter(Boolean);

  const getLatestClosedTimeslot = (cutoffMillis: number): string | null => {
    if (!Number.isFinite(cutoffMillis) || cutoffMillis <= 0) {
      return null;
    }

    return (
      [...timeframes]
        .filter((timeslot) => {
          const timeslotMillis = toMillisWithBogotaFallback(timeslot);
          return (
            Number.isFinite(timeslotMillis) && timeslotMillis <= cutoffMillis
          );
        })
        .sort((a, b) => a.localeCompare(b))
        .slice(-1)[0] || null
    );
  };

  const getNearestTimeslot = (targetMillis: number): string | null => {
    if (!Number.isFinite(targetMillis) || targetMillis <= 0) {
      return null;
    }

    let nearestTimeslot: string | null = null;
    let nearestTimeslotMillis = Number.POSITIVE_INFINITY;
    let nearestDistance = Number.POSITIVE_INFINITY;

    timeframes.forEach((timeslot) => {
      const timeslotMillis = toMillisWithBogotaFallback(timeslot);
      if (!Number.isFinite(timeslotMillis)) {
        return;
      }

      const distance = Math.abs(timeslotMillis - targetMillis);
      const isBetterMatch =
        distance < nearestDistance ||
        (distance === nearestDistance &&
          timeslotMillis < nearestTimeslotMillis);

      if (isBetterMatch) {
        nearestTimeslot = timeslot;
        nearestTimeslotMillis = timeslotMillis;
        nearestDistance = distance;
      }
    });

    return nearestTimeslot;
  };

  let stepMinutes = 15;
  if (timeframes.length >= 2) {
    const first = toMillisWithBogotaFallback(timeframes[0]);
    const second = toMillisWithBogotaFallback(timeframes[1]);
    if (!Number.isNaN(first) && !Number.isNaN(second)) {
      const computed = Math.round((second - first) / 60000);
      if (computed > 0 && Number.isFinite(computed)) {
        stepMinutes = computed;
      }
    }
  }

  const generatedAt = payload.data.generatedAt;
  const generatedAtMillis = toMillisWithBogotaFallback(generatedAt);
  const nowMillis = Date.now();
  const nearestByNow = getNearestTimeslot(nowMillis);
  const latestClosedByGeneratedAt = getLatestClosedTimeslot(generatedAtMillis);

  const backendExpectedLast = normalizeTimeslot(payload.data.expectedLastSlot);
  const backendExpectedLastMillis =
    toMillisWithBogotaFallback(backendExpectedLast);
  const safeBackendExpectedLast =
    backendExpectedLast &&
    timeframes.includes(backendExpectedLast) &&
    Number.isFinite(backendExpectedLastMillis) &&
    Number.isFinite(generatedAtMillis) &&
    backendExpectedLastMillis <= generatedAtMillis
      ? backendExpectedLast
      : null;

  const referenceTimeslot =
    nearestByNow ||
    latestClosedByGeneratedAt ||
    safeBackendExpectedLast ||
    timeframes[0] ||
    null;

  return {
    generatedAt: payload.data.generatedAt,
    stepMinutes,
    referenceTimeslot,
    pastPeriods: 0,
    futurePeriods: timeframes.length,
    regions: payload.data.regions || [],
    timeframes,
    jamsTimeframes,
    expectedPeriods: payload.data.expectedPeriods,
    availablePeriods: payload.data.availablePeriods,
    emptyPeriods: payload.data.emptyPeriods,
    jamsPeriodsAvailable: payload.data.jamsPeriodsAvailable,
  };
};

const mapListAreas = (
  payload: BackendListAreasResponse,
): CongestionPredictionRegion[] => {
  const areas = payload.areas || payload.data?.areas || [];

  return areas
    .map((area) => ({
      areaId: area.id_area,
      name: area.nombre_area,
      areaType: area.tipo_area,
    }))
    .filter((area) => Boolean(area.areaId) && Boolean(area.name));
};

const mapPredictions = async (
  backendUrl: string,
  payload: BackendPredictionsResponse,
  fallbackAreaId: string,
): Promise<CongestionPredictionsDataResponse["data"]> => {
  const mviIndex = await getMviIndex(backendUrl);
  const rawItems = payload.data.items || [];
  const areaId = payload.data.areaId || fallbackAreaId;

  const items: CongestionPredictionSegment[] = rawItems.map((item, index) => {
    const roadId = String(item.road_id || "");
    const mvi = mviIndex.get(roadId) || null;
    const rawCoordinates = mvi?.geometry?.coordinates || [];
    const coordinates = rawCoordinates.filter(
      (point): point is [number, number] =>
        Array.isArray(point) &&
        point.length >= 2 &&
        Number.isFinite(Number(point[0])) &&
        Number.isFinite(Number(point[1])),
    );

    const normalizedTimeslot = normalizeTimeslot(item.timeslot);
    const fallbackDayHour = toDayAndHour(normalizedTimeslot);

    return {
      roadId,
      title: mvi?.properties?.MVIETIQUET?.trim() || roadId,
      coordinates,
      velocity: Number(item.predicted_velocity || 0),
      level: Number(item.predicted_level || 0),
      hour: item.hour || fallbackDayHour.hour,
      day: item.day || fallbackDayHour.day,
      id: index + 1,
      timeslot: normalizedTimeslot,
      areaId,
    };
  });

  if (process.env.NODE_ENV !== "production") {
    const totalPredictions = rawItems.length;
    const uniqueRoadIds = new Set(
      rawItems.map((item) => String(item.road_id || "")).filter(Boolean),
    ).size;
    const matchedDrawable = items.filter(
      (segment) =>
        Array.isArray(segment.coordinates) && segment.coordinates.length >= 2,
    ).length;

    console.info("[Predictions] ID match summary", {
      areaId,
      timeslot: payload.data.timeslot,
      totalPredictions,
      uniqueRoadIds,
      mviIds: mviIndex.size,
      matchedDrawable,
      unmatchedOrNoGeometry: totalPredictions - matchedDrawable,
    });
  }

  return {
    generatedAt: payload.data.generatedAt,
    timeslot: normalizeTimeslot(payload.data.timeslot),
    areaId,
    totalItems: payload.data.totalItems,
    items,
  };
};

const mapHistoryPoint = (item: {
  timeslot: string;
  predicted_level?: number;
  predicted_velocity?: number;
  level_mean?: number;
  vel_mean?: number;
  count_jams?: number;
  source?: string;
}): CongestionPredictionHistoryPoint => {
  const normalizedTimeslot = normalizeTimeslot(item.timeslot);
  const { day, hour } = toDayAndHour(normalizedTimeslot);

  const rawVelocity = item.vel_mean ?? item.predicted_velocity;
  const rawLevel = item.level_mean ?? item.predicted_level;
  const rawJams = item.count_jams;

  const velocity =
    rawVelocity === undefined || rawVelocity === null
      ? null
      : Number(rawVelocity);
  const level =
    rawLevel === undefined || rawLevel === null ? null : Number(rawLevel);
  const jams =
    rawJams === undefined || rawJams === null ? 0 : Number(rawJams || 0);

  const hasData = velocity !== null || level !== null;

  return {
    timeslot: normalizedTimeslot,
    label: hour,
    day,
    velocity,
    level,
    jams,
    hasData,
    source: item.source,
  };
};

export const getCongestionPredictionsMetadata = async (
  backendUrl: string,
): Promise<CongestionPredictionsMetadataResponse["data"]> => {
  const baseUrl = resolveBackendUrl(backendUrl);
  const response = await fetch(
    `${baseUrl}/api/prediccion-congestion/metadata`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const payload = await assertOk<BackendMetadataResponse>(response);
  return mapMetadata(payload);
};

export const getCongestionPredictionAreas = async (
  backendUrl: string,
): Promise<CongestionPredictionRegion[]> => {
  const baseUrl = resolveBackendUrl(backendUrl);
  const response = await fetch(
    `${baseUrl}/api/prediccion-congestion/list-areas`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const payload = await assertOk<BackendListAreasResponse>(response);
  return mapListAreas(payload);
};

export const getCongestionPredictionsByRegionAndTime = async (
  backendUrl: string,
  areaId: string,
  timeslot: string,
): Promise<CongestionPredictionsDataResponse["data"]> => {
  const baseUrl = resolveBackendUrl(backendUrl);
  const searchParams = new URLSearchParams({
    areaId,
    timeslot: normalizeTimeslot(timeslot),
  });

  const response = await fetch(
    `${baseUrl}/api/prediccion-congestion/predictions-areas?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (response.status === 404) {
    return {
      generatedAt: "",
      timeslot: normalizeTimeslot(timeslot),
      areaId,
      totalItems: 0,
      items: [],
    };
  }

  const payload = await assertOk<BackendPredictionsResponse>(response);
  return mapPredictions(baseUrl, payload, areaId);
};

export const getCongestionPredictionsTotalesByTime = async (
  backendUrl: string,
  timeslot: string,
): Promise<CongestionPredictionsDataResponse["data"]> => {
  const baseUrl = resolveBackendUrl(backendUrl);
  const searchParams = new URLSearchParams({
    timeslot: normalizeTimeslot(timeslot),
  });

  const response = await fetch(
    `${baseUrl}/api/prediccion-congestion/predictions-totales?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (response.status === 404) {
    return {
      generatedAt: "",
      timeslot: normalizeTimeslot(timeslot),
      areaId: CITYWIDE_PREDICTION_AREA_ID,
      totalItems: 0,
      items: [],
    };
  }

  const payload = await assertOk<BackendPredictionsResponse>(response);
  return mapPredictions(baseUrl, payload, CITYWIDE_PREDICTION_AREA_ID);
};

export const getCongestionPredictionSegmentHistory = async (
  backendUrl: string,
  roadIdInput: string | number,
): Promise<CongestionPredictionSegmentHistoryResponse["data"]> => {
  const baseUrl = resolveBackendUrl(backendUrl);
  const roadId = String(roadIdInput);
  const searchParams = new URLSearchParams({
    roadId,
  });

  const response = await fetch(
    `${baseUrl}/api/prediccion-congestion/segment-history?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (response.status === 404) {
    return {
      areaId: null,
      totalItems: 0,
      items: [],
    };
  }

  const payload = await assertOk<BackendHistoryResponse>(response);
  const history = payload.data.history_items || [];
  const future = payload.data.future_items || [];
  const items = [...history, ...future]
    .map(mapHistoryPoint)
    .sort((a, b) => a.timeslot.localeCompare(b.timeslot));

  return {
    areaId: null,
    totalItems: payload.data.totalItems,
    items,
  };
};
