# Prediccion de Congestion - Handoff

Este documento resume que esta implementado para la funcionalidad de prediccion de congestion, como se activa, como fluye la data y como se renderiza en mapa y UI.

## 1. Que agrega esta funcionalidad

La app agrega un modo de trafico llamado PREDICCIONES_CONGESTION que permite:

- Seleccionar tipo de area y area especifica (o toda la ciudad).
- Seleccionar timeslot por slider y controles paso a paso.
- Reproducir automaticamente la linea de tiempo.
- Dibujar segmentos de via en mapa con color segun nivel de congestion.
- Hacer click en un segmento para abrir analitica historica y pronostico.
- Mostrar una animacion temporal de corredores mientras se prepara el modo de analisis.

## 2. Puntos de entrada principales

- Contenedor principal de estado y fetch: [components/navBarMap.tsx](../components/navBarMap.tsx#L198)
- Mapa de Google y montaje del controlador: [components/mapaGooglemapsAlertVel.tsx](../components/mapaGooglemapsAlertVel.tsx#L1)
- Controlador de feature (orquesta hooks/UI): [components/prediction/prediction-feature-controller.tsx](../components/prediction/prediction-feature-controller.tsx#L18)

## 3. Activacion del modo de prediccion

El selector de trafico expone PREDICCIONES_CONGESTION cuando hay disponibilidad de predicciones.

Archivo clave:

- [components/layersMapaVel.tsx](../components/layersMapaVel.tsx#L50)

Comportamiento:

- Si opcPredictions === 1, se agrega la opcion PREDICCIONES_CONGESTION al dropdown.
- Al seleccionar ese valor, opcVel pasa a PREDICCIONES_CONGESTION y navBarMap entra en flujo de predicciones.

## 4. Flujo de datos end-to-end

### 4.1 Carga de metadata y areas

En [components/navBarMap.tsx](../components/navBarMap.tsx#L630) se ejecuta un efecto de carga inicial que obtiene:

- Metadata de prediccion: getCongestionPredictionsMetadata
- Catalogo de areas: getCongestionPredictionAreas

Archivo de servicios:

- [lib/prediction/congestion-predictions-service.ts](../lib/prediction/congestion-predictions-service.ts#L586)

Endpoints:

- GET /api/prediccion-congestion/metadata
- GET /api/prediccion-congestion/list-areas

Resultado:

- predictionRegions
- predictionTimeframes
- predictionStepMinutes
- predictionReferenceTimeslot
- opcPredictions (habilita o no la opcion en UI)

Referencias directas:

- [getCongestionPredictionsMetadata](../lib/prediction/congestion-predictions-service.ts#L586)
- [getCongestionPredictionAreas](../lib/prediction/congestion-predictions-service.ts#L604)
- [setOpcPredictions](../components/navBarMap.tsx#L731)

### 4.2 Seleccion de area y timeslot

Estado principal en navBarMap:

- selectedPredictionAreaType
- selectedPredictionRegion
- selectedPredictionTimeslot

Componente UI:

- [components/prediction/prediction-timeline-panel.tsx](../components/prediction/prediction-timeline-panel.tsx#L123)

Combobox de areas:

- [components/prediction/prediction-area-combobox.tsx](../components/prediction/prediction-area-combobox.tsx#L1)

Detalles:

- Permite buscar por nombre, areaId y areaType.
- Tiene opcion Toda la ciudad (area vacia).
- Limita resultados visibles para rendimiento (max 200).

Referencias directas:

- [MAX_VISIBLE_OPTIONS](../components/prediction/prediction-area-combobox.tsx#L31)
- [Toda la ciudad](../components/prediction/prediction-area-combobox.tsx#L101)
- [Filtro por areaType](../components/prediction/prediction-timeline-panel.tsx#L151)

### 4.3 Fetch de predicciones por area/tiempo

En [components/navBarMap.tsx](../components/navBarMap.tsx#L768), un useEffect dispara carga cuando:

- opcVel === PREDICCIONES_CONGESTION
- hay selectedPredictionTimeslot valido

Resolucion de modo:

- Si no hay area seleccionada, usa citywide con endpoint total.
- Si hay area seleccionada, usa endpoint por area.

Funciones:

- getCongestionPredictionsTotalesByTime
- getCongestionPredictionsByRegionAndTime

Referencias directas:

- [getCongestionPredictionsTotalesByTime](../lib/prediction/congestion-predictions-service.ts#L657)
- [getCongestionPredictionsByRegionAndTime](../lib/prediction/congestion-predictions-service.ts#L622)

Endpoints:

- GET /api/prediccion-congestion/predictions-totales?timeslot=...
- GET /api/prediccion-congestion/predictions-areas?areaId=...&timeslot=...

Cache en cliente:

- Clave: areaId|timeslot
- Almacen: Map en predictionDataCacheRef
- Limite: 240 entradas (eviccion FIFO simple)

Referencias directas:

- [predictionDataCacheRef](../components/navBarMap.tsx#L229)
- [Eviccion de cache > 240](../components/navBarMap.tsx#L262)

### 4.4 Transformacion de segmentos y geometria

La respuesta de predicciones se transforma en segmentos de tipo CongestionPredictionSegment.

Importante:

- Las coordenadas se enriquecen con un indice MVI.
- Se hace match por road_id contra id_mvi.
- Si un segmento no logra geometria valida, no se dibuja.

Archivo:

- [lib/prediction/congestion-predictions-service.ts](../lib/prediction/congestion-predictions-service.ts#L479)

Funciones clave:

- getMviIndex
- mapPredictions

Referencias directas:

- [getMviIndex](../lib/prediction/congestion-predictions-service.ts#L257)
- [mapPredictions](../lib/prediction/congestion-predictions-service.ts#L479)
- [resolveMviSourceUrl](../lib/prediction/congestion-predictions-service.ts#L244)

### 4.5 Render en mapa

Hook responsable:

- [components/prediction/use-prediction-layer.ts](../components/prediction/use-prediction-layer.ts#L21)

Comportamiento:

- Limpia polylines anteriores.
- Dibuja una polyline por segmento valido.
- Color por nivel:
  - <= 2 verde
  - <= 3.5 naranja
  - > 3.5 rojo
- Click en polyline selecciona segmento para abrir modal de analitica.

Helper de color:

- [colorForPredictionLevel](../lib/prediction/prediction-formatters.ts#L7)

### 4.6 Timeline y reproduccion

Hook:

- [components/prediction/use-prediction-timeline.ts](../components/prediction/use-prediction-timeline.ts#L11)

Comportamiento:

- Slider controla indice pendiente y luego commit de timeslot.
- Botones prev/next mueven por indices.
- Play/Pause avanza automaticamente cada 1200 ms.
- Se desactiva al final o al salir del modo de prediccion.

Referencias directas:

- [commitTimeslotChange](../components/prediction/use-prediction-timeline.ts#L39)
- [moveTimeslot](../components/prediction/use-prediction-timeline.ts#L60)
- [Auto-play cada 1200 ms](../components/prediction/use-prediction-timeline.ts#L95)

### 4.7 Historial por segmento y modal de analitica

Hook de historial:

- [components/prediction/use-prediction-segment-history.ts](../components/prediction/use-prediction-segment-history.ts#L15)

Servicio:

- getCongestionPredictionSegmentHistory
- Endpoint: GET /api/prediccion-congestion/segment-history?roadId=...

Referencia directa:

- [getCongestionPredictionSegmentHistory](../lib/prediction/congestion-predictions-service.ts#L690)

Comportamiento:

- Toma history_items + future_items.
- Normaliza y ordena por timeslot.
- Alinea contra predictionTimeframes para no romper la serie cuando faltan puntos.
- Usa bandera de cancelacion para evitar setState despues de unmount.

Modal:

- [components/prediction/prediction-segment-analytics-modal.tsx](../components/prediction/prediction-segment-analytics-modal.tsx#L43)

Muestra:

- Resumenes promedio (nivel y velocidad).
- Grafica de nivel o velocidad.
- Distincion visual entre pasado y pronostico usando predictionReferenceTimeslot.

Referencias directas:

- [getHistoryAverages](../lib/prediction/prediction-formatters.ts#L68)
- [Split pasado/pronostico por referencia](../components/prediction/prediction-segment-analytics-modal.tsx#L60)

## 5. Loading de entrada al modo de prediccion

Mientras entra al modo, se aplica un estado de analisis para UX controlada:

- predictionEntryLoading
- predictionAnalysisLoading
- predictionInteractionDisabled

Efectos:

- Se bloquea interaccion del timeline temporalmente.
- Se ocultan segmentos reales de prediccion durante la entrada.
- Se muestra overlay de carga en mapa.

Archivo:

- [components/navBarMap.tsx](../components/navBarMap.tsx#L920)
- [components/mapaGooglemapsAlertVel.tsx](../components/mapaGooglemapsAlertVel.tsx#L3235)

## 6. Corredores animados durante carga

Hook:

- [components/prediction/use-prediction-loading-corridors.ts](../components/prediction/use-prediction-loading-corridors.ts#L14)

Origen de datos:

- [public/corredores.geojson](../public/corredores.geojson) (cargado desde [components/navBarMap.tsx](../components/navBarMap.tsx#L313))

Comportamiento:

- Dibuja glow + flujo animado por corredor.
- Ajusta bounds a corredores durante analisis loading.
- Limpia polylines e intervalos al terminar.

## 7. Estados principales para debugging

En [components/navBarMap.tsx](../components/navBarMap.tsx#L198):

Referencia directa: [components/navBarMap.tsx](../components/navBarMap.tsx#L198)

- predictionRegions
- predictionTimeframes
- predictionReferenceTimeslot
- predictionStepMinutes
- selectedPredictionAreaType
- selectedPredictionRegion
- selectedPredictionTimeslot
- predictionCongestionData
- predictionLoading
- predictionNoDataMessage
- predictionEntryLoading
- predictionAnalysisLoading
- predictionDataCacheRef

## 8. Contrato de tipos clave

Archivo:

- [components/prediction/prediction-types.ts](../components/prediction/prediction-types.ts#L1)
- [lib/prediction/congestion-predictions-service.ts](../lib/prediction/congestion-predictions-service.ts#L1)

Tipos relevantes:

- PredictionFeatureProps
- PredictionLoadingCorridor
- CongestionPredictionRegion
- CongestionPredictionSegment
- CongestionPredictionHistoryPoint

## 9. Notas:

- La feature esta separada en dos capas:
  - Orquestacion y fetch en navBarMap
  - UI y comportamiento de mapa en [components/prediction](../components/prediction)
- Si cambias endpoints o formato backend, valida primero mapMetadata, mapPredictions y mapHistoryPoint.
- Si la timeline no avanza, revisar selectedPredictionTimeslot, predictionTimeframes y guardas de isPredictionLayerActive.
- Si el modo no aparece en dropdown, revisar opcPredictions y carga exitosa de metadata.

Referencias de soporte:

- [Controlador de feature en mapa](../components/mapaGooglemapsAlertVel.tsx#L3211)
- [PredictionFeatureController](../components/prediction/prediction-feature-controller.tsx#L18)
- [usePredictionLayer](../components/prediction/use-prediction-layer.ts#L21)
- [usePredictionLoadingCorridors](../components/prediction/use-prediction-loading-corridors.ts#L14)
- [isPredictionLayerOption](../lib/prediction/prediction-formatters.ts#L3)

## 10. Resumen rapido

La prediccion de congestion en esta rama implementa un modo completo de exploracion temporal de congestion futura: obtiene metadata y areas, permite filtrar por area/timeslot, consulta predicciones, las pinta en mapa por severidad, y al click abre analitica historica/pronostico por segmento con controles de reproduccion temporal.
