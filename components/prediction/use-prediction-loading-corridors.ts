"use client";

import { MutableRefObject, useEffect, useRef } from "react";
import { isPredictionLayerOption } from "../../lib/prediction/prediction-formatters";
import { PredictionLoadingCorridor } from "./prediction-types";

const BOGOTA_CITY_CENTER = { lat: 4.711, lng: -74.0721 };
const BEAM_INTERVAL_MS = 70;
const BEAM_SPEED_PERCENT_PER_TICK = 1.5;
const BEAM_LENGTH_RATIO = 0.13;

const toMercatorDistance = (
  a: google.maps.LatLngLiteral,
  b: google.maps.LatLngLiteral,
) => {
  const latScale = 111.32;
  const avgLatRad = (((a.lat + b.lat) / 2) * Math.PI) / 180;
  const lngScale = 111.32 * Math.cos(avgLatRad);
  const dLat = (b.lat - a.lat) * latScale;
  const dLng = (b.lng - a.lng) * lngScale;
  return Math.hypot(dLat, dLng);
};

const interpolatePoint = (
  a: google.maps.LatLngLiteral,
  b: google.maps.LatLngLiteral,
  t: number,
): google.maps.LatLngLiteral => ({
  lat: a.lat + (b.lat - a.lat) * t,
  lng: a.lng + (b.lng - a.lng) * t,
});

const buildCumulativeDistances = (path: google.maps.LatLngLiteral[]) => {
  const cumulative: number[] = [0];

  for (let index = 1; index < path.length; index += 1) {
    cumulative.push(
      cumulative[index - 1] + toMercatorDistance(path[index - 1], path[index]),
    );
  }

  return cumulative;
};

const pointAtDistance = (
  path: google.maps.LatLngLiteral[],
  cumulative: number[],
  distance: number,
): google.maps.LatLngLiteral => {
  const totalLength = cumulative[cumulative.length - 1];

  if (distance <= 0) {
    return path[0];
  }

  if (distance >= totalLength) {
    return path[path.length - 1];
  }

  for (let index = 1; index < cumulative.length; index += 1) {
    if (cumulative[index] >= distance) {
      const segmentStartDistance = cumulative[index - 1];
      const segmentLength = cumulative[index] - segmentStartDistance;
      const t =
        segmentLength > 0
          ? (distance - segmentStartDistance) / segmentLength
          : 0;
      return interpolatePoint(path[index - 1], path[index], t);
    }
  }

  return path[path.length - 1];
};

const extractSegmentPath = (
  path: google.maps.LatLngLiteral[],
  cumulative: number[],
  startDistance: number,
  endDistance: number,
) => {
  if (endDistance <= startDistance) {
    return [];
  }

  const segmentPath: google.maps.LatLngLiteral[] = [
    pointAtDistance(path, cumulative, startDistance),
  ];

  for (let index = 1; index < path.length - 1; index += 1) {
    const distance = cumulative[index];
    if (distance > startDistance && distance < endDistance) {
      segmentPath.push(path[index]);
    }
  }

  segmentPath.push(pointAtDistance(path, cumulative, endDistance));
  return segmentPath;
};

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
  const mapWaitIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const clearLoadingAnimation = () => {
      if (mapWaitIntervalRef.current !== null) {
        window.clearInterval(mapWaitIntervalRef.current);
        mapWaitIntervalRef.current = null;
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

      const pathModels: {
        path: google.maps.LatLngLiteral[];
        corridorIndex: number;
        pathIndex: number;
        centerDistance: number;
      }[] = [];

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

          const centerDistance = path.reduce((closestDistance, point) => {
            const currentDistance = toMercatorDistance(
              point,
              BOGOTA_CITY_CENTER,
            );
            return Math.min(closestDistance, currentDistance);
          }, Number.POSITIVE_INFINITY);

          pathModels.push({
            path,
            corridorIndex,
            pathIndex,
            centerDistance,
          });
        });
      });

      const maxCenterDistance = pathModels.reduce(
        (maxDistance, model) => Math.max(maxDistance, model.centerDistance),
        0,
      );

      pathModels.forEach(
        ({ path, corridorIndex, pathIndex, centerDistance }) => {
          const basePolyline = new window.google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: "#6c0a0a",
            strokeOpacity: 0.18,
            strokeWeight: 2.4,
            zIndex: 320,
            clickable: false,
          });

          const initialBeamPath = [path[0], path[1]];

          const glowPolyline = new window.google.maps.Polyline({
            path: initialBeamPath,
            geodesic: true,
            strokeColor: "#ff3024",
            strokeOpacity: 0.42,
            strokeWeight: 8.5,
            zIndex: 321,
            clickable: false,
          });

          const beamPolyline = new window.google.maps.Polyline({
            path: initialBeamPath,
            geodesic: true,
            strokeColor: "#ff6f61",
            strokeOpacity: 0.95,
            strokeWeight: 4.2,
            zIndex: 322,
            clickable: false,
          });

          const cumulative = buildCumulativeDistances(path);
          const totalLength = cumulative[cumulative.length - 1];
          if (!Number.isFinite(totalLength) || totalLength <= 0) {
            return;
          }

          const centerDistanceRatio =
            maxCenterDistance > 0
              ? Math.min(1, centerDistance / maxCenterDistance)
              : 0;
          const phaseOffsetPercent =
            centerDistanceRatio * 24 + corridorIndex * 5 + pathIndex * 2;

          basePolyline.setMap(mapInstance);
          glowPolyline.setMap(mapInstance);
          beamPolyline.setMap(mapInstance);
          loadingPolylinesRef.current.push(
            basePolyline,
            glowPolyline,
            beamPolyline,
          );

          let tick = 0;
          const intervalId = window.setInterval(() => {
            tick += 1;

            const phase = tick / 3 + corridorIndex * 0.35 + pathIndex * 0.15;
            const pulse = (Math.sin(phase) + 1) / 2;

            const headPercent =
              ((tick * BEAM_SPEED_PERCENT_PER_TICK + phaseOffsetPercent) %
                100) /
              100;
            const beamLengthDistance = totalLength * BEAM_LENGTH_RATIO;
            const headDistance = headPercent * totalLength;
            const tailDistance = Math.max(0, headDistance - beamLengthDistance);
            const beamPath = extractSegmentPath(
              path,
              cumulative,
              tailDistance,
              headDistance,
            );

            if (beamPath.length < 2) {
              return;
            }

            glowPolyline.setOptions({
              path: beamPath,
              strokeOpacity: 0.26 + pulse * 0.5,
              strokeWeight: 6.5 + pulse * 3,
            });

            beamPolyline.setOptions({
              path: beamPath,
              strokeOpacity: 0.7 + pulse * 0.3,
              strokeWeight: 3.6 + pulse * 1.2,
            });
          }, BEAM_INTERVAL_MS);

          loadingAnimationIntervalsRef.current.push(intervalId);
          drawnPathCount += 1;
        },
      );

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
      mapWaitIntervalRef.current = window.setInterval(() => {
        const didDraw = tryDrawCorridors();
        if (didDraw && mapWaitIntervalRef.current !== null) {
          window.clearInterval(mapWaitIntervalRef.current);
          mapWaitIntervalRef.current = null;
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
