"use client";

import { useEffect, useState } from "react";
import { CongestionPredictionSegment } from "../../lib/prediction/congestion-predictions-service";
import { usePredictionSegmentHistory } from "./use-prediction-segment-history";
import { usePredictionTimeline } from "./use-prediction-timeline";

interface UsePredictionFeatureParams {
  isPredictionLayerActive: boolean;
  predictionTimeframes: string[];
  selectedPredictionTimeslot: string;
  onPredictionTimeslotChange: (timeslot: string) => void;
}

export const usePredictionFeature = ({
  isPredictionLayerActive,
  predictionTimeframes,
  selectedPredictionTimeslot,
  onPredictionTimeslotChange,
}: UsePredictionFeatureParams) => {
  const [selectedPredictionSegment, setSelectedPredictionSegment] =
    useState<CongestionPredictionSegment | null>(null);

  const {
    segmentHistoryData,
    segmentHistoryLoading,
    segmentHistoryError,
    resetSegmentHistory,
  } = usePredictionSegmentHistory({
    predictionTimeframes,
    selectedPredictionSegment,
  });

  const {
    isPredictionPlaying,
    setIsPredictionPlaying,
    displayedTimeslotIndex,
    canControlTimeline,
    handleTimeslotRangeChange,
    commitTimeslotChange,
    moveTimeslot,
  } = usePredictionTimeline({
    isPredictionLayerActive,
    predictionTimeframes,
    selectedPredictionTimeslot,
    onPredictionTimeslotChange,
  });

  useEffect(() => {
    if (!isPredictionLayerActive) {
      if (selectedPredictionSegment !== null) {
        setSelectedPredictionSegment(null);
      }
      resetSegmentHistory();
    }
  }, [isPredictionLayerActive, resetSegmentHistory, selectedPredictionSegment]);

  const handleClosePredictionModal = () => {
    setSelectedPredictionSegment(null);
    resetSegmentHistory();
  };

  return {
    selectedPredictionSegment,
    setSelectedPredictionSegment,
    segmentHistoryData,
    segmentHistoryLoading,
    segmentHistoryError,
    handleClosePredictionModal,
    isPredictionPlaying,
    setIsPredictionPlaying,
    displayedTimeslotIndex,
    canControlTimeline,
    handleTimeslotRangeChange,
    commitTimeslotChange,
    moveTimeslot,
  };
};
