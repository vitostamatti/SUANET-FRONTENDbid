"use client";

import { MutableRefObject, useEffect, useRef } from "react";
import { isPredictionLayerOption } from "../../lib/prediction/prediction-formatters";
import { PredictionLoadingCorridor } from "./prediction-types";

interface UsePredictionLoadingCorridorsParams {
  mapInstanceRef: MutableRefObject<google.maps.Map | null>;
  opcDropdownVel: string;
  predictionAnalysisLoading: boolean;
  predictionLoadingCorridors: PredictionLoadingCorridor[];
}

export const usePredictionLoadingCorridors = ({
  mapInstanceRef,
  opcDropdownVel,
  predictionAnalysisLoading,
  predictionLoadingCorridors,
}: UsePredictionLoadingCorridorsParams) => {
  const loadingPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const loadingAnimationIntervalsRef = useRef<number[]>([]);

  useEffect(() => {
    let mapWaitIntervalId: number | null = null;

    const clearLoadingAnimation = () => {
      if (mapWaitIntervalId !== null) {
        window.clearInterval(mapWaitIntervalId);
        mapWaitIntervalId = null;
      }

      loadingAnimationIntervalsRef.current.forEach((intervalId) => {
        window.clearInterval(intervalId);
      });
      loadingAnimationIntervalsRef.current = [];

      loadingPolylinesRef.current.forEach((polyline) => {
        polyline.setMap(null);
      });
      loadingPolylinesRef.current = [];
    };

    const drawCorridorsOnMap = (mapInstance: google.maps.Map) => {
      if (!window.google) {
        return false;
      }

      let drawnPathCount = 0;
      const bounds = new window.google.maps.LatLngBounds();
      let hasBoundPoint = false;

      predictionLoadingCorridors.forEach((corridor, corridorIndex) => {
        corridor.paths.forEach((corridorPath, pathIndex) => {
          const path = corridorPath
            .map((coordinate) => {
              const lng = Number(coordinate[0]);
              const lat = Number(coordinate[1]);

              if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return null;
              }

              const point = { lat, lng };
              bounds.extend(point);
              hasBoundPoint = true;
              return point;
            })
            .filter(
              (point): point is { lat: number; lng: number } => point !== null,
            );

          if (path.length < 2) {
            return;
          }

          const glowPolyline = new window.google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: "#00d4ff",
            strokeOpacity: 0.55,
            strokeWeight: 6,
            zIndex: 320,
            clickable: false,
          });

          const flowPolyline = new window.google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: "#ffffff",
            strokeOpacity: 0.95,
            strokeWeight: 3.2,
            zIndex: 321,
            clickable: false,
            icons: [
              {
                icon: {
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: 3.8,
                  fillColor: "#ffffff",
                  fillOpacity: 1,
                  strokeOpacity: 0,
                },
                offset: `${(corridorIndex * 13 + pathIndex * 7) % 100}%`,
              },
            ],
          });

          glowPolyline.setMap(mapInstance);
          flowPolyline.setMap(mapInstance);
          loadingPolylinesRef.current.push(glowPolyline, flowPolyline);

          let tick = 0;
          const intervalId = window.setInterval(() => {
            tick += 1;

            const phase = tick / 4 + corridorIndex * 0.45 + pathIndex * 0.2;
            const pulse = (Math.sin(phase) + 1) / 2;
            const flowOffset =
              (tick * 2 + corridorIndex * 11 + pathIndex * 4) % 100;

            glowPolyline.setOptions({
              strokeOpacity: 0.35 + pulse * 0.55,
              strokeWeight: 5 + pulse * 4,
            });

            flowPolyline.setOptions({
              strokeOpacity: 0.65 + pulse * 0.35,
              icons: [
                {
                  icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 3 + pulse * 1.8,
                    fillColor: "#ffffff",
                    fillOpacity: 1,
                    strokeOpacity: 0,
                  },
                  offset: `${flowOffset}%`,
                },
              ],
            });
          }, 90);

          loadingAnimationIntervalsRef.current.push(intervalId);
          drawnPathCount += 1;
        });
      });

      if (hasBoundPoint) {
        mapInstance.fitBounds(bounds, 80);

        window.setTimeout(() => {
          const currentZoom = mapInstance.getZoom();
          const minimumCorridorZoom = 13;

          if (
            typeof currentZoom === "number" &&
            currentZoom < minimumCorridorZoom
          ) {
            mapInstance.setZoom(minimumCorridorZoom);
          }
        }, 50);
      }

      return drawnPathCount > 0;
    };

    const tryDrawCorridors = () => {
      const mapInstance = mapInstanceRef.current;

      if (!mapInstance || !window.google) {
        return false;
      }

      clearLoadingAnimation();
      return drawCorridorsOnMap(mapInstance);
    };

    const isPredictionLayerActive = isPredictionLayerOption(opcDropdownVel);

    clearLoadingAnimation();

    if (
      !isPredictionLayerActive ||
      !predictionAnalysisLoading ||
      predictionLoadingCorridors.length === 0
    ) {
      return () => {
        clearLoadingAnimation();
      };
    }

    const didDrawImmediately = tryDrawCorridors();

    if (!didDrawImmediately) {
      mapWaitIntervalId = window.setInterval(() => {
        const didDraw = tryDrawCorridors();
        if (didDraw && mapWaitIntervalId !== null) {
          window.clearInterval(mapWaitIntervalId);
          mapWaitIntervalId = null;
        }
      }, 120);
    }

    return () => {
      clearLoadingAnimation();
    };
  }, [
    mapInstanceRef,
    opcDropdownVel,
    predictionAnalysisLoading,
    predictionLoadingCorridors,
  ]);
};
