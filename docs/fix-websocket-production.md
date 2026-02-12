# Solución: WebSockets en Producción SUANET

**Fecha**: 2025-11-10
**Problema**: Endpoint `/api/process_stream` funciona pero websockets fallan en producción
**Causa**: Falta configuración de ingress para `/socket.io` y session affinity en Azure Front Door

---

## 🔍 Resumen del Problema

### Arquitectura Actual
```
Cliente Browser
    ↓ HTTPS
Azure Front Door (session affinity: DISABLED ❌)
    ↓ HTTP
nginx Ingress Controller
    ├─ / → suanet-frontend-service ✅
    └─ /socket.io → ❌ NO EXISTE
```

### Flujo que FUNCIONA ✅
```
POST /api/process_stream/{params}
    → Front Door → nginx → frontend:80 → proxy → backend:8080
    ← Responde: {"channel_id": 456}
```

### Flujo que FALLA ❌
```
GET /socket.io/?EIO=4&transport=polling&t=evjwpem
    → Front Door → nginx → ❌ NO HAY RUTA
    ← Error: 404 o timeout
```

---

## ✅ Solución Implementada

### Cambio #1: Ingress para WebSockets en AKS

**Archivo creado**: `k8s/prd/websocket-ingress.yaml`

**Características**:
- ✅ Ruta explícita `/socket.io` → `suanet-backend-service:8080`
- ✅ Anotaciones de websocket (`websocket-services`, `proxy-http-version: 1.1`)
- ✅ Session affinity con cookies (nginx level)
- ✅ Timeouts extendidos (3600s para conexiones largas)
- ✅ Compatible con Azure Front Door (no fuerza SSL redirect)

### Cambio #2: Pipeline Actualizado

**Archivo modificado**: `azure-pipelines-prd.yml`

**Cambio**: Agregada línea para desplegar `websocket-ingress.yaml` junto con el ingress principal.

---

## 🚀 Pasos para Desplegar

### PASO 1: Habilitar Session Affinity en Azure Front Door

**CRÍTICO**: Azure Front Door necesita session affinity para websockets.

#### Opción A: Portal de Azure (Manual)

1. Ir a Azure Portal → Resource Groups → `RG-SDM-SUANET-PRD`
2. Abrir recurso: `fd-suanet-atulaa-prd` (Azure Front Door)
3. Ir a: **Origin groups** → `suanet`
4. Editar:
   - **Session affinity**: Cambiar de `Disabled` a `Enabled`
5. Guardar cambios (toma ~5 minutos en propagarse)

#### Opción B: Azure CLI (Recomendado - Automatizado)

```bash
# Habilitar session affinity en el origin group
az afd origin-group update \
  --profile-name fd-suanet-atulaa-prd \
  --origin-group-name suanet \
  --resource-group RG-SDM-SUANET-PRD \
  --session-affinity-state Enabled

# Verificar cambio
az afd origin-group show \
  --profile-name fd-suanet-atulaa-prd \
  --origin-group-name suanet \
  --resource-group RG-SDM-SUANET-PRD \
  --query "sessionAffinityState" -o tsv
# Debe responder: Enabled
```

**Tiempo de propagación**: ~5 minutos

---

### PASO 2: Desplegar Cambios en AKS

#### Opción A: Via Azure DevOps Pipeline (Recomendado)

1. Hacer commit de los cambios:
   ```bash
   cd /home/lballesterosp/ALL/SUANET-FRONTEND
   git add k8s/prd/websocket-ingress.yaml
   git add azure-pipelines-prd.yml
   git add docs/fix-websocket-production.md
   git commit -m "fix: Add WebSocket ingress for production Socket.IO support"
   git push origin prd
   ```

2. El pipeline `azure-pipelines-prd.yml` se ejecutará automáticamente

3. Monitorear en Azure DevOps:
   - Pipeline debe completar en ~5-10 minutos
   - Verificar que el paso "Deploying WebSocket ingress..." aparezca

#### Opción B: Deployment Manual (Solo para testing)

```bash
# Conectar a AKS
az aks get-credentials \
  --resource-group RG-SDM-SUANET-PRD \
  --name aks-suanet-atulaa-prd \
  --admin

# Desplegar websocket ingress
kubectl apply -f k8s/prd/websocket-ingress.yaml

# Verificar deployment
kubectl get ingress -n suanet-prd
```

