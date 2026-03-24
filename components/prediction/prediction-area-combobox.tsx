"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CongestionPredictionRegion } from "../../lib/prediction/congestion-predictions-service";

interface PredictionAreaComboboxProps {
  value: string;
  onChange: (areaId: string) => void;
  regions: CongestionPredictionRegion[];
  selectedAreaType?: string;
  disabled?: boolean;
}

const MAX_VISIBLE_OPTIONS = 200;

export function PredictionAreaCombobox({
  value,
  onChange,
  regions,
  selectedAreaType,
  disabled = false,
}: PredictionAreaComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedRegion = regions.find((region) => region.areaId === value);

  const filteredRegions = useMemo(() => {
    if (!query.trim()) {
      return regions;
    }

    const normalizedQuery = query.toLowerCase();
    return regions.filter(
      (region) =>
        region.name.toLowerCase().includes(normalizedQuery) ||
        region.areaId.toLowerCase().includes(normalizedQuery) ||
        (region.areaType || "").toLowerCase().includes(normalizedQuery),
    );
  }, [query, regions]);

  const visibleRegions = useMemo(
    () => filteredRegions.slice(0, MAX_VISIBLE_OPTIONS),
    [filteredRegions],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || regions.length === 0}
          className="h-8 w-full justify-between border-slate-600 bg-slate-800 px-2 text-sm font-normal text-slate-100 hover:bg-slate-700"
        >
          {selectedRegion
            ? `${selectedRegion.name}${selectedRegion.areaType ? ` (${selectedRegion.areaType.toUpperCase()})` : ""}`
            : regions.length === 0
              ? "No hay opciones disponibles"
              : "Seleccionar filtro"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No se encontraron opciones.</CommandEmpty>
            <CommandGroup>
              {visibleRegions.map((region) => (
                <CommandItem
                  key={region.areaId}
                  value={region.areaId}
                  onSelect={(currentAreaId) => {
                    const selectedAreaId =
                      regions.find(
                        (entry) => entry.areaId.toLowerCase() === currentAreaId,
                      )?.areaId || currentAreaId;

                    onChange(selectedAreaId);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === region.areaId ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="truncate">{region.name}</span>
                    {region.areaType && (
                      <span className="rounded border border-slate-500/80 bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-200">
                        {region.areaType}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {filteredRegions.length > MAX_VISIBLE_OPTIONS && (
              <div className="px-2 py-1.5 text-[11px] text-slate-500">
                Mostrando {MAX_VISIBLE_OPTIONS} de {filteredRegions.length}{" "}
                resultados.
                {query.trim()
                  ? " Refina la busqueda para ver menos resultados."
                  : selectedAreaType
                    ? " Usa la busqueda para encontrar el area exacta."
                    : " Selecciona un tipo de area para reducir la lista."}
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
