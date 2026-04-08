const fs = require("fs");
const path = require("path");

const BASE_URL = "https://suanet-test.movilidadbogota.gov.co";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(
  process.cwd(),
  "data",
  `prediccion-congestion-snapshot-${stamp}`,
);
fs.mkdirSync(outDir, { recursive: true });

async function fetchEndpoint(url, timeoutMs = 180000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return {
      ok: res.ok,
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      text,
      json,
    };
  } finally {
    clearTimeout(timer);
  }
}

function writeJson(fileName, data) {
  fs.writeFileSync(path.join(outDir, fileName), JSON.stringify(data, null, 2));
}

function writeRaw(fileName, content) {
  fs.writeFileSync(path.join(outDir, fileName), content);
}

function pickAreas(metadataJson, listAreasJson) {
  const fromMeta = (metadataJson?.data?.regions || [])
    .map((r) => r.areaId)
    .filter(Boolean);
  const listAreas = Array.isArray(listAreasJson?.areas)
    ? listAreasJson.areas
    : Array.isArray(listAreasJson?.data?.areas)
      ? listAreasJson.data.areas
      : [];
  const fromList = listAreas.map((a) => a.id_area || a.areaId).filter(Boolean);
  return [...new Set([...fromMeta, ...fromList])];
}

function pickSlots(metadataJson) {
  return (metadataJson?.data?.slots || [])
    .map((s) => s.timeslot)
    .filter(Boolean);
}

function countItemsFromPredAreas(json) {
  return json?.data?.items?.length ?? 0;
}

function countItemsFromTotales(json) {
  return json?.data?.items?.length ?? 0;
}

function countFeaturesFromAgrupadas(json) {
  if (
    json?.data?.items?.type === "FeatureCollection" &&
    Array.isArray(json?.data?.items?.features)
  ) {
    return json.data.items.features.length;
  }
  return 0;
}