**Resultado esperado**:
```
NAME                        CLASS   HOSTS                            ADDRESS
suanet-ingress              nginx   suanet.movilidadbogota.gov.co   20.72.153.153
suanet-websocket-ingress    nginx   suanet.movilidadbogota.gov.co   20.72.153.153
```

---

## 🧪 Testing y Verificación

### Test 1: Verificar Ingress en AKS

```bash
# Conectar a AKS
az aks get-credentials \
  --resource-group RG-SDM-SUANET-PRD \
  --name aks-suanet-atulaa-prd \
  --admin

# Ver ingresses
kubectl get ingress -n suanet-prd

# Detalle del websocket ingress
kubectl describe ingress suanet-websocket-ingress -n suanet-prd
```

**Verificar**:
- ✅ Path `/socket.io` existe
- ✅ Backend apunta a `suanet-backend-service:8080`
- ✅ Anotación `websocket-services` presente

---

### Test 2: Verificar Session Affinity en Front Door

```bash
az afd origin-group show \
  --profile-name fd-suanet-atulaa-prd \
  --origin-group-name suanet \
  --resource-group RG-SDM-SUANET-PRD \
  --query "{SessionAffinity:sessionAffinityState, HealthProbe:healthProbeSettings.probePath}" \
  -o table
```

**Resultado esperado**:
```
SessionAffinity    HealthProbe
-----------------  -------------
Enabled            /
```

---

### Test 3: Verificar WebSocket desde Browser

1. Abrir: `https://suanet.movilidadbogota.gov.co`

2. Abrir DevTools (F12):
   - Tab: **Network**
   - Filter: **WS** (WebSocket)

3. Ejecutar flujo de video analítica:
   - Seleccionar cámara
   - Dibujar polígono (4 puntos)
   - Seleccionar tiempo de procesamiento
   - Click "Procesar video"

4. **Verificar en Network tab**:

   **✅ ÉXITO - Debe aparecer**:
   ```
   Name: socket.io
   Status: 101 Switching Protocols
   Type: websocket
   Size: (varies)
   Time: (mantiene conexión abierta)
   ```

   **❌ FALLA - Si aparece**:
   ```
   Name: socket.io
   Status: 400 Bad Request / 404 Not Found / Timeout
   Type: xhr / polling
   ```

5. **Verificar en Console tab**:

   **✅ ÉXITO**:
   ```
   Conectado al servidor WebSocket en https://suanet.movilidadbogota.gov.co
   Unido al canal 456: success
   Actualización recibida: {frame: ..., count: ...}
   ```

   **❌ FALLA**:
   ```
   WebSocket connection failed
   Error: timeout
   ```

---

### Test 4: Verificar Logs del Backend

```bash
# Ver pods del backend
kubectl get pods -n suanet-prd -l app=suanet-backend

# Ver logs de uno de los pods
kubectl logs -n suanet-prd -l app=suanet-backend --tail=50 -f

# Buscar mensajes tipo:
# "Client connected to channel 456"
# "Sending update to channel 456"
```

---

## 🔍 Troubleshooting

### Problema: "404 Not Found" en /socket.io

**Causa**: El ingress no se aplicó correctamente o nginx no lo reconoce

**Solución**:
```bash
# Verificar que existe
kubectl get ingress -n suanet-prd suanet-websocket-ingress

# Si no existe, aplicar manualmente
kubectl apply -f k8s/prd/websocket-ingress.yaml

# Verificar eventos
kubectl get events -n suanet-prd --sort-by='.lastTimestamp' | grep ingress
```

---

### Problema: "101 Switching Protocols" pero no llegan datos

**Causa**: Session affinity no está habilitada, las peticiones van a pods diferentes

**Solución**:
```bash
# Verificar session affinity
az afd origin-group show \
  --profile-name fd-suanet-atulaa-prd \
  --origin-group-name suanet \
  --resource-group RG-SDM-SUANET-PRD \
  --query "sessionAffinityState"

# Si responde "Disabled", habilitar:
az afd origin-group update \
  --profile-name fd-suanet-atulaa-prd \
  --origin-group-name suanet \
  --resource-group RG-SDM-SUANET-PRD \
  --session-affinity-state Enabled

# Esperar 5 minutos para propagación
```

---

### Problema: Conexión se cae después de unos minutos

**Causa**: Timeouts demasiado cortos

**Solución**: Verificar anotaciones del ingress:
```bash
kubectl get ingress suanet-websocket-ingress -n suanet-prd -o yaml | grep timeout
```

