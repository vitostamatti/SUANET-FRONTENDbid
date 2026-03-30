"use client";

import { Card, Button } from "@tremor/react";
import React, { useState, useEffect } from "react";
import AlertTable from "../../../components/table";
import LoadingScreen from "../../../components/loadingScreen";

interface FutureAlertRow {
  alertId: string;
  roadName: string;
  severityScore: number;
  predictedLevel: number;
  affectedCount: number;
  peakTimeslot: string;
  centerLat: number;
  centerLng: number;
  paths: [number, number][][];
}

const normalizeFutureAlerts = (payload: any): FutureAlertRow[] => {
  const features = payload?.data?.alert_items?.features;

  if (!Array.isArray(features)) {
    return [];
  }

  return features
    .map((feature: any) => {
      const geometry = feature?.geometry || feature?.grometry;
      const properties = feature?.properties || {};

      const normalizeLinePath = (coordinates: any): [number, number][] => {
        if (!Array.isArray(coordinates)) {
          return [];
        }

        return coordinates
          .map((point) => {
            if (!Array.isArray(point) || point.length < 2) {
              return null;
            }

            const lng = Number(point[0]);
            const lat = Number(point[1]);

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              return null;
            }

            return [lng, lat] as [number, number];
          })
          .filter((point): point is [number, number] => point !== null);
      };

      let paths: [number, number][][] = [];

      if (geometry?.type === "LineString") {
        const path = normalizeLinePath(geometry.coordinates);
        if (path.length >= 2) {
          paths = [path];
        }
      } else if (geometry?.type === "MultiLineString") {
        paths = (geometry.coordinates || [])
          .map((line: any) => normalizeLinePath(line))
          .filter((line: [number, number][]) => line.length >= 2);
      }

      const allPoints = paths.flat();
      const validCenter = allPoints.length > 0;

      const centerLng = validCenter
        ? allPoints.reduce((sum, point) => sum + point[0], 0) / allPoints.length
        : 0;
      const centerLat = validCenter
        ? allPoints.reduce((sum, point) => sum + point[1], 0) / allPoints.length
        : 0;

      return {
        alertId: String(properties.alert_id ?? ""),
        roadName: Array.isArray(properties.road_names)
          ? String(properties.road_names[0] || "Sin nombre")
          : "Sin nombre",
        severityScore: Number(properties.severity_score || 0),
        predictedLevel: Number(properties.predicted_level || 0),
        affectedCount: Number(properties.affected_count || 0),
        peakTimeslot: String(properties.peak_timeslot || ""),
        centerLat,
        centerLng,
        paths,
      };
    })
    .filter((row: FutureAlertRow) => row.alertId.length > 0);
};

export const dynamic = "force-dynamic";

