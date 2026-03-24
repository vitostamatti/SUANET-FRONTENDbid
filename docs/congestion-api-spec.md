# Congestion Predictions API Specification (Live Backend Contract)

This document describes the backend contract currently observed in live environments and consumed by this frontend.

## Verification Stamp

- Verified on: 2026-03-16
- Environment used: suanet-test
- Base URL source: `NEXT_PUBLIC_BACKEND_URL`

## Live Base Path

- `/api/prediccion-congestion/metadata`
- `/api/prediccion-congestion/predictions-areas?areaId={areaId}&timeslot={timeslot}`
- `/api/prediccion-congestion/segment-history?roadId={roadId}[&areaId={areaId}]`

## Common Response Envelope

### Success

```json
{
  "data": {}
}
```

### Error

```json
{
  "message": "human readable error"
}
```

## 1) GET `/api/prediccion-congestion/metadata`

Returns available regions and slots plus backend metadata.

### Request

- Method: `GET`
- Query params: none

### Response `200` (observed shape)

```json
{
  "data": {
    "generatedAt": "2026-03-16T13:30:00",
    "expectedFirstSlot": "2026-03-16T13:45:00",
    "expectedLastSlot": "2026-03-17T02:00:00",
    "availablePeriods": 31,
    "emptyPeriods": 19,
    "regions": [
      {
        "areaId": "upl:UPL13",
        "name": "Tintal"
      }
    ],
    "slots": [
      {
        "timeslot": "2026-03-16T13:45:00",
        "hasHighCongestion": false
      }
    ]
  }
}
```

### Error `500`

```json
{
  "message": "Failed to load congestion prediction metadata"
}
```

## 2) GET `/api/prediccion-congestion/predictions-areas`

Returns predicted segments for one `areaId` and one `timeslot`.

### Request

- Method: `GET`
- Query params:
  - `areaId` (required, string)
  - `timeslot` (required, ISO datetime string)

### Response `200` (observed field contract)

```json
{
  "data": {
    "generatedAt": "2026-03-16T13:30:00",
    "timeslot": "2026-03-16T20:00:00",
    "areaId": "upl:UPL13",
    "totalItems": 2,
    "items": [
      {
        "road_id": "1001_north",
        "predicted_velocity": 21.3,
        "predicted_level": 2.8,
        "day": "2026-03-16",
        "hour": "20:00",
        "timeslot": "2026-03-16T20:00:00"
      }
    ]
  }
}
```

### Response `404` (valid request, no data for that area/slot)

```json
{
  "message": "No predictions found for areaId and timeslot"
}
```

### Error `400`

```json
{
  "message": "Query params areaId and timeslot are required"
}
```

### Error `500`

```json
{
  "message": "Failed to process predictions request"
}
```

## 3) GET `/api/prediccion-congestion/segment-history`

Returns segment history and future points for one `roadId`.

### Request

- Method: `GET`
- Query params:
  - `roadId` (required, string)
  - `areaId` (optional, string)

### Response `200` (populated shape)

```json
{
  "data": {
    "roadId": "1001_north",
    "totalItems": 2,
    "history_items": [
      {
        "road_id": "1001_north",
        "timeslot": "2026-03-16T19:45:00",
        "predicted_level": 2.1,
        "predicted_velocity": 24.1,
        "source": "history"
      }
    ],
    "future_items": [
      {
        "road_id": "1001_north",
        "timeslot": "2026-03-16T20:00:00",
        "predicted_level": 2.8,
        "predicted_velocity": 21.3,
        "source": "forecast"
      }
    ]
  }
}
```

### Response `200` (valid request, empty history)

```json
{
  "data": {
    "roadId": "1001",
    "totalItems": 0,
    "history_items": [],
    "future_items": []
  }
}
```

### Error `400`

```json
{
  "message": "Query param roadId is required"
}
```

### Error `500`

```json
{
  "message": "Failed to process segment history request"
}
```

## Method Constraints

Any non-GET method under `/api/prediccion-congestion/*` should return `405`.

## Data Availability Semantics

- `metadata` may expose slots that do not yet have predictions for all areas.
- `predictions-areas` can return `404` for a valid `areaId + timeslot` combination when no predictions exist.
- Partial coverage is expected: only roads with computed predictions are returned in `items`.
- `segment-history` can return `200` with empty arrays for roads without stored history.

## Frontend Compatibility Mapping

Current frontend service normalizes this backend contract to internal UI models in `lib/prediction/congestion-predictions-service.ts`:

- `metadata.data.slots[].timeslot` -> `timeframes[]`
- `metadata` derived internally -> `stepMinutes`, `referenceTimeslot`, `pastPeriods`, `futurePeriods`
- `items[].road_id` -> `roadId`
- `items[].predicted_velocity` -> `velocity`
- `items[].predicted_level` -> `level`
- `segment-history` merged from `history_items + future_items` and sorted by `timeslot`

This means backend payload names in this document are authoritative, while frontend component props may use normalized names.

## Legacy Path Note

Paths under `/api/congestion/predictions/*` in older docs are legacy references and are not the currently integrated backend contract in this branch.
