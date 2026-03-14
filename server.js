require("dotenv").config();
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" }); // Fallback

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { createProxyServer } = require("http-proxy");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const cron = require("node-cron");
const os = require("os");
const crypto = require("crypto");
const {
  handleMockCongestionRoutes,
} = require("./server/mock-congestion/routes");

// ============================================
// BASIC SECURITY HEADERS (CSP REMOVED FOR VIDEO STREAMING)
// ============================================
const applyBasicSecurityHeaders = (req, res, isAPICall = false) => {
  // Basic security headers only - no CSP restrictions
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Remove server information
  res.removeHeader("X-Powered-By");
  res.removeHeader("Server");

  // HSTS in production
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  // Special CORS headers for video streams - critical for AKS to local development
  if (
    req.url &&
    (req.url.includes("/video_feed/") ||
      req.url.includes("/video_detector_feed/"))
  ) {
    console.log(
      `🎥 [Video CORS] Setting CORS headers for video stream: ${req.url}`,
    );
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Type, Content-Length",
    );
  }
};

console.log("🔍 [Debug] Variables de entorno disponibles:");
console.log("🔍 NEXT_PUBLIC_BACKEND_URL:", process.env.NEXT_PUBLIC_BACKEND_URL);
console.log("🔍 BACKEND_URL:", process.env.BACKEND_URL);
console.log("🔍 NODE_ENV:", process.env.NODE_ENV);

// ============================================
// DEFINIR PUERTO PRIMERO
// ============================================
const port = process.env.PORT || 3000;

// ============================================
// NUEVO: Sistema dinámico de backend URL
// ============================================
let dynamicBackendUrl =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
let backendRegistrationStatus = false;

// Function to update backend URL and re-register
const updateBackendUrl = (newBackendUrl) => {
  const oldUrl = dynamicBackendUrl;
  dynamicBackendUrl = newBackendUrl;
  console.log(
    `🔄 [Frontend Server] Backend URL updated: ${oldUrl} -> ${newBackendUrl}`,
  );
  return dynamicBackendUrl;
};

// Función para registrar frontend con backend
const registerWithBackend = async () => {
  try {
    // ✅ CRÍTICO: Usar la misma variable de entorno para consistencia
    const frontendUrl =
      process.env.NEXT_PUBLIC_FRONTEND_URL || `http://localhost:${port}`;
    const sessionId = `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const clientInfo = {
      userAgent: "Frontend-Server-Node",
      platform: os.platform(),
      language: "en",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      buildVersion: process.env.BUILD_VERSION || "unknown",
      serverType: "frontend-proxy-server",
      sessionId: sessionId, // ✅ NUEVO: Incluir ID de sesión del servidor
    };

    console.log(
      `🌐 [Frontend Server] Registrando frontend ${frontendUrl} con backend ${dynamicBackendUrl}`,
    );

    const response = await fetch(`${dynamicBackendUrl}/api/register-frontend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        frontendUrl,
        sessionId: sessionId, // ✅ NUEVO: Incluir ID de sesión
        clientInfo,
      }),
      signal: AbortSignal.timeout(5000), // Reduce timeout to prevent blocking
    });

    if (!response.ok) {
      console.error(`❌ [Frontend Server] Response status: ${response.status}`);
      console.error(
        `❌ [Frontend Server] Response statusText: ${response.statusText}`,
      );
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.success) {
      backendRegistrationStatus = true;
      console.log("✅ [Frontend Server] Registrado exitosamente con backend");
      return true;
    } else {
      throw new Error(result.message || "Registration failed");
    }
  } catch (error) {
    console.warn(
      "⚠️ [Frontend Server] Error registrando con backend (non-blocking):",
      error.message,
    );
    backendRegistrationStatus = false;
    return false;
  }
};

// Función para obtener la URL del backend dinámicamente
const getBackendUrl = () => {
  return dynamicBackendUrl;
};

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const proxy = createProxyServer({
  changeOrigin: true,
  secure: false,
});

