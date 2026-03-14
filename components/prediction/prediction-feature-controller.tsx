"use client";

import { MutableRefObject } from "react";
import { PredictionSegmentAnalyticsModal } from "./prediction-segment-analytics-modal";
import { PredictionTimelinePanel } from "./prediction-timeline-panel";
import { isPredictionLayerOption } from "../../lib/prediction/prediction-formatters";
import { PredictionFeatureProps } from "./prediction-types";
import { usePredictionFeature } from "./use-prediction-feature";
import { usePredictionLayer } from "./use-prediction-layer";

interface PredictionFeatureControllerProps extends PredictionFeatureProps {
  mapInstanceRef: MutableRefObject<google.maps.Map | null>;
  predictionPolylinesRef: MutableRefObject<google.maps.Polyline[]>;
  infoWindowRef: MutableRefObject<google.maps.InfoWindow | null>;
}

export function PredictionFeatureController({
  mapInstanceRef,
  predictionPolylinesRef,
  infoWindowRef,
  opcDropdownVel,
  predictionCongestionData,
  predictionRegions,
  selectedPredictionRegion,
  onPredictionRegionChange,
  predictionTimeframes,
  predictionReferenceTimeslot,
  selectedPredictionTimeslot,
  onPredictionTimeslotChange,
  predictionStepMinutes,
}: PredictionFeatureControllerProps) {
  const isPredictionLayerActive = isPredictionLayerOption(opcDropdownVel);

  const {
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
  } = usePredictionFeature({
    isPredictionLayerActive,
    predictionTimeframes,
    selectedPredictionRegion,
    selectedPredictionTimeslot,
    onPredictionTimeslotChange,
  });

  usePredictionLayer({
    mapInstanceRef,
    predictionPolylinesRef,
    infoWindowRef,
    opcDropdownVel,
    predictionCongestionData,
    onSegmentClick: setSelectedPredictionSegment,
  });

  return (
    <>
      {isPredictionLayerActive && (
        <PredictionTimelinePanel
          selectedPredictionRegion={selectedPredictionRegion}
          onPredictionRegionChange={onPredictionRegionChange}
          predictionRegions={predictionRegions}
          predictionStepMinutes={predictionStepMinutes}
          predictionTimeframes={predictionTimeframes}
          displayedTimeslotIndex={displayedTimeslotIndex}
          canControlTimeline={canControlTimeline}
          isPredictionPlaying={isPredictionPlaying}
          setIsPredictionPlaying={setIsPredictionPlaying}
          moveTimeslot={moveTimeslot}
          handleTimeslotRangeChange={handleTimeslotRangeChange}
          commitTimeslotChange={commitTimeslotChange}
        />
      )}

      <PredictionSegmentAnalyticsModal
        selectedPredictionSegment={selectedPredictionSegment}
        segmentHistoryData={segmentHistoryData}
        segmentHistoryLoading={segmentHistoryLoading}
        segmentHistoryError={segmentHistoryError}
        predictionTimeframes={predictionTimeframes}
        predictionReferenceTimeslot={predictionReferenceTimeslot}
        onClose={handleClosePredictionModal}
      />
    </>
  );
}
