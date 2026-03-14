"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CongestionPredictionHistoryPoint,
  CongestionPredictionSegment,
  getCongestionPredictionSegmentHistory,
} from "../../lib/prediction/congestion-predictions-service";

interface UsePredictionSegmentHistoryParams {
  predictionTimeframes: string[];
  selectedPredictionRegion: string;
  selectedPredictionSegment: CongestionPredictionSegment | null;
}

export const usePredictionSegmentHistory = ({
  predictionTimeframes,
  selectedPredictionRegion,
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
          selectedPredictionSegment.mviCodigo,
          selectedPredictionSegment.areaId || selectedPredictionRegion,
        );

        const historyByTimeslot = new Map(
          (historyResponse.items || []).map((item) => [item.timeslot, item]),
        );

        const history = predictionTimeframes
          .map((timeslot, index) => {
            const fallbackDate = new Date(predictionTimeframes[index] || "");
            const fallbackDay = Number.isNaN(fallbackDate.getTime())
              ? ""
              : fallbackDate.toISOString().slice(0, 10);
            const fallbackHour = Number.isNaN(fallbackDate.getTime())
              ? ""
              : fallbackDate.toISOString().slice(11, 16);

            const found = historyByTimeslot.get(timeslot);

            if (!found) {
              return {
                timeslot,
                label: fallbackHour,
                day: fallbackDay,
                velocity: null,
                level: null,
                delay: null,
                jams: 0,
                hasData: false,
                index,
              };
            }

            return {
              timeslot: found.timeslot,
              label: found.label,
              day: found.day,
              velocity: Number(found.velocity || 0),
              level: Number(found.level || 0),
              delay: Number(found.delay || 0),
              jams: 0,
              hasData: true,
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
  }, [
    predictionTimeframes,
    selectedPredictionRegion,
    selectedPredictionSegment,
  ]);

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
