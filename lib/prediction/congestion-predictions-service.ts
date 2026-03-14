export interface CongestionPredictionRegion {
  areaId: string;
  name: string;
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
  };
}

export interface CongestionPredictionSegment {
  mviCodigo: number;
  title: string;
  coordinates: [number, number][];
  velocity: number;
  level: number;
  delay: number;
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
  delay: number | null;
  jams: number;
  hasData?: boolean;
}

export interface CongestionPredictionSegmentHistoryResponse {
  data: {
    mviCodigo: number;
    areaId: string | null;
    totalItems: number;
    items: CongestionPredictionHistoryPoint[];
  };
}

const assertOk = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export const getCongestionPredictionsMetadata = async (
  backendUrl: string,
): Promise<CongestionPredictionsMetadataResponse["data"]> => {
  const response = await fetch(`${backendUrl}/api/mock/congestion/metadata`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const payload =
    await assertOk<CongestionPredictionsMetadataResponse>(response);
  return payload.data;
};

export const getCongestionPredictionsByRegionAndTime = async (
  backendUrl: string,
  areaId: string,
  timeslot: string,
): Promise<CongestionPredictionsDataResponse["data"]> => {
  const searchParams = new URLSearchParams({
    areaId,
    timeslot,
  });

  const response = await fetch(
    `${backendUrl}/api/mock/congestion?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const payload = await assertOk<CongestionPredictionsDataResponse>(response);
  return payload.data;
};

export const getCongestionPredictionSegmentHistory = async (
  backendUrl: string,
  mviCodigo: number,
  areaId?: string,
): Promise<CongestionPredictionSegmentHistoryResponse["data"]> => {
  const searchParams = new URLSearchParams({
    mviCodigo: String(mviCodigo),
  });

  if (areaId) {
    searchParams.set("areaId", areaId);
  }

  const response = await fetch(
    `${backendUrl}/api/mock/congestion/segment-history?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const payload =
    await assertOk<CongestionPredictionSegmentHistoryResponse>(response);
  return payload.data;
};
