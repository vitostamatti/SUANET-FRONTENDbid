# Congestion Prediction - Endpoints with Real Examples

Base URL:

- https://suanet-test.movilidadbogota.gov.co

Validated with real responses on 2026-03-24 (except for the MVI note below).

## 1. Metadata

Purpose: get valid prediction timeslots and availability status.

Request:

- https://suanet-test.movilidadbogota.gov.co/api/prediccion-congestion/metadata

Real response example (trimmed):

```json
{
	"data": {
		"generatedAt": "2026-03-24T12:00:00",
		"expectedPeriods": 50,
		"availablePeriods": 50,
		"emptyPeriods": 0,
		"jamsPeriodsAvailable": 192,
		"predictionTimeslots": [
			"2026-03-24T12:15:00",
			"2026-03-24T12:30:00",
			"2026-03-24T12:45:00",
			"2026-03-24T13:00:00",
			"2026-03-24T13:15:00"
		],
    "jamsTimeslots":[
      "2026-03-24T12:15:00",
			"2026-03-24T12:30:00",
			"2026-03-24T12:45:00",
			"2026-03-24T13:00:00",
			"2026-03-24T13:15:00"
    ]
	}
}
```

## 2. Available Areas List

Purpose: get valid `areaId` values for area-based queries.

Request:

- https://suanet-test.movilidadbogota.gov.co/api/prediccion-congestion/list-areas

Real response example (trimmed):

```json
{
	"areas": [
		{
			"id_area": "upl:UPL13",
			"tipo_area": "upl",
			"nombre_area": "Tintal"
		},
		{
			"id_area": "upl:UPL18",
			"tipo_area": "upl",
			"nombre_area": "Kennedy"
		},
		{
			"id_area": "corredor:0680000000",
			"tipo_area": "corredor",
			"nombre_area": "AK 68"
		}
	]
}
```

## 3. Segment Predictions in an Area

Purpose: get per-`road_id` predictions for a given `areaId` and `timeslot`.

Example request (currently valid slot):

- https://suanet-test.movilidadbogota.gov.co/api/prediccion-congestion/predictions-areas?areaId=upl:UPL18&timeslot=2026-03-24T18:00:00

Real response example (trimmed):

```json
{
	"data": {
		"generatedAt": "2026-03-24T12:10:00-05:00",
		"timeslot": "2026-03-24T18:00:00",
		"areaId": "upl:UPL18",
		"totalItems": 6318,
		"items": [
			{
				"road_id": "0_N.2",
				"predicted_velocity": 16.13,
				"predicted_level": 1,
				"day": "2026-03-24",
				"hour": "18:00",
				"timeslot": "2026-03-24T18:00:00"
			}
		]
	}
}
```

## 4. Grouped Predictions by Road and Direction

Purpose: consolidated geometry by road/corridor with aggregated metrics.

Example request:

- https://suanet-test.movilidadbogota.gov.co/api/prediccion-congestion/predictions-areas-agrupadas?areaId=upl:UPL18&timeslot=2026-03-24T18:00:00

Real response example (trimmed):

```json
{
	"type": "FeatureCollection",
	"features": [
		{
			"type": "Feature",
			"geometry": {
				"type": "MultiLineString"
			},
			"properties": {
				"road_code": "003A000000",
				"road_name": "CL 3A",
				"direction": "B",
				"min_level": 1,
				"max_level": 1,
				"mean_level": 0.79,
				"min_velocity": 12.9,
				"max_velocity": 21.3,
				"mean_velocity": 18.24,
				"segment_count": 16,
				"timeslot": "2026-03-24T18:00:00"
			}
		}
	]
}
```

## 5. Citywide Predictions

Purpose: top segments citywide for a selected timeslot.

Example request:

- https://suanet-test.movilidadbogota.gov.co/api/prediccion-congestion/predictions-totales?timeslot=2026-03-24T18:00:00

Real response example (trimmed):

```json
{
	"data": {
		"generatedAt": "2026-03-24T12:10:00-05:00",
		"timeslot": "2026-03-24T18:00:00",
		"totalItems": 8,
		"items": [
			{
				"road_id": "15000013_TF.2",
				"predicted_velocity": 23.77,
				"predicted_level": 3,
				"day": "2026-03-24",
				"hour": "18:00",
				"timeslot": "2026-03-24T18:00:00"
			}
		]
	}
}
```

## 6. Segment History

Purpose: future series (and historical series when available) for a `roadId`.

Example request:

- https://suanet-test.movilidadbogota.gov.co/api/prediccion-congestion/segment-history?roadId=15000013_TF.2

Real response example (trimmed):

```json
{
	"data": {
		"roadId": "15000013_TF.2",
		"totalItems": 94,
		"future_items": [
			{
				"road_id": "15000013_TF.2",
				"timeslot": "2026-03-24T12:15:00",
				"predicted_level": 1,
				"predicted_velocity": 25.74,
				"source": "prediction"
			},
			{
				"road_id": "15000013_TF.2",
				"timeslot": "2026-03-24T12:30:00",
				"predicted_level": 1,
				"predicted_velocity": 26.22,
				"source": "prediction"
			}
		],
		"history_items": [
			{
				"road_id": "15000013_TF.2",
				"timeslot": "2026-03-24T00:00:00-05:00",
				"level_mean": 4,
				"vel_mean": 3.92,
				"delay_sum": 142.94,
				"count_jams": 3,
				"source": "historical"
			}
		]
	}
}
```

## 7. Future Alerts

Purpose: future congestion alerts with severity and geometry.

Request:

- https://suanet-test.movilidadbogota.gov.co/api/prediccion-congestion/future-alerts

Real response example (trimmed):

```json
{
	"data": {
		"generatedAt": "2026-03-24T12:10:00-05:00",
		"totalItems": 50,
		"alert_items": {
			"type": "FeatureCollection",
			"features": [
				{
					"type": "Feature",
					"grometry":{},
					"properties": {
						"alert_id": 1,
						"predicted_level": 3,
						"min_velocity": 11.32,
						"severity_score": 9.12,
						"affected_count": 132,
						"segment_count": 3,
						"peak_timeslot": "2026-03-24T14:00:00",
						"road_ids": ["50006910_FT.2"],
						"road_names": ["KR 20"]
					}
				}
			]
		}
	}
}
```

## 8. MVI (Activos)

Purpose: base road network geometry used to enrich segments with metadata.

Request:

- https://suanet-test.movilidadbogota.gov.co/api/activos/mvi

Note: this endpoint is large (snapshot reported with an approximate `contentLength` of 57 MB), so clients usually cache it.

Real response example (trimmed from a local snapshot):

```json
[
	{
		"geometry": {
			"coordinates": [
				[-74.07460868800001, 4.590019063999989],
				[-74.07464678100001, 4.590036950000012]
			]
		},
		"properties": {
			"MVINOMBRE": "SIN_NMG",
			"MVIETIQUET": "CL 6ABISA",
			"MVISVIA": "B",
			"MVINUMC": 2,
			"MVIVELREG": "30",
			"id_mvi": "3001043_B.1",
			"afectados": 13.603705862901785,
			"estado_mvi": "FALLADO",
			"hallazgos": []
		}
	}
]
```

## Quick Parameters and Recommendations

1. `timeslot` should come from `metadata.predictionTimeslots`.
2. `areaId` should come from `list-areas`.
3. `roadId` should match a valid segment id (for example from predictions output, or `id_mvi` in MVI data when applicable).
4. If a query returns empty data for a slot, check metadata again to confirm the slot is still available.