# Plan de Migración: Arquitectura de 2 Ingress Independientes

**Proyecto**: SUANET Frontend & Backend
**Fecha de Análisis**: 2025-11-11
**Autor**: Claude Code + Luis Ballesteros
**Estado**: 📋 Planificado (Pendiente de Aprobación e Implementación)
**Prioridad**: 🟡 Media (Mejora arquitectural, no urgente)

---

## 📌 Contexto y Motivación

### Situación Actual

SUANET actualmente usa **1 ingress + proxy en Node.js** donde:
- Frontend recibe TODO el tráfico (incluyendo API)
- `server.js` hace proxy de rutas `/api/*` al backend
- Backend NO es accesible directamente (depende del frontend)

### Problema Identificado

Durante la resolución del problema de websockets en producción (nov 2025), se identificó que:
- El backend NO puede ser accedido directamente para debugging
- El frontend debe estar corriendo para que la API funcione
- Hay una capa adicional de proxy que añade latency (~5-15ms)
- Arquitectura diferente a ATULAA (que usa 2 ingress independientes)

### Objetivo de la Migración

Adoptar la arquitectura de **2 ingress independientes** (similar a ATULAA) para:
- ✅ Hacer el backend accesible independientemente del frontend
- ✅ Eliminar la capa de proxy en `server.js`
- ✅ Mejorar performance al reducir hops
- ✅ Simplificar debugging y monitoreo
- ✅ Consistencia arquitectural entre proyectos

---

## 🏗️ Comparación de Arquitecturas

### Arquitectura Actual: SUANET (1 Ingress + Proxy)

```
                     ┌─────────────────────────┐
                     │   Azure Front Door      │
                     │   (SSL Termination)     │
                     └────────────┬────────────┘
                                  │ HTTP
                                  ↓
                     ┌─────────────────────────┐
                     │  nginx Ingress          │
                     │  Controller             │
                     └────────────┬────────────┘
                                  │
                          Path: / │ (todo el tráfico)
                                  ↓
                         ┌────────────────┐
                         │   Frontend     │
                         │   Ingress      │
                         └────────┬───────┘
                                  │
                                  ↓
                         ┌────────────────┐
                         │   Frontend     │
                         │   Service :80  │
                         └────────┬───────┘
                                  │
                                  ↓
                    ┌──────────────────────────┐
                    │  Next.js Custom Server  │
                    │  (server.js)            │
                    │  ┌──────────────────┐   │
                    │  │  http-proxy      │───┼───► /api/* → Backend :8080
                    │  │  WebSocket       │   │
                    │  │  upgrade handler │   │
                    │  └──────────────────┘   │
                    └──────────────────────────┘
                                  │
                          ✅ Path: /api/*
                                  ↓
                         ┌────────────────┐
                         │   Backend      │
                         │   Service      │
                         │   :8080        │
                         └────────────────┘
```

**Características**:
- 🟡 **1 Ingress + 1 WebSocket ingress**: Todo pasa por frontend
- 🟡 **Backend NO independiente**: Solo accesible via proxy
- 🟡 **Proxy en Node.js**: `server.js` maneja routing
- 🟡 **WebSocket upgrade manual**: Manejado en server.js
- 🟡 **Dependencia crítica**: Si frontend cae, backend inaccesible

---

### Arquitectura Objetivo: ATULAA (2 Ingress Independientes)

```
                          ┌─────────────────────────┐
                          │   Azure Front Door      │
                          │  suanet.movilidadbogota │
                          │  (SSL Termination)      │
                          │  Session Affinity: ✅   │
                          └────────────┬────────────┘
                                       │ HTTP :80
                                       ↓
                          ┌─────────────────────────┐
                          │   nginx Ingress         │
                          │   Controller            │
                          │   IP: 20.72.153.153     │
                          └──────┬──────────┬───────┘
                                 │          │
                   ┌─────────────┘          └──────────────┐
                   │                                        │
            Path: / │                              Path: /api/*
                   │                              Path: /socket.io
                   ↓                                        ↓
      ┌────────────────────────┐           ┌────────────────────────┐
      │  Frontend Ingress      │           │  Backend Ingress       │
      │  suanet-frontend-      │           │  suanet-backend-       │
      │  ingress               │           │  ingress               │
      │                        │           │                        │
      │  Annotations:          │           │  Annotations:          │
      │  - ssl-redirect: false │           │  - ssl-redirect: false │
      │  - timeout: 300s       │           │  - timeout: 3600s      │
      │                        │           │  - websocket-services  │
      │                        │           │  - proxy-http: 1.1     │
      │                        │           │  - session-affinity    │
      │                        │           │  - rewrite-target      │
      └────────────┬───────────┘           └────────────┬───────────┘
                   │                                    │
                   ↓                                    ↓
      ┌────────────────────────┐           ┌────────────────────────┐
      │  suanet-frontend-      │           │  suanet-backend-       │
      │  service               │           │  service               │
      │  ClusterIP             │           │  ClusterIP             │
      │  Port: 80 → 3000       │           │  Port: 8080 → 8080     │
      └────────────┬───────────┘           └────────────┬───────────┘
                   │                                    │
                   ↓                                    ↓
      ┌────────────────────────┐           ┌────────────────────────┐
      │  Frontend Pods (2x)    │           │  Backend Pods (3x)     │
      │  Next.js App           │           │  FastAPI/Python        │
      │  Port: 3000            │           │  Port: 8080            │
      │                        │           │  - Video Analytics     │
      │  🗑️ YA NO NECESITA:    │           │  - Socket.IO Server    │
      │  - server.js proxy     │           │  - API Endpoints       │
      │  - http-proxy lib      │           │                        │
      │  - WebSocket upgrade   │           │                        │
      └────────────────────────┘           └────────────────────────┘
```

