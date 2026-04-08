const fs = require("fs");
const path = require("path");

const BASE_URL = "https://suanet-test.movilidadbogota.gov.co";

async function fetchJson(url, timeoutMs = 180000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      text,
      json,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithBackoff(url, { timeoutMs = 180000, retries = 6 } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    last = await fetchJson(url, timeoutMs);
    if (last.status !== 429) return last;
    const retryAfter = Number(last.headers["ratelimit-reset"] || 10);
    const delayMs = Number.isFinite(retryAfter)
      ? (retryAfter + 1) * 1000
      : (attempt + 1) * 5000;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return last;
}

function latestSnapshotDir() {
  const base = path.join(process.cwd(), "data");
  const dirs = fs
    .readdirSync(base, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() && d.name.startsWith("prediccion-congestion-snapshot-"),
    )
    .map((d) => path.join(base, d.name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return dirs[0] || null;
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

(async () => {
  const snapshotDir = latestSnapshotDir();
  if (!snapshotDir) throw new Error("No snapshot directory found");

  const reportPath = path.join(snapshotDir, "00-snapshot-report.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));

  const metadataPath = path.join(snapshotDir, "01-metadata.response.json");
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  const slots = (metadata?.data?.slots || [])
    .map((s) => s.timeslot)
    .filter(Boolean);

  const predAreaPath = path.join(
    snapshotDir,
    "03-predictions-areas.response.json",
  );
  const predArea = JSON.parse(fs.readFileSync(predAreaPath, "utf8"));
  const roadId = predArea?.data?.items?.[0]?.road_id || "16000185_TF.2";

  let bestTotales = null;
  for (const ts of slots) {
    const url = `${BASE_URL}/api/prediccion-congestion/predictions-totales?timeslot=${encodeURIComponent(ts)}`;
    const r = await fetchWithBackoff(url, { retries: 4 });
    const items = r.json?.data?.items?.length ?? 0;
    if (
      !bestTotales ||
      (r.status === 200 && items > (bestTotales.items || 0))
    ) {
      bestTotales = {
        url,
        status: r.status,
        timeslot: ts,
        items,
        body: r.json || { raw: r.text },
      };
    }
    if (r.status === 200 && items > 0) break;
  }
  writeJson(
    path.join(snapshotDir, "05-predictions-totales.response.json"),
    bestTotales?.body || { message: "No response captured" },
  );
  report.endpoints.predictionsTotales = {
    url: bestTotales?.url || null,
    status: bestTotales?.status || null,
    timeslot: bestTotales?.timeslot || null,
    items: bestTotales?.items ?? null,
  };

  const histUrl = `${BASE_URL}/api/prediccion-congestion/segment-history?roadId=${encodeURIComponent(roadId)}`;
  const hist = await fetchWithBackoff(histUrl, { retries: 6 });
  writeJson(
    path.join(snapshotDir, "06-segment-history.response.json"),
    hist.json || { raw: hist.text },
  );
  report.endpoints.segmentHistory = {
    url: histUrl,
    status: hist.status,
    roadId,
    totalItems: hist.json?.data?.totalItems ?? null,
  };

  const alertsUrl = `${BASE_URL}/api/prediccion-congestion/future-alerts`;
  const alerts = await fetchWithBackoff(alertsUrl, { retries: 6 });
  writeJson(
    path.join(snapshotDir, "07-future-alerts.response.json"),
    alerts.json || { raw: alerts.text },
  );
  report.endpoints.futureAlerts = { url: alertsUrl, status: alerts.status };

  const mviUrl = `${BASE_URL}/api/activos/mvi`;
  const mvi = await fetchWithBackoff(mviUrl, { timeoutMs: 300000, retries: 3 });
  if (mvi.json) {
    writeJson(path.join(snapshotDir, "08-mvi.response.json"), mvi.json);
  } else {
    fs.writeFileSync(
      path.join(snapshotDir, "08-mvi.response.raw.json"),
      mvi.text,
    );
  }
  report.endpoints.mvi = {
    url: mviUrl,
    status: mvi.status,
    contentLength: mvi.headers["content-length"] || null,
    contentType: mvi.headers["content-type"] || null,
  };

  report.lastRefetchAt = new Date().toISOString();
  writeJson(reportPath, report);

  console.log("UPDATED_SNAPSHOT", snapshotDir);
  console.log("SUMMARY", JSON.stringify(report.endpoints, null, 2));
})();
