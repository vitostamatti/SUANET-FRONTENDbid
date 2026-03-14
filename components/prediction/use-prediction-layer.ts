"use client";

import { MutableRefObject, useEffect } from "react";
import { CongestionPredictionSegment } from "../../lib/prediction/congestion-predictions-service";
import {
  colorForPredictionLevel,
  isPredictionLayerOption,
} from "../../lib/prediction/prediction-formatters";

interface UsePredictionLayerParams {
  mapInstanceRef: MutableRefObject<google.maps.Map | null>;
  predictionPolylinesRef: MutableRefObject<google.maps.Polyline[]>;
  infoWindowRef: MutableRefObject<google.maps.InfoWindow | null>;
  opcDropdownVel: string;
  predictionCongestionData: CongestionPredictionSegment[];
  onSegmentClick: (segment: CongestionPredictionSegment) => void;
}

export const usePredictionLayer = ({
  mapInstanceRef,
  predictionPolylinesRef,
  infoWindowRef,
  opcDropdownVel,
  predictionCongestionData,
  onSegmentClick,
}: UsePredictionLayerParams) => {
  useEffect(() => {
    const mapInstance = mapInstanceRef.current;

    if (!mapInstance || !window.google) {
      return;
    }

    predictionPolylinesRef.current.forEach((polyline) => polyline.setMap(null));
    predictionPolylinesRef.current = [];

    const isPredictionLayerActive = isPredictionLayerOption(opcDropdownVel);

    if (!isPredictionLayerActive || predictionCongestionData.length === 0) {
      return;
    }

    predictionCongestionData.forEach((segment) => {
      if (
        !Array.isArray(segment.coordinates) ||
        segment.coordinates.length < 2
      ) {
        return;
      }

      const path = segment.coordinates
        .map((coordinate) => {
          const lng = Number(coordinate[0]);
          const lat = Number(coordinate[1]);

          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null;
          }

          return { lat, lng };
        })
        .filter(
          (point): point is { lat: number; lng: number } => point !== null,
        );

      if (path.length < 2) {
        return;
      }

      const polyline = new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: colorForPredictionLevel(Number(segment.level)),
        strokeOpacity: 0.85,
        strokeWeight: 3.5,
      });

      polyline.setMap(mapInstance);

      polyline.addListener("click", () => {
        onSegmentClick(segment);
        infoWindowRef.current?.close();
      });

      predictionPolylinesRef.current.push(polyline);
    });

    return () => {
      predictionPolylinesRef.current.forEach((polyline) =>
        polyline.setMap(null),
      );
      predictionPolylinesRef.current = [];
    };
  }, [
    infoWindowRef,
    mapInstanceRef,
    onSegmentClick,
    opcDropdownVel,
    predictionCongestionData,
    predictionPolylinesRef,
  ]);
};
