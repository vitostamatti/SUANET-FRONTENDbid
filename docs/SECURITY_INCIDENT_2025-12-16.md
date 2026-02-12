# Informe de Incidente de Seguridad - SUANET Frontend

**Fecha del Incidente:** 16 de Diciembre de 2025
**Fecha de Deteccion:** 16 de Diciembre de 2025
**Fecha de Remediacion:** 17 de Diciembre de 2025
**Severidad:** CRITICA
**Estado:** REMEDIADO

---

## Resumen Ejecutivo

El frontend de SUANET (https://suanet-test.movilidadbogota.gov.co) fue comprometido mediante la explotacion de la vulnerabilidad **CVE-2025-55182 (React2Shell)**, una vulnerabilidad critica de Remote Code Execution (RCE) con CVSS 10.0 que afecta a React Server Components y Next.js.

El atacante logro ejecutar codigo malicioso para descargar e intentar ejecutar **xmrig**, un cryptominer de Monero.

---

## Cronologia del Incidente

| Fecha/Hora (UTC) | Evento |
|------------------|--------|
| ~2025-12-16 | Atacante explota CVE-2025-55182 en Next.js 15.3.1 |
| ~2025-12-16 | Descarga de xmrig-6.24.0 desde GitHub |
| ~2025-12-16 | Intento de conexion a pool de mineria (37.32.6.33:7979) |
| ~2025-12-16 | Pod termina por OOMKill (Exit Code 137) |
| 2025-12-16 18:34 | Deteccion inicial - sitio muestra "Preparando SUANET..." |
| 2025-12-16 18:38 | Identificacion de problema de Content-Type en archivos estaticos |
| 2025-12-16 19:16 | Descubrimiento de evidencia de cryptominer en logs |
| 2025-12-17 00:37 | Deployment de parche de seguridad (Next.js 15.3.8) |
| 2025-12-17 00:45 | Verificacion de sistema limpio |

---

## Vulnerabilidad Explotada

### CVE-2025-55182 / CVE-2025-66478 (React2Shell)

- **Tipo:** Remote Code Execution (RCE)
- **CVSS Score:** 10.0 (CRITICO)
- **Vector:** Deserializacion insegura en React Server Components
- **Afecta:** Next.js >= 14.3.0-canary.77, >= 15.0.0, >= 16.0.0
- **Descubrimiento:** 29 de Noviembre de 2025 por Lachlan Davidson
- **Divulgacion Publica:** 3 de Diciembre de 2025
- **Explotacion Activa:** Desde 5 de Diciembre de 2025

### Version Vulnerable

```
Next.js: 15.3.1 (VULNERABLE)
```

### Version Parcheada

```
Next.js: 15.3.8 (SEGURA)
```

---

## Evidencia del Ataque

### Logs del Pod Comprometido

```
Connecting to github.com (140.82.114.3:443)
Connecting to release-assets.githubusercontent.com (185.199.110.133:443)
saving to 'xmrig-6.24.0-linux-static-x64.tar.gz'
xmrig-6.24.0-linux-s 100% |********************************| 3439k  0:00:00 ETA
'xmrig-6.24.0-linux-static-x64.tar.gz' saved
Connecting to 37.32.6.33:7979 (37.32.6.33:7979)
wget: can't open 'm': File exists
```

### Indicadores de Compromiso (IOCs)

| Tipo | Valor | Descripcion |
|------|-------|-------------|
| IP | 37.32.6.33 | Servidor C2 / Pool de mineria |
| Puerto | 7979 | Puerto de conexion del miner |
| Archivo | xmrig-6.24.0-linux-static-x64.tar.gz | Cryptominer descargado |
| URL | github.com/xmrig/xmrig | Fuente del malware |

### Atribucion Potencial

Segun reportes de Unit42 (Palo Alto Networks) y Wiz, actividad similar ha sido atribuida a **CL-STA-1015**, un Initial Access Broker (IAB) con posibles vinculos con el Ministerio de Seguridad del Estado de China (MSS).

---

## Impacto

### Sistemas Afectados

| Sistema | Estado | Impacto |
|---------|--------|---------|
| suanet-frontend | Comprometido | RCE, cryptominer ejecutado |
| suanet-backend | No afectado | Sin evidencia de compromiso |
| Base de datos | Potencialmente expuesta | Credenciales en memoria del pod |

### Consecuencias

1. **Ejecucion de codigo malicioso** - Cryptominer descargado y potencialmente ejecutado
2. **Consumo de recursos** - OOMKill por consumo excesivo de memoria (19+ restarts)
3. **Exposicion de secretos** - Variables de entorno accesibles desde el pod comprometido
4. **Interrupcion del servicio** - Sitio inaccesible mostrando "Preparando SUANET..."

---

## Problema Secundario Identificado

Durante la investigacion se descubrio un bug critico en el servidor custom de Next.js:

### Content-Type Incorrecto para Archivos Estaticos

**Problema:** Todos los archivos `.js` y `.css` se servian con `Content-Type: text/html` en lugar de sus tipos MIME correctos.

**Causa:** El `server.js` custom no establecía el Content-Type para archivos en `/_next/static/`.

**Efecto:** Los browsers no ejecutaban el JavaScript debido a `X-Content-Type-Options: nosniff`, dejando la aplicacion en estado de carga permanente.

**Solucion Implementada:**

```javascript
// server.js - Fix aplicado
const mimeTypes = {
  'js': 'application/javascript; charset=utf-8',
  'css': 'text/css; charset=utf-8',
  'woff': 'font/woff',
  'woff2': 'font/woff2',
  // ... otros tipos
};

if (pathname.startsWith('/_next/static/')) {
  const ext = pathname.split('.').pop()?.toLowerCase();
  if (ext && mimeTypes[ext]) {
    res.setHeader('Content-Type', mimeTypes[ext]);
  }
}
```

---

## Acciones de Remediacion

### Completadas

- [x] Actualizacion de Next.js de 15.3.1 a 15.3.8
- [x] Actualizacion de eslint-config-next a 15.3.8
- [x] Fix de Content-Type para archivos estaticos
- [x] Re-deployment del frontend
- [x] Verificacion de sistema limpio
- [x] Rotacion de NEXTAUTH_SECRET (2025-12-17)
- [x] Rotacion de NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (2025-12-17)
- [x] Eliminacion de API key antigua en Google Cloud Console

### Pendientes

- [ ] Aumento de limite de memoria de 256Mi a 512Mi
- [ ] Implementacion de Network Policies
- [ ] Regenerar URLs de embed de PowerBI
- [ ] Auditoria completa de seguridad
- [ ] Implementar retencion extendida de logs (minimo 30 dias)

---

## Analisis de Logs de Acceso

### Estado de los Logs

**Ingress NGINX Logs:** Los logs del ingress controller rotaron automaticamente y solo contienen las ultimas 10 entradas, todas correspondientes a trafico legitimo posterior a la remediacion.

**Pod Logs:** Los logs del pod comprometido fueron destruidos cuando el pod fue reemplazado durante el re-deployment. La evidencia del ataque (descarga de xmrig) fue capturada antes de la rotacion.

**Azure Monitor Container Insights:** Requiere acceso a Log Analytics workspace para consultar logs historicos. Se recomienda ejecutar las siguientes queries KQL:

```kusto
// Buscar evidencia de cryptominer
ContainerLogV2
| where TimeGenerated >= ago(48h)
| where PodNamespace == "suanet-dev"
| where PodName startswith "suanet-frontend"
| where LogMessage contains_any ("xmrig", "37.32.6.33", "wget", "curl", "github.com")
| project TimeGenerated, PodName, LogMessage
| order by TimeGenerated desc
```

### IP del Atacante

**Estado:** NO IDENTIFICADA

La IP de origen del atacante no pudo ser identificada debido a:
1. Rotacion automatica de logs del ingress controller
2. Destruccion de logs del pod comprometido durante re-deployment
3. Falta de logging centralizado configurado previamente

**Recomendacion:** Implementar retencion extendida de logs en Azure Monitor (minimo 30 dias) y configurar alertas para patrones de ataque conocidos.

---

## Secretos Comprometidos - Analisis Detallado

Los siguientes secretos estaban disponibles como variables de entorno en el pod comprometido (Kubernetes Secret: `suanet-frontend-secret`):

### Secretos Criticos

| Variable | Riesgo | Estado |
|----------|--------|--------|
| NEXTAUTH_SECRET | **CRITICO** - Permite forjar tokens de sesion | ✅ **ROTADO** (2025-12-17) |

### Secretos de Alta Prioridad

| Variable | Riesgo | Estado |
|----------|--------|--------|
| NEXT_PUBLIC_GOOGLE_CLIENT_ID | ALTO - OAuth phishing | Revisado - Sin actividad anomala |
| NEXT_PUBLIC_GOOGLE_MAPS_API_KEY | ALTO - Uso no autorizado, cargos | ✅ **ROTADO** (2025-12-17) |

### Secretos de Prioridad Media

| Variable | Riesgo | Estado |
|----------|--------|--------|
| BACKEND_URL | MEDIO - Reconocimiento interno | Solo expone arquitectura interna |
| NEXT_PUBLIC_BACKEND_URL | BAJO - URL publica | Informacion publica |
| NEXT_PUBLIC_FRONTEND_URL | BAJO - URL publica | Informacion publica |
| NEXT_PUBLIC_POWERBI_*_URL | MEDIO - Acceso a dashboards | Pendiente regenerar URLs |
| NODE_ENV | BAJO - Configuracion | Sin accion requerida |

### Rotacion de Secretos Ejecutada

**Fecha de rotacion:** 17 de Diciembre de 2025

**Secretos rotados:**
1. **NEXTAUTH_SECRET** - Nuevo valor generado con `openssl rand -hex 32`
2. **NEXT_PUBLIC_GOOGLE_MAPS_API_KEY** - Nueva key generada en Google Cloud Console

**Procedimiento ejecutado:**
1. Generacion de nuevos valores seguros
2. Actualizacion en Azure DevOps Variable Group (`suanet-frontend-secrets-dev`)
3. Actualizacion en Kubernetes Secret (`suanet-frontend-secret`)
4. Reinicio del deployment (`kubectl rollout restart`)
5. Verificacion de funcionamiento del sistema
6. Eliminacion de credenciales antiguas en Google Cloud Console

**Impacto de la rotacion:**
- Todos los tokens JWT firmados con el secret anterior fueron invalidados
- Los usuarios con sesion activa fueron deslogueados automaticamente
- La API key antigua de Google Maps fue deshabilitada

---

## Lecciones Aprendidas

1. **Monitoreo de CVEs criticos** - Implementar alertas automaticas para vulnerabilidades en dependencias
2. **Limites de recursos** - 256Mi es insuficiente para Next.js en produccion
3. **Contenedores efimeros** - El reinicio del pod limpio el malware, pero no previene re-infeccion
4. **Custom servers** - Requieren mantenimiento adicional de seguridad (MIME types, headers)

---

## Referencias

- [CVE-2025-55182 - NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-55182)
- [Next.js Security Advisory](https://nextjs.org/blog/CVE-2025-66478)
- [React2Shell Analysis - Wiz](https://www.wiz.io/blog/critical-vulnerability-in-react-cve-2025-55182)
- [Unit42 Analysis](https://unit42.paloaltonetworks.com/cve-2025-55182-react-and-cve-2025-66478-next/)

---

## Contacto

**Investigado por:** Claude Code AI Assistant
**Fecha del Informe:** 17 de Diciembre de 2025
**Ultima Actualizacion:** 17 de Diciembre de 2025
**Clasificacion:** CONFIDENCIAL - USO INTERNO
