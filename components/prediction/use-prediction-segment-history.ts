"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CongestionPredictionHistoryPoint,
  CongestionPredictionSegment,
  getCongestionPredictionSegmentHistory,
} from "../../lib/prediction/congestion-predictions-service";

interface UsePredictionSegmentHistoryParams {
  predictionTimeframes: string[];
  selectedPredictionSegment: CongestionPredictionSegment | null;
}

export const usePredictionSegmentHistory = ({
  predictionTimeframes,
  selectedPredictionSegment,
}: UsePredictionSegmentHistoryParams) => {
  const [segmentHistoryData, setSegmentHistoryData] = useState<
    CongestionPredictionHistoryPoint[]
  >([]);
  const [segmentHistoryLoading, setSegmentHistoryLoading] = useState(false);
  const [segmentHistoryError, setSegmentHistoryError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!selectedPredictionSegment) {
      setSegmentHistoryData([]);
      setSegmentHistoryError(null);
      setSegmentHistoryLoading(false);
      return;
    }

    let isCancelled = false;

    const fetchSegmentHistory = async () => {
      try {
        setSegmentHistoryLoading(true);
        setSegmentHistoryError(null);

        const historyResponse = await getCongestionPredictionSegmentHistory(
          "",
          selectedPredictionSegment.roadId,
        );

        const historyByTimeslot = new Map(
          (historyResponse.items || []).map((item) => [item.timeslot, item]),
        );

        const history = predictionTimeframes
          .map((timeslot, index) => {
            const normalizedTimeslot = (predictionTimeframes[index] || "")
              .trim()
              .replace(" ", "T");
            const fallbackDay =
              normalizedTimeslot.length >= 10
                ? normalizedTimeslot.slice(0, 10)
                : "";
            const fallbackHour =
              normalizedTimeslot.length >= 16
                ? normalizedTimeslot.slice(11, 16)
                : "";

            const found = historyByTimeslot.get(timeslot);

            if (!found) {
              return {
                timeslot,
                label: fallbackHour,
                day: fallbackDay,
                velocity: null,
                level: null,
                jams: 0,
                hasData: false,
                index,
              };
            }

            return {
              timeslot: found.timeslot,
              label: found.label,
              day: found.day,
              velocity:
                found.velocity === null || found.velocity === undefined
                  ? null
                  : Number(found.velocity),
              level:
                found.level === null || found.level === undefined
                  ? null
                  : Number(found.level),
              jams: Number(found.jams || 0),
              hasData: found.hasData !== false,
              source: found.source,
              index,
            };
          })
          .sort((a, b) => a.index - b.index)
          .map(({ index, ...point }) => point);

        if (!isCancelled) {
          setSegmentHistoryData(history);
        }
      } catch (_error) {
        if (!isCancelled) {
          setSegmentHistoryData([]);
          setSegmentHistoryError("No se pudo cargar el historial del segmento");
        }
      } finally {
        if (!isCancelled) {
          setSegmentHistoryLoading(false);
        }
      }
    };

    fetchSegmentHistory();

    return () => {
      isCancelled = true;
    };
  }, [predictionTimeframes, selectedPredictionSegment]);

  const resetSegmentHistory = useCallback(() => {
    setSegmentHistoryData([]);
    setSegmentHistoryError(null);
    setSegmentHistoryLoading(false);
  }, []);

  return {
    segmentHistoryData,
    segmentHistoryLoading,
    segmentHistoryError,
    resetSegmentHistory,
  };
};