**Características**:
- ✅ **2 Ingress separados**: frontend + backend
- ✅ **Backend independiente**: Accesible directamente
- ✅ **Path routing en ingress**: `/api/*` → backend, `/` → frontend
- ✅ **Sin proxy intermedio**: Conexión directa
- ✅ **WebSocket directo**: Manejado por nginx ingress

---

## ⚖️ Análisis de Ventajas y Desventajas

| Aspecto | ACTUAL (1 Ingress + Proxy) | OBJETIVO (2 Ingress) |
|---------|----------------------------|----------------------|
| **🎯 Disponibilidad** | ❌ Backend depende del frontend | ✅ Backend independiente |
| **🔧 Mantenimiento** | ❌ Restart frontend afecta API | ✅ Fácil restart independiente |
| **📊 Monitoreo** | ❌ Health checks via proxy | ✅ Health checks directos |
| **🐛 Debugging** | ❌ Necesita frontend corriendo | ✅ Test API sin frontend |
| **⚡ Performance** | ❌ Proxy añade latency (~5-10ms) | ✅ Sin hop intermedio |
| **🔒 Seguridad** | ✅ 1 punto de entrada | 🟡 2 puntos de entrada |
| **🌐 CORS** | ✅ Proxy maneja CORS internamente | 🟡 Requiere config explícita |
| **📝 Configuración** | ✅ Más simple (1 ingress) | ❌ Más compleja (2 ingress) |
| **🔄 WebSockets** | 🟡 Proxy debe manejar upgrade | ✅ Directo al backend |
| **📦 Deployment** | ✅ Deploy coordinado | ❌ 2 deploys independientes |
| **🎭 Staging/Testing** | ❌ Siempre necesita frontend | ✅ Test backend aislado |
| **📈 Escalabilidad** | 🟡 Frontend escala con carga API | ✅ Escala independiente |

---

## 🎯 Impacto en WebSockets (Análisis Detallado)

### Estado Actual (Después del Fix de Nov 2025)

```
Cliente → Front Door (session affinity ✅)
         ↓
      nginx ingress
         ├─ / → Frontend
         └─ /socket.io → Backend (websocket-ingress.yaml ✅)
```

**Estado**: ✅ **Funciona correctamente**

---

### Estado Después de Migración

```
Cliente → Front Door (session affinity ✅)
         ↓
      nginx ingress
         ├─ / → Frontend
         ├─ /api/* → Backend (backend-ingress.yaml)
         └─ /socket.io → Backend (backend-ingress.yaml ✅)
```

**Cambio para WebSockets**:

| Aspecto | ANTES (websocket-ingress) | DESPUÉS (backend-ingress) |
|---------|---------------------------|---------------------------|
| Path `/socket.io` | ✅ Existe | ✅ Existe |
| Annotations websocket | ✅ Configuradas | ✅ Configuradas (idénticas) |
| Session affinity | ✅ Cookie-based | ✅ Cookie-based |
| Timeouts | ✅ 3600s | ✅ 3600s |
| Service target | `suanet-backend-service:8080` | `suanet-backend-service:8080` |

**Conclusión**: 🟢 **CERO IMPACTO NEGATIVO EN WEBSOCKETS**

De hecho, **mejora**:
- ✅ Menos ingress objects (elimina websocket-ingress redundante)
- ✅ Configuración más cohesiva (todo backend en 1 ingress)
- ✅ Más fácil de mantener

---

## 🗺️ PLAN DE MIGRACIÓN COMPLETO

### Fase 0: Pre-Migración y Preparación (2-3 horas)

#### Step 0.1: Backup y Documentación

```bash
# Backup configuración actual
kubectl get ingress -n suanet-prd -o yaml > backup-ingress-$(date +%Y%m%d).yaml
kubectl get svc -n suanet-prd -o yaml > backup-services-$(date +%Y%m%d).yaml

# Documentar URLs actuales de backend
echo "BACKEND_URL actual:"
kubectl get secret suanet-frontend-secret -n suanet-prd -o jsonpath='{.data.BACKEND_URL}' | base64 -d

# Documentar estado actual
kubectl get pods -n suanet-prd
kubectl get ingress -n suanet-prd
```

#### Step 0.2: Verificar Service del Backend

```bash
# Verificar si existe backend service en producción
kubectl get svc suanet-backend-service -n suanet-prd

# Si NO existe, necesitaremos crearlo (ver Fase 1)
```

---

### Fase 1: Preparar Configuraciones (2-3 horas)

#### Step 1.1: Crear Backend Ingress

**Archivo**: `k8s/prd/backend-ingress.yaml`

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: suanet-backend-ingress
  namespace: suanet-prd
  labels:
    app: suanet-backend
    environment: production
  annotations:
    # Production: Azure Front Door handles SSL
    nginx.ingress.kubernetes.io/ssl-redirect: "false"

    # Path rewriting: /api/users → /users (clean backend URLs)
    nginx.ingress.kubernetes.io/rewrite-target: /$2

    # WebSocket support (critical for Socket.IO)
    nginx.ingress.kubernetes.io/websocket-services: "suanet-backend-service"
    nginx.ingress.kubernetes.io/proxy-http-version: "1.1"

    # Extended timeouts for video analytics and websockets
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"

    # Session affinity for websockets
    nginx.ingress.kubernetes.io/upstream-hash-by: "$binary_remote_addr"
    nginx.ingress.kubernetes.io/affinity: "cookie"
    nginx.ingress.kubernetes.io/session-cookie-name: "suanet-backend"
    nginx.ingress.kubernetes.io/session-cookie-max-age: "172800"

    # Large file support
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-buffer-size: "512k"

