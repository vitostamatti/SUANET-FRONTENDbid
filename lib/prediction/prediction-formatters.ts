import { CongestionPredictionHistoryPoint } from "./congestion-predictions-service";

export const isPredictionLayerOption = (value: string) =>
  value === "PREDICCIONES_CONGESTION" ||
  value === "oprimirPREDICCIONES_CONGESTION";

export const colorForPredictionLevel = (level: number) => {
  if (level <= 2) {
    return "#6bca70";
  }

  if (level <= 3.5) {
    return "#f19d5d";
  }

  return "#dd4e47";
};

export const levelSemaphoreColor = (value: number) => {
  if (value <= 2) {
    return "#22c55e";
  }

  if (value <= 3.5) {
    return "#f59e0b";
  }

  return "#ef4444";
};

export const formatTimeslotLabel = (value: string) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export const formatDayTimeLabel = (day: string, hour: string) => {
  if (!day && !hour) {
    return "-";
  }

  const dayPart = day ? day.slice(5) : "";
  return `${dayPart} ${hour || ""}`.trim();
};

export const toChartSeriesData = (
  history: CongestionPredictionHistoryPoint[],
) =>
  history.map((point) => ({
    ...point,
    xLabel: formatDayTimeLabel(point.day, point.label),
  }));

export const getHistoryAverages = (
  history: CongestionPredictionHistoryPoint[],
) => {
  const validHistory = history.filter((point) => point.hasData !== false);

  if (validHistory.length === 0) {
    return {
      averageLevel: 0,
      averageVelocity: 0,
      averageDelay: 0,
    };
  }

  const averageLevel =
    validHistory.reduce((sum, point) => sum + Number(point.level || 0), 0) /
    validHistory.length;

  const averageVelocity =
    validHistory.reduce((sum, point) => sum + Number(point.velocity || 0), 0) /
    validHistory.length;

  const averageDelay =
    validHistory.reduce((sum, point) => sum + Number(point.delay || 0), 0) /
    validHistory.length;

  return {
    averageLevel,
    averageVelocity,
    averageDelay,
  };
};
