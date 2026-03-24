"use client";

import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from "react";
import LoadingScreen from "./loadingScreen";
import dynamic from "next/dynamic";
import Map from "./mapaGooglemapsAlertVel";
import ControlPanel from "./control-panel";
import { off } from "process";
import {
  CongestionPredictionSegment,
  CongestionPredictionRegion,
  getCongestionPredictionAreas,
  getCongestionPredictionsByRegionAndTime,
  getCongestionPredictionsMetadata,
} from "../lib/prediction/congestion-predictions-service";
import { PredictionLoadingCorridor } from "./prediction/prediction-types";

const buildPredictionLoadingCorridors = (
  payload: any,
): PredictionLoadingCorridor[] => {
  const features = Array.isArray(payload?.features) ? payload.features : [];

  const normalizePath = (coordinates: any): [number, number][] => {
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

        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
          return null;
        }

        return [lng, lat] as [number, number];
      })
      .filter((point): point is [number, number] => point !== null);
  };

  return features
    .map((feature: any, index: number) => {
      const geometry = feature?.geometry;
      const properties = feature?.properties || {};
      let paths: [number, number][][] = [];

      if (geometry?.type === "LineString") {
        const path = normalizePath(geometry.coordinates);
        if (path.length >= 2) {
          paths = [path];
        }
      } else if (geometry?.type === "MultiLineString") {
        paths = (geometry.coordinates || [])
          .map((line: any) => normalizePath(line))
          .filter((path: [number, number][]) => path.length >= 2);
      }

      if (paths.length === 0) {
        return null;
      }

      return {
        id: feature?.id ?? properties.FID ?? index,
        fid: Number(properties.FID ?? index),
        name: String(properties.CORREDOR || `Corredor ${index + 1}`),
        paths,
      };
    })
    .filter(
      (
        corridor: PredictionLoadingCorridor | null,
      ): corridor is PredictionLoadingCorridor => corridor !== null,
    );
};

declare global {
  interface Window {
    google: any;
  }
}

interface DataGeo {
  LATITUDE: number;
  LONGITUDE: number;
  STATUS: string;
  DIRECCION: string;
  TIPO_INCIDENTE: string;
  SUBDIVISION: string;
  LOCALIDAD: string;
  DESCRIPCION_TIPO_INCIDENTE: string;
  INCIDENTNUMBER: string;
  INCIDENTDATE_DATE: string;
  INCIDENTDATE_TIME: string;
}

interface navBarMapsProps {
  lat: number;
  lng: number;
  vistaTrafico: string;
}