export default function AlertPanel() {
  // Backend URL configuration
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

  const [loading, setLoading] = useState(true);

  const [dataP1, setDataP1] = useState<any[]>([]);
  const [dataCongestion, setDataCongestion] = useState<any[]>([]);
  const [dataWaze, setDataWaze] = useState<any[]>([]);
  const [dataJams, setDataJams] = useState<any[]>([]);
  const [dataInteligentes, setDataInteligentes] = useState<any[]>([]);
  const [dataFutureAlerts, setDataFutureAlerts] = useState<FutureAlertRow[]>(
    [],
  );

  const [boton, setBoton] = useState("P1");

  const [loadingPage, setLoadingPage] = useState(true); // Nuevo estado para la pantalla de carga

  useEffect(() => {
    async function fetchData() {
      try {
        setLoadingPage(true); // Muestra la pantalla de carga

        const responseP1 = await fetch(`${backendUrl}/api/dataAlertasP1Grave`);
        if (responseP1.ok) {
          const newDataP1 = await responseP1.json();
          setDataP1(newDataP1);
          //console.log(newDataP1);
        } else {
          console.error(
            "Error al obtener datos de alertas graves listado de P1",
          );
        }

        const responseCongestion = await fetch(
          `${backendUrl}/api/dim-congestion-first-decil`,
        );
        if (responseCongestion.ok) {
          const newDataCongestion = await responseCongestion.json();
          setDataCongestion(newDataCongestion);
          //console.log(newDataCongestion);
        } else {
          console.error(
            "Error al obtener datos de alertas graves listado Indice de Congestión",
          );
        }

        const responseAlertasWaze = await fetch(
          `${backendUrl}/api/dim-alerts-high-reliability`,
        );
        if (responseAlertasWaze.ok) {
          const newDataWazeAlertas = await responseAlertasWaze.json();
          setDataWaze(newDataWazeAlertas);
          //console.log(newDataWazeAlertas);
        } else {
          console.error(
            "Error al obtener datos de alertas de waze para el listado",
          );
        }

        const responseAlertasJams = await fetch(
          `${backendUrl}/api/dim-jams-level-4`,
        );
        if (responseAlertasJams.ok) {
          const newDataJams = await responseAlertasJams.json();
          setDataJams(newDataJams);
          //console.log(newDataJams);
        } else {
          console.error(
            "Error al obtener datos de alertas de jams para el listado",
          );
        }

        const responseAlertasInteligentes = await fetch(
          `${backendUrl}/api/dataInteligentesListado`,
        );
        if (responseAlertasInteligentes.ok) {
          const newDataInteligentes = await responseAlertasInteligentes.json();
          setDataInteligentes(newDataInteligentes);
          //console.log(newDataInteligentes);
        } else {
          console.error(
            "Error al obtener datos de alertas inteligentes para el listado",
          );
        }

        const responseFutureAlerts = await fetch(
          `${backendUrl}/api/prediccion-congestion/future-alerts`,
        );

        if (responseFutureAlerts.ok) {
          const payloadFutureAlerts = await responseFutureAlerts.json();
          setDataFutureAlerts(normalizeFutureAlerts(payloadFutureAlerts));
        } else {
          console.error("Error al obtener alertas futuras de prediccion");
        }
      } catch (error) {
        console.error("Error en la solicitud:", error);
      } finally {
        setLoadingPage(false); // Oculta la pantalla de carga
        setLoading(false);
      }
    }
    fetchData();
  }, [backendUrl]);

  const handleClickP1 = () => {
    setBoton("P1");
  };

  const handleClickCongestion = () => {
    setBoton("CONGESTION");
  };

  const handleClickWaze = () => {
    setBoton("WAZE");
  };

  const handleClickJams = () => {
    setBoton("JAMS");
  };

  const handleClickInteligentes = () => {
    setBoton("INTELIGENTES");
  };

  const handleClickFutureAlerts = () => {
    setBoton("FUTURE_ALERTS");
  };

  return (
    <main className="p-4 md:p-6 mx-auto max-w-7xl h-screen overflow-y-auto overflow-x-hidden">
      {loadingPage && <LoadingScreen />}

      <div className="flex flex-wrap gap-2">
        <Button
          style={{
            backgroundColor: boton === "P1" ? "#1e40af" : "#323432",
            color: "white",
            border: "none",
            marginRight: "5px",
          }}
          onClick={() => handleClickP1()}
        >
          Premier One
        </Button>

        <Button
          style={{
            backgroundColor: boton === "CONGESTION" ? "#1e40af" : "#323432",
            color: "white",
            border: "none",
            marginRight: "5px",
          }}
          onClick={() => handleClickCongestion()}
        >
          Indice de Congestion
        </Button>

        <Button
          style={{
            backgroundColor: boton === "WAZE" ? "#1e40af" : "#323432",
            color: "white",
            border: "none",
            marginRight: "5px",
          }}
          onClick={() => handleClickWaze()}
        >
          Waze
        </Button>

        <Button
          style={{
            backgroundColor: boton === "JAMS" ? "#1e40af" : "#323432",
            color: "white",
            border: "none",
            marginRight: "5px",
          }}
          onClick={() => handleClickJams()}
        >
          Jams
        </Button>

        <Button
          style={{
            backgroundColor: boton === "INTELIGENTES" ? "#1e40af" : "#323432",
            color: "white",
            border: "none",
            marginRight: "5px",
          }}
          onClick={() => handleClickInteligentes()}
        >
          Inteligentes
        </Button>

        <Button
          style={{
            backgroundColor: boton === "FUTURE_ALERTS" ? "#1e40af" : "#323432",
            color: "white",
            border: "none",
            marginRight: "5px",
          }}
          onClick={() => handleClickFutureAlerts()}
        >
          Alertas Futuras
        </Button>
      </div>

      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        {boton === "P1" ? (
          <p className="fixed left-0 top-0 flex w-full justify-center border-b bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30 mt-4">
            Lista de Alertas prioritarias de Premier One
          </p>
        ) : boton === "CONGESTION" ? (
          <p className="fixed left-0 top-0 flex w-full justify-center border-b bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30 mt-4">
            Lista de Alertas prioritarias del Indice de Congestión
          </p>
        ) : boton === "JAMS" ? (
          <p className="fixed left-0 top-0 flex w-full justify-center border-b bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30 mt-4">
            Lista de Alertas prioritarias de Jams de Waze
          </p>
        ) : boton === "INTELIGENTES" ? (
          <p className="fixed left-0 top-0 flex w-full justify-center border-b bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30 mt-4">
            Lista de Alertas Inteligentes
          </p>
        ) : boton === "FUTURE_ALERTS" ? (
          <p className="fixed left-0 top-0 flex w-full justify-center border-b bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30 mt-4">
            Lista de Alertas Futuras de Congestion
          </p>
        ) : (
          <p className="fixed left-0 top-0 flex w-full justify-center border-b bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30 mt-4">
            Lista de Alertas prioritarias del Waze
          </p>
        )}
      </div>

      <div>
        {loading ? (
          <div>Loading...</div>
        ) : boton === "P1" ? (
          <Card className="mt-1">
            <AlertTable datos={dataP1} tipoTrafico={boton} />
          </Card>
        ) : boton === "CONGESTION" ? (
          <Card className="mt-1">
            <AlertTable datos={dataCongestion} tipoTrafico={boton} />
          </Card>
        ) : boton === "JAMS" ? (
          <Card className="mt-1">
            <AlertTable datos={dataJams} tipoTrafico={boton} />
          </Card>
        ) : boton === "INTELIGENTES" ? (
          <Card className="mt-1">
            <AlertTable datos={dataInteligentes} tipoTrafico={boton} />
          </Card>
        ) : boton === "FUTURE_ALERTS" ? (
          <Card className="mt-1">
            <AlertTable datos={dataFutureAlerts} tipoTrafico={boton} />
          </Card>
        ) : (
          <Card className="mt-1">
            <AlertTable datos={dataWaze} tipoTrafico={boton} />
          </Card>
        )}
      </div>
    </main>
  );
}
