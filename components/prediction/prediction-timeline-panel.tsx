"use client";

import { useMemo } from "react";
import { formatTimeslotLabel } from "../../lib/prediction/prediction-formatters";
import { CongestionPredictionRegion } from "../../lib/prediction/congestion-predictions-service";
import { PredictionAreaCombobox } from "./prediction-area-combobox";

interface PredictionTimelinePanelProps {
  selectedPredictionRegion: string;
  onPredictionRegionChange: (areaId: string) => void;
  predictionRegions: CongestionPredictionRegion[];
  selectedPredictionAreaType: string;
  onPredictionAreaTypeChange: (areaType: string) => void;
  predictionStepMinutes: number;
  predictionTimeframes: string[];
  displayedTimeslotIndex: number;
  canControlTimeline: boolean;
  predictionLoading: boolean;
  predictionNoDataMessage: string;
  isPredictionPlaying: boolean;
  setIsPredictionPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  moveTimeslot: (direction: -1 | 1) => void;
  handleTimeslotRangeChange: (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => void;
  commitTimeslotChange: (index: number) => void;
}

export function PredictionTimelinePanel({
  selectedPredictionRegion,
  onPredictionRegionChange,
  predictionRegions,
  selectedPredictionAreaType,
  onPredictionAreaTypeChange,
  predictionStepMinutes,
  predictionTimeframes,
  displayedTimeslotIndex,
  canControlTimeline,
  predictionLoading,
  predictionNoDataMessage,
  isPredictionPlaying,
  setIsPredictionPlaying,
  moveTimeslot,
  handleTimeslotRangeChange,
  commitTimeslotChange,
}: PredictionTimelinePanelProps) {
  const areaTypes = useMemo(() => {
    return Array.from(
      new Set(
        predictionRegions.map((region) => region.areaType).filter(Boolean),
      ),
    )
      .map((type) => String(type))
      .sort((a, b) => a.localeCompare(b));
  }, [predictionRegions]);

  const regionsForSelectedType = useMemo(() => {
    if (!selectedPredictionAreaType) {
      return predictionRegions;
    }

    return predictionRegions.filter(
      (region) => region.areaType === selectedPredictionAreaType,
    );
  }, [predictionRegions, selectedPredictionAreaType]);

  return (
    <div className="absolute bottom-5 right-5 z-[11] w-80 rounded-lg border border-slate-700/70 bg-slate-900/90 p-3 text-slate-100 shadow-xl backdrop-blur">
      <label className="mb-2 grid gap-1 text-[13px] font-semibold text-slate-100">
        Tipo de area
        <select
          value={selectedPredictionAreaType}
          onChange={(event) => onPredictionAreaTypeChange(event.target.value)}
          className="h-8 w-full rounded-md border border-slate-600 bg-slate-800 px-2 text-sm font-normal text-slate-100 outline-none focus:border-slate-400"
        >
          <option value="">Todos</option>
          {areaTypes.map((type) => (
            <option key={type} value={type}>
              {type.toUpperCase()}
            </option>
          ))}
        </select>
      </label>

      <label className="mb-2 grid gap-1 text-[13px] font-semibold text-slate-100">
        Area
        <PredictionAreaCombobox
          value={selectedPredictionRegion}
          onChange={onPredictionRegionChange}
          regions={regionsForSelectedType}
          selectedAreaType={selectedPredictionAreaType}
          disabled={regionsForSelectedType.length === 0}
        />
      </label>

      <div className="mb-2 text-[13px] font-semibold text-slate-100">
        Tiempo ({predictionStepMinutes} min)
      </div>
      <div className="mb-2 flex gap-2">
        <button
          type="button"
          title="Paso anterior"
          aria-label="Paso anterior"
          onClick={() => moveTimeslot(-1)}
          disabled={!canControlTimeline}
          className="rounded-md bg-slate-100 px-2 py-1 text-sm font-bold text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          ⏮
        </button>
        <button
          type="button"
          title={isPredictionPlaying ? "Pausar" : "Reproducir"}
          aria-label={isPredictionPlaying ? "Pausar" : "Reproducir"}
          onClick={() => setIsPredictionPlaying((previous) => !previous)}
          disabled={!canControlTimeline}
          className="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-bold text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPredictionPlaying ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          title="Paso siguiente"
          aria-label="Paso siguiente"
          onClick={() => moveTimeslot(1)}
          disabled={!canControlTimeline}
          className="rounded-md bg-slate-100 px-2 py-1 text-sm font-bold text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          ⏭
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(predictionTimeframes.length - 1, 0)}
        value={displayedTimeslotIndex}
        onChange={handleTimeslotRangeChange}
        onMouseUp={(event) =>
          commitTimeslotChange(Number(event.currentTarget.value))
        }
        onTouchEnd={(event) =>
          commitTimeslotChange(Number(event.currentTarget.value))
        }
        onKeyUp={(event) => {
          if (
            event.key === "ArrowLeft" ||
            event.key === "ArrowRight" ||
            event.key === "Home" ||
            event.key === "End" ||
            event.key === "Enter" ||
            event.key === " "
          ) {
            commitTimeslotChange(Number(event.currentTarget.value));
          }
        }}
        disabled={!canControlTimeline}
        className="h-2 w-full cursor-pointer accent-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <div className="mt-1.5 text-xs text-slate-300">
        {formatTimeslotLabel(
          predictionTimeframes[displayedTimeslotIndex] || "",
        )}
      </div>
      {predictionLoading && (
        <div className="mt-2 text-xs text-slate-300">
          Cargando predicciones...
        </div>
      )}
      {!predictionLoading && predictionNoDataMessage && (
        <div className="mt-2 rounded border border-slate-600/80 bg-slate-800/80 p-2 text-xs text-slate-200">
          {predictionNoDataMessage}
        </div>
      )}
    </div>
  );
}