Debe mostrar:
```yaml
nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
```

---

## 📊 Comparación Dev vs Prod (Después del Fix)

| Aspecto | DEV (Antes) | PROD (Antes) | PROD (Después) |
|---------|-------------|--------------|----------------|
| Ingress `/` | ✅ Existe | ✅ Existe | ✅ Existe |
| Ingress `/socket.io` | ✅ Existe | ❌ NO existe | ✅ Existe |
| Anotaciones websocket | ✅ Configuradas | ❌ Faltantes | ✅ Configuradas |
| Session affinity (nginx) | ✅ Cookie | ❌ No configurada | ✅ Cookie |
| Session affinity (Front Door) | N/A | ❌ Disabled | ✅ Enabled |
| Timeouts | ✅ 3600s | ❌ 300s | ✅ 3600s |
| **Estado WebSocket** | **✅ Funciona** | **❌ Falla** | **✅ Funciona** |

---

## 📝 Checklist Final

Antes de considerar el problema resuelto, verificar:

```
□ Session affinity habilitada en Azure Front Door
□ websocket-ingress.yaml desplegado en AKS
□ Ingress aparece en: kubectl get ingress -n suanet-prd
□ Browser muestra "101 Switching Protocols" en Network tab
□ Console muestra "Conectado al servidor WebSocket"
□ Datos de video analítica llegan en tiempo real
□ Logs del backend muestran "Client connected to channel X"
□ Conexión se mantiene abierta durante minutos sin caerse
```

---

## 🎯 Impacto Esperado

**Antes del fix**:
- ❌ API `/api/process_stream` funciona pero no hay feedback visual
- ❌ Usuario no ve progreso del procesamiento
- ❌ No hay actualización de conteos en tiempo real
- ❌ No hay preview de imágenes procesadas

**Después del fix**:
- ✅ API `/api/process_stream` funciona
- ✅ WebSocket se conecta correctamente
- ✅ Usuario recibe actualizaciones en tiempo real
- ✅ Conteos de vehículos se actualizan live
- ✅ Imágenes de debug se muestran durante procesamiento
- ✅ Experiencia de usuario idéntica a desarrollo

---

## 📚 Referencias Técnicas

### Socket.IO Connection Flow

1. **Polling Phase** (Initial):
   ```
   GET /socket.io/?EIO=4&transport=polling&t=evjwpem
   → Establece conexión HTTP long-polling
   ```

2. **Upgrade Phase**:
   ```
   GET /socket.io/?EIO=4&transport=websocket&sid=xyz
   Upgrade: websocket
   Connection: Upgrade
   → Upgrade a WebSocket persistente
   ```

3. **Data Exchange**:
   ```
   WebSocket frames:
   → {"channel_id": 456, "action": "join"}
   ← {"frame": "...", "count": {...}, "image": "..."}
   ```

### Nginx Ingress WebSocket Support

Anotaciones críticas:
- `websocket-services`: Indica qué servicios aceptan websockets
- `proxy-http-version: "1.1"`: HTTP/1.1 necesario para upgrade
- `affinity: "cookie"`: Sticky sessions para mantener conexión
- `proxy-read-timeout`: Evita que nginx cierre conexión idle

### Azure Front Door Session Affinity

Cuando está habilitado:
- Front Door inserta cookie `ARRAffinity` o similar
- Requests del mismo cliente van al mismo origin
- Crítico para Socket.IO multi-replica deployments

---

## 🔐 Seguridad

**Consideraciones**:
- ✅ SSL/TLS terminación en Front Door (HTTPS al cliente)
- ✅ Comunicación interna en HTTP (aceptable en red privada AKS)
- ✅ WAF policies aplicadas en Front Door
- ✅ Ingress con anotaciones de seguridad estándar
- ✅ Backend service tipo ClusterIP (no expuesto públicamente)

**NO cambiar**:
- `ssl-redirect: "false"` en ingress (correcto para Front Door)
- Protocol HTTP en origin de Front Door (correcto para nginx)

---

## 📞 Contacto

**Implementado por**: Claude Code + Luis Ballesteros
**Fecha**: 2025-11-10
**Ambiente**: Producción (suanet-prd)
**Proyecto**: SUANET - Sistema Unificado de Analítica de Tráfico

---

**Estado**: ✅ Solución lista para desplegar
**Riesgo**: 🟢 Bajo (cambios no rompen funcionalidad existente)
**Downtime**: 🟢 Cero (hot deployment)
