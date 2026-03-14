"use client";

import { MutableRefObject, useEffect, useRef } from "react";
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
  predictionWidgetVisible,
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
  const lastZoomedRegionRef = useRef("");

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

  useEffect(() => {
    if (!isPredictionLayerActive) {
      lastZoomedRegionRef.current = "";
      return;
    }

    if (
      !selectedPredictionRegion ||
      lastZoomedRegionRef.current === selectedPredictionRegion
    ) {
      return;
    }

    const mapInstance = mapInstanceRef.current;
    if (
      !mapInstance ||
      !window.google ||
      predictionCongestionData.length === 0
    ) {
      return;
    }

    const segmentsInRegion = predictionCongestionData.filter(
      (segment) => segment.areaId === selectedPredictionRegion,
    );

    if (segmentsInRegion.length === 0) {
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    let hasAtLeastOnePoint = false;

    segmentsInRegion.forEach((segment) => {
      segment.coordinates.forEach((coordinate) => {
        const lng = Number(coordinate[0]);
        const lat = Number(coordinate[1]);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return;
        }

        bounds.extend({ lat, lng });
        hasAtLeastOnePoint = true;
      });
    });

    if (!hasAtLeastOnePoint) {
      return;
    }

    mapInstance.fitBounds(bounds, 20);
    lastZoomedRegionRef.current = selectedPredictionRegion;
  }, [
    isPredictionLayerActive,
    mapInstanceRef,
    predictionCongestionData,
    selectedPredictionRegion,
  ]);

  return (
    <>
      {isPredictionLayerActive && predictionWidgetVisible && (
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
