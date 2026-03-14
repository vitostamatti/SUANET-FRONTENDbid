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

interface PredictionAreaComboboxProps {
  value: string;
  onChange: (areaId: string) => void;
  regions: Array<{ areaId: string; name: string }>;
  disabled?: boolean;
}

export function PredictionAreaCombobox({
  value,
  onChange,
  regions,
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
        region.areaId.toLowerCase().includes(normalizedQuery),
    );
  }, [query, regions]);

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
          {selectedRegion?.name ||
            (regions.length === 0
              ? "No hay opciones disponibles"
              : "Seleccionar filtro")}
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
              {filteredRegions.map((region) => (
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
                  {region.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