spec:
  ingressClassName: nginx
  rules:
  - host: suanet.movilidadbogota.gov.co
    http:
      paths:
      # Socket.IO WebSocket endpoint
      - path: /socket.io(/|$)(.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: suanet-backend-service
            port:
              number: 8080

      # All API endpoints
      - path: /api(/|$)(.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: suanet-backend-service
            port:
              number: 8080
```

#### Step 1.2: Actualizar Frontend Ingress

**Archivo**: `k8s/prd/frontend-ingress.yaml` (renombrar de `ingress.yaml`)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: suanet-frontend-ingress
  namespace: suanet-prd
  labels:
    app: suanet-frontend
    environment: production
  annotations:
    # Production: Azure Front Door handles SSL
    nginx.ingress.kubernetes.io/ssl-redirect: "false"

    # Standard timeouts for frontend
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"

    # Body size for uploads
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"

spec:
  ingressClassName: nginx
  rules:
  - host: suanet.movilidadbogota.gov.co
    http:
      paths:
      # Frontend serves all non-API routes
      # IMPORTANT: This must be LAST (least specific) so /api and /socket.io match first
      - path: /
        pathType: Prefix
        backend:
          service:
            name: suanet-frontend-service
            port:
              number: 80
```

#### Step 1.3: Crear Backend Service (si no existe)

**Archivo**: `k8s/prd/backend-service.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: suanet-backend-service
  namespace: suanet-prd
  labels:
    app: suanet-backend
    environment: production
spec:
  type: ClusterIP
  selector:
    app: suanet-backend
  ports:
  - name: http
    protocol: TCP
    port: 8080
    targetPort: 8080
```

---

### Fase 2: Modificar Código del Frontend (3-4 horas)

#### Step 2.1: Simplificar server.js

**Opción A - Remover Proxy Completamente** (Recomendado):

Eliminar `/home/lballesterosp/ALL/SUANET-FRONTEND/server.js` y usar Next.js estándar.

```javascript
// package.json - Cambiar start script
{
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",  // Sin custom server
    "lint": "next lint"
  }
}
```

**Opción B - Mantener server.js pero Remover Proxy**:

```javascript
// server.js simplificado (sin proxy)
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');
const http = require('http');
const cron = require('node-cron');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = process.env.PORT || 3000;

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const { pathname } = parsedUrl;

    // ============================================
    // SIMPLE HEALTH CHECK
    // ============================================
    if (pathname === '/health' || pathname === '/') {
      if (req.headers['user-agent']?.includes('kube-probe') ||
          req.method === 'HEAD' ||
          req.headers['x-kubernetes-probe']) {
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-cache'
        });
        res.end('OK');
        return;
      }
    }

    // ============================================
    // HANDLER PARA /reflectividad.kmz (mantener si es necesario)
    // ============================================
    if (pathname === '/reflectividad.kmz') {
      // ... mantener lógica de KMZ si es necesaria ...
    }

    // ============================================
    // TODAS LAS DEMÁS RUTAS VAN A NEXT.JS
    // ============================================
    handle(req, res, parsedUrl);
  });

  // ============================================
  // CRON PARA KMZ (mantener si es necesario)
  // ============================================
  // ... mantener lógica de descarga KMZ si es necesaria ...

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
```

**ELIMINAR del server.js**:
- ❌ `http-proxy` import y configuración
- ❌ Todo el bloque de proxy para `/api/*` (líneas ~245-325)
- ❌ Manejador de WebSocket upgrade (líneas ~408-427)
- ❌ Sistema de registro dinámico de backend URL

#### Step 2.2: Actualizar Variables de Entorno

```bash
# .env.production
# Cambiar de URL interna a URL pública (via ingress)
BACKEND_URL=https://suanet.movilidadbogota.gov.co
NEXT_PUBLIC_BACKEND_URL=https://suanet.movilidadbogota.gov.co
NEXT_PUBLIC_FRONTEND_URL=https://suanet.movilidadbogota.gov.co
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
NEXTAUTH_SECRET=...
NEXT_PUBLIC_POWERBI_DESCRIPTIVO_URL=...
NEXT_PUBLIC_POWERBI_TRAFICO_URL=...
NODE_ENV=production
PORT=80
```

**Implicación**: Todas las llamadas API del frontend ahora irán vía Front Door → Backend Ingress (no via proxy local)

#### Step 2.3: Actualizar package.json

```json
{
  "dependencies": {
    // REMOVER (ya no necesarios):
    // "http-proxy": "^1.18.1",  ← ELIMINAR

    // MANTENER:
    "next": "14.x.x",
    "react": "18.x.x",
    "@tremor/react": "...",
    // ... resto de dependencias ...
  }
}
```

Ejecutar después del cambio:
```bash
npm uninstall http-proxy
npm install  # Re-generar package-lock.json
```

---

### Fase 3: Actualizar Pipelines (1-2 horas)

#### Step 3.1: Frontend Pipeline

Modificar: `azure-pipelines-prd.yml`

```yaml
# Buscar sección de deployment (línea ~238)
# CAMBIAR DE:

echo "Deploying ingress (Azure Front Door compatible)..."
kubectl apply -f k8s/prd/ingress.yaml
echo "Deploying WebSocket ingress (Socket.IO support)..."
kubectl apply -f k8s/prd/websocket-ingress.yaml
echo "Deploying frontend service..."
kubectl apply -f k8s/prd/service.yaml

# CAMBIAR A:

echo "Deploying frontend ingress..."
kubectl apply -f k8s/prd/frontend-ingress.yaml
echo "Deploying backend ingress..."
kubectl apply -f k8s/prd/backend-ingress.yaml
echo "Deploying frontend service..."
kubectl apply -f k8s/prd/service.yaml
```

**Nota**: Eliminar referencia a `websocket-ingress.yaml` (ya no existe)

#### Step 3.2: Backend Pipeline

Verificar que el pipeline del backend incluya el service:

```yaml
# azure-pipelines-prd.yml (en SUANET-BACKEND)
# Asegurar que incluya:

echo "Deploying backend service..."
kubectl apply -f k8s/prd/service.yaml
echo "Deploying backend application..."
kubectl apply -f k8s/prd/deployment.yaml
```

---

### Fase 4: Testing en Desarrollo (4-6 horas)

#### Step 4.1: Aplicar en Dev Primero

```bash
# 1. Conectar a cluster dev
az aks get-credentials \
  --resource-group RG-SDM-SUANET-DEV \
  --name aks-suanet-atulaa-dev \
  --admin

# 2. Backup actual
kubectl get ingress -n suanet-dev -o yaml > backup-dev-ingress.yaml

# 3. Aplicar backend service (si no existe)
kubectl apply -f k8s/dev/backend-service.yaml

# 4. Aplicar backend ingress
kubectl apply -f k8s/dev/backend-ingress.yaml

# 5. Actualizar frontend ingress
kubectl apply -f k8s/dev/frontend-ingress.yaml

# 6. Eliminar websocket ingress (redundante)
kubectl delete ingress backend-websocket-ingress -n suanet-dev --ignore-not-found

# 7. Verificar
kubectl get ingress -n suanet-dev
kubectl get svc -n suanet-dev
```

#### Step 4.2: Tests Funcionales

```bash
# Test 1: Backend directo
curl -v https://suanet-test.movilidadbogota.gov.co/api/health
# Esperado: 200 OK con respuesta del backend

# Test 2: Frontend
curl -v https://suanet-test.movilidadbogota.gov.co/
# Esperado: 200 OK con HTML del frontend

# Test 3: API específica
curl -v https://suanet-test.movilidadbogota.gov.co/api/get_last_frame/1
# Esperado: 200 OK o respuesta apropiada

# Test 4: WebSocket (usando cliente de prueba)
node /home/lballesterosp/ALL/SUANET-FRONTEND/websocket_client.js \
  https://suanet-test.movilidadbogota.gov.co 123
# Esperado: "Conectado al servidor WebSocket"
```

#### Step 4.3: Test Video Analítica End-to-End

1. Abrir: https://suanet-test.movilidadbogota.gov.co
2. Login con credenciales de prueba
3. Seleccionar cámara del mapa
4. Dibujar polígono (4 puntos)
5. Seleccionar tiempo de procesamiento (5 min)
6. Click "Procesar video"
7. Abrir DevTools:
   - Network tab → Filter WS
   - Verificar: "101 Switching Protocols" en socket.io
   - Verificar: Mensajes de actualización llegando
8. Console tab:
   - Verificar: "Conectado al servidor WebSocket"
   - Verificar: "Actualización recibida" con datos
9. UI:
   - Verificar: Conteos actualizándose en tiempo real
   - Verificar: Imágenes de debug mostrándose

#### Step 4.4: Performance Testing

```bash
# Test latency backend directo
time curl -s https://suanet-test.movilidadbogota.gov.co/api/health > /dev/null
# Anotar tiempo promedio (esperado: 15-25ms)

# Comparar con arquitectura anterior (si es posible)
# Esperado: Reducción de 5-15ms
```

#### Step 4.5: Load Testing (Opcional)

```bash
# Usando Apache Bench
ab -n 1000 -c 10 https://suanet-test.movilidadbogota.gov.co/api/health

# Verificar:
# - 0% failed requests
# - Latency consistente
# - No errores en logs
```

---

### Fase 5: Deployment en Producción (2-3 horas)

#### Step 5.1: Pre-Deployment Checklist

```
□ Testing en dev completado exitosamente
□ Todos los tests funcionales pasaron
□ Performance verificada (igual o mejor)
□ WebSockets funcionando correctamente
□ Backup de configuración actual realizado
□ Plan de rollback documentado y probado
□ Equipo notificado del deployment
□ Ventana de mantenimiento coordinada (opcional)
```

#### Step 5.2: Notificación

```bash
# Notificar a stakeholders
# Mensaje sugerido:

"Se realizará migración arquitectural de SUANET en [FECHA] a las [HORA].

 Cambio: Migración a arquitectura de 2 ingress independientes
 Impacto esperado: < 5 minutos de downtime potencial
 Mejoras: Backend independiente, mejor performance

 Rollback disponible en caso de problemas.

 Contacto: [TU NOMBRE/EMAIL]"
```

#### Step 5.3: Deployment Gradual

```bash
# ============================================
# IMPORTANTE: Ejecutar comandos UNO POR UNO
# Verificar resultado antes de continuar
# ============================================

# 1. Conectar a cluster producción
az aks get-credentials \
  --resource-group RG-SDM-SUANET-PRD \
  --name aks-suanet-atulaa-prd \
  --admin

# 2. Backup configuración actual
kubectl get ingress -n suanet-prd -o yaml > backup-prod-ingress-$(date +%Y%m%d-%H%M).yaml
kubectl get svc -n suanet-prd -o yaml > backup-prod-services-$(date +%Y%m%d-%H%M).yaml

# 3. Aplicar backend service (si no existe)
kubectl apply -f k8s/prd/backend-service.yaml

# 4. Verificar backend service
kubectl get svc suanet-backend-service -n suanet-prd
# Debe mostrar: ClusterIP con port 8080

# 5. Aplicar backend ingress (NO afecta tráfico actual aún)
kubectl apply -f k8s/prd/backend-ingress.yaml

# 6. Verificar backend ingress está creado
kubectl get ingress suanet-backend-ingress -n suanet-prd
kubectl describe ingress suanet-backend-ingress -n suanet-prd
# Verificar: Rules para /api y /socket.io

# 7. IMPORTANTE: Esperar propagación (30-60 segundos)
echo "Esperando propagación de backend ingress..."
sleep 60

# 8. Test backend ingress (ANTES de eliminar el antiguo)
curl -v https://suanet.movilidadbogota.gov.co/api/health
# Debe funcionar correctamente

# 9. Si test OK, aplicar frontend ingress (switch tráfico)
kubectl apply -f k8s/prd/frontend-ingress.yaml

# 10. Verificar frontend ingress
kubectl get ingress suanet-frontend-ingress -n suanet-prd

# 11. IMPORTANTE: Esperar propagación (30-60 segundos)
echo "Esperando propagación de frontend ingress..."
sleep 60

# 12. Eliminar ingress antiguo (ya redundante)
kubectl delete ingress suanet-ingress -n suanet-prd --ignore-not-found

# 13. Eliminar websocket ingress (ahora redundante)
kubectl delete ingress suanet-websocket-ingress -n suanet-prd --ignore-not-found

# 14. Verificar estado final
kubectl get ingress -n suanet-prd
# Debe mostrar:
# - suanet-frontend-ingress
# - suanet-backend-ingress

# 15. Verificar servicios
kubectl get svc -n suanet-prd
# Debe mostrar:
# - suanet-frontend-service
# - suanet-backend-service

# 16. Verificar pods funcionando
kubectl get pods -n suanet-prd
# Todos deben estar Running
```

#### Step 5.4: Monitoreo Post-Deployment

```bash
# Terminal 1: Logs frontend
kubectl logs -n suanet-prd -l app=suanet-frontend --tail=100 -f

# Terminal 2: Logs backend
kubectl logs -n suanet-prd -l app=suanet-backend --tail=100 -f

# Terminal 3: Watch pods
watch -n 2 'kubectl get pods -n suanet-prd'

# Terminal 4: Watch ingress
watch -n 5 'kubectl get ingress -n suanet-prd'
```

#### Step 5.5: Verificación Funcional

```bash
# Test 1: Health check frontend
curl https://suanet.movilidadbogota.gov.co/health

# Test 2: Health check backend
curl https://suanet.movilidadbogota.gov.co/api/health

# Test 3: API específica
curl https://suanet.movilidadbogota.gov.co/api/get_last_frame/1

# Test 4: Frontend en browser
# Abrir: https://suanet.movilidadbogota.gov.co
# Verificar: Página carga correctamente

# Test 5: Video analítica completo
# (Seguir pasos de Fase 4, Step 4.3)
```

---

### Fase 6: Validación y Cleanup (1-2 horas)

#### Step 6.1: Tests de Producción Exhaustivos

```bash
# Test suite completo
echo "=== Testing Backend API ==="
curl -s https://suanet.movilidadbogota.gov.co/api/health | jq
curl -s https://suanet.movilidadbogota.gov.co/api/backend_version | jq

echo "=== Testing WebSocket ==="
node websocket_client.js https://suanet.movilidadbogota.gov.co 123
# Verificar: Conexión exitosa

echo "=== Testing Video Analytics ==="
# Manual: Ejecutar flujo completo en browser
# Verificar: Proceso completo funciona

echo "=== Testing Performance ==="
ab -n 100 -c 5 https://suanet.movilidadbogota.gov.co/api/health
# Anotar: Requests/sec, Time per request
```

#### Step 6.2: Métricas de Éxito

Capturar métricas post-migración:

```bash
# Latency promedio
echo "=== API Latency ==="
for i in {1..10}; do
  time curl -s https://suanet.movilidadbogota.gov.co/api/health > /dev/null
done

# Resource usage
echo "=== Resource Usage ==="
kubectl top pods -n suanet-prd

# Error rate
echo "=== Error Rate ==="
kubectl logs -n suanet-prd -l app=suanet-backend --tail=1000 | grep -i error | wc -l
```

#### Step 6.3: Cleanup Código (Frontend)

```bash
cd /home/lballesterosp/ALL/SUANET-FRONTEND

# Opción A: Eliminar server.js completamente
git rm server.js
git commit -m "refactor: Remove custom server.js proxy (using direct backend ingress)"

# Opción B: Mantener versión simplificada
# (Ya modificado en Fase 2)
git add server.js
git commit -m "refactor: Simplify server.js (remove proxy, keep health checks)"

# Actualizar package.json
git add package.json package-lock.json
git commit -m "chore: Remove http-proxy dependency"

# Eliminar archivos obsoletos
git rm k8s/prd/websocket-ingress.yaml
git rm k8s/prd/ingress.yaml  # Renombrado a frontend-ingress.yaml
git commit -m "refactor: Consolidate ingress configs (frontend + backend separate)"

# Push cambios
git push origin prd
```

#### Step 6.4: Actualizar Documentación

Crear/actualizar: `docs/architecture.md`

```markdown
# SUANET - Arquitectura de Infraestructura

**Última actualización**: [FECHA]
**Versión**: 2.0 (Arquitectura de 2 Ingress)

## Infraestructura de Producción

### Diagrama de Arquitectura

[Incluir diagrama de arquitectura objetivo aquí]

### Componentes

#### 1. Azure Front Door
- **Endpoint**: suanet.movilidadbogota.gov.co
- **Función**: SSL termination, CDN, WAF, session affinity
- **Session Affinity**: ✅ Habilitada (crítico para websockets)

#### 2. nginx Ingress Controller
- **IP**: 20.72.153.153
- **Función**: Routing interno, load balancing
- **Ingress configurados**: 2 (frontend + backend)

#### 3. Frontend Ingress
- **Nombre**: `suanet-frontend-ingress`
- **Path**: `/` (Prefix)
- **Service**: `suanet-frontend-service:80`
- **Pods**: 2 replicas
- **Timeout**: 300s

#### 4. Backend Ingress
- **Nombre**: `suanet-backend-ingress`
- **Paths**:
  - `/api/*` → API REST endpoints
  - `/socket.io` → WebSocket connections
- **Service**: `suanet-backend-service:8080`
- **Pods**: 3 replicas
- **Timeout**: 3600s
- **WebSocket support**: ✅ Habilitado

### Ventajas de Arquitectura Actual

1. **Backend Independiente**: Accesible sin frontend para debugging
2. **Mejor Performance**: ~5-15ms más rápido (sin proxy intermedio)
3. **Escalabilidad Independiente**: Frontend y backend escalan separadamente
4. **Debugging Simplificado**: Logs y métricas separadas por componente
5. **Consistencia**: Misma arquitectura que proyecto ATULAA

### Cambios desde Arquitectura Anterior (v1.0)

**Antes (1 Ingress + Proxy)**:
- Frontend recibía TODO el tráfico
- `server.js` hacía proxy de `/api/*` al backend
- Backend NO accesible directamente
- Proxy añadía latency

**Ahora (2 Ingress)**:
- Frontend y backend tienen ingress separados
- Routing directo en nginx ingress
- Backend accesible independientemente
- Sin proxy intermedio

### Migración Realizada

- **Fecha**: [FECHA DE DEPLOYMENT]
- **Tiempo de migración**: [TIEMPO]
- **Downtime**: [TIEMPO o "Cero"]
- **Documentación**: Ver `docs/migration-plan-2-ingress-architecture.md`
```

#### Step 6.5: Cleanup Backups (Después de 1 semana)

```bash
# Verificar sistema estable por 1 semana
# Luego eliminar backups:

# Backups locales
rm backup-prod-ingress-*.yaml
rm backup-prod-services-*.yaml

# Git: Eliminar archivos obsoletos (ya hecho en Step 6.3)
```

---

## ⚠️ ANÁLISIS DE RIESGOS Y MITIGACIONES

### 🔴 Riesgo Alto

#### 1. Downtime Durante Migration

**Descripción**: API inaccesible por 1-5 minutos durante el switch de ingress

**Probabilidad**: MEDIA (30%)

**Impacto**: ALTO
- Usuarios no pueden acceder a API
- Procesamiento de video analítica interrumpido
- Websockets desconectados

**Mitigación**:
- ✅ Deployment gradual (backend ingress primero, luego frontend)
- ✅ Mantener ingress anterior hasta confirmar nuevo funciona
- ✅ Health checks automáticos antes de switchear
- ✅ Deployment en horario de baja demanda (2-6 AM)
- ✅ Esperas de propagación entre pasos

**Rollback**:
```bash
# Revertir a configuración anterior (< 1 minuto)
kubectl apply -f backup-prod-ingress-[DATE].yaml
kubectl delete ingress suanet-backend-ingress -n suanet-prd
kubectl delete ingress suanet-frontend-ingress -n suanet-prd
```

---

#### 2. WebSockets Dejan de Funcionar

**Descripción**: Video analítica no muestra progreso en tiempo real

**Probabilidad**: BAJA (10%)

**Impacto**: MEDIO
- Funcionalidad de tiempo real no funciona
- Usuarios no ven progreso de procesamiento
- Impacto solo en video analítica (resto del sistema OK)

**Mitigación**:
- ✅ Misma configuración que websocket-ingress actual (ya probada)
- ✅ Session affinity configurada en Front Door (ya existe)
- ✅ Testing exhaustivo en dev antes de prod
- ✅ Anotaciones websocket idénticas

**Rollback**:
```bash
# Restaurar websocket-ingress anterior
kubectl apply -f k8s/prd/websocket-ingress.yaml
# Backend ingress puede coexistir, no causa conflicto
```

---

### 🟡 Riesgo Medio

#### 3. CORS Errors por Cambio de URLs

**Descripción**: Frontend no puede llamar API por errores CORS

**Probabilidad**: BAJA (15%)

**Impacto**: ALTO si ocurre
- Frontend completamente no funcional
- No puede cargar datos

**Mitigación**:
- ✅ Backend CORS ya configurado para mismo dominio
- ✅ Todas las URLs usan `suanet.movilidadbogota.gov.co`
- ✅ No hay cambio de origen (same-origin requests)
- ✅ Testing en dev detectaría este problema

**Rollback**:
```bash
# Revertir variables de entorno si es necesario
kubectl edit secret suanet-frontend-secret -n suanet-prd
# Cambiar BACKEND_URL a valor anterior
```

---

#### 4. Session Affinity No Funciona

**Descripción**: Conexiones websocket inestables, drops frecuentes

**Probabilidad**: MUY BAJA (5%)

**Impacto**: MEDIO
- WebSockets se desconectan aleatoriamente
- Video analítica necesita reconexiones

**Mitigación**:
- ✅ Session affinity en Front Door (nivel global)
- ✅ Session affinity en nginx ingress (nivel pod)
- ✅ Doble capa de protección
- ✅ Configuración probada en websocket-ingress actual

**Detección**:
```bash
# Monitorear reconexiones frecuentes
kubectl logs -n suanet-prd -l app=suanet-backend --tail=100 -f | grep "disconnect"
```

---

### 🟢 Riesgo Bajo

#### 5. Performance Degradation

**Descripción**: API más lenta después de migración

**Probabilidad**: MUY BAJA (< 5%)

**Impacto**: BAJO
- Usuarios notan ligera lentitud

**Expectativa Real**: **MEJORA de 5-15ms** por eliminación de proxy hop

**Mitigación**:
- ✅ Testing de performance en dev
- ✅ Comparación antes/después
- ✅ Métricas capturadas

**Verificación**:
```bash
# Comparar latency antes/después
ab -n 1000 -c 10 https://suanet.movilidadbogota.gov.co/api/health
```

---

#### 6. Health Checks Failing

**Descripción**: Pods marcados como unhealthy, no reciben tráfico

**Probabilidad**: MUY BAJA (< 5%)

**Impacto**: ALTO si ocurre
- Pods restarted continuamente
- Servicio inestable

**Mitigación**:
- ✅ Health checks ya configurados en deployment actual
- ✅ `/health` endpoint expuesto en backend ingress
- ✅ No cambios en lógica de health checks

**Detección**:
```bash
kubectl get pods -n suanet-prd
# Ver columna RESTARTS (no debe incrementar)
```

---

## 🔄 ESTRATEGIA DE ROLLBACK COMPLETA

### Rollback Nivel 1: Rápido (< 1 minuto)

**Cuándo usar**: Problema inmediato detectado (errores 5xx, servicio down)

```bash
#!/bin/bash
# rollback-quick.sh

echo "🔄 ROLLBACK RÁPIDO: Restaurando configuración anterior..."

# Aplicar backup
kubectl apply -f backup-prod-ingress-$(date +%Y%m%d-*).yaml

echo "✅ Configuración anterior restaurada"
echo "⏳ Esperando propagación (30s)..."
sleep 30

# Verificar
curl -I https://suanet.movilidadbogota.gov.co/health
echo "Rollback completo. Sistema debe estar funcionando."
```

---

### Rollback Nivel 2: Parcial (< 3 minutos)

**Cuándo usar**: Solo un componente tiene problemas (ej: solo websockets)

```bash
#!/bin/bash
# rollback-partial.sh

echo "🔄 ROLLBACK PARCIAL..."

# Opción A: Solo restaurar websocket ingress
echo "Restaurando websocket-ingress..."
kubectl apply -f k8s/prd/websocket-ingress.yaml

# Backend ingress puede coexistir (no conflicto)
# Frontend ingress permanece con nueva configuración

echo "✅ WebSocket ingress restaurado"
```

---

### Rollback Nivel 3: Completo (< 5 minutos)

**Cuándo usar**: Múltiples problemas, necesario volver completamente atrás

```bash
#!/bin/bash
# rollback-complete.sh

echo "🔄 ROLLBACK COMPLETO: Revirtiendo toda la migración..."

# 1. Restaurar ingress anterior
echo "1/6 Restaurando ingress anterior..."
kubectl apply -f backup-prod-ingress-*.yaml

# 2. Eliminar backend ingress nuevo
echo "2/6 Eliminando backend ingress..."
kubectl delete ingress suanet-backend-ingress -n suanet-prd --ignore-not-found

# 3. Eliminar frontend ingress nuevo
echo "3/6 Eliminando frontend ingress..."
kubectl delete ingress suanet-frontend-ingress -n suanet-prd --ignore-not-found

# 4. Restaurar websocket ingress
echo "4/6 Restaurando websocket ingress..."
kubectl apply -f k8s/prd/websocket-ingress.yaml

# 5. Esperar propagación
echo "5/6 Esperando propagación (30s)..."
sleep 30

# 6. Verificar
echo "6/6 Verificando estado..."
kubectl get ingress -n suanet-prd
curl -I https://suanet.movilidadbogota.gov.co/health
curl -I https://suanet.movilidadbogota.gov.co/api/health

echo ""
echo "✅ Rollback completo"
echo "Estado del sistema:"
kubectl get pods -n suanet-prd
```

---

### Rollback de Código (Si se desplegó nuevo frontend)

```bash
#!/bin/bash
# rollback-code.sh

cd /home/lballesterosp/ALL/SUANET-FRONTEND

# Revertir commit
git log --oneline -5  # Ver commits recientes
git revert [COMMIT_HASH]  # Revertir cambios de migración

# O resetear a commit anterior
git reset --hard [COMMIT_ANTERIOR]
git push origin prd --force  # ⚠️ Solo si no hay otros cambios

# Triggear re-deployment via pipeline
# O deployment manual:
kubectl rollout restart deployment/suanet-frontend -n suanet-prd
```

---

## 💰 ANÁLISIS COSTO/BENEFICIO

### Costos de Implementación

| Fase | Tiempo Estimado | Esfuerzo |
|------|-----------------|----------|
| Fase 0: Pre-Migración | 2-3 horas | 👷 Bajo |
| Fase 1: Configuraciones | 2-3 horas | 👷 Bajo |
| Fase 2: Código Frontend | 3-4 horas | 👷👷 Medio |
| Fase 3: Pipelines | 1-2 horas | 👷 Bajo |
| Fase 4: Testing Dev | 4-6 horas | 👷👷 Medio |
| Fase 5: Deployment Prod | 2-3 horas | 👷👷 Medio |
| Fase 6: Validación/Cleanup | 1-2 horas | 👷 Bajo |
| **TOTAL** | **15-23 horas** | **👷👷 Medio** |

**Costo en Tiempo Real**: ~3 días de trabajo (con testing exhaustivo)

**Downtime Potencial**: 1-5 minutos (optimizable a ~0 minutos con deployment cuidadoso)

---

### Beneficios a Corto Plazo (Primeros 3 meses)

✅ **Operacionales**:
- **Backend testeable independientemente**: Ahorra 10-15 min por sesión de debugging
- **Deployment independiente**: Backend puede actualizarse sin afectar frontend
- **Mejor performance**: 5-15ms más rápido en llamadas API (ahorro acumulativo)

✅ **Desarrollo**:
- **Código más simple**: Menos complejidad en server.js
- **Hot reload más rápido**: No necesita reiniciar proxy
- **Debugging más claro**: Logs separados por componente

**Ahorro estimado**: ~2-4 horas/semana en debugging y testing

---

### Beneficios a Largo Plazo (6-12 meses)

✅ **Arquitectura**:
- **Consistencia con ATULAA**: Facilita mantenimiento cruzado
- **Escalabilidad independiente**: Frontend y backend escalan según necesidad
- **Mejores prácticas**: Arquitectura estándar, no custom

✅ **Mantenibilidad**:
- **Onboarding más rápido**: Arquitectura estándar más fácil de entender
- **Menos sorpresas**: No hay comportamiento custom del proxy
- **Documentación clara**: Arquitectura bien definida

✅ **Monitoreo**:
- **Métricas granulares**: Latency separada frontend vs backend
- **Alertas específicas**: Puede alertar solo backend sin falsos positivos
- **Health checks directos**: Diagnóstico más preciso

**ROI Estimado**: Ahorro acumulativo de 20-40 horas/año en debugging, testing y troubleshooting

---

## 📋 CHECKLIST DE ARCHIVOS A CREAR/MODIFICAR

### ✅ Archivos a CREAR

```
□ k8s/prd/backend-ingress.yaml
□ k8s/prd/backend-service.yaml (si no existe)
□ k8s/prd/frontend-ingress.yaml (renombrar de ingress.yaml)
□ k8s/dev/backend-ingress.yaml
□ k8s/dev/backend-service.yaml (si no existe)
□ k8s/dev/frontend-ingress.yaml
□ docs/architecture.md (actualizar)
□ scripts/rollback-quick.sh
□ scripts/rollback-complete.sh
```

### ✏️ Archivos a MODIFICAR

```
□ server.js (simplificar o eliminar)
□ package.json (remover http-proxy)
□ .env.production (actualizar BACKEND_URL)
□ azure-pipelines-prd.yml (actualizar kubectl apply)
□ README.md (actualizar arquitectura)
```

### 🗑️ Archivos a ELIMINAR

```
□ k8s/prd/websocket-ingress.yaml (redundante)
□ k8s/prd/ingress.yaml (renombrado a frontend-ingress.yaml)
□ k8s/dev/backend-websocket-ingress.yaml (si existe, redundante)
```

---

## 🎯 DECISIÓN FINAL Y PRÓXIMOS PASOS

### ¿Implementar la Migración?

**Recomendación**: ✅ **SÍ**, pero con timing adecuado

**A FAVOR**:
1. ✅ Arquitectura superior y más mantenible
2. ✅ Backend independiente (debugging más fácil)
3. ✅ Mejor performance (elimina proxy hop)
4. ✅ Consistencia con ATULAA
5. ✅ Riesgos mitigables con plan adecuado

**EN CONTRA**:
1. ⏰ Requiere ~20 horas de trabajo
2. ⚠️ Pequeño riesgo de downtime (1-5 min)
3. 📚 Necesita testing exhaustivo

---

### Cuándo Implementar

#### ✅ BUEN MOMENTO:
- Después de completar tareas prioritarias actuales
- Durante periodo de baja demanda del sistema
- Cuando tengas 3-5 días disponibles para dedicar
- Después de un sprint/milestone completado

#### ❌ MAL MOMENTO:
- Durante desarrollo de features críticos
- Cerca de fechas límite importantes
- Periodos de alta demanda (reportes, auditorías)
- Sin tiempo para testing exhaustivo

---

### Próximos Pasos Sugeridos

#### Opción A: Implementar Ahora (Si tiempo disponible)

```
Semana 1-2:
□ Día 1-2: Crear archivos de configuración (Fase 1)
□ Día 3-4: Modificar código frontend (Fase 2)
□ Día 5: Actualizar pipelines (Fase 3)

Semana 2-3:
□ Día 6-8: Testing exhaustivo en dev (Fase 4)
□ Día 9: Review con equipo
□ Día 10: Deployment en producción (Fase 5)

Semana 3:
□ Día 11-12: Monitoreo post-deployment
□ Día 13-14: Cleanup y documentación (Fase 6)
```

#### Opción B: Posponer (Recomendado si ocupado)

```
1. Guardar este documento en repo (Ya hecho ✅)
2. Agregar a backlog de mejoras técnicas
3. Revisar en próxima planificación de sprint
4. Implementar cuando tengamos:
   - Tiempo disponible (3-5 días)
   - Sistema estable
   - Periodo de baja demanda
```

---

### Contacto y Soporte

**Documentación creada por**: Claude Code + Luis Ballesteros
**Fecha**: 2025-11-11
**Ubicación**: `/home/lballesterosp/ALL/SUANET-FRONTEND/docs/migration-plan-2-ingress-architecture.md`

**Para preguntas o dudas**:
- Revisar secciones relevantes de este documento
- Consultar `docs/fix-websocket-production.md` (migración websockets anterior)
- Comparar con arquitectura ATULAA: `/home/lballesterosp/ALL/ATULAA-*/k8s/prd/ingress.yaml`

---

## 📚 REFERENCIAS Y RECURSOS ADICIONALES

### Documentación Relacionada

- `docs/fix-websocket-production.md` - Solución de websockets en producción (Nov 2025)
- `SUANET_VS_ATULAA_COMPARISON.md` - Comparación arquitectural
- `docs/GIT_WORKFLOW.md` - Workflow de Git para deployments

### Arquitectura ATULAA (Referencia)

- `/home/lballesterosp/ALL/ATULAA-BACKEND/k8s/prd/ingress.yaml`
- `/home/lballesterosp/ALL/ATULAA-FRONTEND/k8s/prd/ingress.yaml`

### Configuración Actual SUANET

- `/home/lballesterosp/ALL/SUANET-FRONTEND/k8s/prd/ingress.yaml`
- `/home/lballesterosp/ALL/SUANET-FRONTEND/k8s/prd/websocket-ingress.yaml`
- `/home/lballesterosp/ALL/SUANET-FRONTEND/server.js`

### Recursos Kubernetes

- [nginx Ingress Annotations](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/)
- [WebSocket Support](https://kubernetes.github.io/ingress-nginx/user-guide/websocket/)
- [Path Rewriting](https://kubernetes.github.io/ingress-nginx/examples/rewrite/)

---

## 📝 CHANGELOG DE ESTE DOCUMENTO

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2025-11-11 | 1.0 | Documento inicial creado después de análisis comparativo |

---

**FIN DEL DOCUMENTO**

Estado: 📋 **Plan listo para implementación**
Decisión: ⏳ **Pendiente de evaluación por equipo**
Próxima revisión: **Cuando tiempo disponible**
