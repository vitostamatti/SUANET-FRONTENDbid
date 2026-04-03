"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
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
  isPredictionPlaying: boolean;
  setIsPredictionPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  moveTimeslot: (direction: -1 | 1) => void;
  handleTimeslotRangeChange: (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => void;
  commitTimeslotChange: (index: number) => void;
}

interface PredictionAreaTypeSelectProps {
  value: string;
  onChange: (areaType: string) => void;
  options: string[];
}

function PredictionAreaTypeSelect({
  value,
  onChange,
  options,
}: PredictionAreaTypeSelectProps) {
  const [open, setOpen] = useState(false);
  const ALL_VALUE = "__all__";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-full justify-between border-slate-600 bg-slate-800 px-2 text-sm font-normal text-slate-100 hover:bg-slate-700"
        >
          {value ? value.toUpperCase() : "Todos"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandList>
            <CommandGroup>
              <CommandItem
                value={ALL_VALUE}
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === "" ? "opacity-100" : "opacity-0",
                  )}
                />
                Todos
              </CommandItem>
              {options.map((type) => (
                <CommandItem
                  key={type}
                  value={type}
                  onSelect={(currentType) => {
                    const selectedType =
                      options.find(
                        (option) => option.toLowerCase() === currentType,
                      ) || type;

                    onChange(selectedType);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === type ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {type.toUpperCase()}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
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
      {predictionLoading && (
        <div
          className="pointer-events-none absolute right-3 top-3 flex items-center"
          aria-live="polite"
        >
          <span className="sr-only">Cargando predicciones</span>
          <span className="h-3 w-3 animate-spin rounded-full border border-slate-500 border-t-slate-200/90 opacity-80" />
        </div>
      )}

      <label className="mb-2 grid gap-1 text-[13px] font-semibold text-slate-100">
        Tipo de area
        <PredictionAreaTypeSelect
          value={selectedPredictionAreaType}
          onChange={onPredictionAreaTypeChange}
          options={areaTypes}
        />
      </label>

      <label className="mb-2 grid gap-1 text-[13px] font-semibold text-slate-100">
        Area
        <PredictionAreaCombobox
          value={selectedPredictionRegion}
          onChange={onPredictionRegionChange}
          regions={regionsForSelectedType}
          selectedAreaType={selectedPredictionAreaType}
          disabled={false}
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
    </div>
  );
}
