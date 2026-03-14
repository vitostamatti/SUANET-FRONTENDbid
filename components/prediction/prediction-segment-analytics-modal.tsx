"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CongestionPredictionHistoryPoint,
  CongestionPredictionSegment,
} from "../../lib/prediction/congestion-predictions-service";
import {
  getHistoryAverages,
  levelSemaphoreColor,
  toChartSeriesData,
} from "../../lib/prediction/prediction-formatters";
import { useMemo, useState } from "react";

type Metric = "level" | "velocity" | "delay";

interface PredictionSegmentAnalyticsModalProps {
  selectedPredictionSegment: CongestionPredictionSegment | null;
  segmentHistoryData: CongestionPredictionHistoryPoint[];
  segmentHistoryLoading: boolean;
  segmentHistoryError: string | null;
  predictionTimeframes: string[];
  predictionReferenceTimeslot: string;
  onClose: () => void;
}

const metricLabels: Record<Metric, string> = {
  level: "Nivel",
  velocity: "Velocidad",
  delay: "Retraso",
};

const metricColors: Record<Metric, string> = {
  level: "#f19d5d",
  velocity: "#6bca70",
  delay: "#dd4e47",
};

export function PredictionSegmentAnalyticsModal({
  selectedPredictionSegment,
  segmentHistoryData,
  segmentHistoryLoading,
  segmentHistoryError,
  predictionTimeframes,
  predictionReferenceTimeslot,
  onClose,
}: PredictionSegmentAnalyticsModalProps) {
  const [selectedMetric, setSelectedMetric] = useState<Metric>("level");

  const selectedTimeslotIndex = predictionReferenceTimeslot
    ? predictionTimeframes.findIndex(
        (timeslot) => timeslot === predictionReferenceTimeslot,
      )
    : -1;

  const chartSeriesData = useMemo(() => {
    const baseData = toChartSeriesData(segmentHistoryData);

    return baseData.map((point, index) => {
      const isForecast =
        selectedTimeslotIndex >= 0 && index > selectedTimeslotIndex;
      const metricValue = point[selectedMetric] ?? null;
      const isSplitAnchor =
        selectedTimeslotIndex >= 0 && index === selectedTimeslotIndex;

      return {
        ...point,
        periodType: isForecast ? "forecast" : "past",
        periodLabel: isForecast ? "Pronóstico" : "Pasado",
        pastMetric: isForecast ? null : metricValue,
        forecastMetric: isForecast || isSplitAnchor ? metricValue : null,
      };
    });
  }, [segmentHistoryData, selectedMetric, selectedTimeslotIndex]);

  const { averageLevel, averageVelocity, averageDelay } = useMemo(
    () => getHistoryAverages(segmentHistoryData),
    [segmentHistoryData],
  );

  const CustomChartTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ name?: string; value?: unknown; payload?: any }>;
    label?: string;
  }) => {
    if (!active || !payload || payload.length === 0) {
      return null;
    }

    const periodLabel = payload[0]?.payload?.periodLabel || "";

    return (
      <div className="min-w-[180px] rounded-md border border-slate-600 bg-slate-900/95 px-3 py-2 text-slate-100 shadow-lg">
        <div className="mb-1 text-xs font-semibold text-slate-200">{label}</div>
        {periodLabel ? (
          <div className="mb-1 text-[11px] font-medium text-slate-400">
            {periodLabel}
          </div>
        ) : null}
        <div className="space-y-1">
          {payload.map((entry, index) => {
            const numericValue = Number(entry.value);
            const readableValue =
              entry.value === null || Number.isNaN(numericValue)
                ? "Sin dato"
                : numericValue.toFixed(2);

            return (
              <div
                key={`${String(entry.name)}-${index}`}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="text-slate-300">{entry.name}</span>
                <span className="font-semibold text-slate-100">
                  {readableValue}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!selectedPredictionSegment) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/45">
      <div className="max-h-[82vh] w-[min(920px,calc(100vw-40px))] overflow-auto rounded-xl border border-slate-700 bg-slate-950 p-4 text-slate-200 shadow-2xl">
        <div className="mb-2.5 flex items-center justify-between">
          <div>
            <div className="text-base font-bold text-slate-100">
              Analítica de Congestión del Segmento
            </div>
            <div className="text-xs text-slate-400">
              {selectedPredictionSegment.title ||
                `Segmento ${selectedPredictionSegment.mviCodigo}`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none text-slate-200 transition hover:text-white"
            title="Cerrar analítica"
            aria-label="Cerrar analítica"
          >
            ✕
          </button>
        </div>

        {segmentHistoryLoading ? (
          <div className="text-sm text-slate-300">
            Cargando historial del segmento...
          </div>
        ) : segmentHistoryError ? (
          <div className="text-sm text-rose-300">{segmentHistoryError}</div>
        ) : segmentHistoryData.length === 0 ? (
          <div className="text-sm text-slate-300">
            No hay historial disponible para este segmento.
          </div>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
              <div className="rounded-lg bg-slate-900 p-2">
                <div className="text-[11px] text-slate-400">
                  Promedio de Nivel
                </div>
                <div className="text-base font-bold text-slate-100">
                  {averageLevel.toFixed(2)}
                </div>
              </div>
              <div className="rounded-lg bg-slate-900 p-2">
                <div className="text-[11px] text-slate-400">
                  Promedio de Velocidad
                </div>
                <div className="text-base font-bold text-slate-100">
                  {averageVelocity.toFixed(2)}
                </div>
              </div>
              <div className="rounded-lg bg-slate-900 p-2">
                <div className="text-[11px] text-slate-400">
                  Promedio de Retraso
                </div>
                <div className="text-base font-bold text-slate-100">
                  {averageDelay.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-2.5">
              <label className="grid gap-1 text-xs text-slate-200">
                Métrica
                <select
                  value={selectedMetric}
                  onChange={(event) =>
                    setSelectedMetric(event.target.value as Metric)
                  }
                  className="h-8 rounded-md border border-slate-600 bg-slate-900 px-2 text-sm text-slate-100 outline-none transition focus:border-slate-400"
                >
                  <option value="level">Nivel</option>
                  <option value="velocity">Velocidad</option>
                  <option value="delay">Retraso</option>
                </select>
              </label>
            </div>

            <div className="h-[420px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {selectedMetric === "level" ? (
                  <BarChart data={chartSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#23314f" />
                    <XAxis
                      dataKey="xLabel"
                      tick={{ fontSize: 11, fill: "#cbd5e1" }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#cbd5e1" }}
                      domain={[0, 5]}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={<CustomChartTooltip />}
                      labelFormatter={(_, payload: any) => {
                        const point = payload?.[0]?.payload;
                        return point
                          ? `${point.day || ""} ${point.label || ""} · ${point.periodLabel || ""}`.trim()
                          : "";
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "11px", color: "#cbd5e1" }}
                    />
                    <Bar dataKey="level" name="Nivel" radius={[4, 4, 0, 0]}>
                      {chartSeriesData.map((entry, index) =>
                        (() => {
                          const baseColor =
                            entry.level === null
                              ? "#475569"
                              : levelSemaphoreColor(Number(entry.level || 0));

                          if (entry.periodType === "forecast") {
                            return (
                              <Cell
                                key={`level-cell-${index}`}
                                fill={baseColor}
                                fillOpacity={0.2}
                                stroke={baseColor}
                                strokeWidth={2}
                                strokeDasharray="5 3"
                              />
                            );
                          }

                          return (
                            <Cell
                              key={`level-cell-${index}`}
                              fill={baseColor}
                            />
                          );
                        })(),
                      )}
                    </Bar>
                  </BarChart>
                ) : (
                  <AreaChart data={chartSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#23314f" />
                    <XAxis
                      dataKey="xLabel"
                      tick={{ fontSize: 11, fill: "#cbd5e1" }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#cbd5e1" }} />
                    <Tooltip
                      content={<CustomChartTooltip />}
                      labelFormatter={(_, payload: any) => {
                        const point = payload?.[0]?.payload;
                        return point
                          ? `${point.day || ""} ${point.label || ""} · ${point.periodLabel || ""}`.trim()
                          : "";
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "11px", color: "#cbd5e1" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="pastMetric"
                      stroke={metricColors[selectedMetric]}
                      fill={metricColors[selectedMetric]}
                      fillOpacity={0.3}
                      strokeWidth={2}
                      name={`${metricLabels[selectedMetric]} (Pasado)`}
                      connectNulls={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="forecastMetric"
                      stroke={metricColors[selectedMetric]}
                      fill={metricColors[selectedMetric]}
                      fillOpacity={0.12}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      name={`${metricLabels[selectedMetric]} (Pronóstico)`}
                      connectNulls={false}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
