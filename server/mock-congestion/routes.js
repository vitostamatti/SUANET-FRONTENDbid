const {
  initializeMockCongestionData,
  getMockCongestionMetadata,
  getCongestionRowsForAreaAndTimeslot,
  getCongestionSegmentHistory,
  isValidMockTimeslot,
} = require("./service");

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
};

const handleMockCongestionRoutes = async ({
  pathname,
  method,
  parsedUrl,
  res,
}) => {
  if (pathname === "/api/mock/congestion/metadata" && method === "GET") {
    try {
      await initializeMockCongestionData();

      return sendJson(res, 200, {
        data: getMockCongestionMetadata(),
      });
    } catch (error) {
      console.error("❌ [Mock Congestion] Metadata error:", error);
      return sendJson(res, 500, {
        message: "Failed to initialize mock congestion metadata",
      });
    }
  }

  if (pathname === "/api/mock/congestion" && method === "GET") {
    try {
      await initializeMockCongestionData();

      const areaId = String(parsedUrl.query.areaId || "").trim();
      const timeslot = String(parsedUrl.query.timeslot || "").trim();

      if (!areaId || !timeslot) {
        return sendJson(res, 400, {
          message: "Query params areaId and timeslot are required",
        });
      }

      if (!isValidMockTimeslot(timeslot)) {
        return sendJson(res, 400, {
          message: "Invalid timeslot. Use one value from metadata.timeframes",
        });
      }

      const rows = getCongestionRowsForAreaAndTimeslot(areaId, timeslot);
      const metadata = getMockCongestionMetadata();

      return sendJson(res, 200, {
        data: {
          generatedAt: metadata.generatedAt,
          timeslot,
          areaId,
          totalItems: rows.length,
          items: rows,
        },
      });
    } catch (error) {
      console.error("❌ [Mock Congestion] Query error:", error);
      return sendJson(res, 500, {
        message: "Failed to process mock congestion request",
      });
    }
  }

  if (pathname === "/api/mock/congestion/segment-history" && method === "GET") {
    try {
      await initializeMockCongestionData();

      const mviCodigo = String(parsedUrl.query.mviCodigo || "").trim();
      const areaId = String(parsedUrl.query.areaId || "").trim();

      if (!mviCodigo) {
        return sendJson(res, 400, {
          message: "Query param mviCodigo is required",
        });
      }

      const history = getCongestionSegmentHistory(mviCodigo, areaId || null);

      return sendJson(res, 200, {
        data: {
          mviCodigo: Number(mviCodigo),
          areaId: areaId || null,
          totalItems: history.length,
          items: history,
        },
      });
    } catch (error) {
      console.error("❌ [Mock Congestion] Segment history error:", error);
      return sendJson(res, 500, {
        message: "Failed to process segment history request",
      });
    }
  }

  if (pathname.startsWith("/api/mock/congestion")) {
    sendJson(res, 405, {
      message: "Method not allowed for mock congestion endpoint",
    });
    return true;
  }

  return false;
};

module.exports = {
  handleMockCongestionRoutes,
};