proxy.on("error", (err, req, res) => {
  console.error("Error de proxy:", err);
  if (res && res.writeHead && !res.headersSent) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Error de proxy");
  }
});

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const { pathname } = parsedUrl;

    // ============================================
    // APPLY APPROPRIATE CSP HEADERS BASED ON REQUEST TYPE
    // ============================================
    const isAPICall = pathname.startsWith("/api");
    applyBasicSecurityHeaders(req, res, isAPICall);

    // ============================================
    // CRITICAL: Simple health check endpoint for Kubernetes probes
    // ============================================
    if (pathname === "/health" || pathname === "/") {
      // For health checks, return immediately without CSP processing
      if (
        req.headers["user-agent"]?.includes("kube-probe") ||
        req.method === "HEAD" ||
        req.headers["x-kubernetes-probe"]
      ) {
        res.writeHead(200, {
          "Content-Type": "text/plain",
          "Cache-Control": "no-cache",
        });
        res.end("OK");
        return;
      }
    }

    // ============================================
    // NUEVO: Endpoint para obtener estado del proxy
    // ============================================
    if (pathname === "/proxy-status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: true,
          data: {
            backendUrl: getBackendUrl(),
            registrationStatus: backendRegistrationStatus,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || "development",
          },
        }),
      );
      return;
    }

    // ============================================
    // NUEVO: Endpoint para actualizar backend URL
    // ============================================
    if (pathname === "/update-backend" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const { backendUrl } = JSON.parse(body);

          if (!backendUrl) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                success: false,
                message: "backendUrl requerido",
              }),
            );
            return;
          }

          // Validar URL
          new URL(backendUrl);

          const oldUrl = dynamicBackendUrl;
          dynamicBackendUrl = backendUrl;

          console.log(
            `🔄 [Frontend Server] Backend URL actualizada: ${oldUrl} -> ${backendUrl}`,
          );

          // Re-registrar con nuevo backend
          await registerWithBackend();

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              success: true,
              message: "Backend URL actualizada",
              data: {
                oldUrl,
                newUrl: backendUrl,
                timestamp: new Date().toISOString(),
              },
            }),
          );
        } catch (error) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              success: false,
              message: "URL inválida: " + error.message,
            }),
          );
        }
      });
      return;
    }

    if (pathname.startsWith("/api/mock/congestion")) {
      handleMockCongestionRoutes({
        pathname,
        method: req.method,
        parsedUrl,
        res,
      });
      return;
    }

    // ============================================
    // MODIFICAR: Proxy dinámico para rutas /api con debugging especial para process_stream
    // ============================================
    if (pathname.startsWith("/api")) {
      console.log(
        `🔀 [Frontend Server] Proxying ${pathname} -> ${getBackendUrl()}`,
      );

      // Special handling for process_stream endpoint to debug response format
      if (pathname.includes("/process_stream/")) {
        console.log(`🎥 [Process Stream] Debugging endpoint: ${pathname}`);

        proxy.web(req, res, {
          target: getBackendUrl(),
          changeOrigin: true,
          secure: false,
          onProxyRes: function (proxyRes, req, res) {
            const contentType = proxyRes.headers["content-type"] || "unknown";
            const contentLength =
              proxyRes.headers["content-length"] || "unknown";

            console.log(`📤 [Process Stream Response]`);
            console.log(`   Status: ${proxyRes.statusCode}`);
            console.log(`   Content-Type: ${contentType}`);
            console.log(`   Content-Length: ${contentLength}`);
            console.log(
              `   Headers:`,
              JSON.stringify(proxyRes.headers, null, 2),
            );

            // Log first chunk of response to understand format
            let responseBody = "";
            proxyRes.on("data", (chunk) => {
              if (responseBody.length < 500) {
                // Only log first 500 chars
                responseBody += chunk.toString();
              }
            });

            proxyRes.on("end", () => {
              console.log(
                `📋 [Process Stream] Response preview (first 500 chars):`,
              );
              console.log(responseBody.substring(0, 500));

              if (contentType.includes("application/json")) {
                console.log(`✅ [Process Stream] Response is JSON (expected)`);
              } else if (contentType.includes("image/")) {
                console.log(
                  `⚠️ [Process Stream] Response is IMAGE (unexpected - should be JSON)`,
                );
              } else {
                console.log(
                  `❓ [Process Stream] Response type unclear: ${contentType}`,
                );
              }
            });
          },
          onError: function (err, req, res) {
            console.error(`❌ [Process Stream Error] ${err.message}`);
            if (!res.headersSent) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  error: "Process stream proxy error",
                  details: err.message,
                  endpoint: pathname,
                }),
              );
            }
          },
        });
      } else if (
        pathname.includes("/video_feed/") ||
        pathname.includes("/video_detector_feed/")
      ) {
        // Special handling for video streams to preserve MJPEG headers
        console.log(
          `📹 [Video Stream] Proxying ${pathname} to remote backend ${getBackendUrl()}`,
        );

        proxy.web(req, res, {
          target: getBackendUrl(),
          changeOrigin: true,
          secure: true, // HTTPS backend requires secure: true
          xfwd: true,
          preserveHeaderKeyCase: true,
          followRedirects: false,
          headers: {
            Connection: "keep-alive",
          },
        });
      } else {
        // Regular API proxy without special debugging
        proxy.web(req, res, {
          target: getBackendUrl(),
          changeOrigin: true,
          secure: false,
        });
      }
      return;
    }

    // Handler específico para reflectividad.kmz
    if (pathname === "/reflectividad.kmz") {
      try {
        const kmzDir = path.join(process.cwd(), "public", "kmz");
        const kmzPath = path.join(kmzDir, "reflectividad.kmz");

        // Validate path to prevent directory traversal
        const normalizedPath = path.normalize(kmzPath);
        if (!normalizedPath.startsWith(kmzDir)) {
          console.error(
            "[KMZ Server] Path traversal attempt detected:",
            pathname,
          );
          res.writeHead(403);
          res.end("Forbidden");
          return;
        }

        // ✅ SEGURIDAD: Verificar si el archivo existe de forma segura
        try {
          fs.accessSync(normalizedPath, fs.constants.F_OK);
          // El archivo existe, continuar
          console.log(`[KMZ Server] Sirviendo archivo desde: ${kmzPath}`);

          // Configurar headers apropiados
          res.setHeader("Content-Type", "application/vnd.google-earth.kmz");
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
          res.setHeader(
            "Content-Disposition",
            'attachment; filename="reflectividad.kmz"',
          );

          // Leer y enviar el archivo
          const fileStream = fs.createReadStream(normalizedPath);
          fileStream.pipe(res);

          fileStream.on("error", (err) => {
            console.error("[KMZ Server] Error leyendo archivo:", err);
            res.writeHead(500);
            res.end("Error interno del servidor");
          });
        } catch (accessError) {
          console.log("[KMZ Server] Archivo no encontrado en:", normalizedPath);
          res.writeHead(404);
          res.end("Archivo no encontrado");
        }
      } catch (error) {
        console.error("[KMZ Server] Error:", error);
        res.writeHead(500);
        res.end("Error interno del servidor");
      }
      return;
    }

    // Redirigir al diagnóstico seguro
    if (pathname === "/ws-test") {
      res.writeHead(302, {
        Location: "/videoanalitica/websocket-diagnostics.html",
      });
      res.end();
      return;
    }

    // Handle Next.js static assets with appropriate caching and CORRECT MIME types
    if (pathname.startsWith("/_next/static/")) {
      // For Next.js static assets, apply basic security headers
      applyBasicSecurityHeaders(req, res, false);

      // ✅ FIX: Set correct Content-Type based on file extension
      // This fixes the critical bug where all static files were served as text/html
      const ext = pathname.split(".").pop()?.toLowerCase();
      const mimeTypes = {
        js: "application/javascript; charset=utf-8",
        mjs: "application/javascript; charset=utf-8",
        css: "text/css; charset=utf-8",
        woff: "font/woff",
        woff2: "font/woff2",
        ttf: "font/ttf",
        eot: "application/vnd.ms-fontobject",
        svg: "image/svg+xml",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        ico: "image/x-icon",
        json: "application/json",
        map: "application/json",
      };

      if (ext && mimeTypes[ext]) {
        res.setHeader("Content-Type", mimeTypes[ext]);
      }

      // In development, allow some caching for chunks to prevent timeouts
      if (process.env.NODE_ENV === "development") {
        res.setHeader("Cache-Control", "private, max-age=60"); // 1 minute cache
      }
    } else if (!isAPICall && !res.headersSent) {
      // For regular frontend content, apply basic security headers
      applyBasicSecurityHeaders(req, res, false);

      // No nonce handling needed - CSP removed for video streaming compatibility
    }

    // No nonce injection needed - CSP removed for video streaming compatibility

    // Manejo normal de rutas API y Next.js
    handle(req, res, parsedUrl);
  });

  // Manejar eventos 'upgrade' (WebSockets) redirigiendo al backend
  server.on("upgrade", (req, socket, head) => {
    const parsedUrl = parse(req.url, true);
    const { pathname } = parsedUrl;

    console.log("Recibida solicitud WebSocket en:", pathname);

    if (pathname.startsWith("/socket.io")) {
      console.log(
        "Solicitud WebSocket Socket.IO recibida, redirigiendo al backend",
      );

      proxy.ws(req, socket, head, {
        target: getBackendUrl(),
        ws: true,
        secure: false,
        changeOrigin: true,
      });
    } else {
      console.log("Solicitud WebSocket no reconocida, cerrando conexión");
      socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    }
  });

  // Completar la implementación de downloadKmzFile
  function downloadKmzFile() {
    const sourceUrl =
      "https://evp.sire.gov.co/radar_animate/datos/kml/reflectividad.kmz";

    // Ruta directa al directorio /public/kmz
    let destinationDir = path.join(process.cwd(), "public", "kmz");

    // Verificación adicional para producción
    console.log(`[KMZ Updater] Directorio de trabajo actual: ${process.cwd()}`);
    console.log(`[KMZ Updater] Directorio destino: ${destinationDir}`);

    // Validate and normalize destination directory
    const normalizedDestDir = path.normalize(destinationDir);
    const expectedDir = path.normalize(
      path.join(process.cwd(), "public", "kmz"),
    );

    if (!normalizedDestDir.startsWith(expectedDir)) {
      console.error("[KMZ Updater] Invalid destination directory path");
      return;
    }

    // ✅ SEGURIDAD: Asegurarse de que el directorio existe de forma segura
    try {
      fs.accessSync(normalizedDestDir, fs.constants.F_OK);
      // El directorio ya existe
    } catch (accessError) {
      // El directorio no existe, crearlo
      try {
        console.log(`[KMZ Updater] Creando directorio ${normalizedDestDir}`);
        fs.mkdirSync(normalizedDestDir, { recursive: true });
      } catch (err) {
        console.error(
          `[KMZ Updater] Error al crear directorio ${normalizedDestDir}: ${err.message}`,
        );
        return;
      }
    }

    const destinationPath = path.join(normalizedDestDir, "reflectividad.kmz");
    console.log(`[KMZ Updater] Ruta completa del archivo: ${destinationPath}`);

    // Validate final paths
    const normalizedDestPath = path.normalize(destinationPath);
    const tempFilePath = `${normalizedDestPath}.temp`;

    if (
      !normalizedDestPath.startsWith(expectedDir) ||
      !tempFilePath.startsWith(expectedDir)
    ) {
      console.error("[KMZ Updater] Invalid file path detected");
      return;
    }

    console.log(
      `[KMZ Updater] Iniciando descarga desde ${sourceUrl} a ${destinationPath}`,
    );
    console.log(
      `[KMZ Updater] Network info: NODE_ENV=${process.env.NODE_ENV}, timestamp=${new Date().toISOString()}`,
    );

    const request = https.get(sourceUrl, (response) => {
      console.log(`[KMZ Updater] ✅ Conexión establecida con ${sourceUrl}`);
      // Verificar si la respuesta es exitosa
      if (response.statusCode !== 200) {
        console.error(
          `[KMZ Updater] Error al descargar archivo. Código de estado: ${response.statusCode}`,
        );
        return;
      }

      // Crear stream de escritura al archivo temporal
      const fileStream = fs.createWriteStream(tempFilePath);

      // Enviar la respuesta al archivo
      response.pipe(fileStream);

      // Manejar la finalización de la descarga
      fileStream.on("finish", () => {
        fileStream.close();

        // Reemplazar el archivo original con el nuevo
        fs.rename(tempFilePath, normalizedDestPath, (err) => {
          if (err) {
            console.error(`[KMZ Updater] Error reemplazando archivo: ${err}`);
            // ✅ SEGURIDAD: Intentar limpiar el archivo temporal de forma segura
            try {
              fs.accessSync(tempFilePath, fs.constants.F_OK);
              fs.unlinkSync(tempFilePath);
            } catch (cleanupErr) {
              // El archivo temporal no existe o no se puede eliminar
              if (cleanupErr.code !== "ENOENT") {
                console.error(
                  `[KMZ Updater] Error limpiando archivo temporal: ${cleanupErr}`,
                );
              }
            }
            return;
          }

          console.log(
            `[KMZ Updater] Archivo reflectividad.kmz actualizado exitosamente a las ${new Date().toLocaleTimeString()}`,
          );
        });
      });
    });

    // Manejar errores en la solicitud
    request.on("error", (err) => {
      console.error(`[KMZ Updater] ❌ Network Error: ${err.message}`);
      console.error(`[KMZ Updater] Error code: ${err.code}`);
      console.error(`[KMZ Updater] Error type: ${err.constructor.name}`);
      // ✅ SEGURIDAD: Limpiar archivo temporal de forma segura
      try {
        fs.accessSync(tempFilePath, fs.constants.F_OK);
        fs.unlinkSync(tempFilePath);
      } catch (cleanupErr) {
        // El archivo temporal no existe o no se puede eliminar
        if (cleanupErr.code !== "ENOENT") {
          console.error(
            `[KMZ Updater] Error limpiando archivo temporal: ${cleanupErr}`,
          );
        }
      }
    });

    // Establecer timeout para evitar solicitudes colgadas
    request.setTimeout(30000, () => {
      request.abort();
      console.error(
        `[KMZ Updater] ⏰ Timeout después de 30 segundos intentando conectar a ${sourceUrl}`,
      );
      // ✅ SEGURIDAD: Limpiar archivo temporal de forma segura
      try {
        fs.accessSync(tempFilePath, fs.constants.F_OK);
        fs.unlinkSync(tempFilePath);
      } catch (cleanupErr) {
        // El archivo temporal no existe o no se puede eliminar
        if (cleanupErr.code !== "ENOENT") {
          console.error(
            `[KMZ Updater] Error limpiando archivo temporal: ${cleanupErr}`,
          );
        }
      }
    });
  }

  // Programar la tarea para ejecutarse cada minuto
  const kmzUpdateTask = cron.schedule("* * * * *", () => {
    console.log("[KMZ Updater] Ejecutando actualización programada");
    downloadKmzFile();
  });

  // Descargar inmediatamente al iniciar el servidor
  downloadKmzFile();

  server.listen(port, (err) => {
    if (err) {
      if (kmzUpdateTask) kmzUpdateTask.stop();
      throw err;
    }

    console.log(`> Ready on http://localhost:${port}`);
    console.log(
      `> WebSocket test disponible en: http://localhost:${port}/ws-test`,
    );

    // ============================================
    // NUEVO: Inicializar registro con backend (async, non-blocking)
    // ============================================
    console.log("🌐 [Frontend Server] Iniciando registro con backend...");

    // Don't await - let this run in background to avoid blocking startup
    registerWithBackend()
      .then((registrationSuccess) => {
        if (registrationSuccess) {
          console.log(
            "✅ [Frontend Server] Sistema de proxy dinámico configurado",
          );
        } else {
          console.warn(
            "⚠️ [Frontend Server] Registro inicial falló, continuando con configuración estática",
          );
        }
      })
      .catch((error) => {
        console.warn(
          "⚠️ [Frontend Server] Registration error (non-blocking):",
          error.message,
        );
      });

    // ============================================
    // MODIFICADO: Re-registro periódico menos frecuente para evitar conflictos
    // ============================================
    setInterval(
      async () => {
        try {
          console.log(
            "🔄 [Frontend Server] Re-registro periódico (reducido)...",
          );
          await registerWithBackend();
        } catch (error) {
          console.warn(
            "⚠️ [Frontend Server] Periodic registration failed:",
            error.message,
          );
        }
      },
      15 * 60 * 1000,
    ); // ✅ CAMBIADO: Cada 15 minutos en lugar de 5 para reducir conflictos

    console.log(
      `> Actualizador KMZ iniciado - descargando reflectividad.kmz cada minuto`,
    );
  });

  // Actualiza el gracefulShutdown para incluir la detención del cron
  const gracefulShutdown = () => {
    console.log("Deteniendo tareas programadas...");
    if (kmzUpdateTask) kmzUpdateTask.stop();
    process.exit(0);
  };

  process.on("SIGINT", gracefulShutdown);
  process.on("SIGTERM", gracefulShutdown);
});

// Test de deployment 1
// Test de deployment 2
// Test de deployment 3
// Test de deployment 4
// Test de deployment 5
// Test de deployment 6
// Test de deployment 7
