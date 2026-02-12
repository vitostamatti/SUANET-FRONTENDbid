# Tareas Pendientes de Seguridad - Post-Incidente

**Fecha de creacion:** 17 de Diciembre de 2025
**Relacionado con:** SECURITY_INCIDENT_2025-12-16.md
**Estado:** PENDIENTE

---

## Resumen

Este documento lista las tareas de seguridad pendientes despues del incidente de CVE-2025-55182 (React2Shell) del 16 de diciembre de 2025.

---

## Tareas Completadas

- [x] Actualizacion de Next.js de 15.3.1 a 15.3.8
- [x] Fix de Content-Type para archivos estaticos en server.js
- [x] Rotacion de NEXTAUTH_SECRET
- [x] Rotacion de NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
- [x] Verificacion de sistema limpio (sin malware)
- [x] Documentacion del incidente

---

## Tareas Pendientes

### 1. Aumentar Limite de Memoria del Pod

**Prioridad:** ALTA
**Archivo:** `k8s/dev/deployment.yaml`
**Razon:** El limite actual de 256Mi es insuficiente para Next.js en produccion. El cryptominer causo OOMKill repetidos (19+ restarts).

**Cambio requerido:**

```yaml
# Antes
resources:
  requests:
    memory: "100Mi"
    cpu: "20m"
  limits:
    memory: "256Mi"
    cpu: "100m"

# Despues
resources:
  requests:
    memory: "256Mi"
    cpu: "50m"
  limits:
    memory: "512Mi"
    cpu: "200m"
```

**Comando para aplicar:**
```bash
kubectl apply -f k8s/dev/deployment.yaml
kubectl rollout restart deployment/suanet-frontend -n suanet-dev
```

---

### 2. Regenerar URLs de PowerBI

**Prioridad:** ALTA
**Variables afectadas:**
- `NEXT_PUBLIC_POWERBI_DESCRIPTIVO_URL`
- `NEXT_PUBLIC_POWERBI_TRAFICO_URL`

**Razon:** Las URLs de embed de PowerBI fueron expuestas durante el compromiso del pod. Aunque tienen tokens de acceso limitado, es recomendable regenerarlas.

**Procedimiento:**
1. Acceder a PowerBI Service (https://app.powerbi.com)
2. Ir al dashboard "Descriptivo"
3. Archivo > Insertar informe > Sitio web o portal
4. Copiar nueva URL de embed
5. Repetir para dashboard "Trafico"
6. Actualizar en Azure DevOps Variable Group `suanet-frontend-secrets-dev`
7. Actualizar en Kubernetes:
   ```bash
   kubectl patch secret suanet-frontend-secret -n suanet-dev \
     -p '{"data":{"NEXT_PUBLIC_POWERBI_DESCRIPTIVO_URL":"'$(echo -n "NUEVA_URL" | base64)'"}}'
   ```
8. Reiniciar deployment

---

### 3. Implementar Network Policies

**Prioridad:** MEDIA
**Archivo a crear:** `k8s/dev/network-policy.yaml`

**Razon:** Restringir el trafico de salida del pod para prevenir que malware pueda comunicarse con servidores C2 o descargar payloads.

**Network Policy recomendada:**

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: suanet-frontend-egress
  namespace: suanet-dev
spec:
  podSelector:
    matchLabels:
      app: suanet-frontend
  policyTypes:
  - Egress
  egress:
  # Permitir DNS
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: UDP
      port: 53
  # Permitir comunicacion con backend
  - to:
    - podSelector:
        matchLabels:
          app: suanet-backend
    ports:
    - protocol: TCP
      port: 8080
  # Permitir HTTPS saliente (Google Maps, PowerBI, etc)
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        # Bloquear rangos conocidos de mining pools
        - 37.32.0.0/16
    ports:
    - protocol: TCP
      port: 443
```

**Comando para aplicar:**
```bash
kubectl apply -f k8s/dev/network-policy.yaml
```

**Nota:** Requiere que el cluster tenga un CNI que soporte Network Policies (Azure CNI lo soporta).

---

### 4. Configurar Retencion Extendida de Logs

**Prioridad:** MEDIA
**Ubicacion:** Azure Portal > Log Analytics Workspace

**Razon:** Durante el incidente, los logs del ingress rotaron antes de poder identificar la IP del atacante. Se requiere retencion minima de 30 dias.

**Procedimiento:**
1. Ir a Azure Portal
2. Buscar el Log Analytics Workspace asociado al cluster AKS
3. Settings > Usage and estimated costs > Data Retention
4. Cambiar de 30 dias (default) a 90 dias
5. Guardar cambios

**Configurar alertas:**
1. Ir a Azure Monitor > Alerts
2. Crear nueva regla de alerta
3. Condicion: Custom log search con query:
   ```kusto
   ContainerLogV2
   | where LogMessage contains_any ("xmrig", "cryptonight", "mining", "stratum+tcp")
   | where TimeGenerated > ago(5m)
   ```
4. Accion: Enviar email al equipo de seguridad
5. Severidad: Critical (Sev 0)

---

### 5. Auditoria Completa de Seguridad

**Prioridad:** BAJA
**Responsable:** Por asignar

**Alcance recomendado:**
- [ ] Revisar todas las dependencias de npm por vulnerabilidades conocidas
- [ ] Ejecutar `npm audit` y remediar vulnerabilidades criticas
- [ ] Revisar configuracion de headers de seguridad en server.js
- [ ] Verificar que no hay secretos hardcodeados en el codigo
- [ ] Revisar permisos de los Service Accounts de Kubernetes
- [ ] Verificar configuracion de RBAC en el cluster
- [ ] Revisar logs de acceso de los ultimos 30 dias

**Comando para auditoria de npm:**
```bash
cd /home/lballesterosp/ALL/SUANET-FRONTEND
npm audit --production
```

---

## Mejoras Opcionales de Seguridad

### A. Habilitar Read-Only Root Filesystem

**Archivo:** `k8s/dev/deployment.yaml`

```yaml
securityContext:
  readOnlyRootFilesystem: true
```

**Nota:** Requiere montar volumenes escribibles para:
- `/app/.next/cache`
- `/tmp`

### B. Implementar Pod Security Standards

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: suanet-dev
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/warn: restricted
```

### C. Configurar Falco para Deteccion de Amenazas

Falco puede detectar actividad sospechosa en tiempo real:
- Ejecucion de shells
- Descargas de binarios
- Conexiones a IPs sospechosas
- Modificacion de archivos del sistema

---

## Cronograma Sugerido

| Semana | Tarea |
|--------|-------|
| Semana 1 | Aumentar memoria, regenerar PowerBI URLs |
| Semana 2 | Implementar Network Policies |
| Semana 3 | Configurar retencion de logs y alertas |
| Semana 4 | Auditoria completa de seguridad |

---

## Contacto

**Documento creado por:** Claude Code AI Assistant
**Fecha:** 17 de Diciembre de 2025

Para dudas sobre este documento, consultar el informe de incidente original:
`/home/lballesterosp/ALL/SUANET-FRONTEND/docs/SECURITY_INCIDENT_2025-12-16.md`