(async () => {
  const report = {
    baseUrl: BASE_URL,
    outputDir: outDir,
    timestamp: new Date().toISOString(),
    endpoints: {},
  };

  const metaUrl = `${BASE_URL}/api/prediccion-congestion/metadata`;
  const metadata = await fetchEndpoint(metaUrl);
  report.endpoints.metadata = { url: metaUrl, status: metadata.status };
  writeJson(
    "01-metadata.response.json",
    metadata.json || { raw: metadata.text },
  );

  const listAreasUrl = `${BASE_URL}/api/prediccion-congestion/list-areas`;
  const listAreas = await fetchEndpoint(listAreasUrl);
  report.endpoints.listAreas = { url: listAreasUrl, status: listAreas.status };
  writeJson(
    "02-list-areas.response.json",
    listAreas.json || { raw: listAreas.text },
  );

  const areas = pickAreas(metadata.json, listAreas.json);
  const slots = pickSlots(metadata.json);
  report.derived = {
    areaCount: areas.length,
    slotCount: slots.length,
    firstArea: areas[0] || null,
    firstSlot: slots[0] || null,
  };

  let predAreasBest = null;
  for (const areaId of areas.slice(0, 40)) {
    for (const timeslot of slots.slice(0, 50)) {
      const url = `${BASE_URL}/api/prediccion-congestion/predictions-areas?areaId=${encodeURIComponent(areaId)}&timeslot=${encodeURIComponent(timeslot)}`;
      const r = await fetchEndpoint(url);
      const items = countItemsFromPredAreas(r.json);
      if (
        !predAreasBest ||
        (r.status === 200 && items > (predAreasBest.items || 0))
      ) {
        predAreasBest = {
          url,
          status: r.status,
          items,
          areaId,
          timeslot,
          body: r.json || { raw: r.text },
        };
      }
      if (r.status === 200 && items > 0) {
        predAreasBest = {
          url,
          status: r.status,
          items,
          areaId,
          timeslot,
          body: r.json || { raw: r.text },
        };
        break;
      }
    }
    if (
      predAreasBest &&
      predAreasBest.status === 200 &&
      predAreasBest.items > 0
    )
      break;
  }
  report.endpoints.predictionsAreas = {
    url: predAreasBest?.url || null,
    status: predAreasBest?.status || null,
    areaId: predAreasBest?.areaId || null,
    timeslot: predAreasBest?.timeslot || null,
    items: predAreasBest?.items ?? null,
  };
  writeJson(
    "03-predictions-areas.response.json",
    predAreasBest?.body || { message: "No response captured" },
  );

  let agrupadasBest = null;
  const agrupProbe = [];
  if (predAreasBest?.areaId && predAreasBest?.timeslot) {
    agrupProbe.push({
      areaId: predAreasBest.areaId,
      timeslot: predAreasBest.timeslot,
    });
  }
  for (const areaId of areas.slice(0, 25)) {
    for (const timeslot of slots.slice(0, 25)) {
      agrupProbe.push({ areaId, timeslot });
    }
  }
  for (const { areaId, timeslot } of agrupProbe) {
    const url = `${BASE_URL}/api/prediccion-congestion/predictions-areas-agrupadas?areaId=${encodeURIComponent(areaId)}&timeslot=${encodeURIComponent(timeslot)}`;
    const r = await fetchEndpoint(url);
    const features = countFeaturesFromAgrupadas(r.json);
    if (
      !agrupadasBest ||
      (r.status === 200 && features > (agrupadasBest.features || 0))
    ) {
      agrupadasBest = {
        url,
        status: r.status,
        areaId,
        timeslot,
        features,
        body: r.json || { raw: r.text },
      };
    }
    if (r.status === 200 && features > 0) {
      agrupadasBest = {
        url,
        status: r.status,
        areaId,
        timeslot,
        features,
        body: r.json || { raw: r.text },
      };
      break;
    }
  }
  report.endpoints.predictionsAreasAgrupadas = {
    url: agrupadasBest?.url || null,
    status: agrupadasBest?.status || null,
    areaId: agrupadasBest?.areaId || null,
    timeslot: agrupadasBest?.timeslot || null,
    features: agrupadasBest?.features ?? null,
  };
  writeJson(
    "04-predictions-areas-agrupadas.response.json",
    agrupadasBest?.body || { message: "No response captured" },
  );

  let totalesBest = null;
  for (const timeslot of slots.slice(0, 60)) {
    const url = `${BASE_URL}/api/prediccion-congestion/predictions-totales?timeslot=${encodeURIComponent(timeslot)}`;
    const r = await fetchEndpoint(url);
    const items = countItemsFromTotales(r.json);
    if (
      !totalesBest ||
      (r.status === 200 && items > (totalesBest.items || 0))
    ) {
      totalesBest = {
        url,
        status: r.status,
        timeslot,
        items,
        body: r.json || { raw: r.text },
      };
    }
    if (r.status === 200 && items > 0) {
      totalesBest = {
        url,
        status: r.status,
        timeslot,
        items,
        body: r.json || { raw: r.text },
      };
      break;
    }
  }
  report.endpoints.predictionsTotales = {
    url: totalesBest?.url || null,
    status: totalesBest?.status || null,
    timeslot: totalesBest?.timeslot || null,
    items: totalesBest?.items ?? null,
  };
  writeJson(
    "05-predictions-totales.response.json",
    totalesBest?.body || { message: "No response captured" },
  );

  const candidateRoadIds = [];
  const predItems = predAreasBest?.body?.data?.items || [];
  if (predItems[0]?.road_id) candidateRoadIds.push(predItems[0].road_id);
  candidateRoadIds.push("16000185_TF.2", "1001");
  let histBest = null;
  for (const roadId of [...new Set(candidateRoadIds)]) {
    const url = `${BASE_URL}/api/prediccion-congestion/segment-history?roadId=${encodeURIComponent(roadId)}`;
    const r = await fetchEndpoint(url);
    const total = r.json?.data?.totalItems ?? null;
    if (
      !histBest ||
      (r.status === 200 && (total || 0) > (histBest.totalItems || 0))
    ) {
      histBest = {
        url,
        status: r.status,
        roadId,
        totalItems: total,
        body: r.json || { raw: r.text },
      };
    }
    if (r.status === 200 && (total || 0) > 0) {
      histBest = {
        url,
        status: r.status,
        roadId,
        totalItems: total,
        body: r.json || { raw: r.text },
      };
      break;
    }
  }
  report.endpoints.segmentHistory = {
    url: histBest?.url || null,
    status: histBest?.status || null,
    roadId: histBest?.roadId || null,
    totalItems: histBest?.totalItems ?? null,
  };
  writeJson(
    "06-segment-history.response.json",
    histBest?.body || { message: "No response captured" },
  );

  const alertsUrl = `${BASE_URL}/api/prediccion-congestion/future-alerts`;
  const alerts = await fetchEndpoint(alertsUrl);
  report.endpoints.futureAlerts = { url: alertsUrl, status: alerts.status };
  writeJson(
    "07-future-alerts.response.json",
    alerts.json || { raw: alerts.text },
  );

  const mviUrl = `${BASE_URL}/api/activos/mvi`;
  const mvi = await fetchEndpoint(mviUrl, 240000);
  report.endpoints.mvi = {
    url: mviUrl,
    status: mvi.status,
    contentLength: mvi.headers["content-length"] || null,
    contentType: mvi.headers["content-type"] || null,
  };
  if (mvi.json) {
    writeJson("08-mvi.response.json", mvi.json);
  } else {
    writeRaw("08-mvi.response.raw.json", mvi.text);
  }

  writeJson("00-snapshot-report.json", report);

  console.log("SNAPSHOT_DIR", outDir);
  console.log("REPORT_FILE", path.join(outDir, "00-snapshot-report.json"));
  console.log("SUMMARY", JSON.stringify(report.endpoints, null, 2));
})();
