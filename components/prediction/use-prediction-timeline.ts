"use client";

import { useEffect, useState } from "react";

interface UsePredictionTimelineParams {
  isPredictionLayerActive: boolean;
  predictionTimeframes: string[];
  selectedPredictionTimeslot: string;
  onPredictionTimeslotChange: (timeslot: string) => void;
}

export const usePredictionTimeline = ({
  isPredictionLayerActive,
  predictionTimeframes,
  selectedPredictionTimeslot,
  onPredictionTimeslotChange,
}: UsePredictionTimelineParams) => {
  const [isPredictionPlaying, setIsPredictionPlaying] = useState(false);
  const [pendingTimeslotIndex, setPendingTimeslotIndex] = useState<
    number | null
  >(null);

  const selectedTimeslotIndex = selectedPredictionTimeslot
    ? predictionTimeframes.findIndex(
        (timeslot) => timeslot === selectedPredictionTimeslot,
      )
    : -1;

  const effectiveTimeslotIndex =
    selectedTimeslotIndex >= 0 ? selectedTimeslotIndex : 0;

  const displayedTimeslotIndex =
    pendingTimeslotIndex !== null
      ? pendingTimeslotIndex
      : effectiveTimeslotIndex;

  const canControlTimeline = predictionTimeframes.length > 1;

  const commitTimeslotChange = (index: number) => {
    const boundedIndex = Math.min(
      Math.max(index, 0),
      Math.max(predictionTimeframes.length - 1, 0),
    );
    const nextTimeslot = predictionTimeframes[boundedIndex];

    if (nextTimeslot && nextTimeslot !== selectedPredictionTimeslot) {
      onPredictionTimeslotChange(nextTimeslot);
    }

    setPendingTimeslotIndex(null);
  };

  const handleTimeslotRangeChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const nextIndex = Number(event.target.value);
    setPendingTimeslotIndex(nextIndex);
  };

  const moveTimeslot = (direction: -1 | 1) => {
    if (!canControlTimeline) {
      return;
    }

    const currentIndex = selectedTimeslotIndex >= 0 ? selectedTimeslotIndex : 0;
    const nextIndex = Math.min(
      Math.max(currentIndex + direction, 0),
      predictionTimeframes.length - 1,
    );

    if (nextIndex === currentIndex) {
      return;
    }

    const nextTimeslot = predictionTimeframes[nextIndex];

    if (nextTimeslot) {
      onPredictionTimeslotChange(nextTimeslot);
    }
  };

  useEffect(() => {
    setPendingTimeslotIndex(null);
  }, [selectedPredictionTimeslot]);

  useEffect(() => {
    if (
      !isPredictionLayerActive ||
      !isPredictionPlaying ||
      predictionTimeframes.length <= 1
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const currentIndex =
        selectedTimeslotIndex >= 0 ? selectedTimeslotIndex : 0;
      const nextIndex = Math.min(
        currentIndex + 1,
        predictionTimeframes.length - 1,
      );

      if (nextIndex === currentIndex) {
        setIsPredictionPlaying(false);
        return;
      }

      const nextTimeslot = predictionTimeframes[nextIndex];

      if (nextTimeslot) {
        onPredictionTimeslotChange(nextTimeslot);
      }
    }, 1200);

    return () => window.clearInterval(intervalId);
  }, [
    isPredictionLayerActive,
    isPredictionPlaying,
    onPredictionTimeslotChange,
    predictionTimeframes,
    selectedTimeslotIndex,
  ]);

  useEffect(() => {
    if (!isPredictionLayerActive && isPredictionPlaying) {
      setIsPredictionPlaying(false);
    }
  }, [isPredictionLayerActive, isPredictionPlaying]);

  return {
    isPredictionPlaying,
    setIsPredictionPlaying,
    displayedTimeslotIndex,
    canControlTimeline,
    selectedTimeslotIndex,
    handleTimeslotRangeChange,
    commitTimeslotChange,
    moveTimeslot,
  };
};
