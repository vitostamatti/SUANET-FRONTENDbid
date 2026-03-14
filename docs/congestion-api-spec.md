# Congestion Predictions API Specification (Production Contract)

This document defines the **real backend contract** required by this frontend for congestion predictions.

## Canonical Base Path (Production)

- `/api/congestion/predictions/metadata`
- `/api/congestion/predictions` ?areaId=12
- `/api/congestions/predictions/area` // polygon
- `/api/congestion/predictions/segment-history` ?segmentId=1212312
- `/api/congestion/predictions/segment-future` ?segmentId=1212312

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

---

## 1) GET `/api/congestion/predictions/metadata`

Returns timeline and region metadata.

### Request

- Method: `GET`
- Query params: none

### Response `200`

```json
{
  "data": {
    "generatedAt": "2026-02-28T12:30:00.000Z",
    "stepMinutes": 15,
    "referenceTimeslot": "2026-02-28T06:15:00.000Z",
    "pastPeriods": 8,
    "futurePeriods": 8,
    "regions": [
      {
        "areaId": "1",
        "name": "Region 1"
      }
    ],
    "timeframes": ["2026-02-28T06:00:00.000Z", "2026-02-28T06:15:00.000Z"]
  }
}
```

### Error `500`

```json
{
  "message": "Failed to load congestion prediction metadata"
}
```

---

## 2) GET `/api/congestion/predictions`

Returns all segment predictions for one region and one timeslot.

### Request

- Method: `GET`
- Query params:
  - `areaId` (required, string)
  - `timeslot` (required, ISO datetime string)

### Response `200`

```json
{
  "data": {
    "generatedAt": "2026-02-28T12:30:00.000Z",
    "timeslot": "2026-02-28T06:15:00.000Z",
    "areaId": "1",
    "totalItems": 2,
    "items": [
      {
        "mviCodigo": 1001,
        "id": 1001,
        "areaId": "1",
        "title": "Segmento 1001",
        "coordinates": [
          [-74.1, 4.6],
          [-74.09, 4.61]
        ],
        "velocity": 21.3,
        "level": 2.8,
        "delay": 31.0,
        "day": "2026-02-28",
        "hour": "06:15",
        "timeslot": "2026-02-28T06:15:00.000Z"
      }
    ]
  }
}
```

### Error `400`

```json
{
  "message": "Query params areaId and timeslot are required"
}
```

```json
{
  "message": "Invalid timeslot. Use one value from metadata.timeframes"
}
```

### Error `500`

```json
{
  "message": "Failed to process congestion prediction request"
}
```

---

## 3) GET `/api/congestion/predictions/segment-history`

Returns one segment history across all available timeslots.

### Request

- Method: `GET`
- Query params:
  - `mviCodigo` (required, number/string numeric)
  - `areaId` (optional, string)

### Response `200`

```json
{
  "data": {
    "mviCodigo": 1001,
    "areaId": "1",
    "totalItems": 2,
    "items": [
      {
        "timeslot": "2026-02-28T06:00:00.000Z",
        "label": "06:00",
        "day": "2026-02-28",
        "velocity": 24.1,
        "level": 2.1,
        "delay": 26.0,
        "jams": 0
      },
      {
        "timeslot": "2026-02-28T06:15:00.000Z",
        "label": "06:15",
        "day": "2026-02-28",
        "velocity": 21.3,
        "level": 2.8,
        "delay": 31.0,
        "jams": 1
      }
    ]
  }
}
```

### Error `400`

```json
{
  "message": "Query param mviCodigo is required"
}
```

### Error `500`

```json
{
  "message": "Failed to process segment history request"
}
```

---

## Method Constraints

Any non-GET method under `/api/congestion/predictions*` should return `405`:

```json
{
  "message": "Method not allowed"
}
```

## Data Contract (Mandatory Fields)

### `metadata.data`

- `generatedAt`: string (ISO-8601)
- `stepMinutes`: number (positive integer)
- `referenceTimeslot`: string (ISO-8601, fixed forecast reference point)
- `pastPeriods`: number (configured historical window size)
- `futurePeriods`: number (configured forecast window size)
- `regions`: array of `{ areaId: string, name: string }`
- `timeframes`: ordered array of ISO-8601 timestamps

### `predictions.data.items[]`

- `mviCodigo`: number
- `id`: number (can equal `mviCodigo`)
- `areaId`: string
- `title`: string
- `coordinates`: array of `[lng, lat]`
- `velocity`: number
- `level`: number
- `delay`: number
- `day`: string (`YYYY-MM-DD`)
- `hour`: string (`HH:mm`)
- `timeslot`: string (ISO-8601)

### `segment-history.data.items[]`

- `timeslot`: string (ISO-8601)
- `label`: string (`HH:mm`)
- `day`: string (`YYYY-MM-DD`)
- `velocity`: number
- `level`: number
- `delay`: number
- `jams`: number

## Behavioral Requirements

- `timeframes` must be sorted ascending and stable within a session.
- `referenceTimeslot` must be set to the last closed slot relative to backend current time.
- `timeframes` must be a bounded window around `referenceTimeslot`: `pastPeriods` behind and `futurePeriods` ahead (clamped by data availability).
- `timeslot` in `/predictions` must be validated against `metadata.timeframes`.
- `segment-history` must return all available points for that segment in chronological order.
- `areaId` in `segment-history` is optional; if provided and does not match segment area, return empty `items`.
- Response envelope (`data` for 2xx, `message` for error statuses) must stay consistent.

## Performance Expectations

- `/metadata`: lightweight bootstrap response.
- `/predictions`: optimized for one `areaId + timeslot` (map repaint).
- `/segment-history`: optimized for one segment across the timeline (analytics modal).

## Client Usage Guidance

- Timeline/map rendering uses `/api/congestion/predictions` by `areaId + timeslot`.
- Segment analytics uses `/api/congestion/predictions/segment-history` (one call per segment).
- Metadata bootstrap uses `/api/congestion/predictions/metadata` once and cache locally.

## Migration Notes

- Preferred: implement canonical production paths and update frontend service paths.
- Transitional: expose both canonical and compatibility alias paths until frontend switch is completed.
