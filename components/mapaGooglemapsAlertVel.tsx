"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { PredictionFeatureController } from "./prediction/prediction-feature-controller";
import { PredictionFeatureProps } from "./prediction/prediction-types";

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

const NEXT_PUBLIC_GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Cache global para iconos SVG
const svgIconCache = new Map<string, string>();

// Función para crear iconos rotados
async function createMarkerIcon(
  markerIcon: string | any,
  rotation: number = 0,
): Promise<any> {
  try {
    // Extrae la URL si el parámetro es un objeto
    const iconUrl =
      typeof markerIcon === "string"
        ? markerIcon
        : markerIcon?.url || markerIcon;

    // Solo procesar archivos SVG que contengan 'streamingSemaforos'
    if (
      typeof iconUrl === "string" &&
      iconUrl.includes("streamingSemaforos.svg")
    ) {
      // Verificar si ya tenemos el contenido en cache
      let svgContent = svgIconCache.get(iconUrl);

      if (!svgContent) {
        // Fetch del archivo SVG si no está en cache
        try {
          const response = await fetch(iconUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch SVG: ${response.status}`);
          }
          svgContent = await response.text();
          // Guardar en cache para futuros usos
          svgIconCache.set(iconUrl, svgContent);
        } catch (fetchError) {
          console.error("Error fetching SVG:", fetchError);
          // Fallback: retornar objeto básico sin rotación
          return {
            url: iconUrl,
            scaledSize: new window.google.maps.Size(50, 50),
            anchor: new window.google.maps.Point(16, 16),
          };
        }
      }

      // Aplicar rotación al SVG usando CSS transform
      const rotatedSvg = svgContent.replace(
        /<svg([^>]*)>/,
        `<svg$1 style="transform: rotate(${rotation - 90}deg); transform-origin: center;">`,
      );

      // Crear data URL con el SVG rotado
      const dataUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(rotatedSvg)}`;

      return {
        url: dataUrl,
        scaledSize: new window.google.maps.Size(50, 50),
        anchor: new window.google.maps.Point(16, 16),
      };
    }

    // Para iconos que no son streamingSemaforos.svg, retornar como está
    if (typeof markerIcon === "string") {
      return {
        url: markerIcon,
        scaledSize: new window.google.maps.Size(32, 32),
        anchor: new window.google.maps.Point(16, 16),
      };
    }

    // Si ya es un objeto, retornarlo tal como está
    return markerIcon;
  } catch (error) {
    console.error("Error in createMarkerIcon:", error);
    // Fallback en caso de error
    return typeof markerIcon === "string"
      ? { url: markerIcon, scaledSize: new window.google.maps.Size(32, 32) }
      : markerIcon;
  }
}

interface MapaGoogleMapsProps extends PredictionFeatureProps {
  ubicaciones: any[];
  velocidadesWaze1: any[];
  velocidadesWaze2: any[];
  velocidadesWaze3: any[];
  velocidadesWaze4: any[];
  velocidadesWaze5: any[];
  tramoPMT: any[];
  desvios: any[];
  inteligentes: any[];
  opcDropdownVel: string;
  lat: number;
  lng: number;
  congestionDataAlta: any;
  congestionDataMedia: any;
  congestionDataBaja: any;
  predictionLoading: boolean;
  ubicacionesAlertas: any[];
  onChangeActualizar: (
    on: boolean,
    lati: number,
    longi: number,
    zoom: number,
  ) => void;
  onChangeActualizarStreaming: (id: number, fuente: string) => void;
  onChangeOrigins?: (origins: google.maps.LatLngLiteral[]) => void;
  onChangeRecomendaciones: (recomendaciones: number) => void;
  zoom: number;
  recomendaciones: number;
  areaslocalidades: any[];
}

//export default function MapaGoogleMapsAlertVel({ ubicaciones,velocidadesWazeAlta,velocidadesWazeMedia,velocidadesWazeBaja, opcDropdownVel, lat, lng, congestionDataAlta, congestionDataMedia, congestionDataBaja, ubicacionesAlertas, onChangeActualizar, zoom, actualizar }: MapaGoogleMapsProps) {
export default function MapaGoogleMapsAlertVel({
  ubicaciones,
  velocidadesWaze1,
  velocidadesWaze2,
  velocidadesWaze3,
  velocidadesWaze4,
  velocidadesWaze5,
  tramoPMT,
  desvios,
  inteligentes,
  opcDropdownVel,
  lat,
  lng,
  congestionDataAlta,
  congestionDataMedia,
  congestionDataBaja,
  predictionWidgetVisible,
  predictionCongestionData,
  predictionRegions,
  selectedPredictionRegion,
  onPredictionRegionChange,
  predictionTimeframes,
  predictionReferenceTimeslot,
  selectedPredictionTimeslot,
  onPredictionTimeslotChange,
  predictionStepMinutes,
  predictionLoading,
  ubicacionesAlertas,
  onChangeActualizar,
  onChangeActualizarStreaming,
  onChangeOrigins,
  onChangeRecomendaciones,
  zoom,
  recomendaciones,
  areaslocalidades,
}: MapaGoogleMapsProps) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null); // Referencia persistente del mapa
  const savedBoundsRef = useRef<google.maps.LatLngBounds | null>(null); // Guardar bounds de la ruta
  //const [actualizar, setActualizar] = useState(false);

  const [origins, setOrigins] = useState<google.maps.LatLngLiteral[]>([]);
  const [destinations, setDestinations] = useState<google.maps.LatLngLiteral>({
    lat: 0,
    lng: 0,
  });

  // Notificar al componente padre cuando cambian los origins
  useEffect(() => {
    if (onChangeOrigins) {
      onChangeOrigins(origins);
    }
  }, [origins, onChangeOrigins]);

  let map: google.maps.Map;

  const inputRef = useRef<HTMLInputElement>(null);
  const searchBoxInstance = useRef<google.maps.places.SearchBox | null>(null);

  const animationRefs = useRef<number[]>([]);
  const polylineRefs = useRef<google.maps.Polyline[]>([]);
  const predictionPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const recommendationPolylinesRef = useRef<google.maps.Polyline[]>([]); // Polilíneas de recomendaciones que persisten
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
  const originMarkersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null); // InfoWindow persistente

  // Guardar los datos de las polilíneas para recrear listeners después de re-render
  const recommendationPolylinesDataRef = useRef<
    Array<{
      polyline: google.maps.Polyline;
      originAddress: string;
      destinationAddress: string;
      tiempo: string;
      distancia: string;
    }>
  >([]);

  //console.log("mapaGooglmaps " + lat + " " + lng);

  const [latitud1, setLatitud] = useState<number>(lat);
  const [longitud1, setLongitud] = useState<number>(lng);

  const clustererRefs = useRef<{
    incidente: MarkerClusterer | null;
    waze: MarkerClusterer | null;
    irregularidades: MarkerClusterer | null;
    pmt: MarkerClusterer | null;
    streaming: MarkerClusterer | null;
    lluvias: MarkerClusterer | null;
    salvavidas: MarkerClusterer | null;
    camarasCGT: MarkerClusterer | null;
    semaforos: MarkerClusterer | null;
    inteligentes: MarkerClusterer | null;
  }>({
    incidente: null,
    waze: null,
    irregularidades: null,
    pmt: null,
    streaming: null,
    lluvias: null,
    salvavidas: null,
    camarasCGT: null,
    semaforos: null,
    inteligentes: null,
  });

  const clusterStyles = {
    incidente: [
      {
        url: "/cluster-incidente.png",
        height: 50,
        width: 50,
        anchor: [25, 25],
        textColor: "#ffffff",
        textSize: 12,
      },
    ],
    waze: [
      {
        url: "/cluster-waze.png",
        height: 50,
        width: 50,
        anchor: [25, 25],
        textColor: "#ffffff",
        textSize: 12,
      },
    ],
    irregularidades: [
      {
        url: "/cluster-irregularidades.png",
        height: 50,
        width: 50,
        anchor: [25, 25],
        textColor: "#ffffff",
        textSize: 12,
      },
    ],
    pmt: [
      {
        url: "/cluster-pmt.png",
        height: 50,
        width: 50,
        anchor: [25, 25],
        textColor: "#ffffff",
        textSize: 12,
      },
    ],
    streaming: [
      {
        url: "/cluster-streaming.png",
        height: 50,
        width: 50,
        anchor: [25, 25],
        textColor: "#ffffff",
        textSize: 12,
      },
    ],
    lluvias: [
      {
        url: "/cluster-lluvias.png",
        height: 50,
        width: 50,
        anchor: [25, 25],
        textColor: "#ffffff",
        textSize: 12,
      },
    ],
    salvavidas: [
      {
        url: "/cluster-salvavidas.png",
        height: 50,
        width: 50,
        anchor: [25, 25],
        textColor: "#ffffff",
        textSize: 12,
      },
    ],
    camarasCGT: [
      {
        url: "/cluster-camaras-cgt.png",
        height: 50,
        width: 50,
        anchor: [25, 25],
        textColor: "#ffffff",
        textSize: 12,
      },
    ],
    semaforos: [
      {
        url: "/cluster-semaforos.png",
        height: 50,
        width: 50,
        anchor: [25, 25],
        textColor: "#ffffff",
        textSize: 12,
      },
    ],
    inteligentes: [
      {
        url: "/cluster-inteligentes.png",
        height: 50,
        width: 50,
        anchor: [25, 25],
        textColor: "#ffffff",
        textSize: 12,
      },
    ],
  };

  const iconUrlWarning = "/warning.png";
  const iconUrlVelInfo = "/velInfo.png";
  const iconUrlClock = "/clock20.png";
  const iconUrlClockCongestion = "/congestionHora.png";
  const iconUrlCalendar = "/calendar20.png";
  const iconUrlLocation = "/location20.png";
  const iconUrlVel = "/vel20.png";
  const iconUrlAccident = "/accident.png";
  const iconUrlHazard = "/hazard.png";
  const iconUrlJam = "/jam.png";
  const iconUrlRoadClose = "/roadClose.png";
  const iconUrlCamsalvavidas = "/salvavidas.png";
  const iconUrlCamCGT = "/camCGT.png";
  const iconUrlSemaforos = "/semaforo.png";
  const iconUrlSemaforosNO = "/semaforoNO.png";
  const iconUrlSemaforosFalla = "/semaforoFalla.png";
  const iconUrlInteligentes = "/alertaInteligente.gif";
  const iconUrlInteligentes2 = "/inteligentes.png";
  const iconUrlPrioridad = "/prioridad.png";
  const iconUrlPrioridadGigAlta = "/prioridad.gif";
  const iconUrlPrioridadGigMedia = "/prioridad3.gif";
  const iconUrlPrioridadGigBaja = "/prioridad2.gif";
  const iconUrlPrioridadSemaforos = "/semaforoFalla.gif";
  const iconUrlStreaming = "/streaming.png";
  const iconUrlStreamingNO = "/streamingNO.png";
  const iconUrlStreamingSemaforos = "/streamingSemaforos.svg";
  const iconUrlStreamingSemaforos1 = "/streamingSemaforos1.png";
  const iconUrlPMT = "/pmt.png";
  const iconUrlDesvio = "/desvio.png";
  const iconUrlLluvias = "/lluvia.png";
  const iconUrlLluvias0 = "/lluvias0.png";
  const iconUrlLluvias1 = "/lluvias1.png";
  const iconUrlLluvias2 = "/lluvias2.png";
  const iconUrlLluvias3 = "/lluvias3.png";
  const iconUrlLluvias4 = "/lluvias4.png";
  const iconUrlLluvias0Gif = "/lluvia0.gif";
  const iconUrlLluvias1Gif = "/lluvia1.gif";
  const iconUrlLluvias2Gif = "/lluvia2.gif";
  const iconUrlLluvias3Gif = "/lluvia3.gif";
  const iconUrlLluvias4Gif = "/lluvia4.gif";
  const iconUrlCongestion2 = "/congestion2.png";
  const iconUrlClima = "/clima.png";
  const iconCantidadAlertasWaze = "/cantidadAlertas.png";
  const iconTiposAlertasWaze = "/tipoAlerta.png";
  const iconIdIncidente = "/idIncidente.png";
  const iconTipoIncidente = "/tipoIncidente.png";
  const iconUrlAcumiladoDia1 = "/acumuladoClima1.png";
  const iconUrlAcumiladoDia2 = "/acumuladoClima2.png";
  const iconUrlAcumiladoDia3 = "/acumuladoClima3.png";
  const iconUrlAcumiladoDia4 = "/acumuladoClima4.png";
  const iconUrlAcumiladoDia5 = "/acumuladoClima5.png";
  const iconUrlSemaforoEstado = "/semaforosEstado.png";
  const iconIndiceCongestion = "/indiceCongestion.png";
  const iconAfectados = "/afectados.png";
  const iconTamanoCongestion = "/lenght.png";
  const iconCoordenadas = "/planeta.png";
  const iconRecomendacionesOrigen = "/RecomendacionOrigen.png";
  const iconRecomendacionesDestino = "/RecomendacionDestino.png";
  const iconUrlRutaRecomendada = "/rutaRecomendada.png";

  const getIconUrl = (
    fuente: string,
    incidente: string,
    valorLectura: number,
  ) => {
    if (
      (fuente === "WAZE" || fuente === "IRREGULARIDADES") &&
      (incidente === "HAZARD_ON_ROAD" ||
        incidente === "HAZARD_ON_SHOULDER" ||
        incidente === "HAZARD_WEATHER" ||
        incidente === "HAZARD_ON_ROAD_OBJECT" ||
        incidente === "HAZARD_ON_ROAD_POT_HOLE" ||
        incidente === "HAZARD_ON_ROAD_ROAD_KILL" ||
        incidente === "HAZARD_ON_SHOULDER_CAR_STOPPED" ||
        incidente === "HAZARD_ON_SHOULDER_ANIMALS" ||
        incidente === "HAZARD_ON_SHOULDER_MISSING_SIGN" ||
        incidente === "HAZARD_WEATHER_FOG" ||
        incidente === "HAZARD_WEATHER_HAIL" ||
        incidente === "HAZARD_WEATHER_HEAVY_RAIN" ||
        incidente === "HAZARD_WEATHER_HEAVY_SNOW" ||
        incidente === "HAZARD_WEATHER_FLOOD" ||
        incidente === "HAZARD_WEATHER_MONSOON" ||
        incidente === "HAZARD_WEATHER_TORNADO" ||
        incidente === "HAZARD_WEATHER_HEAT_WAVE" ||
        incidente === "HAZARD_WEATHER_HURRICANE" ||
        incidente === "HAZARD_WEATHER_FREEZING_RAIN" ||
        incidente === "HAZARD_ON_ROAD_LANE_CLOSED" ||
        incidente === "HAZARD_ON_ROAD_OIL" ||
        incidente === "HAZARD_ON_ROAD_ICE" ||
        incidente === "HAZARD_ON_ROAD_CONSTRUCTION" ||
        incidente === "HAZARD_ON_ROAD_CAR_STOPPED" ||
        incidente === "HAZARD_ON_ROAD_TRAFFIC_LIGHT_FAULT" ||
        incidente === "" ||
        incidente === " ")
    ) {
      return iconUrlHazard;
    } else if (
      (fuente === "WAZE" || fuente === "IRREGULARIDADES") &&
      (incidente === "ROAD_CLOSED_HAZARD" ||
        incidente === "ROAD_CLOSED_CONSTRUCTION" ||
        incidente === "ROAD_CLOSED_EVENT")
    ) {
      return iconUrlRoadClose;
    } else if (
      (fuente === "WAZE" || fuente === "IRREGULARIDADES") &&
      (incidente === "JAM_MODERATE_TRAFFIC" ||
        incidente === "JAM_HEAVY_TRAFFIC" ||
        incidente === "JAM_LIGHT_TRAFFIC" ||
        incidente === "JAM_STAND_STILL_TRAFFIC")
    ) {
      return iconUrlJam;
    } else if (
      (fuente === "WAZE" || fuente === "IRREGULARIDADES") &&
      (incidente === "ACCIDENT_MINOR" || incidente === "ACCIDENT_MAJOR")
    ) {
      return iconUrlAccident;
    } else if (fuente === "P1") {
      return iconUrlWarning;
    } else if (fuente === "PMT") {
      return iconUrlPMT;
    } else if (fuente === "CAMARASSALVAVIDAS") {
      return iconUrlCamsalvavidas;
    } else if (fuente === "CAMARASCGT") {
      return iconUrlCamCGT;
    } else if (fuente === "INTELIGENTES") {
      return {
        url: iconUrlInteligentes,
        scaledSize: new window.google.maps.Size(80, 80),
      };
    } else if (fuente === "SEMAFOROS") {
      return iconUrlSemaforos;
    } else if (fuente === "SEMAFOROSNO") {
      return iconUrlSemaforosNO;
    } else if (fuente === "SEMAFOROSFALLA") {
      return iconUrlSemaforosFalla;
    } else if (fuente === "STREAMINGSEMAFOROS") {
      return iconUrlStreamingSemaforos;
    } else if (fuente === "STREAMING" && incidente === "Activa") {
      return iconUrlStreaming;
    } else if (fuente === "STREAMING" && incidente === "No Funciona") {
      return iconUrlStreamingNO;
    } else if (fuente === "CONGESTIONPRIORIDAD" && incidente === "bajo") {
      return {
        url: iconUrlPrioridadGigBaja,
        scaledSize: new window.google.maps.Size(70, 70), // Tamaño del icono 80x80
      };
    } else if (fuente === "CONGESTIONPRIORIDAD" && incidente === "medio") {
      return {
        url: iconUrlPrioridadGigMedia,
        scaledSize: new window.google.maps.Size(70, 70), // Tamaño del icono 80x80
      };
    } else if (fuente === "CONGESTIONPRIORIDAD" && incidente === "alto") {
      return {
        url: iconUrlPrioridadGigAlta,
        scaledSize: new window.google.maps.Size(70, 70), // Tamaño del icono 80x80
      };
    } else if (fuente === "CONGESTIONPRIORIDADSEMAFOROS") {
      return {
        url: iconUrlPrioridadSemaforos,
        scaledSize: new window.google.maps.Size(60, 60), // Tamaño del icono 80x80
      };
    } else if (
      fuente === "LLUVIAS" &&
      incidente === "Sin Lluvias" &&
      valorLectura === 0
    ) {
      return iconUrlLluvias0;
    } else if (
      fuente === "LLUVIAS" &&
      incidente === "Sin Lluvias" &&
      valorLectura >= 0.1
    ) {
      return iconUrlLluvias0Gif;
    } else if (
      fuente === "LLUVIAS" &&
      incidente === "Acumulados Bajos" &&
      valorLectura === 0
    ) {
      return iconUrlLluvias1;
    } else if (
      fuente === "LLUVIAS" &&
      incidente === "Acumulados Bajos" &&
      valorLectura >= 0.1
    ) {
      return iconUrlLluvias1Gif;
    } else if (
      fuente === "LLUVIAS" &&
      incidente === "Acumulados Moderados" &&
      valorLectura === 0
    ) {
      return iconUrlLluvias2;
    } else if (
      fuente === "LLUVIAS" &&
      incidente === "Acumulados Moderados" &&
      valorLectura >= 0.1
    ) {
      return iconUrlLluvias2Gif;
    } else if (
      fuente === "LLUVIAS" &&
      incidente === "Acumulados Altos" &&
      valorLectura === 0
    ) {
      return iconUrlLluvias3;
    } else if (
      fuente === "LLUVIAS" &&
      incidente === "Acumulados Altos" &&
      valorLectura >= 0.1
    ) {
      return iconUrlLluvias3Gif;
    } else if (
      fuente === "LLUVIAS" &&
      incidente === "Acumulados Muy Altos" &&
      valorLectura === 0
    ) {
      return iconUrlLluvias4;
    } else if (
      fuente === "LLUVIAS" &&
      incidente === "Acumulados Muy Altos" &&
      valorLectura >= 0.1
    ) {
      return iconUrlLluvias4Gif;
    } else {
      return "";
    }
  };

  const styles = {
    default: [
      { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
      {
        featureType: "poi.park",
        elementType: "geometry",
        stylers: [{ color: "#263c3f" }],
      },
      {
        featureType: "poi.park",
        elementType: "labels.text.fill",
        stylers: [{ color: "#6b9a76" }],
      },
      {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#38414e" }],
      },
      {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#212a37" }],
      },
      {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ color: "#9ca5b3" }],
      },
      {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#746855" }],
      },
      {
        featureType: "road.highway",
        elementType: "geometry.stroke",
        stylers: [{ color: "#1f2835" }],
      },
      {
        featureType: "road.highway",
        elementType: "labels.text.fill",
        stylers: [{ color: "#f3d19c" }],
      },
      {
        featureType: "transit",
        elementType: "geometry",
        stylers: [{ color: "#2f3948" }],
      },
      {
        featureType: "transit.station",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
      },
      {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#17263c" }],
      },
      {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ color: "#515c6d" }],
      },
      {
        featureType: "water",
        elementType: "labels.text.stroke",
        stylers: [{ color: "#17263c" }],
      },
      {
        featureType: "poi.business",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "poi.attraction",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "poi.medical",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "poi.government",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "poi.park",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "poi.school",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "poi.sports_complex",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "poi.place_of_worship",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "transit",
        elementType: "labels.icon",
        stylers: [{ visibility: "on" }],
      },
    ],
  };

  // useEffect para reaplicar bounds después del re-render causado por onChangeRecomendaciones
  useEffect(() => {
    if (
      savedBoundsRef.current &&
      mapInstanceRef.current &&
      recomendaciones === 0
    ) {
      // Reaplicar los bounds guardados después de un breve delay para asegurar que el re-render haya terminado
      const timer = setTimeout(() => {
        if (mapInstanceRef.current && savedBoundsRef.current) {
          mapInstanceRef.current.fitBounds(savedBoundsRef.current, 100);
        }
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [recomendaciones]);

  useEffect(() => {
    const interval = setInterval(
      () => {
        fetchDataActualizar();
      },
      2 * 60 * 1000,
    ); // 2 minutos

    const initMap = async () => {
      if (!mapRef.current || !window.google) {
        console.error("Google Maps not loaded");
        return;
      }

      let zoomMapa = 10;
      if (
        (lat === 0 && lng === 0) ||
        (lat === 4.6573506 && lng === -74.0909468)
      ) {
        lat = 4.6573506;
        lng = -74.0909468;
        zoomMapa = 12.5;
      } else {
        zoomMapa = zoom;
      }

      map = new window.google.maps.Map(mapRef.current, {
        center: { lat: lat, lng: lng },
        zoom: zoomMapa,

        cameraControl: true,
        cameraControlOptions: {
          position: google.maps.ControlPosition.LEFT_BOTTOM,
        },

        rotateControl: true,
        rotateControlOptions: {
          position: google.maps.ControlPosition.BOTTOM_LEFT,
        },

        mapTypeControl: true,
        mapTypeControlOptions: {
          position: google.maps.ControlPosition.BOTTOM_LEFT,
        },

        streetViewControl: true,
        streetViewControlOptions: {
          position: google.maps.ControlPosition.LEFT_BOTTOM,
        },

        fullscreenControl: true,
        fullscreenControlOptions: {
          position: google.maps.ControlPosition.LEFT_TOP,
        },

        styles: styles.default,
      });

      // Guardar referencia del mapa para usarlo en otras funciones
      mapInstanceRef.current = map;

      // la orientación de la cámara en grados en sentido horario desde el norte, pero sólo funciona ara lugares cómo USA y con zoom mayor a 16
      //map.setHeading(45);
      //map.setTilt(10);

      //cuadro de búsqueda de direcciones de Google Maps
      const input = document.getElementById("pac-input") as HTMLInputElement;

      // Verificar que la API de Places esté disponible antes de crear Autocomplete
      if (input && google.maps.places && google.maps.places.Autocomplete) {
        const autocomplete = new google.maps.places.Autocomplete(input);
        autocomplete.setComponentRestrictions({
          country: ["co"],
        });
        autocomplete.setBounds(map.getBounds() as google.maps.LatLngBounds);
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place.geometry || !place.geometry.location) {
            window.alert("No se tiene información de: '" + place.name + "'");
            return;
          }

          if (place.geometry.viewport) {
            map.fitBounds(place.geometry.viewport);
          } else {
            map.setCenter(place.geometry.location);
            map.setZoom(17);
          }
        });
      } else {
        console.warn(
          "Google Maps Places API no está disponible o el elemento pac-input no se encontró",
        );
      }

      // un cuadro emergente vacío, que se utilizará para mostrar información de los marcadores
      // Usar el ref para mantener la misma instancia entre re-renders
      if (!infoWindowRef.current) {
        infoWindowRef.current = new window.google.maps.InfoWindow();
      }
      const infoWindow = infoWindowRef.current;

      if (origins && origins.length > 0) {
        origins.forEach((origin) => {
          var marcador: google.maps.Marker = new window.google.maps.Marker({
            position: origin as google.maps.LatLng | google.maps.LatLngLiteral,
            map: map,
            icon: iconRecomendacionesOrigen,
          });
          // Guardar referencia del marcador
          originMarkersRef.current.push(marcador);
        });
      }

      if (destinations && destinations.lat != 0 && destinations.lng != 0) {
        // Limpiar marcador anterior si existe
        if (destinationMarkerRef.current) {
          destinationMarkerRef.current.setMap(null);
        }

        var marcador: google.maps.Marker = new window.google.maps.Marker({
          position: destinations as
            | google.maps.LatLng
            | google.maps.LatLngLiteral,
          map: map,
          icon: iconRecomendacionesDestino,
        });

        // Guardar referencia del marcador
        destinationMarkerRef.current = marcador;
      }

      if (recomendaciones == 1) {
        google.maps.event.addListener(map, "click", (event) => {
          //addMarker(event.latLng, map);
          var marcador: google.maps.Marker = new window.google.maps.Marker({
            position: event.latLng as
              | google.maps.LatLng
              | google.maps.LatLngLiteral,
            map: map,
            icon: iconRecomendacionesOrigen,
          });

          // Guardar referencia del marcador
          originMarkersRef.current.push(marcador);

          //se adiciona al arreglo de origins los nuevos marcadores
          setOrigins((prev) => {
            const newOrigins = [...prev, event.latLng.toJSON()];
            console.log("Origins actualizados:", newOrigins);
            return newOrigins;
          });
        });
      } else if (recomendaciones == 2) {
        if (origins && origins.length > 0) {
          // Centrar el mapa en el último marcador de origen
          const firstOrigin = origins[origins.length - 1];
          if (firstOrigin && firstOrigin.lat !== 0 && firstOrigin.lng !== 0) {
            map.setCenter({ lat: firstOrigin.lat, lng: firstOrigin.lng });
            map.setZoom(15);
          }

          google.maps.event.addListener(map, "click", (event) => {
            // Eliminar el marcador de destino anterior si existe
            if (destinationMarkerRef.current) {
              destinationMarkerRef.current.setMap(null);
              destinationMarkerRef.current = null;
            }

            //addMarker(event.latLng, map);
            var marcador: google.maps.Marker = new window.google.maps.Marker({
              position: event.latLng as
                | google.maps.LatLng
                | google.maps.LatLngLiteral,
              map: map,
              icon: iconRecomendacionesDestino,
            });

            // Guardar referencia del nuevo marcador
            destinationMarkerRef.current = marcador;

            // Obtener coordenadas del clic
            const clickedCoords = event.latLng.toJSON();

            // Actualizar el estado
            setDestinations(clickedCoords);

            // Pasar las coordenadas directamente a la función
            moduloRecomendaciones(clickedCoords, infoWindow);
          });
        }
      } else if (recomendaciones == 3) {
        // Eliminar todos los marcadores de origins del mapa
        originMarkersRef.current.forEach((marker) => {
          if (marker) {
            marker.setMap(null);
          }
        });
        // Limpiar el array de referencias
        originMarkersRef.current = [];

        // Eliminar el marcador de destino si existe
        if (destinationMarkerRef.current) {
          destinationMarkerRef.current.setMap(null);
          destinationMarkerRef.current = null;
        }

        // Eliminar todas las polilíneas de recomendaciones
        recommendationPolylinesRef.current.forEach((polyline) => {
          if (polyline) {
            polyline.setMap(null);
          }
        });
        recommendationPolylinesRef.current = [];
        recommendationPolylinesDataRef.current = []; // También limpiar los datos guardados

        // Limpiar los estados
        setOrigins([]);
        setDestinations({ lat: 0, lng: 0 });
      }

      if (tramoPMT && tramoPMT.length > 0) {
        loadGeoJsonDataTramoPMT(
          makeGeoJSONVel(tramoPMT, "pmt"),
          map,
          "#600924",
          infoWindow,
        );
      }

      if (desvios && desvios.length > 0) {
        loadGeoJsonDataDesvios(
          makeGeoJSONVel(desvios, "desvios"),
          map,
          "#7045ec",
          infoWindow,
        );
      }

      if (inteligentes && inteligentes.length > 0) {
        loadGeoJsonDataInteligentes(
          makeGeoJSONVel(inteligentes, "inteligentes"),
          map,
          "#ec4570",
          infoWindow,
        );
      }

      if (
        ubicacionesAlertas !== null &&
        ubicacionesAlertas !== undefined &&
        ubicacionesAlertas.length > 0
      ) {
        const markersAlertas = ubicacionesAlertas
          .map((ubicacionAlertas) => {
            const latitud = parseFloat(ubicacionAlertas[0]);
            const longitud = parseFloat(ubicacionAlertas[1]);
            const direccion = ubicacionAlertas[3];
            const incidente = ubicacionAlertas[7];
            const fuente = ubicacionAlertas[11];
            const idAlerta = ubicacionAlertas[8];
            const valorLectura = parseFloat(ubicacionAlertas[5]); // Nuevo campo para valor de lectura, asumiendo que está en el índice 12

            if (isNaN(latitud) || isNaN(longitud)) {
              console.error(`Invalid coordinates: ${latitud}, ${longitud}`);
              return null;
            }

            const markerAlerta = new window.google.maps.Marker({
              position: { lat: latitud, lng: longitud },
              map: map,
              icon: getIconUrl(fuente, incidente, valorLectura),
              title: direccion,
              optimized: false,
            });

            const content = buildContent(ubicacionAlertas);

            markerAlerta.addListener("click", () => {
              if (infoWindow) {
                infoWindow.setContent(content);
                infoWindow.open(map, markerAlerta);
              }
            });

            return markerAlerta;
          })
          .filter((markerAlerta) => markerAlerta !== null);

        const clustererAlertas = new MarkerClusterer({
          markers: markersAlertas,
          map,
        });
      }

      // ========== KMZ LAYER PARA NUBES DE RADAR ==========
      const hasLluviasData = ubicaciones.some(
        (ubicacion) => ubicacion[11] === "LLUVIAS",
      );

      if (hasLluviasData && ubicaciones.length > 0) {
        const timestamp = new Date().getTime();
        // Usamos el proxy de SUANET para cachear el KMZ y reducir requests a SIRE
        const kmzUrl = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/reflectividad.kmz?t=${timestamp}`;

        new google.maps.KmlLayer({
          preserveViewport: true,
          url: kmzUrl,
          map: map,
          suppressInfoWindows: false,
          screenOverlays: true,
        });
      }
      // ========== FIN KMZ LAYER ==========

      // Dibujar áreas de localidades
      if (
        areaslocalidades &&
        areaslocalidades.length > 0 &&
        ubicaciones.length > 0 &&
        hasLluviasData
      ) {
        console.log("Areas localidades:", areaslocalidades);

        const colors = [
          "#c700385b",
          "#ff58334b",
          "#900c3f3d",
          "#5818456c",
          "#1f618d4f",
          "#117a6550",
          "#27ae5f46",
          "#f39d123f",
          "#d4ac0d44",
          "#f7dc6f63",
          "#e74d3c41",
          "#8d44ad52",
          "#3498db56",
          "#16a0845b",
          "#2c3e506c",
        ];

        areaslocalidades.forEach((area, index) => {
          const coordinates = area.coordinates[0].map((coord: any) => ({
            lat: parseFloat(coord[1]),
            lng: parseFloat(coord[0]),
          }));

          const polygonColor = colors[index % colors.length]; // Cicla a través de los colores

          const areaPolygon = new window.google.maps.Polygon({
            paths: coordinates,
            strokeColor: polygonColor,
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: polygonColor,
            fillOpacity: 0.35,
          });

          areaPolygon.setMap(map);
        });
      }

      // Objetos para almacenar marcadores por categoría
      type CategoryKey =
        | "incidente"
        | "waze"
        | "irregularidades"
        | "pmt"
        | "streaming"
        | "lluvias"
        | "salvavidas"
        | "camarasCGT"
        | "semaforos"
        | "inteligentes";
      const markersByCategory: Record<CategoryKey, google.maps.Marker[]> = {
        incidente: [],
        waze: [],
        irregularidades: [],
        pmt: [],
        streaming: [],
        lluvias: [],
        salvavidas: [],
        camarasCGT: [],
        semaforos: [],
        inteligentes: [],
      };

      if (
        ubicaciones !== null &&
        ubicaciones !== undefined &&
        ubicaciones.length > 0
      ) {
        // Función para crear un marcador individual con el contexto correcto
        const createSingleMarker = async (item: any) => {
          const latitud = parseFloat(item[0]);
          const longitud = parseFloat(item[1]);
          const status = item[2];
          const direccion = item[3];
          const tipoIncidente = item[4];
          const subdivision = item[5];
          const localidad = item[6];
          let incidente = item[7];
          const numeroIncidente = parseFloat(item[8]);
          const fechaIncidente = item[9];
          const horaIncidente = item[10];
          const fuente = item[11];
          // Solo extraer rotación para STREAMINGSEMAFOROS, desde el índice correcto
          const rotacion =
            fuente === "STREAMINGSEMAFOROS" ? parseFloat(item[14]) || 0 : 0;

          if (fuente === "LLUVIAS") {
            const descripcionLluvias = item[7];
            incidente = nivelLLuvias(parseFloat(item[8]));
          }

          if (isNaN(latitud) || isNaN(longitud)) {
            console.error(`Invalid coordinates: ${latitud}, ${longitud}`);
            return null;
          }

          var latLng = new google.maps.LatLng(
            parseFloat(item[0]),
            parseFloat(item[1]),
          );

          // Crear icono con o sin rotación según el tipo
          let iconData;
          if (fuente === "STREAMINGSEMAFOROS") {
            iconData = await createMarkerIcon(
              getIconUrl(fuente, incidente, 0),
              rotacion,
            );
          } else {
            iconData = getIconUrl(fuente, incidente, 0);
          }

          var marcador = new window.google.maps.Marker({
            position: latLng,
            map: map,
            icon: iconData,
          });

          let content;

          if (fuente === "INTELIGENTES") {
            content = buildContentInteligentes(item[8]);
          } else {
            content = buildContent(item);
          }

          // Crear el event listener con las variables capturadas correctamente
          marcador.addListener("click", () => {
            if (fuente === "STREAMING" || fuente === "STREAMINGSEMAFOROS") {
              onChangeActualizarStreaming(item[8], fuente);
            }
            if (infoWindow) {
              infoWindow.setContent(content);
              infoWindow.open(map, marcador);
            }
          });

          return { marcador, fuente };
        };

        // Crear marcadores con soporte para rotación
        const createMarkers = async () => {
          for (const item of ubicaciones) {
            const result = await createSingleMarker(item);
            if (result) {
              const { marcador, fuente } = result;

              if (
                fuente === "SEMAFOROS" ||
                fuente === "SEMAFOROSNO" ||
                fuente === "SEMAFOROSFALLA"
              ) {
                markersByCategory.semaforos.push(marcador);
              } else if (fuente === "INTELIGENTES") {
                markersByCategory.inteligentes.push(marcador);
              } else if (
                fuente === "STREAMING" ||
                fuente === "STREAMINGSEMAFOROS"
              ) {
                markersByCategory.streaming.push(marcador);
              } else if (fuente === "CAMARASCGT") {
                markersByCategory.camarasCGT.push(marcador);
              } else if (fuente === "CAMARASSALVAVIDAS") {
                markersByCategory.salvavidas.push(marcador);
              } else if (fuente === "LLUVIAS") {
                markersByCategory.lluvias.push(marcador);
              } else if (fuente === "PMT") {
                markersByCategory.pmt.push(marcador);
              } else if (fuente === "WAZE") {
                markersByCategory.waze.push(marcador);
              } else if (fuente === "P1") {
                markersByCategory.incidente.push(marcador);
              } else if (fuente === "IRREGULARIDADES") {
                markersByCategory.irregularidades.push(marcador);
              }
            }
          }
        };

        await createMarkers();

        Object.entries(markersByCategory).forEach(([category, markers]) => {
          if (markers.length > 0) {
            clustererRefs.current[category as CategoryKey] =
              new MarkerClusterer({
                map,
                markers,
                renderer: {
                  render: ({ count, position }) => {
                    // Personalizar el icono del cluster según la categoría
                    const iconUrl = `/cluster-${category}.png`;
                    return new google.maps.Marker({
                      position,
                      icon: {
                        url: iconUrl,
                        scaledSize: new google.maps.Size(60, 60),
                      },
                      label: {
                        text: String(count),
                        color: "black",
                        fontSize: "14px",
                        fontWeight: "bold",
                      },
                    });
                  },
                },
              });
          }
        });
      }

      if (opcDropdownVel === "waze" || opcDropdownVel === "P1") {
        const trafficLayer = new google.maps.TrafficLayer();
        trafficLayer.setMap(map);
      } else if (
        opcDropdownVel === "JAMS" ||
        opcDropdownVel === "oprimirJAMS"
      ) {
        loadGeoJsonData(
          makeGeoJSONVel(velocidadesWaze1, "vel"),
          map,
          "#20ac54",
          infoWindow,
        );
        loadGeoJsonData(
          makeGeoJSONVel(velocidadesWaze2, "vel"),
          map,
          "#f4c30d",
          infoWindow,
        );
        loadGeoJsonData(
          makeGeoJSONVel(velocidadesWaze3, "vel"),
          map,
          "#f6834a",
          infoWindow,
        );
        loadGeoJsonData(
          makeGeoJSONVel(velocidadesWaze4, "vel"),
          map,
          "#c10408",
          infoWindow,
        );
        loadGeoJsonData(
          makeGeoJSONVel(velocidadesWaze5, "vel"),
          map,
          "#6d021d",
          infoWindow,
        );
      } else if (
        opcDropdownVel === "CONGESTION" ||
        opcDropdownVel === "oprimirCONGESTION"
      ) {
        loadGeoJsonData(
          makeGeoJSONVel(congestionDataAlta, "vel"),
          map,
          "#6bca70",
          infoWindow,
        );
        loadGeoJsonData(
          makeGeoJSONVel(congestionDataMedia, "vel"),
          map,
          "#f19d5d",
          infoWindow,
        );
        loadGeoJsonData(
          makeGeoJSONVel(congestionDataBaja, "vel"),
          map,
          "#dd4e47",
          infoWindow,
        );
      }

      // Redibujar polilíneas de recomendaciones si existen y re-attachar listeners
      if (recommendationPolylinesDataRef.current.length > 0) {
        console.log(
          "Redibujando polilíneas de recomendaciones en el nuevo mapa...",
        );

        recommendationPolylinesDataRef.current.forEach((polylineData) => {
          const {
            polyline,
            originAddress,
            destinationAddress,
            tiempo,
            distancia,
          } = polylineData;

          if (polyline) {
            // Redibujar la polilínea en el nuevo mapa
            polyline.setMap(map);

            // Re-attachar el event listener (necesario después de re-render)
            google.maps.event.clearListeners(polyline, "click"); // Limpiar listeners antiguos

            polyline.addListener("click", (event: any) => {
              const content = `
                <div class="proper">
                  <div class="icon">
                    <img src="${iconUrlRutaRecomendada}" alt="icon" title='Simulación'/>
                    <span class="fa-sr-only">Simulación</span>
                  </div>
                  <div class="details">
                    <div class="id">Origen: ${originAddress}</div>
                    <div class="id">Destino: ${destinationAddress}</div>
                    <div class="id">Tiempo: ${tiempo}</div>
                    <div class="id">Distancia: ${distancia}</div>
                  </div>
                </div>
              `;

              // Usar el infoWindow del ref
              if (infoWindowRef.current) {
                infoWindowRef.current.setContent(content);
                infoWindowRef.current.setPosition(event.latLng);
                infoWindowRef.current.open(map);
              }
            });
          }
        });
      }

      // Redibujar marcadores de origen si existen
      if (originMarkersRef.current.length > 0) {
        originMarkersRef.current.forEach((marker) => {
          if (marker) {
            marker.setMap(map);
          }
        });
      }

      // Redibujar marcador de destino si existe
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setMap(map);
      }
    };

    const moduloRecomendaciones = (
      destinationCoords?: google.maps.LatLngLiteral,
      infoWindow?: any,
    ) => {
      // Usar las coordenadas pasadas como parámetro o las del estado
      const finalDestination = destinationCoords || destinations;

      //console.log('Origins:', origins);
      //console.log('Destination:', finalDestination);

      const geocoder = new google.maps.Geocoder();
      const service = new google.maps.DistanceMatrixService();
      const directionsRenderer = new google.maps.DirectionsRenderer();
      const directionsService = new google.maps.DirectionsService();

      if (
        origins.length > 0 &&
        finalDestination.lat !== 0 &&
        finalDestination.lng !== 0
      ) {
        const originLatLngs = origins.map(
          (origin) => new google.maps.LatLng(origin.lat, origin.lng),
        );
        const destinationLatLng = new google.maps.LatLng(
          finalDestination.lat,
          finalDestination.lng,
        );
        service.getDistanceMatrix(
          {
            origins: originLatLngs,
            destinations: [destinationLatLng],
            travelMode: google.maps.TravelMode.DRIVING,
            unitSystem: google.maps.UnitSystem.METRIC,
            avoidHighways: false,
            avoidTolls: false,
          },
          (response, status) => {
            if (status !== "OK") {
              console.error("Error with Distance Matrix service:", status);
            } else {
              const originList = response.originAddresses;
              const destinationList = response.destinationAddresses;
              //console.log('Origenes:', originList);
              //console.log('Destino:', destinationList);

              const destinationAddress = destinationList[0];
              //console.log('Destino seleccionado:', destinationAddress);

              const results = response.rows;

              // Crear array de objetos con información completa para ordenar
              const rutasConTiempo: Array<{
                origin: google.maps.LatLngLiteral;
                durationValue: number; // Duración en segundos
                durationText: string;
                distanceValue: number; // Distancia en metros
                distanceText: string;
                addressText: string;
                index: number;
              }> = [];

              results.forEach((row, index) => {
                const element = row.elements[0];
                if (element.status === "OK") {
                  rutasConTiempo.push({
                    origin: origins[index],
                    durationValue: element.duration.value,
                    durationText: element.duration.text,
                    distanceValue: element.distance.value,
                    distanceText: element.distance.text,
                    addressText: originList[index],
                    index: index,
                  });
                }
              });

              // Ordenar por tiempo de viaje (menor a mayor)
              rutasConTiempo.sort((a, b) => a.durationValue - b.durationValue);

              // Mostrar el mejor origen
              if (rutasConTiempo.length > 0) {
                const mejorRuta = rutasConTiempo[0];
                //console.log(`MEJOR OPCIÓN: Desde: ${mejorRuta.addressText} hasta: ${destinationAddress}  - Tiempo: ${mejorRuta.durationText}  - Distancia: ${mejorRuta.distanceText}`);

                calculateAndDisplayRoute(
                  directionsService,
                  map,
                  mejorRuta.origin,
                  finalDestination,
                  infoWindow,
                  mejorRuta.addressText,
                  destinationAddress,
                  mejorRuta.durationText,
                  mejorRuta.distanceText,
                );
              }
            }
          },
        );
      }
    };

    const calculateAndDisplayRoute = (
      directionsService: google.maps.DirectionsService,
      map: google.maps.Map,
      originCoords: google.maps.LatLngLiteral,
      destinationCoords: google.maps.LatLngLiteral,
      infoWindow: any,
      originAddress: string,
      destinationAddress: string,
      tiempo: string,
      distancia: string,
    ) => {
      const selectedMode: google.maps.TravelMode =
        google.maps.TravelMode.DRIVING;

      if (
        (originCoords.lat === 0 && originCoords.lng === 0) ||
        (destinationCoords.lat === 0 && destinationCoords.lng === 0)
      ) {
        console.warn("Origen o Destino nulos");
      } else {
        const origenCoords = originCoords;
        const destinoCoords = destinationCoords;

        directionsService.route(
          {
            origin: { lat: origenCoords.lat, lng: origenCoords.lng },
            destination: { lat: destinoCoords.lat, lng: destinoCoords.lng },
            travelMode: selectedMode,
          },
          (
            response: google.maps.DirectionsResult | null,
            status: google.maps.DirectionsStatus,
          ) => {
            if (status === "OK" && response) {
              const route = response.routes[0];
              let routePath: google.maps.LatLng[] = [];

              route.legs.forEach((leg) => {
                leg.steps.forEach((step) => {
                  const stepPath = step.path;
                  if (stepPath.length > 0) {
                    routePath.push(...stepPath);
                  }
                });
              });

              // Eliminar todas las polilíneas de recomendaciones
              recommendationPolylinesRef.current.forEach((polyline) => {
                if (polyline) {
                  polyline.setMap(null);
                }
              });
              recommendationPolylinesRef.current = [];
              recommendationPolylinesDataRef.current = [];

              const originAddressFixed = originAddress.split(", Bogotá")[0];
              const destinationAddressFixed =
                destinationAddress.split(", Bogotá")[0];

              //dibuja la polilinea de la ruta recomendada
              drawPolyline(
                routePath,
                map,
                infoWindow,
                originAddressFixed,
                destinationAddressFixed,
                tiempo,
                distancia,
                destinationCoords,
              );
            } else {
              window.alert("Directions request failed due to " + status);
            }
          },
        );
      }
    };

    const drawPolyline = (
      routePath: google.maps.LatLng[],
      map: google.maps.Map,
      infoWindow: any,
      originAddress: string,
      destinationAddress: string,
      tiempo: string,
      distancia: string,
      destinationCoords: google.maps.LatLngLiteral,
    ) => {
      //console.log(routePath);
      const polyline = new google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: getRandomColor(),
        strokeOpacity: 1.0,
        strokeWeight: 9,
      });

      polyline.setMap(map);

      // Guardar la polilínea en la ref para que persista
      recommendationPolylinesRef.current.push(polyline);

      // Guardar los datos de la polilínea para recrear el listener después de re-renders
      recommendationPolylinesDataRef.current.push({
        polyline,
        originAddress,
        destinationAddress,
        tiempo,
        distancia,
      });

      // Función para crear el listener (se puede llamar múltiples veces)
      const attachPolylineListener = () => {
        polyline.addListener("click", (event: any) => {
          const content = `
              <div class="proper">
                <div class="icon">
                  <img src="${iconUrlRutaRecomendada}" alt="icon" title='Simulación'/>
                  <span class="fa-sr-only">Simulación</span>
                </div>
                <div class="details">
                  <div class="id">Origen: ${originAddress}</div>
                  <div class="id">Destino: ${destinationAddress}</div>
                  <div class="id">Tiempo: ${tiempo}</div>
                  <div class="id">Distancia: ${distancia}</div>
                </div>
              </div>
            `;

          // Usar el infoWindow del ref para que persista entre re-renders
          if (infoWindowRef.current) {
            infoWindowRef.current.setContent(content);
            infoWindowRef.current.setPosition(event.latLng);
            infoWindowRef.current.open(map);
          }
        });
      };

      // Adjuntar el listener inicial
      attachPolylineListener();

      // Ajustar el mapa para mostrar toda la ruta
      const bounds = new google.maps.LatLngBounds();
      routePath.forEach((point) => {
        bounds.extend(point);
      });

      // Guardar los bounds en la ref para reaplicarlos después del re-render
      savedBoundsRef.current = bounds;

      // Aplicar el ajuste de vista con un pequeño padding
      map.fitBounds(bounds, 100);

      // Notificar cambio de recomendaciones inmediatamente
      onChangeRecomendaciones(0);
    };

    const getRandomColor = () => {
      // Crear un array de 3 bytes (uno para cada componente RGB)
      const randomBytes = new Uint8Array(3);

      // Llenar el array con valores aleatorios criptográficamente seguros
      crypto.getRandomValues(randomBytes);

      // Extraer los componentes RGB (cada byte es un valor entre 0-255)
      const r = randomBytes[0];
      const g = randomBytes[1];
      const b = randomBytes[2];

      // Convertir a hexadecimal
      const hexR = ("00" + r.toString(16)).slice(-2);
      const hexG = ("00" + g.toString(16)).slice(-2);
      const hexB = ("00" + b.toString(16)).slice(-2);

      return `#${hexR}${hexG}${hexB}`; // Color en formato #RRGGBB
    };

    const nivelLLuvias = (nivel: number | null | undefined): string => {
      if (nivel === null || nivel === undefined) {
        return "Sin información";
      }

      const nivelNumerico = parseFloat(nivel.toString());

      if (isNaN(nivelNumerico)) {
        return "Nivel desconocido";
      }

      if (nivelNumerico == 0 || nivelNumerico === 0.0) {
        return "Sin Lluvias";
      } else if (nivelNumerico > 0 && nivelNumerico <= 10) {
        return "Acumulados Bajos";
      } else if (nivelNumerico > 10 && nivelNumerico <= 30) {
        return "Acumulados Moderados";
      } else if (nivelNumerico > 30 && nivelNumerico <= 50) {
        return "Acumulados Altos";
      } else if (nivelNumerico > 50) {
        return "Acumulados Muy Altos";
      }

      return "Nivel desconocido";
    };

    const makeGeoJSONVel = (velocidadesData: any, info: string) => {
      // console.log(velocidadesData);

      if (!velocidadesData) {
        return {
          type: "FeatureCollection",
          features: [], // No hay datos
        };
      }

      return {
        type: "FeatureCollection",
        features: velocidadesData
          .filter((velDatos: any) => velDatos !== null) // Filtrar elementos nulos
          .map((velDatos: any) => {
            // Verificar si wazeDatos es null antes de acceder a sus propiedades
            if (!velDatos) return null;
            const coordinates = velDatos.coordinates; // Corregir aquí para obtener las coordenadas

            //console.log(velDatos);

            if (coordinates && info === "vel") {
              return {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates,
                },
                properties: {
                  velocidad: velDatos.velocity,
                  title: velDatos.address,
                  hora: velDatos.hour,
                  dia: velDatos.day,
                  id: velDatos.id,
                  level: velDatos.level,
                  delay: velDatos.delay,
                },
              };
            }

            if (coordinates && info === "desvios") {
              return {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates,
                },
                properties: {
                  cambio: velDatos.cambio,
                  sentido: velDatos.sentido,
                },
              };
            }

            if (coordinates && info === "pmt") {
              return {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates,
                },
                properties: {
                  empresa: velDatos.company,
                  direccion: velDatos.address,
                  tipo: velDatos.type,
                  localidad: velDatos.localidad,
                  hora: velDatos.hour,
                  dia: velDatos.day,
                },
              };
            }

            if (coordinates && info === "inteligentes") {
              return {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates,
                },
                properties: {
                  id: velDatos.id,
                  inicio: velDatos.acumuladodia_clima,
                  fin: velDatos.timestamp_endTime,
                  clima: velDatos.valorlectura_clima,
                  climaDia: velDatos.acumuladodia_clima,
                  estadoVia: velDatos.estado_mvi,
                  afectados: velDatos.afectados,
                  length: velDatos.length,
                  nivelAlertas: velDatos.nivel_alertas,
                  trend: velDatos.trend,
                },
              };
            }

            return null;
          })
          .filter(Boolean), // Filtrar elementos nulos si hay algún formato desconocido
      };
    };

    const loadGeoJsonDataTramoPMT = (
      geoJsonData: any,
      map: any,
      strokeColor: string,
      infoWindow: any,
    ) => {
      const dataLayer = new window.google.maps.Data();

      // Establecer el estilo de la capa de datos
      dataLayer.setStyle({
        strokeColor,
        strokeWeight: 3.5,
        fillColor: strokeColor,
        fillOpacity: 0.6,
      });

      dataLayer.addGeoJson(geoJsonData);
      dataLayer.setMap(map);

      dataLayer.addListener("click", (event: any) => {
        const feature = event.feature;

        const empresa = feature.getProperty("empresa");
        const dir = feature.getProperty("direccion");
        const tipo = feature.getProperty("tipo");
        const localidad = feature.getProperty("localidad");
        const hora = feature.getProperty("hora");
        const dia = feature.getProperty("dia");

        const properDiv = document.createElement("div");
        properDiv.classList.add("proper");

        // Icon
        const iconDiv = document.createElement("div");
        iconDiv.classList.add("icon");

        const iconImg = document.createElement("img");
        iconImg.src = iconUrlPMT;
        iconImg.alt = "icon";
        iconImg.title = "PMT";
        iconDiv.appendChild(iconImg);

        const iconSpan = document.createElement("span");
        iconSpan.classList.add("fa-sr-only");
        iconSpan.textContent = "Incidente";
        iconDiv.appendChild(iconSpan);

        properDiv.appendChild(iconDiv);

        // Details
        const detailsDiv = document.createElement("div");
        detailsDiv.classList.add("details");

        const idDiv = document.createElement("div");
        idDiv.classList.add("id");
        idDiv.textContent = tipo;
        detailsDiv.appendChild(idDiv);

        const specificsDir = document.createElement("div");
        specificsDir.classList.add("specifics");
        specificsDir.textContent = `Dirección: ${dir}`;
        detailsDiv.appendChild(specificsDir);

        const specificsEmpresa = document.createElement("div");
        specificsEmpresa.classList.add("specifics");
        specificsEmpresa.textContent = `Empresa: ${empresa}`;
        detailsDiv.appendChild(specificsEmpresa);

        // Features
        const featuresDiv = document.createElement("div");
        featuresDiv.classList.add("features");

        const createFeature = (src: string, title: string, text: string) => {
          const featureDiv = document.createElement("div");

          const img = document.createElement("img");
          img.src = src;
          img.alt = `${title} icon`;
          img.title = title;

          const span = document.createElement("span");
          span.textContent = text;

          featureDiv.appendChild(img);
          featureDiv.appendChild(span);

          return featureDiv;
        };

        featuresDiv.appendChild(
          createFeature(iconUrlLocation, "Velocidad", localidad),
        );
        featuresDiv.appendChild(createFeature(iconUrlClock, "Hora", hora));
        featuresDiv.appendChild(createFeature(iconUrlCalendar, "Fecha", dia));

        detailsDiv.appendChild(featuresDiv);
        properDiv.appendChild(detailsDiv);

        infoWindow.setContent(properDiv);
        infoWindow.setPosition(event.latLng);
        infoWindow.open(map);
      });
    };

    const loadGeoJsonDataInteligentes = (
      geoJsonData: any,
      map: any,
      strokeColor: string,
      infoWindow: any,
    ) => {
      //console.log(geoJsonData);

      polylineRefs.current.forEach((polyline) => polyline.setMap(null));
      polylineRefs.current = [];

      // Recorrer todas las features del GeoJSON
      geoJsonData.features.forEach((feature: any) => {
        // Verificar que sea una feature con geometría LineString
        if (
          feature.type === "Feature" &&
          feature.geometry &&
          feature.geometry.type === "LineString" &&
          Array.isArray(feature.geometry.coordinates)
        ) {
          // Convertir coordenadas a formato LatLngLiteral
          const pathCoordinates = feature.geometry.coordinates.map(
            (coord: [number, number]) => ({
              lat: coord[1],
              lng: coord[0],
            }),
          );

          if (pathCoordinates.length < 2) return;

          // Crear la polyline
          const polyline = new google.maps.Polyline({
            path: pathCoordinates,
            geodesic: true,
            strokeColor:
              feature.properties.nivel_alerta < 10
                ? "#FF0000"
                : feature.properties.nivel_alerta > 20
                  ? "#760D06"
                  : "#E3615B",
            strokeOpacity: 0.8,
            strokeWeight: 10,
          });

          polyline.setMap(map);

          const content = buildContentInteligentes(feature.properties.id);

          polyline.addListener("click", (event: google.maps.PolyMouseEvent) => {
            infoWindow.setContent(content);
            infoWindow.setPosition(event.latLng);
            infoWindow.open(map);
          });
        }
      });

      return () => {
        polylineRefs.current.forEach((polyline) => polyline.setMap(null));
      };
    };

    const loadGeoJsonDataDesvios = (
      geoJsonData: any,
      map: any,
      strokeColor: string,
      infoWindow: any,
    ) => {
      animationRefs.current.forEach((interval) => clearInterval(interval));
      animationRefs.current = [];
      polylineRefs.current.forEach((polyline) => polyline.setMap(null));
      polylineRefs.current = [];

      // Recorrer todas las features del GeoJSON
      geoJsonData.features.forEach((feature: any) => {
        // Verificar que sea una feature con geometría LineString
        if (
          feature.type === "Feature" &&
          feature.geometry &&
          feature.geometry.type === "LineString" &&
          Array.isArray(feature.geometry.coordinates)
        ) {
          // Convertir coordenadas a formato LatLngLiteral
          const pathCoordinates = feature.geometry.coordinates.map(
            (coord: [number, number]) => ({
              lat: coord[1],
              lng: coord[0],
            }),
          );

          if (pathCoordinates.length < 2) return;

          const lineSymbol = {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 5,
            strokeColor: "#393",
            fillColor: "#393",
            fillOpacity: 1,
          };

          const animatedLine = new google.maps.Polyline({
            path: pathCoordinates,
            icons: [
              {
                icon: lineSymbol,
                offset: "100%",
              },
            ],
            strokeColor: strokeColor,
            strokeOpacity: 1,
            map: map,
          });

          polylineRefs.current.push(animatedLine);

          const velocidadAnimacion = 150; // ms (más bajo = más rápido)
          //let direction = 1; // 1 para adelante, -1 para atrás
          let count = 0;

          const animateIcon = () => {
            count += 1;

            if (count >= 100) {
              count = 0;
            }
            /*  
              // Cambiar la dirección de la animación al llegar a los extremos
              count += direction;
              
              if (count >= 100) {
                direction = -1;
                count = 100;
              } else if (count <= 0) {
                direction = 1;
                count = 0;
              }
              */

            const icons = animatedLine.get("icons");
            icons[0].offset = `${count}%`;
            animatedLine.set("icons", icons);
          };

          const intervalId = window.setInterval(
            animateIcon,
            velocidadAnimacion,
          );
          animationRefs.current.push(intervalId);

          google.maps.event.addListener(
            animatedLine,
            "click",
            (event: google.maps.PolyMouseEvent) => {
              const latLng = event.latLng;

              const properDiv = document.createElement("div");
              properDiv.classList.add("proper");

              // Icon
              const iconDiv = document.createElement("div");
              iconDiv.classList.add("icon");

              const iconImg = document.createElement("img");
              iconImg.src = iconUrlDesvio;
              iconImg.alt = "icon";
              iconImg.title = "Desvio";
              iconDiv.appendChild(iconImg);

              const iconSpan = document.createElement("span");
              iconSpan.classList.add("fa-sr-only");
              iconSpan.textContent = "Incidente";
              iconDiv.appendChild(iconSpan);

              properDiv.appendChild(iconDiv);

              // Details
              const detailsDiv = document.createElement("div");
              detailsDiv.classList.add("details");

              const idDiv = document.createElement("div");
              idDiv.classList.add("id");
              idDiv.textContent = "Desvio";
              detailsDiv.appendChild(idDiv);

              const specificsCambio = document.createElement("div");
              specificsCambio.classList.add("specifics");
              specificsCambio.textContent = `Cambio de sentido: ${feature.properties.cambio}`;
              detailsDiv.appendChild(specificsCambio);

              const specificsSentido = document.createElement("div");
              specificsSentido.classList.add("specifics");
              specificsSentido.textContent = `Sentido: ${feature.properties.sentido}`;
              detailsDiv.appendChild(specificsSentido);

              properDiv.appendChild(detailsDiv);

              // Set content safely
              infoWindow.setContent(properDiv);
              infoWindow.setPosition(latLng);
              infoWindow.open(map);
            },
          );
        }
      });

      return () => {
        animationRefs.current.forEach((interval) => clearInterval(interval));
        polylineRefs.current.forEach((polyline) => polyline.setMap(null));
      };
    };

    const loadGeoJsonData = (
      geoJsonData: any,
      map: any,
      strokeColor: string,
      infoWindow: any,
    ) => {
      if (!window.google || !window.google.maps.Data) {
        console.error("Google Maps Data layer not available");
        return;
      }

      const dataLayer = new window.google.maps.Data();

      // Establecer el estilo de la capa de datos
      dataLayer.setStyle({
        strokeColor,
        strokeWeight: 3.5,
        fillColor: strokeColor,
        fillOpacity: 0.6,
      });

      dataLayer.addGeoJson(geoJsonData);
      dataLayer.setMap(map);

      dataLayer.addListener("click", (event: any) => {
        const feature = event.feature;
        const title = feature.getProperty("title");
        const velocity = feature.getProperty("velocidad");
        const hour = feature.getProperty("hora");
        const day = feature.getProperty("dia");
        const indice = feature.getProperty("id");
        const vel = parseFloat(velocity);

        const properDiv = document.createElement("div");
        properDiv.classList.add("proper");

        // Icon
        const iconDiv = document.createElement("div");
        iconDiv.classList.add("icon");

        const iconImg = document.createElement("img");
        iconImg.src = iconUrlVelInfo;
        iconImg.alt = "icon";
        iconImg.title = "Velocidad de Waze";
        iconDiv.appendChild(iconImg);

        const iconSpan = document.createElement("span");
        iconSpan.classList.add("fa-sr-only");
        iconSpan.textContent = "Incidente";
        iconDiv.appendChild(iconSpan);

        properDiv.appendChild(iconDiv);

        // Details
        const detailsDiv = document.createElement("div");
        detailsDiv.classList.add("details");

        const idDiv = document.createElement("div");
        idDiv.classList.add("id");
        idDiv.textContent = title;
        detailsDiv.appendChild(idDiv);

        // Opcional: Solo si opcDropdownVel es 'congestion'
        if (opcDropdownVel === "CONGESTION") {
          const specificsIndice = document.createElement("div");
          specificsIndice.classList.add("specifics");
          specificsIndice.textContent = `Indice de congestión: ${indice}`;
          detailsDiv.appendChild(specificsIndice);
        }

        // Opcional: Solo si opcDropdownVel es 'JAMS'
        if (opcDropdownVel === "JAMS") {
          const specificsIndice = document.createElement("div");
          specificsIndice.classList.add("specifics");
          specificsIndice.textContent = `Nivel de Jams: ${feature.getProperty("level")} - Delay: ${feature.getProperty("delay")} segundos`;
          detailsDiv.appendChild(specificsIndice);
        }

        if (opcDropdownVel === "PREDICCIONES_CONGESTION") {
          const specificsPrediction = document.createElement("div");
          specificsPrediction.classList.add("specifics");
          specificsPrediction.textContent = `Predicted congestion level: ${feature.getProperty("level")} - Delay: ${feature.getProperty("delay")} seconds`;
          detailsDiv.appendChild(specificsPrediction);
        }

        // Features
        const featuresDiv = document.createElement("div");
        featuresDiv.classList.add("features");

        const velDiv = document.createElement("div");
        const velImg = document.createElement("img");
        velImg.src = iconUrlVel;
        velImg.alt = "velocidad icon";
        velImg.title = "Velocidad";
        velDiv.appendChild(velImg);
        const velSpan = document.createElement("span");
        velSpan.textContent = vel.toString();
        velDiv.appendChild(velSpan);
        featuresDiv.appendChild(velDiv);

        const hourDiv = document.createElement("div");
        const hourImg = document.createElement("img");
        hourImg.src = iconUrlClock;
        hourImg.alt = "hora icon";
        hourImg.title = "Hora";
        hourDiv.appendChild(hourImg);
        const hourSpan = document.createElement("span");
        hourSpan.textContent = hour;
        hourDiv.appendChild(hourSpan);
        featuresDiv.appendChild(hourDiv);

        const dayDiv = document.createElement("div");
        const dayImg = document.createElement("img");
        dayImg.src = iconUrlCalendar;
        dayImg.alt = "fecha icon";
        dayImg.title = "Fecha";
        dayDiv.appendChild(dayImg);
        const daySpan = document.createElement("span");
        daySpan.textContent = day;
        dayDiv.appendChild(daySpan);
        featuresDiv.appendChild(dayDiv);

        detailsDiv.appendChild(featuresDiv);

        properDiv.appendChild(detailsDiv);

        // Set content safely
        infoWindow.setContent(properDiv);
        infoWindow.setPosition(event.latLng);
        infoWindow.open(map);
      });
    };

    const buildContentInteligentes = (id: number) => {
      const ubicacion = inteligentes.find((item: any) => item.id === id);

      //console.log(ubicacion);

      if (!ubicacion) {
        return document.createElement("div"); // Retorna un div vacío si no se encuentra la ubicación
      } else {
        const acumuladodia_clima = ubicacion.acumuladodia_clima;
        const timestamp_startTime = ubicacion.timestamp_startTime;
        const timestamp_endTime = ubicacion.timestamp_endTime;
        const valorlectura_clima = ubicacion.valorlectura_clima;
        const estado_mvi = ubicacion.estado_mvi;
        const afectados =
          ubicacion.afectados !== undefined && ubicacion.afectados !== null
            ? Number.parseFloat(ubicacion.afectados).toFixed(2)
            : "0.00";
        const nivel_alerta = ubicacion.nivel_alerta;
        const trend =
          ubicacion.trend === 1
            ? "Empeorando"
            : ubicacion.trend === -1
              ? "Mejorando"
              : "Igual";
        const tiempo_en_congestion = ubicacion.tiempo_en_congestion;

        let fecha = "Sin información";

        //let horaInicial = "Sin información";

        if (timestamp_endTime) {
          let fechaCalendar = timestamp_startTime.split("T")[0];
          //horaInicial = timestamp_startTime.split("T")[1];
          let hora = timestamp_endTime.split("T")[1];
          let horaFinal = hora.split(":")[0];
          let minutoFinal = hora.split(":")[1];

          fecha = fechaCalendar + "  -  " + horaFinal + ":" + minutoFinal;
        }

        const estado_semaforo =
          ubicacion.estado_semaforo === null ||
          ubicacion.estado_semaforo === undefined
            ? "Sin información"
            : ubicacion.estado_semaforo;
        const tipo_congestion = ubicacion.tipo_congestion;
        const length = ubicacion.length;

        const cantidad_alertas_waze = ubicacion.cantidad_alertas_waze;
        const tipos_alertas_waze =
          ubicacion.tipos_alertas_waze === null ||
          ubicacion.tipos_alertas_waze === undefined
            ? "Sin información"
            : ubicacion.tipos_alertas_waze;
        const id_incidente =
          ubicacion.id_incidente === null ||
          ubicacion.id_incidente === undefined
            ? "Sin información"
            : ubicacion.id_incidente;
        const tipo_incidente =
          ubicacion.tipo_incidente === null ||
          ubicacion.tipo_incidente === undefined
            ? "Sin información"
            : ubicacion.tipo_incidente;

        const indice_congestion =
          ubicacion.indice_congestion !== undefined &&
          ubicacion.indice_congestion !== null
            ? Number.parseFloat(ubicacion.indice_congestion).toFixed(2)
            : "0.00";

        const coordinates = ubicacion.coordinates;

        const content = document.createElement("div");
        content.classList.add("propertyInteligentes");

        // Details section
        const detailsDiv = document.createElement("div");
        detailsDiv.classList.add("details");

        const idDiv = document.createElement("div");
        idDiv.classList.add("id");

        // Crear el ícono
        const iconImgID = document.createElement("img");
        iconImgID.src = iconUrlInteligentes2;
        iconImgID.alt = "icon";
        iconImgID.title = "Inteligente";
        iconImgID.classList.add("icon-image");

        // Crear el texto
        const textSpan = document.createElement("span");
        textSpan.textContent = `Nivel de alerta: ${nivel_alerta}  -----   Tendencia: ${trend}`;

        // Agregar ícono y texto dentro del mismo div
        idDiv.appendChild(iconImgID);
        idDiv.appendChild(textSpan);

        // Finalmente agregar al detailsDiv
        detailsDiv.appendChild(idDiv);

        const specificsVial = document.createElement("div");
        specificsVial.classList.add("specifics");
        specificsVial.style.display = "flex";
        specificsVial.style.alignItems = "center";
        specificsVial.style.gap = "6px";

        // Texto fijo "Estado vial:"
        const labelSpan = document.createElement("span");
        labelSpan.textContent = "Estado vial:";
        labelSpan.style.fontWeight = "bold";
        labelSpan.style.color = "black";

        // Contenedor para los valores
        const valueSpan = document.createElement("span");

        //console.log(estado_mvi);

        // Separar los valores por " | " y asignar color a cada uno
        if (estado_mvi) {
          estado_mvi.split(" | ").forEach((word: string, index: number) => {
            const span = document.createElement("span");
            span.textContent = word;

            if (
              word === "POBRE" ||
              word === "MUY POBRE" ||
              word === "FALLADO" ||
              word === "GRAVE"
            ) {
              span.style.color = "red";
            } else if (word === "BUENO" || word === "SATISFACTORIO") {
              span.style.color = "green";
            } else {
              span.style.color = "orange";
            }
            valueSpan.appendChild(span);

            // Agregar separador " | " excepto después del último
            if (index < estado_mvi.split(" | ").length - 1) {
              const separator = document.createElement("span");
              separator.textContent = " | ";
              separator.style.color = "black"; // separador en negro
              valueSpan.appendChild(separator);
            }
          });
        }

        // Agregar al div principal
        specificsVial.appendChild(labelSpan);
        specificsVial.appendChild(valueSpan);

        detailsDiv.appendChild(specificsVial);

        const featuresDivIC = document.createElement("div");
        featuresDivIC.classList.add("features");
        featuresDivIC.style.fontSize = "11px";
        featuresDivIC.style.alignItems = "center";
        featuresDivIC.style.display = "flex";
        featuresDivIC.style.justifyContent = "left";
        featuresDivIC.textContent = "Indice de congestión:";

        const appendFeatureIC = (src: string, title: string, text: string) => {
          const feature = document.createElement("div");

          const img = document.createElement("img");
          img.src = src;
          img.alt = `${title} icon`;
          img.title = title;

          const span = document.createElement("span");
          span.textContent = text;

          feature.appendChild(img);
          feature.appendChild(span);

          featuresDivIC.appendChild(feature);
        };

        appendFeatureIC(
          iconIndiceCongestion,
          "Indice de congestión",
          indice_congestion,
        );

        detailsDiv.appendChild(featuresDivIC);

        const featuresDivTipoCongestion = document.createElement("div");
        featuresDivTipoCongestion.classList.add("features");
        featuresDivTipoCongestion.style.fontSize = "11px";
        featuresDivTipoCongestion.style.alignItems = "center";
        featuresDivTipoCongestion.style.display = "flex";
        featuresDivTipoCongestion.style.justifyContent = "left";
        featuresDivTipoCongestion.textContent = "Tipo de congestión:";

        const appendFeatureTipoCongestion = (
          src: string,
          title: string,
          text: string,
        ) => {
          const feature = document.createElement("div");

          const img = document.createElement("img");
          img.src = src;
          img.alt = `${title} icon`;
          img.title = title;

          const span = document.createElement("span");
          span.textContent = text;

          feature.appendChild(img);
          feature.appendChild(span);

          featuresDivTipoCongestion.appendChild(feature);
        };

        appendFeatureTipoCongestion(
          iconUrlCongestion2,
          "Tipo de congestión",
          tipo_congestion,
        );

        detailsDiv.appendChild(featuresDivTipoCongestion);

        const featuresDivAfectados = document.createElement("div");
        featuresDivAfectados.classList.add("features");
        featuresDivAfectados.style.fontSize = "11px";
        featuresDivAfectados.style.alignItems = "center";
        featuresDivAfectados.style.display = "flex";
        featuresDivAfectados.style.justifyContent = "left";
        featuresDivAfectados.textContent = "Afectados:";

        const appendFeatureAfectados = (
          src: string,
          title: string,
          text: string,
        ) => {
          const feature = document.createElement("div");

          const img = document.createElement("img");
          img.src = src;
          img.alt = `${title} icon`;
          img.title = title;

          const span = document.createElement("span");
          span.textContent = text;

          feature.appendChild(img);
          feature.appendChild(span);

          featuresDivAfectados.appendChild(feature);
        };

        appendFeatureAfectados(
          iconAfectados,
          "Afectados",
          `${afectados} personas`,
        );

        detailsDiv.appendChild(featuresDivAfectados);

        const featuresDivTamanoCongestion = document.createElement("div");
        featuresDivTamanoCongestion.classList.add("features");
        featuresDivTamanoCongestion.style.fontSize = "11px";
        featuresDivTamanoCongestion.style.alignItems = "center";
        featuresDivTamanoCongestion.style.display = "flex";
        featuresDivTamanoCongestion.style.justifyContent = "left";
        featuresDivTamanoCongestion.textContent = "Tamaño de la congestión:";

        const appendFeatureTamanoCongestion = (
          src: string,
          title: string,
          text: string,
        ) => {
          const feature = document.createElement("div");

          const img = document.createElement("img");
          img.src = src;
          img.alt = `${title} icon`;
          img.title = title;

          const span = document.createElement("span");
          span.textContent = text;

          feature.appendChild(img);
          feature.appendChild(span);

          featuresDivTamanoCongestion.appendChild(feature);
        };

        appendFeatureTamanoCongestion(
          iconTamanoCongestion,
          "Tamaño de la congestión",
          `${length} metros`,
        );

        detailsDiv.appendChild(featuresDivTamanoCongestion);

        // ==================== BLOQUE DE ALERTAS ====================
        const featuresDivAlerta = document.createElement("div");
        featuresDivAlerta.style.fontSize = "11px";
        featuresDivAlerta.style.alignItems = "center";
        featuresDivAlerta.style.display = "flex";
        featuresDivAlerta.style.flexDirection = "row"; // en fila
        featuresDivAlerta.style.gap = "20px";
        featuresDivAlerta.style.marginTop = "10px";

        // Función genérica: label + recuadro (icono + valor)
        const appendFeatureAlerta = (
          label: string,
          src: string,
          title: string,
          text: string,
        ) => {
          const row = document.createElement("div");
          row.style.display = "flex";
          row.style.alignItems = "center";
          row.style.gap = "6px";

          const labelSpan = document.createElement("span");
          labelSpan.textContent = label;

          const boxDiv = document.createElement("div");
          boxDiv.style.display = "flex";
          boxDiv.style.alignItems = "center";
          boxDiv.style.gap = "4px";
          boxDiv.style.border = "1px solid #dee2e6";
          boxDiv.style.borderRadius = "5px";
          boxDiv.style.padding = "2px 6px";
          boxDiv.style.background = "#f8f9fa";

          const img = document.createElement("img");
          img.src = src;
          img.alt = `${title} icon`;
          img.title = title;
          img.style.width = "14px";
          img.style.height = "14px";

          const valueSpan = document.createElement("span");
          valueSpan.textContent = text;

          boxDiv.appendChild(img);
          boxDiv.appendChild(valueSpan);

          row.appendChild(labelSpan);
          row.appendChild(boxDiv);

          featuresDivAlerta.appendChild(row);
        };

        // Agregar datos de alertas
        appendFeatureAlerta(
          "Cantidad de alertas:",
          iconCantidadAlertasWaze,
          "Cantidad de alertas",
          cantidad_alertas_waze,
        );
        appendFeatureAlerta(
          "Tipo de alertas:",
          iconTiposAlertasWaze,
          "Tipos de alertas",
          tipos_alertas_waze,
        );

        detailsDiv.appendChild(featuresDivAlerta);

        // ==================== BLOQUE DE INCIDENTES ====================
        const featuresDivIncidente = document.createElement("div");
        featuresDivIncidente.style.fontSize = "11px";
        featuresDivIncidente.style.alignItems = "center";
        featuresDivIncidente.style.display = "flex";
        featuresDivIncidente.style.flexDirection = "row"; // en fila
        featuresDivIncidente.style.gap = "20px";
        featuresDivIncidente.style.marginTop = "10px";

        // Función específica para incidentes
        const appendFeatureIncidente = (
          label: string,
          src: string,
          title: string,
          text: string,
        ) => {
          const row1 = document.createElement("div");
          row1.style.display = "flex";
          row1.style.alignItems = "center";
          row1.style.gap = "6px";
          row1.style.marginTop = "4px";
          row1.style.marginBottom = "8px";

          const labelSpan = document.createElement("span");
          labelSpan.textContent = label;

          const boxDiv = document.createElement("div");
          boxDiv.style.display = "flex";
          boxDiv.style.alignItems = "center";
          boxDiv.style.gap = "4px";
          boxDiv.style.border = "1px solid #dee2e6";
          boxDiv.style.borderRadius = "5px";
          boxDiv.style.padding = "2px 6px";
          boxDiv.style.background = "#f8f9fa";

          const img = document.createElement("img");
          img.src = src;
          img.alt = `${title} icon`;
          img.title = title;
          img.style.width = "14px";
          img.style.height = "14px";

          const valueSpan = document.createElement("span");
          valueSpan.textContent = text;

          boxDiv.appendChild(img);
          boxDiv.appendChild(valueSpan);

          row1.appendChild(labelSpan);
          row1.appendChild(boxDiv);

          featuresDivIncidente.appendChild(row1);
        };

        // Agregar datos de incidentes
        appendFeatureIncidente(
          "ID incidente:",
          iconIdIncidente,
          "ID incidente",
          id_incidente,
        );
        appendFeatureIncidente(
          "Tipo de incidentes:",
          iconTipoIncidente,
          "Tipos de incidentes",
          tipo_incidente,
        );

        detailsDiv.appendChild(featuresDivIncidente);

        // Features section
        const featuresDiv = document.createElement("div");
        featuresDiv.classList.add("features");

        const appendFeature = (src: string, title: string, text: string) => {
          const feature = document.createElement("div");

          const img = document.createElement("img");
          img.src = src;
          img.alt = `${title} icon`;
          img.title = title;

          const span = document.createElement("span");
          span.textContent = text;

          feature.appendChild(img);
          feature.appendChild(span);

          featuresDiv.appendChild(feature);
        };

        appendFeature(iconUrlCalendar, "Fecha", fecha);
        appendFeature(
          iconUrlClockCongestion,
          "Tiempo de congestión",
          `${tiempo_en_congestion} minutos`,
        );

        detailsDiv.appendChild(featuresDiv);

        // Features section
        const featuresDiv2 = document.createElement("div");
        featuresDiv2.style.marginTop = "6px";
        featuresDiv2.classList.add("features");

        const appendFeature2 = (src: string, title: string, text: string) => {
          const feature = document.createElement("div");

          const img = document.createElement("img");
          img.src = src;
          img.alt = `${title} icon`;
          img.title = title;

          const span = document.createElement("span");
          span.textContent = text;

          feature.appendChild(img);
          feature.appendChild(span);

          featuresDiv2.appendChild(feature);
        };

        const iconoAcumulado =
          acumuladodia_clima === 0
            ? iconUrlAcumiladoDia1
            : acumuladodia_clima > 0 && acumuladodia_clima <= 10
              ? iconUrlAcumiladoDia2
              : acumuladodia_clima > 10 && acumuladodia_clima <= 30
                ? iconUrlAcumiladoDia3
                : acumuladodia_clima > 30 && acumuladodia_clima <= 50
                  ? iconUrlAcumiladoDia4
                  : iconUrlAcumiladoDia5;

        appendFeature2(iconoAcumulado, "Acumulado día", acumuladodia_clima);
        appendFeature2(iconUrlClima, "Precipitación", valorlectura_clima);
        appendFeature2(
          iconUrlSemaforoEstado,
          "Estado de semaforos",
          estado_semaforo,
        );
        //appendFeature2(iconCoordenadas, "Coordenadas", `${coordinates[0]}`);

        if (coordinates[0]) {
          appendFeature2(
            iconCoordenadas,
            "Coordenadas",
            `${coordinates[0][1]} , ${coordinates[0][0]}`,
          );
        }

        detailsDiv.appendChild(featuresDiv2);

        // Assemble
        content.appendChild(detailsDiv);

        return content;
      }
    };

    const buildContent = (ubicacion: any) => {
      const latitud = parseFloat(ubicacion[0]);
      const longitud = parseFloat(ubicacion[1]);
      const estado = ubicacion[2];
      const direccion = ubicacion[3];
      const tipoIncidente = ubicacion[4];
      const barrio = ubicacion[5];
      const localidad = ubicacion[6];
      const descripcion = ubicacion[7];
      const id = ubicacion[8];
      const dia = ubicacion[9];
      const hora = ubicacion[10];
      const fuente = ubicacion[11];
      let comentarios = "";
      let idCruceSemaforos = "";
      if (fuente === "P1") {
        comentarios = ubicacion[12];
      } else {
        idCruceSemaforos = ubicacion[12];
      }
      const nomenclaturaCruceSemaforos = ubicacion[13];

      let horaFinal = "";

      if (hora) {
        const horaSplit = hora.split(":");
        horaFinal = `${horaSplit[0]}:${horaSplit[1]}`;
      }

      const content = document.createElement("div");
      content.classList.add("property");

      // Icon section
      const iconDiv = document.createElement("div");
      iconDiv.classList.add("icon");

      const iconImg = document.createElement("img");
      const iconUrl =
        fuente === "WAZE"
          ? getIconUrl(fuente, descripcion, 0)
          : fuente === "IRREGULARIDADES"
            ? getIconUrl(fuente, descripcion, 0)
            : fuente === "INTELIGENTES"
              ? iconUrlInteligentes
              : fuente === "P1"
                ? iconUrlWarning
                : fuente === "CAMARASSALVAVIDAS"
                  ? iconUrlCamsalvavidas
                  : fuente === "CAMARASCGT"
                    ? iconUrlCamCGT
                    : fuente === "SEMAFOROS"
                      ? iconUrlSemaforos
                      : fuente === "SEMAFOROSNO"
                        ? iconUrlSemaforosNO
                        : fuente === "SEMAFOROSFALLA"
                          ? iconUrlSemaforosFalla
                          : fuente === "STREAMING"
                            ? iconUrlStreaming
                            : fuente === "STREAMINGSEMAFOROS"
                              ? iconUrlStreamingSemaforos1
                              : fuente === "PMT"
                                ? iconUrlPMT
                                : fuente === "CONGESTIONPRIORIDAD"
                                  ? iconUrlPrioridad
                                  : fuente === "CONGESTIONPRIORIDADSEMAFOROS"
                                    ? iconUrlSemaforosNO
                                    : fuente === "LLUVIAS"
                                      ? iconUrlLluvias
                                      : "";

      iconImg.src = typeof iconUrl === "string" ? iconUrl : iconUrl?.url || "";
      iconImg.alt = "icon";
      iconImg.title =
        fuente === "WAZE"
          ? "Waze"
          : fuente === "IRREGULARIDADES"
            ? "Irregularidades"
            : fuente === "INTELIGENTES"
              ? "Inteligentes"
              : fuente === "P1"
                ? "Premiere One"
                : fuente === "CAMARASSALVAVIDAS"
                  ? "Cámara salvavidas"
                  : fuente === "CAMARASCGT"
                    ? "Cámara CGT"
                    : fuente === "SEMAFOROS"
                      ? "Semaforización"
                      : fuente === "SEMAFOROSNO"
                        ? "Semaforización"
                        : fuente === "SEMAFOROSFALLA"
                          ? "Semaforización"
                          : fuente === "STREAMING"
                            ? "Streaming"
                            : fuente === "STREAMINGSEMAFOROS"
                              ? "Streaming Semáforos"
                              : fuente === "PMT"
                                ? "PMT"
                                : fuente === "CONGESTIONPRIORIDAD"
                                  ? "Prioridad"
                                  : fuente === "CONGESTIONPRIORIDADSEMAFOROS"
                                    ? "Prioridad"
                                    : fuente === "LLUVIAS"
                                      ? "Lluvias"
                                      : "";

      iconImg.classList.add("icon-image");
      iconDiv.appendChild(iconImg);

      // Details section
      const detailsDiv = document.createElement("div");
      detailsDiv.classList.add("details");

      const idDiv = document.createElement("div");
      idDiv.classList.add("id");
      idDiv.textContent =
        fuente === "CONGESTIONPRIORIDAD" ||
        fuente === "CONGESTIONPRIORIDADSEMAFOROS"
          ? estado
          : fuente === "LLUVIAS" ||
              fuente === "INTELIGENTES" ||
              fuente === "SEMAFOROS" ||
              fuente === "SEMAFOROSNO" ||
              fuente === "SEMAFOROSFALLA" ||
              fuente === "P1"
            ? direccion
            : fuente === "STREAMINGSEMAFOROS"
              ? idCruceSemaforos
              : id;
      detailsDiv.appendChild(idDiv);

      if (fuente === "LLUVIAS") {
        const specificsLluvia = document.createElement("div");
        specificsLluvia.classList.add("specifics");
        specificsLluvia.innerText = `Descripción: ${descripcion}\n Acumulado día: ${id}\n Valor de lectura: ${barrio}`;
        detailsDiv.appendChild(specificsLluvia);
      }

      if (
        fuente === "SEMAFOROS" ||
        fuente === "SEMAFOROSNO" ||
        fuente === "SEMAFOROSFALLA"
      ) {
        const specificsSemaforos = document.createElement("div");
        specificsSemaforos.classList.add("specifics");
        specificsSemaforos.innerText = `Estado: ${estado} / Shutdown: ${id}\nVideo detectores en la intersección: ${tipoIncidente}\nVideo detectores en el corredor: ${barrio} `;
        detailsDiv.appendChild(specificsSemaforos);
      }

      if (
        [
          "WAZE",
          "IRREGULARIDADES",
          "CONGESTIONPRIORIDAD",
          ,
          "CONGESTIONPRIORIDADSEMAFOROS",
          "STREAMING",
          "STREAMINGSEMAFOROS",
          "PMT",
        ].includes(fuente)
      ) {
        const specificsDireccion = document.createElement("div");
        specificsDireccion.classList.add("specifics");
        specificsDireccion.textContent = `Dirección: ${direccion}`;
        detailsDiv.appendChild(specificsDireccion);
      }

      if (["P1", "WAZE", "IRREGULARIDADES"].includes(fuente)) {
        const specificsTipo = document.createElement("div");
        specificsTipo.classList.add("specifics");
        specificsTipo.textContent = `Tipo de incidente: ${descripcion}`;
        detailsDiv.appendChild(specificsTipo);
      }

      if (fuente === "P1") {
        const comentarioContainer = document.createElement("div");
        comentarioContainer.classList.add("specifics");
        comentarioContainer.style.display = "flex";
        comentarioContainer.style.alignItems = "center";
        comentarioContainer.style.gap = "8px";

        const comentarioLabel = document.createElement("span");
        comentarioLabel.textContent = "Comentarios:";

        const verComentarioBtn = document.createElement("button");
        verComentarioBtn.textContent = "Ver comentarios";
        verComentarioBtn.style.backgroundColor = "#3b82f6";
        verComentarioBtn.style.color = "white";
        verComentarioBtn.style.padding = "4px 12px";
        verComentarioBtn.style.borderRadius = "4px";
        verComentarioBtn.style.border = "none";
        verComentarioBtn.style.cursor = "pointer";
        verComentarioBtn.style.fontSize = "12px";
        verComentarioBtn.style.fontWeight = "500";

        verComentarioBtn.onmouseover = () => {
          verComentarioBtn.style.backgroundColor = "#2563eb";
        };
        verComentarioBtn.onmouseout = () => {
          verComentarioBtn.style.backgroundColor = "#3b82f6";
        };

        verComentarioBtn.onclick = () => {
          // Crear overlay del popup
          const overlay = document.createElement("div");
          overlay.style.position = "fixed";
          overlay.style.top = "0";
          overlay.style.left = "0";
          overlay.style.width = "100%";
          overlay.style.height = "100%";
          overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
          overlay.style.display = "flex";
          overlay.style.justifyContent = "center";
          overlay.style.alignItems = "center";
          overlay.style.zIndex = "10000";

          // Crear popup
          const popup = document.createElement("div");
          popup.style.backgroundColor = "white";
          popup.style.padding = "24px";
          popup.style.borderRadius = "8px";
          popup.style.maxWidth = "500px";
          popup.style.width = "90%";
          popup.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
          popup.style.position = "relative";

          // Título del popup
          const popupTitle = document.createElement("h3");
          popupTitle.textContent = "Comentarios del Incidente";
          popupTitle.style.margin = "0 0 16px 0";
          popupTitle.style.fontSize = "18px";
          popupTitle.style.fontWeight = "600";
          popupTitle.style.color = "#1f2937";

          // Contenido de comentarios
          const popupContent = document.createElement("div");
          popupContent.textContent =
            comentarios || "No hay comentarios disponibles";
          popupContent.style.marginBottom = "20px";
          popupContent.style.color = "#4b5563";
          popupContent.style.lineHeight = "1.6";
          popupContent.style.maxHeight = "300px";
          popupContent.style.overflowY = "auto";

          // Botón cerrar
          const closeBtn = document.createElement("button");
          closeBtn.textContent = "Cerrar";
          closeBtn.style.backgroundColor = "#ef4444";
          closeBtn.style.color = "white";
          closeBtn.style.padding = "8px 16px";
          closeBtn.style.borderRadius = "4px";
          closeBtn.style.border = "none";
          closeBtn.style.cursor = "pointer";
          closeBtn.style.fontSize = "14px";
          closeBtn.style.fontWeight = "500";
          closeBtn.style.width = "100%";

          closeBtn.onmouseover = () => {
            closeBtn.style.backgroundColor = "#dc2626";
          };
          closeBtn.onmouseout = () => {
            closeBtn.style.backgroundColor = "#ef4444";
          };

          closeBtn.onclick = () => {
            document.body.removeChild(overlay);
          };

          // Cerrar al hacer click fuera del popup
          overlay.onclick = (e) => {
            if (e.target === overlay) {
              document.body.removeChild(overlay);
            }
          };

          // Ensamblar el popup
          popup.appendChild(popupTitle);
          popup.appendChild(popupContent);
          popup.appendChild(closeBtn);
          overlay.appendChild(popup);
          document.body.appendChild(overlay);
        };

        comentarioContainer.appendChild(comentarioLabel);
        comentarioContainer.appendChild(verComentarioBtn);
        detailsDiv.appendChild(comentarioContainer);
      }

      if (fuente === "CONGESTIONPRIORIDAD") {
        const specificsIndice = document.createElement("div");
        specificsIndice.classList.add("specifics");
        specificsIndice.textContent = `Índice de congestión: ${id}`;
        detailsDiv.appendChild(specificsIndice);
      }

      if (fuente === "STREAMING") {
        const specificsStreaming = document.createElement("div");
        specificsStreaming.classList.add("specifics");
        specificsStreaming.textContent = `Funcionamiento: ${descripcion}`;
        detailsDiv.appendChild(specificsStreaming);
      }

      if (fuente === "STREAMING" || fuente === "STREAMINGSEMAFOROS") {
        if (nomenclaturaCruceSemaforos) {
          const specificsNomenclatura = document.createElement("div");
          specificsNomenclatura.classList.add("specifics");
          specificsNomenclatura.textContent = `Nomenclatura: ${nomenclaturaCruceSemaforos}`;
          detailsDiv.appendChild(specificsNomenclatura);
        }
      }

      if (fuente === "PMT") {
        const specificsEmpresa = document.createElement("div");
        specificsEmpresa.classList.add("specifics");
        specificsEmpresa.textContent = `Empresa: ${tipoIncidente}`;
        detailsDiv.appendChild(specificsEmpresa);
      }

      // Features section
      const featuresDiv = document.createElement("div");
      featuresDiv.classList.add("features");

      const appendFeature = (src: string, title: string, text: string) => {
        const feature = document.createElement("div");

        const img = document.createElement("img");
        img.src = src;
        img.alt = `${title} icon`;
        img.title = title;

        const span = document.createElement("span");
        span.textContent = text;

        feature.appendChild(img);
        feature.appendChild(span);

        featuresDiv.appendChild(feature);
      };

      if (
        [
          "P1",
          "LLUVIAS",
          "SEMAFOROS",
          "SEMAFOROSNO",
          "SEMAFOROSFALLA",
          "INTELIGENTES",
        ].includes(fuente)
      ) {
        appendFeature(iconUrlLocation, "Localidad", localidad);
      }

      if (fuente === "PMT") {
        appendFeature(iconUrlLocation, "Localidad", descripcion);
      }

      if (fuente === "CONGESTIONPRIORIDAD") {
        appendFeature(iconUrlVel, "Velocidad", localidad);
      }

      if (
        [
          "P1",
          "WAZE",
          "IRREGULARIDADES",
          "CONGESTIONPRIORIDAD",
          "CONGESTIONPRIORIDADSEMAFOROS",
          "STREAMING",
          "STREAMINGSEMAFOROS",
          "PMT",
          "LLUVIAS",
          "SEMAFOROS",
          "SEMAFOROSNO",
          "SEMAFOROSFALLA",
        ].includes(fuente)
      ) {
        appendFeature(iconUrlClock, "Hora", horaFinal);
        appendFeature(iconUrlCalendar, "Fecha", dia);
      }

      appendFeature(
        iconCoordenadas,
        "Coordenadas",
        `${latitud.toFixed(6)}, ${longitud.toFixed(6)}`,
      );

      detailsDiv.appendChild(featuresDiv);

      // Assemble
      content.appendChild(iconDiv);
      content.appendChild(detailsDiv);

      return content;
    };

    const loadGoogleMapsScript = () => {
      const script = document.createElement("script");
      //script.src = `https://maps.googleapis.com/maps/api/js?key=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&callback=initMap`;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&callback=initMap&v=weekly`;

      //script.src = `https://maps.googleapis.com/maps/api/js?v=3&sensor=false&libraries=places&callback=initMap`;

      script.async = true;
      script.defer = true;
      //console.log('script.src:');
      //console.log(script.src);
      document.head.appendChild(script);

      script.onload = () => {
        console.log("Google Maps script loaded successfully");
      };

      script.onerror = () => {
        console.error("Failed to load Google Maps script");
      };
    };

    //si no se ha cargado aún el script de Google Maps
    if (!window.google) {
      //cargue el script de google maps con el mapa
      window.initMap = initMap;
      loadGoogleMapsScript();
    } else {
      //si ya esta cargado el script de google maps, inicialice el mapa
      initMap();
    }

    const fetchDataActualizar = async () => {
      try {
        const currentCenter = map.getCenter();
        const currentZoom = map.getZoom();

        if (currentCenter) {
          const currentLat = currentCenter.lat();
          const currentLng = currentCenter.lng();

          onChangeActualizar(
            true,
            currentLat ?? 0,
            currentLng ?? 0,
            currentZoom ?? 10,
          );
        }
      } catch (error) {
        console.error("Error actualizando:", error);
      }
    };

    return () => clearInterval(interval);
  }, [ubicaciones, opcDropdownVel, ubicacionesAlertas, recomendaciones]);

  const router = useRouter();

  return (
    <div className="map-container">
      <div
        style={{ position: "absolute", top: "10px", left: "60px", zIndex: 15 }}
      >
        <input
          id="pac-input"
          className="controls"
          type="text"
          placeholder="Search Box"
          style={{
            padding: "10px",
            fontSize: "16px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            backgroundColor: "white",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
          }}
        />
      </div>
      <PredictionFeatureController
        mapInstanceRef={mapInstanceRef}
        predictionPolylinesRef={predictionPolylinesRef}
        infoWindowRef={infoWindowRef}
        opcDropdownVel={opcDropdownVel}
        predictionWidgetVisible={predictionWidgetVisible}
        predictionCongestionData={predictionCongestionData}
        predictionRegions={predictionRegions}
        selectedPredictionRegion={selectedPredictionRegion}
        onPredictionRegionChange={onPredictionRegionChange}
        predictionTimeframes={predictionTimeframes}
        predictionReferenceTimeslot={predictionReferenceTimeslot}
        selectedPredictionTimeslot={selectedPredictionTimeslot}
        onPredictionTimeslotChange={onPredictionTimeslotChange}
        predictionStepMinutes={predictionStepMinutes}
      />

      <div ref={mapRef} className="map-wrapper"></div>
    </div>
  );
}