export default function NavBarMap({ lat, lng, vistaTrafico }: navBarMapsProps) {
  // Backend URL configuration
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

  const [dataTimeRTAhistoric, setTimeRTAhistoric] = useState("");
  const [dataTimeRTA, setdataTimeRTA] = useState("");
  const [dataincidentLastDay, setdataIncidentLastDay] = useState(0);

  const [pmtData, setPMTData] = useState(null);
  const [pmtTramoData, setTramoPMTData] = useState<any[]>([]);
  const [wazeData, setWazeData] = useState(null);
  const [irregularidadesData, setIrregularidadesData] = useState(null);
  const [prioridadData, setPrioridadData] = useState<any[]>([]);
  const [inteligentesData, setInteligentesData] = useState<any[]>([]);
  const [camarassalvavidasData, setCamarassalvavidasData] = useState(null);
  const [camarasCGTData, setCamarasCGTData] = useState(null);
  const [semaforosData, setSemaforosData] = useState(null);
  const [streamingData, setStreamingData] = useState(null);
  const [streamingSemaforosData, setStreamingSemaforosData] = useState(null);
  const [lluviasData, setLluviasData] = useState(null);

  const [wazeDataVel1, setWazeDataVel1] = useState<any[]>([]);
  const [wazeDataVel2, setWazeDataVel2] = useState<any[]>([]);
  const [wazeDataVel3, setWazeDataVel3] = useState<any[]>([]);
  const [wazeDataVel4, setWazeDataVel4] = useState<any[]>([]);
  const [wazeDataVel5, setWazeDataVel5] = useState<any[]>([]);

  const [congestionDataAlta, setCongestionDataAlta] = useState<any[]>([]);
  const [congestionDataMedia, setCongestionDataMedia] = useState<any[]>([]);
  const [congestionDataBaja, setCongestionDataBaja] = useState<any[]>([]);

  const [desviosData, setDesviosData] = useState<any[]>([]);

  const [data, setData] = useState<any[]>([]);
  const [dataGeo, setDataGeo] = useState<DataGeo[]>([]);
  const [dataGeoAlertas, setDataGeoAlertas] = useState<DataGeo[]>([]);

  let valueID;

  const [loadingPage, setLoadingPage] = useState(false);

  const [desviosCheckbox, setDesviosCheckbox] = useState(false);
  const [pmtCheckbox, setPMTCheckbox] = useState(false);
  const [incidentesCheckbox, setIncidentesCheckbox] = useState(false);
  const [wazeCheckbox, setWazeCheckbox] = useState(false);
  const [irregularidadesCheckbox, setIrregularidadesCheckbox] = useState(false);
  const [prioridadCheckbox, setPrioridadCheckbox] = useState(true);
  const [inteligentesCheckbox, setInteligentesCheckbox] = useState(false);

  const [streamingCheckbox, setStreamingCheckbox] = useState(false);
  const [lluviasCheckbox, setLluviasCheckbox] = useState(false);
  const [origenCheckbox, setOrigenCheckbox] = useState(false);
  const [destinoCheckbox, setDestinoCheckbox] = useState(false);
  const [borrarCheckbox, setBorrarCheckbox] = useState(false);
  const [salvavidasCheckbox, setSalvavidasCheckbox] = useState(false);
  const [camCGTCheckbox, setCamCGTCheckbox] = useState(false);
  const [semaforosCheckbox, setSemaforosCheckbox] = useState(false);

  const [opcVel, setOpcVel] = useState(vistaTrafico);

  const [alertasDesvios, setAlertasDesvios] = useState(0);
  const [alertasPMT, setAlertasPMT] = useState(0);
  const [alertasWaze, setAlertasWaze] = useState(0);
  const [alertasIrregularidades, setAlertasIrregularidades] = useState(0);
  const [alertasPrioridad, setAlertasPrioridad] = useState(0);
  const [alertasInteligentes, setAlertasInteligentes] = useState(0);
  const [alertasSalvavidas, setAlertasSalvavidas] = useState(0);
  const [alertasCGT, setAlertasCGT] = useState(0);
  const [alertasSemaforos, setAlertasSemaforos] = useState(0);
  const [alertasStreaming, setAlertasStreaming] = useState(0);
  const [alertaStreamingSemaforos, setAlertaStreamingSemaforos] = useState(0);
  const [alertasLluvias, setAlertasLluvias] = useState(0);
  const [areasLocalidades, setAreasLocalidades] = useState<number[]>([]);

  const [alertasRecomendaciones, setAlertasRecomendaciones] = useState(0);
  const [alertasOrigen, setAlertasOrigen] = useState(0);
  const [alertasDestino, setAlertasDestino] = useState(0);
  const [alertasBorrar, setAlertasBorrar] = useState(0);

  const [opcOtic, setOpcOtic] = useState(0);
  const [opcCongestion, setOpcCongestion] = useState(0);
  const [opcPredictions, setOpcPredictions] = useState(0);
  const [predictionRegions, setPredictionRegions] = useState<
    CongestionPredictionRegion[]
  >([]);
  const [predictionTimeframes, setPredictionTimeframes] = useState<string[]>(
    [],
  );
  const [predictionStepMinutes, setPredictionStepMinutes] = useState(15);
  const [predictionReferenceTimeslot, setPredictionReferenceTimeslot] =
    useState("");
  const [selectedPredictionAreaType, setSelectedPredictionAreaType] =
    useState("");
  const [selectedPredictionRegion, setSelectedPredictionRegion] = useState("");
  const [selectedPredictionTimeslot, setSelectedPredictionTimeslot] =
    useState("");
  const [predictionWidgetVisible, setPredictionWidgetVisible] = useState(true);
  const [predictionCongestionData, setPredictionCongestionData] = useState<
    CongestionPredictionSegment[]
  >([]);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionLoadingCorridors, setPredictionLoadingCorridors] = useState<
    PredictionLoadingCorridor[]
  >([]);
  const [predictionNoDataMessage, setPredictionNoDataMessage] = useState("");
  const [predictionEntryLoading, setPredictionEntryLoading] = useState(false);
  const predictionRequestIdRef = useRef(0);
  const previousOpcVelRef = useRef(opcVel);
  const predictionDataCacheRef = useRef<
    Map<string, CongestionPredictionSegment[]>
  >(new globalThis.Map<string, CongestionPredictionSegment[]>());

  const buildPredictionCacheKey = useCallback(
    (areaId: string, timeslot: string) => `${areaId}|${timeslot}`,
    [],
  );

  const buildPredictionNoDataMessage = useCallback(
    (items: CongestionPredictionSegment[]) => {
      if (items.length === 0) {
        return "No hay predicciones disponibles para el area y tiempo seleccionados.";
      }

      return "";
    },
    [],
  );

  const setPredictionCacheEntry = useCallback(
    (
      areaId: string,
      timeslot: string,
      items: CongestionPredictionSegment[],
    ) => {
      const key = buildPredictionCacheKey(areaId, timeslot);
      predictionDataCacheRef.current.set(key, items);

      if (predictionDataCacheRef.current.size > 240) {
        const oldestKey = predictionDataCacheRef.current.keys().next().value;
        if (oldestKey) {
          predictionDataCacheRef.current.delete(oldestKey);
        }
      }
    },
    [buildPredictionCacheKey],
  );

  useEffect(() => {
    let isCancelled = false;

    const loadPredictionCorridors = async () => {
      try {
        const response = await fetch("/corredores.geojson", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(
            `Failed to load corredores.geojson: ${response.status}`,
          );
        }

        const payload = await response.json();
        if (!isCancelled) {
          setPredictionLoadingCorridors(
            buildPredictionLoadingCorridors(payload),
          );
        }
      } catch (error) {
        console.error("Error loading prediction corridors GeoJSON:", error);
        if (!isCancelled) {
          setPredictionLoadingCorridors([]);
        }
      }
    };

    loadPredictionCorridors();

    return () => {
      isCancelled = true;
    };
  }, []);

  const handlePredictionAreaTypeChange = useCallback(
    (areaType: string) => {
      setSelectedPredictionAreaType((previousType) => {
        if (previousType === areaType) {
          return previousType;
        }
        return areaType;
      });

      if (!areaType) {
        return;
      }

      const regionsOfType = predictionRegions.filter(
        (region) => region.areaType === areaType,
      );

      if (regionsOfType.length === 0) {
        return;
      }

      const hasSelectedRegionInType = regionsOfType.some(
        (region) => region.areaId === selectedPredictionRegion,
      );

      if (!hasSelectedRegionInType) {
        setSelectedPredictionRegion(regionsOfType[0].areaId);
      }
    },
    [predictionRegions, selectedPredictionRegion],
  );

  const handlePredictionRegionChange = useCallback(
    (areaId: string) => {
      setSelectedPredictionRegion((previousRegion) => {
        if (previousRegion === areaId) {
          return previousRegion;
        }
        return areaId;
      });

      const selectedRegion = predictionRegions.find(
        (region) => region.areaId === areaId,
      );

      if (
        selectedRegion?.areaType &&
        selectedRegion.areaType !== selectedPredictionAreaType
      ) {
        setSelectedPredictionAreaType(selectedRegion.areaType);
      }
    },
    [predictionRegions, selectedPredictionAreaType],
  );
  // Estado para controlar si la página está inactiva
  const [isInactive, setIsInactive] = useState(false);
  // Último tiempo de interacción
  const [lastInteraction, setLastInteraction] = useState<Date | null>(null);

  const [actualizar, setActualizar] = useState(false);
  const [latitud, setLatitud] = useState<number>(lat);
  const [longitud, setLongitud] = useState<number>(lng);
  const [zoom, setZoom] = useState<number>(19);

  const [dataIDstreaming, setDataIDstreaming] = useState<number>(0);
  const [fuenteStreaming, setFuenteStreaming] = useState<string>("");
  const [originsData, setOriginsData] = useState<google.maps.LatLngLiteral[]>(
    [],
  );

  const handleActualizarStreaming = (id: number, fuente: string) => {
    setDataIDstreaming(id);
    setFuenteStreaming(fuente);
    //console.log(id);
  };

  const handleOriginsChange = (origins: google.maps.LatLngLiteral[]) => {
    setOriginsData(origins);
    //console.log('Origins recibidos en navBarMap:', origins);
  };

  const handleRecomendacionesChange = (recomendaciones: number) => {
    // Desactivar todos los checkboxes y alertas de recomendaciones
    if (recomendaciones === 0) {
      setOrigenCheckbox(false);
      setDestinoCheckbox(false);
      setBorrarCheckbox(false);
      // Actualizar las alertas directamente
      setAlertasRecomendaciones(0);
      setAlertasOrigen(0);
      setAlertasDestino(0);
      setAlertasBorrar(0);
    }
  };

  useEffect(() => {
    const hasGeoCoordinates = !(lat === 0 && lng === 0);
    const effectiveLat = hasGeoCoordinates ? lat : 4.6573524;
    const effectiveLng = hasGeoCoordinates ? lng : -74.1109368;

    setLatitud(effectiveLat);
    setLongitud(effectiveLng);

    const fetchData = async () => {
      try {
        if (actualizar === false) {
          setLoadingPage(true); // Muestra la pantalla de carga
        }

        if (!hasGeoCoordinates) {
          alert("la alerta no tiene datos georeferenciados");
        }

        const responseCountLastDay = await fetch(
          `${backendUrl}/api/countLastHour`,
        );
        if (responseCountLastDay.ok) {
          const newDataCount = await responseCountLastDay.json();
          setdataIncidentLastDay(newDataCount);
        } else {
          console.error("Error al obtener datos del servidor");
        }

        const resTiempoRTAhistorico = await fetch(
          `${backendUrl}/api/AVGtimeRTAhistoricDay`,
        );
        if (resTiempoRTAhistorico.ok) {
          const newDataTiempoRTAhistorico = await resTiempoRTAhistorico.json();
          setTimeRTAhistoric(newDataTiempoRTAhistorico);
          console.log("Datos de tiempo historico cargados correctamente");
        } else {
          console.error("Error al cargar los datos de tiempo historico");
        }

        const resTiempoRTA = await fetch(
          `${backendUrl}/api/AVGtimeRTALastHour`,
        );
        if (resTiempoRTA.ok) {
          const newDataTiempoRTA = await resTiempoRTA.json();
          setdataTimeRTA(newDataTiempoRTA);
          console.log("Datos de tiempo del día cargados correctamente");
        } else {
          console.error("Error al cargar los datos de tiempo del día");
        }

        const promises = [];

        if (incidentesCheckbox) {
          promises.push(fetchDataIncidentes());
        }
        if (wazeCheckbox) {
          promises.push(fetchDataWaze());
        }
        if (irregularidadesCheckbox) {
          promises.push(fetchDataIrregularidades());
        }
        if (pmtCheckbox) {
          promises.push(fetchDataPMT());
          const dataPMTStramos = await fetchDataPMTtramos();
          setTramoPMTData(dataPMTStramos);
        } else {
          setTramoPMTData([]);
        }

        if (desviosCheckbox) {
          const dataDesvios = await fetchDataDesvios();
          setDesviosData(dataDesvios);
        } else {
          setDesviosData([]);
        }

        if (inteligentesCheckbox) {
          const dataAlertasInteligentes = await fetchDataAlertasInteligentes();
          setInteligentesData(dataAlertasInteligentes);
          promises.push(fetchDataInteligentesPoints());
        } else {
          setInteligentesData([]);
        }

        if (prioridadCheckbox) {
          const dataAlertas = await fetchDataIndiceCongestionAlertas();

          //console.log(dataAlertas);
          setDataGeoAlertas(dataAlertas);
        } else {
          setDataGeoAlertas([]);
        }

        if (salvavidasCheckbox) {
          promises.push(fetchDataSalvavidas());
        }

        if (camCGTCheckbox) {
          promises.push(fetchDataCamCGT());
        }

        if (semaforosCheckbox) {
          promises.push(fetchDataSemaforos());
        }

        if (streamingCheckbox) {
          promises.push(fetchDataStreaming());
          promises.push(fetchDataStreamingSemaforos());
        }

        if (lluviasCheckbox) {
          promises.push(fetchDataLluvias());
          fetchDataAreasLocalidades();
        }

        const allData = (await Promise.all(promises)).flat();
        setDataGeo(allData);

        fetchDataIndiceCongestion();

        fetchDataWazeVel();
      } catch (error) {
        console.error("Error en la solicitud API:", error);
      } finally {
        setLoadingPage(false); // Oculta la pantalla de carga
      }
    };

    fetchData();

    // Limpia el temporizador al desmontar el componente, al igual que los listeners y elintervalo

    /*return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      clearInterval(interval);
    };*/
  }, [
    incidentesCheckbox,
    prioridadCheckbox,
    inteligentesCheckbox,
    wazeCheckbox,
    pmtCheckbox,
    desviosCheckbox,
    irregularidadesCheckbox,
    salvavidasCheckbox,
    camCGTCheckbox,
    semaforosCheckbox,
    streamingCheckbox,
    lluviasCheckbox,
    lat,
    lng,
    vistaTrafico,
  ]);

  //el checkbox de origen y destino lo manejo en un useeffect aparte, para que no cargue todos los otros apis de alertas activados cuando se seleccione origen o destino
  useEffect(() => {
    if (origenCheckbox) {
      setAlertasRecomendaciones(1);
      setAlertasOrigen(1);
    }

    if (destinoCheckbox) {
      setAlertasRecomendaciones(2);
      setAlertasDestino(1);
    }

    if (borrarCheckbox) {
      setAlertasRecomendaciones(3);
      setAlertasBorrar(1);
    }

    if (!origenCheckbox && !destinoCheckbox && !borrarCheckbox) {
      setAlertasRecomendaciones(0);
      setAlertasOrigen(0);
      setAlertasDestino(0);
      setAlertasBorrar(0);
    }
  }, [origenCheckbox, destinoCheckbox, borrarCheckbox]);

  useEffect(() => {
    const fetchPredictionMetadata = async () => {
      try {
        const [metadata, areaOptions] = await Promise.all([
          getCongestionPredictionsMetadata(backendUrl),
          getCongestionPredictionAreas(backendUrl).catch(() => []),
        ]);

        const mergedRegions = (() => {
          if (areaOptions.length === 0) {
            return metadata.regions;
          }

          const metadataRegionById = new globalThis.Map(
            metadata.regions.map((region) => [
              region.areaId.toLowerCase(),
              region,
            ]),
          );

          const areaOptionById = new globalThis.Map(
            areaOptions.map((region) => [region.areaId.toLowerCase(), region]),
          );

          const prioritizedRegions: CongestionPredictionRegion[] = [];
          const usedIds = new globalThis.Set<string>();

          metadata.regions.forEach((metadataRegion) => {
            const key = metadataRegion.areaId.toLowerCase();
            const matchingAreaOption = areaOptionById.get(key);

            prioritizedRegions.push(
              matchingAreaOption
                ? {
                    ...matchingAreaOption,
                    // Keep canonical metadata naming where available.
                    name: metadataRegion.name || matchingAreaOption.name,
                  }
                : {
                    ...metadataRegion,
                    areaType: metadataRegion.areaId.split(":")[0] || undefined,
                  },
            );

            usedIds.add(key);
          });

          const remainingRegions = areaOptions
            .filter((region) => !usedIds.has(region.areaId.toLowerCase()))
            .sort((a, b) => {
              const aInMetadata = metadataRegionById.has(a.areaId.toLowerCase())
                ? 0
                : 1;
              const bInMetadata = metadataRegionById.has(b.areaId.toLowerCase())
                ? 0
                : 1;

              if (aInMetadata !== bInMetadata) {
                return aInMetadata - bInMetadata;
              }

              const byType = (a.areaType || "").localeCompare(
                b.areaType || "",
                "es",
                { sensitivity: "base" },
              );

              if (byType !== 0) {
                return byType;
              }

              return a.name.localeCompare(b.name, "es", {
                sensitivity: "base",
              });
            });

          return [...prioritizedRegions, ...remainingRegions];
        })();

        setPredictionRegions(mergedRegions);
        setPredictionTimeframes(metadata.timeframes);
        setPredictionStepMinutes(metadata.stepMinutes || 15);
        const safeReferenceTimeslot =
          metadata.referenceTimeslot &&
          metadata.timeframes.includes(metadata.referenceTimeslot)
            ? metadata.referenceTimeslot
            : metadata.timeframes[0] || "";

        setPredictionReferenceTimeslot(safeReferenceTimeslot);

        if (mergedRegions.length > 0) {
          setSelectedPredictionRegion((previousRegion) => {
            const hasPreviousRegion = mergedRegions.some(
              (region) => region.areaId === previousRegion,
            );

            if (hasPreviousRegion) {
              const previousType = mergedRegions.find(
                (region) => region.areaId === previousRegion,
              )?.areaType;
              if (previousType) {
                setSelectedPredictionAreaType(previousType);
              }
              return previousRegion;
            }

            const metadataDefaultRegion = metadata.regions[0]?.areaId;
            if (
              metadataDefaultRegion &&
              mergedRegions.some(
                (region) => region.areaId === metadataDefaultRegion,
              )
            ) {
              const metadataDefaultType = mergedRegions.find(
                (region) => region.areaId === metadataDefaultRegion,
              )?.areaType;
              if (metadataDefaultType) {
                setSelectedPredictionAreaType(metadataDefaultType);
              }
              return metadataDefaultRegion;
            }

            if (mergedRegions[0].areaType) {
              setSelectedPredictionAreaType(mergedRegions[0].areaType || "");
            }
            return mergedRegions[0].areaId;
          });
        }

        if (metadata.timeframes.length > 0) {
          setSelectedPredictionTimeslot(safeReferenceTimeslot);
        }

        setOpcPredictions(mergedRegions.length > 0 ? 1 : 0);
      } catch (error) {
        console.error("Error loading congestion prediction metadata:", error);
        setOpcPredictions(0);
      }
    };

    fetchPredictionMetadata();
  }, [backendUrl]);

  useEffect(() => {
    if (!selectedPredictionAreaType || predictionRegions.length === 0) {
      return;
    }

    const regionsOfType = predictionRegions.filter(
      (region) => region.areaType === selectedPredictionAreaType,
    );

    if (regionsOfType.length === 0) {
      return;
    }

    const hasSelectedRegionInType = regionsOfType.some(
      (region) => region.areaId === selectedPredictionRegion,
    );

    if (!hasSelectedRegionInType) {
      setSelectedPredictionRegion(regionsOfType[0].areaId);
    }
  }, [predictionRegions, selectedPredictionAreaType, selectedPredictionRegion]);

  useEffect(() => {
    const fetchPredictionData = async () => {
      if (opcVel !== "PREDICCIONES_CONGESTION") {
        setPredictionNoDataMessage("");
        return;
      }

      if (!selectedPredictionRegion || !selectedPredictionTimeslot) {
        setPredictionCongestionData([]);
        setPredictionNoDataMessage("");
        return;
      }

      if (
        predictionTimeframes.length > 0 &&
        !predictionTimeframes.includes(selectedPredictionTimeslot)
      ) {
        setSelectedPredictionTimeslot(
          predictionReferenceTimeslot || predictionTimeframes[0],
        );
        return;
      }

      const requestId = predictionRequestIdRef.current + 1;
      predictionRequestIdRef.current = requestId;

      try {
        const getItemsWithCache = async (areaId: string, timeslot: string) => {
          const key = buildPredictionCacheKey(areaId, timeslot);
          const cachedItems = predictionDataCacheRef.current.get(key);
          if (cachedItems) {
            return cachedItems;
          }

          const response = await getCongestionPredictionsByRegionAndTime(
            backendUrl,
            areaId,
            timeslot,
          );
          const responseItems = response.items || [];
          setPredictionCacheEntry(areaId, timeslot, responseItems);
          return responseItems;
        };

        const cacheKey = buildPredictionCacheKey(
          selectedPredictionRegion,
          selectedPredictionTimeslot,
        );
        const cached = predictionDataCacheRef.current.get(cacheKey);

        if (cached) {
          setPredictionCongestionData(cached);
          setPredictionNoDataMessage(buildPredictionNoDataMessage(cached));
          setPredictionLoading(false);
          setPredictionEntryLoading(false);
          return;
        }

        setPredictionLoading(true);

        const items = await getItemsWithCache(
          selectedPredictionRegion,
          selectedPredictionTimeslot,
        );

        if (requestId !== predictionRequestIdRef.current) {
          return;
        }

        setPredictionCongestionData(items);
        setPredictionNoDataMessage(buildPredictionNoDataMessage(items));
      } catch (error) {
        if (requestId !== predictionRequestIdRef.current) {
          return;
        }

        console.error("Error loading congestion predictions:", error);
        setPredictionCongestionData([]);
        setPredictionNoDataMessage(
          "No se pudieron cargar las predicciones. Intenta de nuevo en unos minutos.",
        );
      } finally {
        if (requestId === predictionRequestIdRef.current) {
          setPredictionLoading(false);
          setPredictionEntryLoading(false);
        }
      }
    };

    fetchPredictionData();
  }, [
    backendUrl,
    opcVel,
    selectedPredictionRegion,
    selectedPredictionTimeslot,
    predictionReferenceTimeslot,
    predictionTimeframes,
    buildPredictionCacheKey,
    buildPredictionNoDataMessage,
    setPredictionCacheEntry,
  ]);

  useEffect(() => {
    const wasPredictionsMode =
      previousOpcVelRef.current === "PREDICCIONES_CONGESTION";
    const isPredictionsMode = opcVel === "PREDICCIONES_CONGESTION";

    if (!wasPredictionsMode && isPredictionsMode) {
      setPredictionEntryLoading(true);
      if (
        predictionReferenceTimeslot &&
        predictionTimeframes.includes(predictionReferenceTimeslot)
      ) {
        setSelectedPredictionTimeslot(predictionReferenceTimeslot);
      } else if (predictionTimeframes.length > 0) {
        setSelectedPredictionTimeslot(predictionTimeframes[0]);
      }
    } else if (wasPredictionsMode && !isPredictionsMode) {
      setPredictionEntryLoading(false);
    }

    previousOpcVelRef.current = opcVel;
  }, [opcVel, predictionReferenceTimeslot, predictionTimeframes]);

  const predictionAnalysisLoading =
    opcVel === "PREDICCIONES_CONGESTION" &&
    predictionEntryLoading &&
    predictionLoading;
  const predictionInteractionDisabled = predictionAnalysisLoading;
  const visiblePredictionCongestionData = predictionAnalysisLoading
    ? []
    : predictionCongestionData;

  const handleLayerToggleAlertas = (name: string, on: boolean) => {
    //console.log(`Layer '${name}' toggled: ${on ? true : false}`);

    //setLoadingPage(true);

    if (name === "incidentes") {
      setIncidentesCheckbox(on);
    } else if (name === "waze") {
      setWazeCheckbox(on);
    } else if (name === "irregularidad") {
      setIrregularidadesCheckbox(on);
    } else if (name === "prioridad") {
      setPrioridadCheckbox(on);
    } else if (name === "inteligentes") {
      setInteligentesCheckbox(on);
    } else if (name === "pmt") {
      setPMTCheckbox(on);
    } else if (name === "desvios") {
      setDesviosCheckbox(on);
    }
  };

  const handleLayerToggleActivos = (name: string, on: boolean) => {
    //setLoadingPage(true);

    if (name === "salvavidas") {
      setSalvavidasCheckbox(on);
    } else if (name === "camaras_CGT") {
      setCamCGTCheckbox(on);
    } else if (name === "semaforos") {
      setSemaforosCheckbox(on);
    } else if (name === "streaming") {
      setStreamingCheckbox(on);
    } else if (name === "lluvias") {
      setLluviasCheckbox(on);
    }
  };

  const handleLayerToggleCondiciones = (name: string, on: boolean) => {
    //setLoadingPage(true);

    if (name === "lluvias") {
      setLluviasCheckbox(on);
    } else if (name === "pmt") {
      setPMTCheckbox(on);
    } else if (name === "desvios") {
      setDesviosCheckbox(on);
    }
  };

  const handleLayerToggleRecomendaciones = (name: string, on: boolean) => {
    //setLoadingPage(true);

    if (name === "origen") {
      setOrigenCheckbox(on);
    } else if (name === "destino") {
      setDestinoCheckbox(on);
    } else if (name === "borrar") {
      setBorrarCheckbox(on);
    }
  };

  const handleLayerToggleVel = (name: string, on: boolean) => {
    //console.log(`Layer '${name}' toggled: ${on ? true : false}`);
    setOpcVel(name);
  };

  const fetchDataPMTtramos = async () => {
    try {
      const responseTramoPMT = await fetch(`${backendUrl}/api/pmts_tramo`);
      if (responseTramoPMT.ok) {
        const tramoInfo = await responseTramoPMT.json();

        const newDataTramoPMT = tramoInfo.pmts_coi_tramo.features;

        if (newDataTramoPMT) {
          const combinedDataTramoPMT = newDataTramoPMT
            .map((feature: any) => {
              const type = feature.properties.TAFE;
              const address =
                feature.properties.DINI + " - " + feature.properties.DFIN;
              const company = feature.properties.CONT;
              const localidad = feature.properties.LOCA;
              const hour = feature.properties.HTRA;
              const day = feature.properties.FCOM_T;

              if (feature.geometry.type == "LineString") {
                const coordinates = feature.geometry.coordinates.map(
                  (point: number[]) => [point[0], point[1]],
                );

                return {
                  coordinates,
                  address,
                  type,
                  localidad,
                  company,
                  day,
                  hour,
                };
              }
            })
            .filter((item: any) => item !== null);

          return combinedDataTramoPMT;

          console.log("Datos de tramo PMT cargados correctamente");
        }
      }
    } catch (error) {
      //setLoadingPage(false);
      console.error("Error en la solicitud API:", error);
    }
  };

  const fetchDataDesvios = async () => {
    try {
      const responseDesvios = await fetch(`${backendUrl}/api/desvios`);
      //const responseDesvios = await fetch(`/api/desvios-1-reg`);
      if (responseDesvios.ok) {
        const desviosInfo = await responseDesvios.json();

        const newDataDesvios = desviosInfo.features;

        if (newDataDesvios) {
          const combinedDataDesvios = newDataDesvios
            .map((feature: any) => {
              const cambio = feature.properties.CAMBIO_SENTIDO_VIAL;
              const sentido = feature.properties.DESVIO;

              //console.log(feature.geometry.coordinates);
              //const coordinates = JSON.parse(feature.geometry.coordinates);

              if (feature.geometry.type == "LineString") {
                const coordinates = feature.geometry.coordinates.map(
                  (point: number[]) => [point[0], point[1]],
                );

                return { coordinates, cambio, sentido };
              }
            })
            .filter((item: any) => item !== null);

          //console.log(combinedDataDesvios);
          //setDesviosData(combinedDataDesvios);

          setAlertasDesvios(1);

          console.log("Datos de desvios cargados correctamente");

          return combinedDataDesvios;
        } else {
          //setLoadingPage(false);
          setAlertasDesvios(0);
          console.error("Error al obtener datos de desvios");
          return null;
        }
      }
    } catch (error) {
      //setLoadingPage(false);
      setAlertasDesvios(0);
      console.error("Error en la solicitud API:", error);
    }
  };

  const fetchDataAlertasInteligentes = async () => {
    try {
      const responseInteligentes = await fetch(
        `${backendUrl}/api/alertas_inteligentes`,
      );
      if (responseInteligentes.ok) {
        const inteligentesInfo = await responseInteligentes.json();

        //console.log(inteligentesInfo);

        if (inteligentesInfo) {
          const combinedDataInteligentes = inteligentesInfo
            .map((feature: any) => {
              //console.log(feature);

              const id = feature.properties.uuid;
              const acumuladodia_clima = feature.properties.acumuladodia_clima;
              const afectados = feature.properties.afectados;
              const estado_mvi = feature.properties.estado_mvi;
              const length = feature.properties.length;
              const nivel_alerta = feature.properties.nivel_alerta;
              const timestamp_startTime =
                feature.properties.timestamp_startTime;
              const timestamp_endTime = feature.properties.timestamp_endTime;
              const trend = feature.properties.trend;
              const valorlectura_clima = feature.properties.valorlectura_clima;
              const estado_semaforo = feature.properties.estado_semaforo;
              const tipo_congestion = feature.properties.tipo_congestion;
              const cantidad_alertas_waze =
                feature.properties.cantidad_alertas_waze;
              const tipos_alertas_waze =
                feature.properties.tipos_alertas_waze_unidos;
              const id_incidente = feature.properties.id_incidente;
              const tipo_incidente = feature.properties.tipo_incidente;
              const indice_congestion = feature.properties.ic;
              const tiempo_en_congestion =
                feature.properties.tiempo_en_congestion;

              //console.log(feature.geometry.coordinates);
              //const coordinates = JSON.parse(feature.geometry.coordinates);

              const coordinates = feature.geometry.coordinates.map(
                (point: number[]) => [point[0], point[1]],
              );

              return {
                coordinates,
                id,
                acumuladodia_clima,
                afectados,
                estado_mvi,
                length,
                nivel_alerta,
                timestamp_startTime,
                timestamp_endTime,
                trend,
                valorlectura_clima,
                estado_semaforo,
                tipo_congestion,
                cantidad_alertas_waze,
                tipos_alertas_waze,
                id_incidente,
                tipo_incidente,
                indice_congestion,
                tiempo_en_congestion,
              };
            })
            .filter((item: any) => item !== null);

          //console.log(combinedDataInteligentes);

          setAlertasInteligentes(1);

          console.log("Datos de alertas inteligentes cargados correctamente");

          return combinedDataInteligentes;
        } else {
          setAlertasInteligentes(0);
          console.warn("⚠️ No hay datos de Alertas Inteligentes disponibles");
          return []; // Retornar array vacío para evitar errores de renderizado
        }
      } else {
        setAlertasInteligentes(0);
        console.warn(
          "⚠️ Error al obtener Alertas Inteligentes (endpoint no disponible)",
        );
        return []; // Retornar array vacío para evitar errores de renderizado
      }
    } catch (error) {
      setAlertasInteligentes(0);
      console.warn("⚠️ Error en Alertas Inteligentes:", error);
      return []; // Retornar array vacío para evitar errores de renderizado
    }
  };

  const fetchDataInteligentesPoints = async () => {
    try {
      const fuente9 = "INTELIGENTES";
      const responseInteligentes = await fetch(
        `${backendUrl}/api/alertas_inteligentes`,
      );

      if (responseInteligentes.ok) {
        const newDataInteligentes = await responseInteligentes.json();

        //console.log(newDataInteligentes);

        if (newDataInteligentes) {
          console.log(
            "Datos de puntos alertas inteligentes cargados correctamente",
          );

          const combinedDataInteligentes = newDataInteligentes.map(
            (item: any) => {
              const idInteligente = item.properties.uuid;

              const coordinates = item.geometry.coordinates.map(
                (point: number[]) => [point[0], point[1]],
              );

              // Calcular el índice del punto medio
              const middleIndex = Math.floor(coordinates.length / 2);

              // Obtener lat/lng del punto medio
              const latInteligente = coordinates[middleIndex][1];
              const lngInteligente = coordinates[middleIndex][0];

              return [
                latInteligente,
                lngInteligente,
                null,
                null,
                null,
                null,
                null,
                null,
                idInteligente,
                null,
                null,
                fuente9,
              ];
            },
          );

          return combinedDataInteligentes;
        }
      } else {
        console.warn(
          "⚠️ Error al obtener puntos de alertas inteligentes (endpoint no disponible)",
        );
      }
    } catch (error) {
      console.warn("⚠️ Error en puntos de alertas inteligentes:", error);
      // No afectar otras alertas - solo registrar el error
    }
    return []; // Siempre retornar array vacío en caso de error
  };

  const fetchDataIndiceCongestion = async () => {
    try {
      const responseCongestionVel = await fetch(
        `${backendUrl}/api/dim-congestion`,
      );
      if (responseCongestionVel.ok) {
        const newDataCongestionVel = await responseCongestionVel.json();

        if (newDataCongestionVel) {
          const combinedDataCongestionVel = newDataCongestionVel
            .map((properties: any) => {
              const name = properties.nombre;
              const start = properties.desde;
              const end = properties.hasta;
              const address = name + " desde " + start + " hasta " + end;
              const fecha = properties.date_time;
              const fechaArray = fecha.split("T");
              const day = fechaArray[0];
              const horaArray = fechaArray[1].split(":");
              const hour = horaArray[0] + ":" + horaArray[1];
              const id = properties.ind_congestion;
              const velocity = properties.vel_kmh;
              const ind_congestion = properties.ind_congestion;

              const coordinates = JSON.parse(properties.geometry);

              //const coordinates = properties.geometry.map((point: number[]) => [point[0], point[1]]);

              // Procesamiento de las coordenadas
              /*const coordinatesText = properties.geometry.replace(/[{}]/g, ''); // Eliminando llaves
                const coordinatesArray = coordinatesText.split("},{"); // Separando pares de coordenadas

                const coordinates = coordinatesArray.map((point: string) => {
                  const [lng, lat] = point.split(',').map(Number); // Separando y convirtiendo a números
                  return [lng, lat];
                });*/

              return { coordinates, address, hour, day, id, velocity };
            })
            .filter((item: any) => item !== null);

          //console.log(combinedDataCongestionVel);

          const congestionIndiceAlta = combinedDataCongestionVel.filter(
            (datos: any) => datos.id < 150,
          );
          setCongestionDataAlta(congestionIndiceAlta);

          const congestionIndiceMedia = combinedDataCongestionVel.filter(
            (datos: any) => datos.id >= 150 && datos.id <= 500,
          );
          setCongestionDataMedia(congestionIndiceMedia);

          const congestionIndiceBaja = combinedDataCongestionVel.filter(
            (datos: any) => datos.id > 500,
          );
          setCongestionDataBaja(congestionIndiceBaja);

          console.log("Datos de congestion cargados correctamente");

          setOpcCongestion(1);
        } else {
          console.error("Error al obtener datos de indice de congestión");
          setOpcCongestion(0);
          return null;
        }
      }
    } catch (error) {
      console.error("Error en la solicitud API:", error);
      setOpcCongestion(0);
    }
  };

  const fetchDataIndiceCongestionAlertas = async () => {
    const promisesAlertas = [];

    let alertaSemaforos = false;
    let alertaCongestion = false;

    let combinedDataCongestion;
    let combinedDataSemaforos;

    try {
      const fuente4 = "CONGESTIONPRIORIDAD";
      const responseCongestionAlerta = await fetch(
        `${backendUrl}/api/dim-congestion-first-decil-mapa`,
      );

      if (responseCongestionAlerta.ok) {
        const newDataCongestionAlerta = await responseCongestionAlerta.json();

        if (newDataCongestionAlerta.length > 0) {
          combinedDataCongestion = newDataCongestionAlerta.map((data: any) => {
            const [
              id,
              address,
              indicador,
              calificacion,
              velocidad,
              fecha,
              hora,
              lat,
              lng,
              tipo,
            ] = data;

            const horaArray = hora.split(":");
            const hour = horaArray[0] + ":" + horaArray[1];

            return [
              lat,
              lng,
              id,
              address,
              null,
              null,
              velocidad,
              calificacion,
              indicador,
              fecha,
              hour,
              fuente4,
            ];
          });

          alertaCongestion = true;
          promisesAlertas.push(combinedDataCongestion);
          console.log("Datos de prioridad congestion cargados correctamente");
        } else {
          console.warn("⚠️ No hay datos de índice de congestión disponibles");
          // No retornamos - continuamos para intentar cargar semáforos
        }
      } else {
        console.warn(
          "⚠️ Error al obtener datos de índice de congestión (endpoint no disponible)",
        );
        // No retornamos - continuamos para intentar cargar semáforos
      }
    } catch (error) {
      console.warn("⚠️ Error al obtener datos de congestión:", error);
      // No marcamos como 0 aún - continuamos para intentar semáforos
    }

    try {
      const fuente4 = "CONGESTIONPRIORIDADSEMAFOROS";
      const responseSemaforoAlerta = await fetch(
        `${backendUrl}/api/falla_semaforos`,
      );

      if (responseSemaforoAlerta.ok) {
        const newDataSemaforoAlerta = await responseSemaforoAlerta.json();

        if (newDataSemaforoAlerta.length > 0) {
          combinedDataSemaforos = newDataSemaforoAlerta.map((data: any) => {
            const id = data.id;
            const address = data.direccion;
            const velocidad = data.externo;
            const calificacion = data.estado_original;
            const indicador = data.zona_auto;

            const fechaCompleta = data.last_update;
            const fechaArray = fechaCompleta.split("T");
            const fecha = fechaArray[0];
            const horaArray = fechaArray[1].split(":");
            const hour = horaArray[0] + ":" + horaArray[1];

            const lat = data.y;
            const lng = data.x;

            return [
              lat,
              lng,
              id,
              address,
              null,
              null,
              velocidad,
              calificacion,
              indicador,
              fecha,
              hour,
              fuente4,
            ];
          });

          alertaSemaforos = true;
          promisesAlertas.push(combinedDataSemaforos);
          console.log("Datos de prioridad semaforos cargados correctamente");
        } else {
          console.warn("⚠️ No hay datos de semáforos en falla disponibles");
          // No retornamos - continuamos con los datos que tengamos
        }
      } else {
        console.warn(
          "⚠️ Error al obtener datos de semáforos en falla (endpoint no disponible)",
        );
        // No retornamos - continuamos con los datos que tengamos
      }
    } catch (error) {
      console.warn("⚠️ Error al obtener datos de semáforos:", error);
      // Continuamos con los datos que tengamos
    }

    // Manejo resiliente: mostrar los datos que estén disponibles
    if (alertaCongestion && alertaSemaforos) {
      setAlertasPrioridad(1);
      const allDataAlertas = (await Promise.all(promisesAlertas)).flat();
      setPrioridadData(allDataAlertas);
      console.log("✅ Datos de prioridad cargados: congestión + semáforos");
      return allDataAlertas;
    } else if (alertaCongestion && !alertaSemaforos) {
      setAlertasPrioridad(1); // Activar aunque solo funcione congestión
      setPrioridadData(combinedDataCongestion);
      console.log(
        "✅ Datos de prioridad cargados: solo congestión (semáforos no disponibles)",
      );
      return combinedDataCongestion;
    } else if (!alertaCongestion && alertaSemaforos) {
      setAlertasPrioridad(1); // Activar aunque solo funcionen semáforos
      setPrioridadData(combinedDataSemaforos);
      console.log(
        "✅ Datos de prioridad cargados: solo semáforos (congestión no disponible)",
      );
      return combinedDataSemaforos;
    } else {
      setAlertasPrioridad(0); // Solo desactivar si ambos fallan
      console.warn(
        "⚠️ No hay datos de prioridad disponibles (ni congestión ni semáforos)",
      );
      return [];
    }
  };

  const fetchDataWazeVel = async () => {
    try {
      const responseWazeVel = await fetch(`${backendUrl}/api/dim-jams`);

      if (responseWazeVel.ok) {
        const newDataWazeVel = await responseWazeVel.json();

        if (newDataWazeVel) {
          const combinedDataWazeVel = newDataWazeVel.map((feature: any) => {
            const address = feature.street + " " + feature.endnode;
            const hour = feature.hora_lectura_dato;
            const day = feature.fecha_lectura;
            const id = feature.id;
            const velocity = feature.speedkmh;
            const level = feature.level;
            const delay = feature.delay;

            const geometryWKT = feature.geom_wkt;

            if (geometryWKT && geometryWKT.startsWith("MULTILINESTRING")) {
              // Extracción de las coordenadas del WKT
              const coordinatesString = geometryWKT
                .replace("MULTILINESTRING((", "")
                .replace("))", "");

              // Convertir la cadena de coordenadas en un array de arrays de números
              const coordinates = coordinatesString
                .split(", ")
                .map((coord: string) => {
                  const [lng, lat] = coord.split(" ").map(Number);
                  return [lng, lat];
                });

              return {
                coordinates,
                address,
                hour,
                day,
                id,
                velocity,
                level,
                delay,
              };
            }

            return null;
          });

          //console.log(combinedDataWazeVel);

          const wazeVel1 = combinedDataWazeVel.map((datos: any) => {
            if (datos.level == 1) {
              const address = datos.address;
              const hour = datos.hour;
              const day = datos.day;
              const id = datos.id;
              const velocity = datos.velocity;
              const coordinates = datos.coordinates;
              const level = datos.level;
              const delay = datos.delay;
              return {
                coordinates,
                address,
                hour,
                day,
                id,
                velocity,
                level,
                delay,
              };
            }
            return null;
          });

          setWazeDataVel1(wazeVel1);

          const wazeVel2 = combinedDataWazeVel.map((datos: any) => {
            if (datos.level == 2) {
              const address = datos.address;
              const hour = datos.hour;
              const day = datos.day;
              const id = datos.id;
              const velocity = datos.velocity;
              const coordinates = datos.coordinates;
              const level = datos.level;
              const delay = datos.delay;
              return {
                coordinates,
                address,
                hour,
                day,
                id,
                velocity,
                level,
                delay,
              };
            }
            return null;
          });

          setWazeDataVel2(wazeVel2);

          const wazeVel3 = combinedDataWazeVel.map((datos: any) => {
            if (datos.level == 3) {
              const address = datos.address;
              const hour = datos.hour;
              const day = datos.day;
              const id = datos.id;
              const velocity = datos.velocity;
              const coordinates = datos.coordinates;
              const level = datos.level;
              const delay = datos.delay;
              return {
                coordinates,
                address,
                hour,
                day,
                id,
                velocity,
                level,
                delay,
              };
            }
            return null;
          });

          setWazeDataVel3(wazeVel3);

          const wazeVel4 = combinedDataWazeVel.map((datos: any) => {
            if (datos.level == 4) {
              const address = datos.address;
              const hour = datos.hour;
              const day = datos.day;
              const id = datos.id;
              const velocity = datos.velocity;
              const coordinates = datos.coordinates;
              const level = datos.level;
              const delay = datos.delay;
              return {
                coordinates,
                address,
                hour,
                day,
                id,
                velocity,
                level,
                delay,
              };
            }
            return null;
          });

          setWazeDataVel4(wazeVel4);

          const wazeVel5 = combinedDataWazeVel.map((datos: any) => {
            if (datos.level == 5) {
              const address = datos.address;
              const hour = datos.hour;
              const day = datos.day;
              const id = datos.id;
              const velocity = datos.velocity;
              const coordinates = datos.coordinates;
              const level = datos.level;
              const delay = datos.delay;
              return {
                coordinates,
                address,
                hour,
                day,
                id,
                velocity,
                level,
                delay,
              };
            }
            return null;
          });

          setWazeDataVel5(wazeVel5);

          console.log("Datos de velocidad cargados correctamente");

          setOpcOtic(1);
        } else {
          console.error("Error al obtener datos de velocidad de waze OTIC");
          setOpcOtic(0);
          return null;
        }
      } else {
        console.error("Error al obtener datos de velocidad 2");
        setOpcOtic(0);
        //return null;
      }
    } catch (error) {
      console.error("Error en la solicitud API:", error);
    }
  };

  const fetchDataSemaforos = async () => {
    try {
      // Consulta API semaforizacion
      let fuente5 = "SEMAFOROS";
      const responseSemaforos = await fetch(
        `${backendUrl}/api/estados_semaforizacion`,
      );

      if (responseSemaforos.ok) {
        const newDataSemaforos = await responseSemaforos.json();

        //console.log(newDataSemaforos);

        if (newDataSemaforos.length > 0) {
          console.log("Datos de semaforos cargados correctamente");

          const combinedDataSemaforos = newDataSemaforos.map((item: any) => {
            const idSemaforos = item.shutdown;
            const dirSemaforos = item.direccion;
            const latSemaforos = item.y;
            const lngSemaforos = item.x;
            const fechaCompleta = item.last_update;
            const estado = item.estado;
            const localidad = item.localidad;
            const descripcion = item.interseccion;
            const videoDetectorInterseccion = item.num_wide;
            const videoDetectorCorredor = item.num_narrow;

            if (estado === "Operando") {
              fuente5 = "SEMAFOROS";
            } else if (estado === "Operación sin conexión") {
              fuente5 = "SEMAFOROSNO";
            } else {
              fuente5 = "SEMAFOROSFALLA";
            }

            const fechaArray = fechaCompleta.split("T");
            const day = fechaArray[0];
            const hour = fechaArray[1];
            const hourArray = hour.split(":");
            const horaCompleta = hourArray[0] + ":" + hourArray[1];

            return [
              latSemaforos,
              lngSemaforos,
              estado,
              dirSemaforos,
              videoDetectorInterseccion,
              videoDetectorCorredor,
              localidad,
              descripcion,
              idSemaforos,
              day,
              horaCompleta,
              fuente5,
            ];
          });

          setAlertasSemaforos(1);

          setSemaforosData(combinedDataSemaforos);

          return combinedDataSemaforos;
        }
      } else {
        console.error("ERROR al obtener datos de semaforizacion");
        setAlertasSemaforos(0);
      }
    } catch (error) {
      console.error("Error en la solicitud API:", error);
      setAlertasSemaforos(0);
    }
    //finally {
    //  setLoadingPage(false); // Oculta la pantalla de carga
    //}
    return [];
  };

  const fetchDataStreaming = async () => {
    try {
      // Consulta API streaming
      const fuente6 = "STREAMING";
      const responseStreaming = await fetch(
        `${backendUrl}/api/camaras_streaming`,
      );

      if (responseStreaming.ok) {
        const newDataStreaming = await responseStreaming.json();

        //console.log(newDataStreaming);

        if (newDataStreaming.length > 0) {
          console.log("Datos de streaming cargados correctamente");

          const combinedDataStreaming = newDataStreaming.map((item: any) => {
            const idStreaming = item[0];
            const dirStreaming = item[1];
            const latStreaming = item[2];
            const lngStreaming = item[3];
            const funcionamiento = item[4];
            const fechaCompleta = item[5];

            const fechaArray = fechaCompleta.split(" ");
            const day = fechaArray[0];
            const hour = fechaArray[1];
            const hourArray = hour.split(":");
            const horaCompleta = hourArray[0] + ":" + hourArray[1];

            let camaraActiva = "Activa";

            if (!funcionamiento) {
              camaraActiva = "No Funciona";
            }

            //console.log(idStreaming, dirStreaming, latStreaming, lngStreaming);

            return [
              latStreaming,
              lngStreaming,
              null,
              dirStreaming,
              null,
              null,
              null,
              camaraActiva,
              idStreaming,
              day,
              horaCompleta,
              fuente6,
            ];
          });

          setAlertasStreaming(1);

          setStreamingData(combinedDataStreaming);

          return combinedDataStreaming;
        }
      } else {
        console.error("ERROR al obtener datos de streaming");
        setAlertasStreaming(0);
      }
    } catch (error) {
      console.error("Error en la solicitud API:", error);
      setAlertasStreaming(0);
    }
    //finally {
    //  setLoadingPage(false); // Oculta la pantalla de carga
    //}
    return [];
  };

  const fetchDataStreamingSemaforos = async () => {
    try {
      // Consulta API streaming
      const fuente6 = "STREAMINGSEMAFOROS";
      const responseStreaming = await fetch(
        `${backendUrl}/api/camaras_semaforos`,
      );

      if (responseStreaming.ok) {
        const newDataStreaming = await responseStreaming.json();

        //console.log(newDataStreaming);

        if (newDataStreaming.length > 0) {
          console.log("Datos de streaming de semaforos cargados correctamente");

          const combinedDataStreamingSemaforos = newDataStreaming.map(
            (item: any) => {
              const idStreamingSemaforos = item[0];
              const idCruceSemaforos = item[1];
              const dirStreamingSemaforos = item[2];
              const latStreamingSemaforos = item[4];
              const lngStreamingSemaforos = item[5];
              const funcionamientoSemaforos = item[6];
              const fechaCompletaSemaforos = item[7];
              const nomenclaturaCruceSemaforos = item[8];
              const rotacionSemaforos = item[10]; // ← Extraer la rotación

              const fechaArray = fechaCompletaSemaforos.split("T");
              const day = fechaArray[0];
              const hour = fechaArray[1];
              const hourArray = hour.split(":");
              const horaCompleta = hourArray[0] + ":" + hourArray[1];

              //console.log(idStreaming, dirStreaming, latStreaming, lngStreaming);

              return [
                latStreamingSemaforos,
                lngStreamingSemaforos,
                null,
                dirStreamingSemaforos,
                null,
                null,
                null,
                funcionamientoSemaforos,
                idStreamingSemaforos,
                day,
                horaCompleta,
                fuente6,
                idCruceSemaforos,
                nomenclaturaCruceSemaforos,
                rotacionSemaforos,
              ];
            },
          );

          setAlertaStreamingSemaforos(1);

          setStreamingSemaforosData(combinedDataStreamingSemaforos);

          return combinedDataStreamingSemaforos;
        }
      } else {
        console.error("ERROR al obtener datos de streaming");
        setAlertaStreamingSemaforos(0);
      }
    } catch (error) {
      console.error("Error en la solicitud API:", error);
      setAlertaStreamingSemaforos(0);
    }
    //finally {
    //  setLoadingPage(false); // Oculta la pantalla de carga
    //}
    return [];
  };

  const fetchDataCamCGT = async () => {
    try {
      // Consulta API camaras-CCGT
      const fuente4 = "CAMARASCGT";
      const responseCamCGT = await fetch(`${backendUrl}/api/camaras-CGT`);

      if (responseCamCGT.ok) {
        const newDataCamCGT = await responseCamCGT.json();

        //console.log(newDataCamCGT);

        if (newDataCamCGT.length > 0) {
          console.log("Datos de cámaras CGT cargados correctamente");

          const combinedDataCamCG = newDataCamCGT.map((item: any) => {
            const idCamCGT = item.camaras_cgt_id;
            const latCamCGT = item.y;
            const lngCamCGT = item.x;

            return [
              latCamCGT,
              lngCamCGT,
              null,
              null,
              null,
              null,
              null,
              null,
              idCamCGT,
              null,
              null,
              fuente4,
            ];
          });

          setAlertasCGT(1);

          setCamarasCGTData(combinedDataCamCG);

          return combinedDataCamCG;
        }
      } else {
        console.error("ERROR al obtener datos de cámaras CGT");
        setAlertasCGT(0);
      }
    } catch (error) {
      console.error("Error en la solicitud API:", error);
      setAlertasCGT(0);
    }
    //finally {
    //  setLoadingPage(false); // Oculta la pantalla de carga
    //}
    return [];
  };

  const fetchDataSalvavidas = async () => {
    try {
      // Consulta API camaras-salvavidas
      const fuente3 = "CAMARASSALVAVIDAS";
      const responseCamSalvavidas = await fetch(
        `${backendUrl}/api/camaras-salvavidas`,
      );

      if (responseCamSalvavidas.ok) {
        const newDataCamSalvavidas = await responseCamSalvavidas.json();

        if (newDataCamSalvavidas.length > 0) {
          console.log("Datos de cámaras salvavidas cargados correctamente");

          const combinedDataCamSalvavidas = newDataCamSalvavidas.map(
            (item: any) => {
              const idCamSalvavidas = item.camaras_salvavidas_id;
              const latCamSalvavidas = item.y;
              const lngCamSalvavidas = item.x;

              return [
                latCamSalvavidas,
                lngCamSalvavidas,
                null,
                null,
                null,
                null,
                null,
                null,
                idCamSalvavidas,
                null,
                null,
                fuente3,
              ];
            },
          );

          setAlertasSalvavidas(1);

          setCamarassalvavidasData(combinedDataCamSalvavidas);

          return combinedDataCamSalvavidas;
        }
      } else {
        console.error("ERROR al obtener datos de cámaras salvavidas");
        setAlertasSalvavidas(0);
      }
    } catch (error) {
      console.error("Error en la solicitud API:", error);
      setAlertasSalvavidas(0);
    }
    //finally {
    //  setLoadingPage(false); // Oculta la pantalla de carga
    //}
    return [];
  };

  const fetchDataAreasLocalidades = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/localidades`);

      if (res.ok) {
        const newData = await res.json();

        if (!newData || newData.error) {
          window.alert(newData.error);
          console.error(newData.error);
        } else {
          const localidadesAreaData = newData.features;

          if (localidadesAreaData) {
            const areas = localidadesAreaData.map((feature: any) => {
              const geometry = feature.geometry;

              if (geometry && geometry.coordinates) {
                const coordinates = geometry.coordinates;
                return { coordinates };
              }
              return null;
            });
            setAreasLocalidades(areas);
            console.log(areas);
          }
        }
      } else {
        window.alert("Error al registrar los datos. Intente más tarde");
        console.error("Error al registrar los datos.");
      }
    } catch (error) {
      console.error("Error en la solicitud API:", error);
    }
  };

  const fetchDataLluvias = async () => {
    try {
      // ✅ CORREGIDO: Usar proxy del backend en lugar de llamada directa
      const fuente8 = "LLUVIAS";
      const rainUrl = `${backendUrl}/api/sab/rain-data`; // Proxy a través del backend

      console.log(`🌧️ [Rain Data] Fetching via backend proxy: ${rainUrl}`);

      const responseLluvias = await fetch(rainUrl, {
        method: "GET",
        headers: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json",
        },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      console.log(`🌧️ [Rain Data] Response status: ${responseLluvias.status}`);
      console.log(`🌧️ [Rain Data] Response headers:`, responseLluvias.headers);

      if (responseLluvias.ok) {
        const lluviasJson = await responseLluvias.json();

        const newDataLluvias = lluviasJson.TipoSensores;

        console.log(newDataLluvias);

        if (newDataLluvias.length > 0) {
          console.log("Datos de lluvias cargados correctamente");

          const combinedDataLluvias = newDataLluvias.map((item: any) => {
            const latLluvias = item.LATITUD;
            const lngLluvias = item.LONGITUD;
            const statusLLuvias = item.ESTADO;
            const dirLLuvias = item.ESTACION;
            const tipoLluvias = item.TIPOSENSOR;
            const medidaLLuvias = item.UNIDADMEDIDA;
            const localidadLLuvias = item.LOCALIDAD;
            const descripcionLluvias =
              item.TIPOTECNOLOGIA + " Altitud " + item.ALTITUD;
            const idLluvias = item.ACUMULADODIA;
            const valorlecturaLluvias = item.VALORLECTURA;

            const fechaCompletaLluvias = item.FECHALECTURA;
            const fechaArrayLluvias = fechaCompletaLluvias.split(" ");
            const diaLluvias = fechaArrayLluvias[0];
            const horaLluvias = fechaArrayLluvias[1];
            const horaArrayLluvias = horaLluvias.split(":");
            const horaCompletaLluvias =
              horaArrayLluvias[0] + ":" + horaArrayLluvias[1];

            return [
              latLluvias,
              lngLluvias,
              statusLLuvias,
              dirLLuvias,
              tipoLluvias,
              valorlecturaLluvias,
              localidadLLuvias,
              descripcionLluvias,
              idLluvias,
              diaLluvias,
              horaCompletaLluvias,
              fuente8,
            ];
          });

          setAlertasLluvias(1);

          setLluviasData(combinedDataLluvias);

          return combinedDataLluvias;
        }
      } else {
        console.error(
          `❌ [Rain Data] HTTP Error: ${responseLluvias.status} - ${responseLluvias.statusText}`,
        );
        console.error(`❌ [Rain Data] Response URL: ${responseLluvias.url}`);

        // Try to get error details from response
        try {
          const errorText = await responseLluvias.text();
          console.error(`❌ [Rain Data] Error response body:`, errorText);
        } catch (e) {
          console.error(`❌ [Rain Data] Could not read error response body`);
        }

        setAlertasLluvias(0);
      }
    } catch (error) {
      console.error("❌ [Rain Data] Network/Fetch Error:", error);

      // Provide specific error information with proper type checking
      if (error instanceof TypeError && error.message.includes("fetch")) {
        console.error(
          "❌ [Rain Data] This appears to be a network connectivity issue",
        );
      } else if (error instanceof Error && error.name === "AbortError") {
        console.error("❌ [Rain Data] Request timed out after 10 seconds");
      } else if (error instanceof Error && error.message.includes("CORS")) {
        console.error("❌ [Rain Data] CORS policy is blocking this request");
      }

      setAlertasLluvias(0);

      // Optional: Show user-friendly message
      console.warn(
        "⚠️ [Rain Data] Rain data is temporarily unavailable. This may be due to:",
      );
      console.warn("   - SAB server maintenance");
      console.warn("   - Network connectivity issues");
      console.warn("   - CORS policy restrictions");
    }
    //finally {
    //  setLoadingPage(false); // Oculta la pantalla de carga
    //}
    return [];
  };

  const fetchDataPMT = async () => {
    try {
      // Consulta API de pmt
      const fuente7 = "PMT";
      const responsePMT = await fetch(`${backendUrl}/api/pmts`);
      if (responsePMT.ok) {
        const newDataPMT = await responsePMT.json();

        if (newDataPMT) {
          console.log("Datos de alertas de pmt cargados correctamente");

          const pmtInfo = newDataPMT.pmts_coi_punto.features;

          const combinedDataPMT = pmtInfo
            .map((feature: any) => {
              const address = feature.properties.DINI;
              const type = feature.properties.CONT;
              const subtype = feature.properties.LOCA;
              const id = feature.properties.TAFE;
              const hour = feature.properties.HTRA;
              const day = feature.properties.FCOM_T;

              const coordinatesText = feature.geometry.coordinates;

              const latitud = coordinatesText[1];
              const longitud = coordinatesText[0];

              if (latitud && longitud) {
                return [
                  latitud,
                  longitud,
                  null,
                  address,
                  type,
                  null,
                  null,
                  subtype,
                  id,
                  day,
                  hour,
                  fuente7,
                ];
              }

              return null;
            })
            .filter(Boolean); // Filtrar elementos nulos

          setAlertasPMT(1);

          setPMTData(combinedDataPMT);

          return combinedDataPMT;
        } else {
          console.log("ERROR al cargar las alertas de pmt");
          setAlertasPMT(0);
        }
      } else {
        console.log("ERROR al cargar las alertas de pmt");
        setAlertasPMT(0);
      }
    } catch (error) {
      console.error("Error en la solicitud API:", error);
      setAlertasPMT(0);
    }
    //finally {
    //  setLoadingPage(false); // Oculta la pantalla de carga
    //}
    return [];
  };

  const fetchDataWaze = async () => {
    try {
      // Consulta API waze-data
      const fuente2 = "WAZE";
      const responseWaze = await fetch(`${backendUrl}/api/dim-alerts`);
      if (responseWaze.ok) {
        const newDataWaze = await responseWaze.json();

        if (newDataWaze) {
          console.log("Datos de alertas de waze cargados correctamente");

          const combinedDataWaze = newDataWaze
            .map((feature: any) => {
              const latitud = feature.latitud;
              const longitud = feature.longitud;
              const subtype = feature.subtype;
              const hour = feature.hora_lectura_dato;
              const address = feature.street;
              const day = feature.fecha_lectura;
              const type = feature.type;
              const id = feature.id;

              if (latitud && longitud) {
                return [
                  latitud,
                  longitud,
                  null,
                  address,
                  type,
                  null,
                  null,
                  subtype,
                  id,
                  day,
                  hour,
                  fuente2,
                ];
              }

              return null;
            })
            .filter(Boolean); // Filtrar elementos nulos

          setAlertasWaze(1);

          setWazeData(combinedDataWaze);

          return combinedDataWaze;
        } else {
          console.log("ERROR al cargar las alertas de waze");
          setAlertasWaze(0);
        }
      } else {
        console.log("ERROR al cargar las alertas de waze");
        setAlertasWaze(0);
      }
    } catch (error) {
      console.error("Error en la solicitud API:", error);
      setAlertasWaze(0);
    }
    //finally {
    //  setLoadingPage(false); // Oculta la pantalla de carga
    //}
    return [];
  };

  const fetchDataIrregularidades = async () => {
    try {
      // Consulta API waze-data
      const fuente3 = "IRREGULARIDADES";
      const responseIrregularidades = await fetch(
        `${backendUrl}/api/dim-irregularities`,
      );
      if (responseIrregularidades.ok) {
        const newDataIrregularidades = await responseIrregularidades.json();

        if (newDataIrregularidades) {
          console.log(
            "Datos de alertas de irregularidades cargados correctamente",
          );

          const combinedDataIrregularidades = newDataIrregularidades
            .map((feature: any) => {
              const latitud = feature.y;
              const longitud = feature.x;
              const subtype = feature.subtype;
              const fecha = feature.last_update.split(" ");
              const hour = fecha[1];
              const address = feature.street;
              const day = fecha[0];
              const type = feature.alert_type;
              const id = feature.id;

              if (latitud && longitud) {
                return [
                  latitud,
                  longitud,
                  null,
                  address,
                  type,
                  null,
                  null,
                  subtype,
                  id,
                  day,
                  hour,
                  fuente3,
                ];
              }

              return null;
            })
            .filter(Boolean); // Filtrar elementos nulos

          setAlertasIrregularidades(1);

          //console.log(combinedDataIrregularidades);

          setIrregularidadesData(combinedDataIrregularidades);

          return combinedDataIrregularidades;
        } else {
          console.log("ERROR al cargar las alertas de irregularidades");
          setAlertasIrregularidades(0);
        }
      } else {
        console.log("ERROR al cargar las alertas de irregularidades");
        setAlertasIrregularidades(0);
      }
    } catch (error) {
      console.error("Error en la solicitud API:", error);
      setAlertasIrregularidades(0);
    }
    //finally {
    //  setLoadingPage(false); // Oculta la pantalla de carga
    //}
    return [];
  };

  const fetchDataIncidentes = async () => {
    try {
      const fuente = "P1";
      const res = await fetch(`${backendUrl}/api/geodataIncidentes/${fuente}`);
      if (res.ok) {
        const newData = await res.json();
        setData(newData);
        //console.log(newData);

        console.log("Datos completos correctamente");

        return newData;
      } else {
        console.error("Error al cargar todos los datos");
      }
    } catch (error) {
      console.error("Error en la solicitud API:", error);
    }

    return [];
    //finally {
    //  setLoadingPage(false); // Oculta la pantalla de carga
    //}
  };

  const handleActualizar = (
    on: boolean,
    lati: number,
    longi: number,
    zoom: number,
  ) => {
    //console.log("Actualizar:", on);

    setLatitud(lati);
    setLongitud(longi);
    setActualizar(on);
    setZoom(zoom);

    fetchDataActualizar();
  };

  const fetchDataActualizar = async () => {
    try {
      const responseCountLastDay = await fetch(
        `${backendUrl}/api/countLastHour`,
      );
      if (responseCountLastDay.ok) {
        const newDataCount = await responseCountLastDay.json();
        setdataIncidentLastDay(newDataCount);
      } else {
        console.error("Error al obtener datos del servidor");
      }

      const resTiempoRTAhistorico = await fetch(
        `${backendUrl}/api/AVGtimeRTAhistoricDay`,
      );
      if (resTiempoRTAhistorico.ok) {
        const newDataTiempoRTAhistorico = await resTiempoRTAhistorico.json();
        setTimeRTAhistoric(newDataTiempoRTAhistorico);
        console.log("Datos de tiempo historico cargados correctamente");
      } else {
        console.error("Error al cargar los datos de tiempo historico");
      }

      const resTiempoRTA = await fetch(`${backendUrl}/api/AVGtimeRTALastHour`);
      if (resTiempoRTA.ok) {
        const newDataTiempoRTA = await resTiempoRTA.json();
        setdataTimeRTA(newDataTiempoRTA);
        console.log("Datos de tiempo del día cargados correctamente");
      } else {
        console.error("Error al cargar los datos de tiempo del día");
      }

      const promises = [];

      if (incidentesCheckbox) {
        promises.push(fetchDataIncidentes());
      }
      if (wazeCheckbox) {
        promises.push(fetchDataWaze());
      }
      if (irregularidadesCheckbox) {
        promises.push(fetchDataIrregularidades());
      }
      if (pmtCheckbox) {
        promises.push(fetchDataPMT());
        const dataPMTStramos = await fetchDataPMTtramos();
        setTramoPMTData(dataPMTStramos);
      } else {
        setTramoPMTData([]);
      }

      if (desviosCheckbox) {
        const dataDesvios = await fetchDataDesvios();
        setDesviosData(dataDesvios);
      } else {
        setDesviosData([]);
      }

      if (inteligentesCheckbox) {
        const dataAlertasInteligentes = await fetchDataAlertasInteligentes();
        setInteligentesData(dataAlertasInteligentes);
        promises.push(fetchDataInteligentesPoints());
      } else {
        setInteligentesData([]);
      }

      if (prioridadCheckbox) {
        //promises.push(fetchDataIndiceCongestionAlertas());

        const dataAlertas = await fetchDataIndiceCongestionAlertas();
        setDataGeoAlertas(dataAlertas);
      } else {
        setDataGeoAlertas([]);
      }

      if (salvavidasCheckbox) {
        promises.push(fetchDataSalvavidas());
      }

      if (camCGTCheckbox) {
        promises.push(fetchDataCamCGT());
      }

      if (semaforosCheckbox) {
        promises.push(fetchDataSemaforos());
      }

      if (streamingCheckbox) {
        promises.push(fetchDataStreaming());
        promises.push(fetchDataStreamingSemaforos());
      }

      if (lluviasCheckbox) {
        promises.push(fetchDataLluvias());
      }

      if (origenCheckbox) {
        setAlertasRecomendaciones(1);
        setAlertasOrigen(1);
      }

      if (destinoCheckbox) {
        setAlertasRecomendaciones(2);
        setAlertasDestino(1);
      }

      if (borrarCheckbox) {
        setAlertasRecomendaciones(3);
        setAlertasBorrar(1);
      }

      if (!origenCheckbox && !destinoCheckbox && !borrarCheckbox) {
        setAlertasRecomendaciones(0);
        setAlertasOrigen(0);
        setAlertasDestino(0);
        setAlertasBorrar(0);
      }

      const allData = (await Promise.all(promises)).flat();
      setDataGeo(allData);

      fetchDataIndiceCongestion();

      fetchDataWazeVel();

      //setActualizar(false);
    } catch (error) {
      console.error("Error en la solicitud API:", error);
    }
  };

  //console.log(opcVel);

  return (
    <div className="w-full h-screen px-0 py-0">
      {loadingPage && <LoadingScreen />}

      {
        //<Map ubicaciones={dataGeo} velocidadesWazeAlta={wazeDataVelAlta} velocidadesWazeMedia={wazeDataVelMedia} velocidadesWazeBaja={wazeDataVelBaja} opcDropdownVel={opcVel} lat={latitud} lng={longitud} congestionDataAlta={congestionDataAlta} congestionDataMedia={congestionDataMedia} congestionDataBaja={congestionDataBaja} ubicacionesAlertas={dataGeoAlertas} onChangeActualizar={handleActualizar} zoom={zoom} actualizar={actualizar}/>
        <Map
          ubicaciones={dataGeo}
          velocidadesWaze1={wazeDataVel1}
          velocidadesWaze2={wazeDataVel2}
          velocidadesWaze3={wazeDataVel3}
          velocidadesWaze4={wazeDataVel4}
          velocidadesWaze5={wazeDataVel5}
          tramoPMT={pmtTramoData}
          desvios={desviosData}
          inteligentes={inteligentesData}
          opcDropdownVel={opcVel}
          lat={latitud}
          lng={longitud}
          congestionDataAlta={congestionDataAlta}
          congestionDataMedia={congestionDataMedia}
          congestionDataBaja={congestionDataBaja}
          predictionWidgetVisible={predictionWidgetVisible}
          predictionLoading={predictionLoading}
          predictionAnalysisLoading={predictionAnalysisLoading}
          predictionInteractionDisabled={predictionInteractionDisabled}
          predictionLoadingCorridors={predictionLoadingCorridors}
          predictionCongestionData={visiblePredictionCongestionData}
          predictionRegions={predictionRegions}
          selectedPredictionAreaType={selectedPredictionAreaType}
          onPredictionAreaTypeChange={handlePredictionAreaTypeChange}
          selectedPredictionRegion={selectedPredictionRegion}
          onPredictionRegionChange={handlePredictionRegionChange}
          predictionTimeframes={predictionTimeframes}
          predictionReferenceTimeslot={predictionReferenceTimeslot}
          selectedPredictionTimeslot={selectedPredictionTimeslot}
          onPredictionTimeslotChange={setSelectedPredictionTimeslot}
          predictionStepMinutes={predictionStepMinutes}
          predictionNoDataMessage={predictionNoDataMessage}
          ubicacionesAlertas={dataGeoAlertas}
          onChangeActualizar={handleActualizar}
          onChangeActualizarStreaming={handleActualizarStreaming}
          onChangeOrigins={handleOriginsChange}
          onChangeRecomendaciones={handleRecomendacionesChange}
          zoom={zoom}
          recomendaciones={alertasRecomendaciones}
          areaslocalidades={areasLocalidades}
        />
      }

      <ControlPanel
        alertasDesvios={alertasDesvios}
        alertasPMT={alertasPMT}
        alertasWaze={alertasWaze}
        alertasIrregularidades={alertasIrregularidades}
        alertasPrioridad={alertasPrioridad}
        alertasInteligentes={alertasInteligentes}
        alertasSalvavidas={alertasSalvavidas}
        alertasCGT={alertasCGT}
        alertasSemaforos={alertasSemaforos}
        alertasStreaming={alertasStreaming}
        alertasLluvias={alertasLluvias}
        alertasOrigen={alertasOrigen}
        alertasDestino={alertasDestino}
        alertasBorrar={alertasBorrar}
        opcOtic={opcOtic}
        opcCongestion={opcCongestion}
        opcPredictions={opcPredictions}
        onChangeAlertas={handleLayerToggleAlertas}
        onChangeActivos={handleLayerToggleActivos}
        onChangeCondiciones={handleLayerToggleCondiciones}
        onChangeRecomendaciones={handleLayerToggleRecomendaciones}
        onChangeVel={handleLayerToggleVel}
        tiempoHistorico={dataTimeRTAhistoric}
        tiempo={dataTimeRTA}
        numIncidentesLastDay={dataincidentLastDay}
        vistaTrafico={vistaTrafico}
        dataIDstreaming={dataIDstreaming}
        fuenteStreaming={fuenteStreaming}
        opcListaAlertas={vistaTrafico}
        opcVel={opcVel}
        isPredictionWidgetVisible={predictionWidgetVisible}
        onTogglePredictionWidget={() =>
          setPredictionWidgetVisible((previous) => !previous)
        }
        originsCount={originsData.length}
      />
    </div>
  );
}
