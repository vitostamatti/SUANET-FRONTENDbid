# Protocolo de Testing y Diagnóstico - SUANET Producción

**Versión:** 1.0  
**Fecha:** 2025-11-27  
**Autor:** Equipo DevOps - SDM  
**Propósito:** Guía de diagnóstico para verificar el estado de SUANET en producción y resolver incidentes

---

## 📋 Tabla de Contenidos

1. [Arquitectura de Producción](#arquitectura-de-producción)
2. [Parámetros y Configuración](#parámetros-y-configuración)
3. [Protocolo de Testing Rápido](#protocolo-de-testing-rápido)
4. [Diagnóstico Completo Paso a Paso](#diagnóstico-completo-paso-a-paso)
5. [Comandos de Emergencia](#comandos-de-emergencia)
6. [Troubleshooting por Síntoma](#troubleshooting-por-síntoma)
7. [Contactos y Escalamiento](#contactos-y-escalamiento)

---

## 🏗️ Arquitectura de Producción

### Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────┐
│ Usuario Final                                                    │
│ https://suanet.movilidadbogota.gov.co                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ DNS Resolution (CNAME)
                      ↓
┌─────────────────────────────────────────────────────────────────┐
│ Azure Front Door (CDN/WAF/SSL Termination)                      │
│ Endpoint: suanet-hfaqd8ckefasepez.z01.azurefd.net              │
│ Profile: fd-suanet-atulaa-prd                                   │
│ IPs: 13.107.213.41, 13.107.246.41                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ HTTP/HTTPS Forward
                      │ Origin Host Header: suanet.movilidadbogota.gov.co
                      ↓
┌─────────────────────────────────────────────────────────────────┐
│ Nginx Ingress Controller (Load Balancer)                        │
│ IP Pública: 20.72.153.153                                       │
│ Service: ingress-nginx-controller (namespace: ingress-nginx)    │
│ Ingress: suanet-ingress (namespace: suanet-prd)                │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ Kubernetes Service
                      ↓
┌─────────────────────────────────────────────────────────────────┐
│ Frontend Service (ClusterIP)                                    │
│ Service: suanet-frontend-service                                │
│ IP Interna: 10.210.103.29                                       │
│ Port: 80                                                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ Pod Selector
                      ↓
┌─────────────────────────────────────────────────────────────────┐
│ Frontend Pods (Next.js App)                                     │
│ Deployment: suanet-frontend                                     │
│ Namespace: suanet-prd                                           │
│ Replicas: 2                                                     │
│ Image: Next.js 14+                                              │
│ Pods IPs: 10.209.244.x                                          │
└─────────────────────────────────────────────────────────────────┘
                      │
                      │ Backend API Calls
                      ↓
┌─────────────────────────────────────────────────────────────────┐
│ Backend Pods (FastAPI/Python)                                   │
│ Deployment: suanet-backend-deployment                           │
│ Service: suanet-backend-service (ClusterIP: 10.210.103.116)    │
│ Namespace: suanet-prd                                           │
│ Replicas: 2                                                     │
│ Port: 8080                                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Componentes Clave

| Componente | Tipo | Ubicación | Propósito |
|------------|------|-----------|-----------|
| **Azure Front Door** | CDN/WAF | Global | Terminación SSL, caché, protección DDoS, enrutamiento geográfico |
| **AKS Cluster** | Kubernetes | East US | Orquestación de contenedores |
| **Nginx Ingress** | Load Balancer | AKS | Enrutamiento HTTP/HTTPS interno, gestión de dominios |
| **Frontend** | Next.js App | Pods | Aplicación web (SSR/CSR) |
| **Backend** | FastAPI | Pods | API REST, WebSockets (Socket.IO) |

---

## 🔧 Parámetros y Configuración

### Azure Subscription & Resource Group

```yaml
Subscription ID: d3e8cfda-afb7-4656-b72e-7564f83fd393
Resource Group: RG-SDM-SUANET-PRD
Región: East US
Ambiente: Producción
```

### Azure Front Door

```yaml
Nombre: fd-suanet-atulaa-prd
Resource Group: RG-SDM-SUANET-PRD
Estado Esperado: Active
SKU: Standard_AzureFrontDoor

# Endpoints
Endpoint Name: suanet
Hostname: suanet-hfaqd8ckefasepez.z01.azurefd.net
Estado: Enabled

# Custom Domains
Domain: suanet.movilidadbogota.gov.co
Validation State: Approved
Deployment Status: Succeeded
TLS Version: TLS 1.2
Certificate Type: CustomerCertificate
Certificate: *.movilidadbogota.gov.co (DigiCert)
Expira: Oct 4, 2026

# Origin Group
Origin Group: suanet
Health Probe Path: /
Health Probe Protocol: Http
Probe Interval: 100 segundos

# Origin
Origin Name: suanet
Hostname: 20.72.153.153
Origin Host Header: suanet.movilidadbogota.gov.co
HTTP Port: 80
HTTPS Port: 443
Priority: 1
Weight: 1000

# Routes
Route Name: suanet
Patterns: /*
Forwarding Protocol: HttpOnly
HTTPS Redirect: Enabled
```

### AKS Cluster

```yaml
Nombre: aks-suanet-atulaa-prd
Resource Group: RG-SDM-SUANET-PRD
Kubernetes Version: 1.32.6
DNS Prefix: aks-suanet-atulaa-prd
FQDN: aks-suanet-atulaa-prd-mz5zv8n9.hcp.eastus.azmk8s.io

# Node Pools
- nodepool0 (System): 1 node, Standard_D2s_v5
- nodepool1 (User): 1 node, Standard_D4s_v5
- nodepool2 (Apps): 1-3 nodes (autoscaling), Standard_D4s_v5

# Network
Network Plugin: azure
Service CIDR: 10.210.100.0/22
DNS Service IP: 10.210.100.10
Pod CIDR: Managed by Azure CNI
VNet: VNet-SDM-PRD-VNetProduction
Subnet: SNet-SDM-PRD-AKS-Suanet-Atulaa

# Load Balancer
Tipo: Standard
IP Pública: 01a60fa6-056e-4476-955b-03eccadc2700
Dirección IP: 20.72.153.153
```

### Kubernetes Resources - Namespace: suanet-prd

```yaml
# Frontend Deployment
Name: suanet-frontend
Image: (Check deployment for current tag)
Replicas: 2
Container Port: 3000 (típicamente Next.js)

# Frontend Service
Name: suanet-frontend-service
Type: ClusterIP
Cluster IP: 10.210.103.29
Port: 80

# Backend Deployment
Name: suanet-backend-deployment
Image: (Check deployment for current tag)
Replicas: 2
Container Port: 8080

# Backend Service
Name: suanet-backend-service
Type: ClusterIP
Cluster IP: 10.210.103.116
Port: 8080

# Ingress
Name: suanet-ingress
Class: nginx
Host: suanet.movilidadbogota.gov.co
Path: / → suanet-frontend-service:80

# Ingress WebSocket
Name: suanet-websocket-ingress
Path: /socket.io → suanet-backend-service:8080
```

### Nginx Ingress Controller

```yaml
Namespace: ingress-nginx
Service: ingress-nginx-controller
Type: LoadBalancer
External IP: 20.72.153.153
Ports:
  - 80:31361/TCP
  - 443:30890/TCP
```

### DNS Configuration

```yaml
Dominio Producción: suanet.movilidadbogota.gov.co
Tipo: CNAME
Valor: suanet-hfaqd8ckefasepez.z01.azurefd.net
TTL: 3600 (1 hora recomendado)

# Resolución Esperada
suanet.movilidadbogota.gov.co
  → CNAME: suanet-hfaqd8ckefasepez.z01.azurefd.net
  → CNAME: mr-z01.tm-azurefd.net
  → A: 13.107.213.41, 13.107.246.41
```

---

## ⚡ Protocolo de Testing Rápido

### Test de 5 Minutos (Quick Health Check)

Ejecutar estos comandos en orden. Si todos pasan, el sistema está 100% operativo:

```bash
# 1. DNS Resolution (debe devolver IPs de Front Door)
nslookup suanet.movilidadbogota.gov.co 8.8.8.8

# Resultado esperado:
# suanet.movilidadbogota.gov.co canonical name = suanet-hfaqd8ckefasepez.z01.azurefd.net
# Address: 13.107.213.41
# Address: 13.107.246.41

# 2. HTTPS Connectivity (debe devolver 200 OK)
curl -I https://suanet.movilidadbogota.gov.co --max-time 10

# Resultado esperado:
# HTTP/2 200
# content-type: text/html (o similar)
# x-azure-ref: (presente)

# 3. HTTP Redirect (debe redirigir a HTTPS)
curl -I http://suanet.movilidadbogota.gov.co --max-time 10

# Resultado esperado:
# HTTP/1.1 307 Temporary Redirect
# Location: https://suanet.movilidadbogota.gov.co/

# 4. SSL Certificate (debe ser válido)
echo | openssl s_client -servername suanet.movilidadbogota.gov.co -connect suanet.movilidadbogota.gov.co:443 2>/dev/null | openssl x509 -noout -dates -subject

# Resultado esperado:
# subject=CN = *.movilidadbogota.gov.co
# notAfter=Oct  4 23:59:59 2026 GMT

# 5. Aplicación Respondiendo (debe devolver HTML de Next.js)
curl -s https://suanet.movilidadbogota.gov.co | grep -i "suanet"

# Resultado esperado:
# <title>Suanet</title>
# (contenido HTML presente)
```

**✅ Si todos los tests pasan:** El sistema está operativo  
**❌ Si alguno falla:** Proceder al diagnóstico completo

---

## 🔍 Diagnóstico Completo Paso a Paso

### Prerequisitos

Para ejecutar el diagnóstico completo necesitas:

1. **Azure CLI autenticado** con permisos de lectura en:
   - Subscription: `d3e8cfda-afb7-4656-b72e-7564f83fd393`
   - Resource Group: `RG-SDM-SUANET-PRD`

2. **kubectl configurado** para el cluster AKS:
   ```bash
   az aks get-credentials \
     --name aks-suanet-atulaa-prd \
     --resource-group RG-SDM-SUANET-PRD \
     --overwrite-existing
   ```

3. **Herramientas de red:**
   - `curl`
   - `nslookup` o `dig`
   - `openssl`

### Paso 1: Verificar DNS

**Objetivo:** Confirmar que el dominio resuelve correctamente a Azure Front Door

```bash
# Test 1.1: Resolución DNS con Google DNS
nslookup suanet.movilidadbogota.gov.co 8.8.8.8

# Test 1.2: Resolución DNS con Cloudflare DNS
nslookup suanet.movilidadbogota.gov.co 1.1.1.1

# Test 1.3: Verificar cadena CNAME completa
dig suanet.movilidadbogota.gov.co +short

# Test 1.4: Verificar TTL
dig suanet.movilidadbogota.gov.co +noall +answer
```

**Resultados Esperados:**

```
suanet.movilidadbogota.gov.co
  → CNAME: suanet-hfaqd8ckefasepez.z01.azurefd.net
  → IPs finales: 13.107.213.41, 13.107.246.41
```

**❌ Si falla:**
- Verificar con el administrador del registrador DNS
- El CNAME debe apuntar exactamente a: `suanet-hfaqd8ckefasepez.z01.azurefd.net`
- Esperar propagación DNS (hasta 48 horas, típicamente 15 minutos)

---

### Paso 2: Verificar Azure Front Door

**Objetivo:** Confirmar que Front Door está activo y configurado correctamente

```bash
# Test 2.1: Estado del perfil de Front Door
az afd profile show \
  --profile-name fd-suanet-atulaa-prd \
  --resource-group RG-SDM-SUANET-PRD \
  --query "{name:name, state:resourceState, provisioning:provisioningState}"

# Test 2.2: Estado del endpoint
az afd endpoint show \
  --profile-name fd-suanet-atulaa-prd \
  --endpoint-name suanet \
  --resource-group RG-SDM-SUANET-PRD \
  --query "{name:name, hostname:hostName, state:enabledState, deployment:deploymentStatus}"

# Test 2.3: Verificar dominio personalizado
az afd custom-domain show \
  --profile-name fd-suanet-atulaa-prd \
  --custom-domain-name suanet-movilidadbogota-gov-co-1efb \
  --resource-group RG-SDM-SUANET-PRD \
  --query "{domain:hostName, validation:domainValidationState, deployment:deploymentStatus}"

# Test 2.4: Verificar origin (backend)
az afd origin show \
  --profile-name fd-suanet-atulaa-prd \
  --origin-group-name suanet \
  --origin-name suanet \
  --resource-group RG-SDM-SUANET-PRD \
  --query "{hostname:hostName, header:originHostHeader, state:enabledState}"

# Test 2.5: Probar conectividad directa al endpoint de Front Door
curl -I https://suanet-hfaqd8ckefasepez.z01.azurefd.net --max-time 10

# Test 2.6: Probar con el dominio personalizado
curl -I https://suanet.movilidadbogota.gov.co --max-time 10 -v
```

**Resultados Esperados:**

```json
// Test 2.1
{
  "name": "fd-suanet-atulaa-prd",
  "state": "Active",
  "provisioning": "Succeeded"
}

// Test 2.2
{
  "name": "suanet",
  "hostname": "suanet-hfaqd8ckefasepez.z01.azurefd.net",
  "state": "Enabled",
  "deployment": "Succeeded" o "NotStarted"
}

// Test 2.3
{
  "domain": "suanet.movilidadbogota.gov.co",
  "validation": "Approved",
  "deployment": "Succeeded"
}

// Test 2.4
{
  "hostname": "20.72.153.153",
  "header": "suanet.movilidadbogota.gov.co",
  "state": "Enabled"
}

// Test 2.5 & 2.6
HTTP/2 200
```

**❌ Si falla:**
- **resourceState != "Active"**: Front Door podría estar en mantenimiento o deshabilitado
- **domainValidationState != "Approved"**: Problema con validación del dominio personalizado
- **origin.hostname != "20.72.153.153"**: Origin mal configurado
- **HTTP != 200**: Problema en el backend (proceder al Paso 3)

---

### Paso 3: Verificar AKS Cluster

**Objetivo:** Confirmar que el cluster de Kubernetes está operativo

```bash
# Test 3.1: Estado del cluster
az aks show \
  --name aks-suanet-atulaa-prd \
  --resource-group RG-SDM-SUANET-PRD \
  --query "{name:name, state:powerState.code, provisioning:provisioningState, k8sVersion:kubernetesVersion}"

# Test 3.2: Estado de los node pools
az aks nodepool list \
  --cluster-name aks-suanet-atulaa-prd \
  --resource-group RG-SDM-SUANET-PRD \
  --query "[].{name:name, count:count, state:powerState.code, vmSize:vmSize}"

# Test 3.3: Verificar conectividad kubectl
kubectl cluster-info

# Test 3.4: Verificar nodos
kubectl get nodes -o wide
```

**Resultados Esperados:**

```json
// Test 3.1
{
  "name": "aks-suanet-atulaa-prd",
  "state": "Running",
  "provisioning": "Succeeded",
  "k8sVersion": "1.32.6"
}

// Test 3.2
[
  {"name": "nodepool0", "count": 1, "state": "Running", "vmSize": "Standard_D2s_v5"},
  {"name": "nodepool1", "count": 1, "state": "Running", "vmSize": "Standard_D4s_v5"},
  {"name": "nodepool2", "count": 1-3, "state": "Running", "vmSize": "Standard_D4s_v5"}
]

// Test 3.4
NAME                                STATUS   ROLES    AGE   VERSION
aks-nodepool0-xxxxx   Ready    <none>   Xd    v1.32.6
aks-nodepool1-xxxxx   Ready    <none>   Xd    v1.32.6
aks-nodepool2-xxxxx   Ready    <none>   Xd    v1.32.6
```

**❌ Si falla:**
- **powerState != "Running"**: Cluster detenido o en mantenimiento
- **Nodos NotReady**: Problemas de conectividad o recursos
- Contactar al equipo de infraestructura Azure

---

### Paso 4: Verificar Nginx Ingress Controller

**Objetivo:** Confirmar que el Load Balancer está funcionando

```bash
# Test 4.1: Estado del servicio Nginx Ingress
kubectl get svc -n ingress-nginx ingress-nginx-controller

# Test 4.2: Estado del pod del controller
kubectl get pods -n ingress-nginx -l app.kubernetes.io/component=controller

# Test 4.3: Logs del controller (últimas 50 líneas)
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller --tail=50

# Test 4.4: Verificar IP pública asignada
kubectl get svc -n ingress-nginx ingress-nginx-controller \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}'

# Test 4.5: Probar conectividad directa a la IP pública
curl -H "Host: suanet.movilidadbogota.gov.co" http://20.72.153.153 --max-time 10 -I
```

**Resultados Esperados:**

```bash
# Test 4.1
NAME                       TYPE           EXTERNAL-IP     PORT(S)
ingress-nginx-controller   LoadBalancer   20.72.153.153   80:31361/TCP,443:30890/TCP

# Test 4.2
NAME                                        READY   STATUS    RESTARTS   AGE
ingress-nginx-controller-xxxxx              1/1     Running   0          Xd

# Test 4.4
20.72.153.153

# Test 4.5
HTTP/1.1 200 OK
```

**❌ Si falla:**
- **EXTERNAL-IP = <pending>**: LoadBalancer no asignó IP pública
- **Pod != Running**: Controller caído
- **curl falla**: Firewall/NSG bloqueando tráfico o backend down

---

### Paso 5: Verificar Pods de Frontend

**Objetivo:** Confirmar que la aplicación Next.js está ejecutándose

```bash
# Test 5.1: Listar pods de frontend
kubectl get pods -n suanet-prd -l app=suanet-frontend -o wide

# Test 5.2: Verificar estado detallado del deployment
kubectl get deployment -n suanet-prd suanet-frontend

# Test 5.3: Revisar eventos recientes
kubectl get events -n suanet-prd --sort-by='.lastTimestamp' | grep frontend | tail -20

# Test 5.4: Logs de un pod de frontend
POD_NAME=$(kubectl get pods -n suanet-prd -l app=suanet-frontend -o jsonpath='{.items[0].metadata.name}')
kubectl logs -n suanet-prd $POD_NAME --tail=50

# Test 5.5: Verificar health del pod (si tiene endpoint /health)
kubectl exec -n suanet-prd $POD_NAME -- wget -qO- http://localhost:3000/ | head -20
```

**Resultados Esperados:**

```bash
# Test 5.1
NAME                                READY   STATUS    RESTARTS   AGE
suanet-frontend-xxxxxx-xxxxx        1/1     Running   0          Xd
suanet-frontend-xxxxxx-xxxxx        1/1     Running   0          Xd

# Test 5.2
NAME              READY   UP-TO-DATE   AVAILABLE   AGE
suanet-frontend   2/2     2            2           Xd

# Test 5.5
<!DOCTYPE html>...<title>Suanet</title>...
```

**❌ Si falla:**
- **READY != 1/1**: Container no iniciado correctamente
- **STATUS != Running**: CrashLoopBackOff, ImagePullBackOff, etc.
- **Logs muestran errores**: Revisar configuración de la aplicación
- Ver sección [Troubleshooting por Síntoma](#troubleshooting-por-síntoma)

---

### Paso 6: Verificar Services e Ingress

**Objetivo:** Confirmar que el enrutamiento interno está correcto

```bash
# Test 6.1: Verificar servicio de frontend
kubectl get svc -n suanet-prd suanet-frontend-service

# Test 6.2: Verificar endpoints del servicio (debe listar IPs de pods)
kubectl get endpoints -n suanet-prd suanet-frontend-service

# Test 6.3: Verificar ingress
kubectl get ingress -n suanet-prd suanet-ingress

# Test 6.4: Describir ingress (ver backends)
kubectl describe ingress -n suanet-prd suanet-ingress

# Test 6.5: Probar desde dentro del cluster
kubectl run -n suanet-prd curl-test --image=curlimages/curl --rm -it --restart=Never -- \
  curl -s http://suanet-frontend-service.suanet-prd.svc.cluster.local | head -20
```

**Resultados Esperados:**

```bash
# Test 6.1
NAME                      TYPE        CLUSTER-IP      PORT(S)
suanet-frontend-service   ClusterIP   10.210.103.29   80/TCP

# Test 6.2
NAME                      ENDPOINTS
suanet-frontend-service   10.209.244.50:3000,10.209.244.68:3000

# Test 6.3
NAME             CLASS   HOSTS                            ADDRESS         PORTS
suanet-ingress   nginx   suanet.movilidadbogota.gov.co    20.72.153.153   80

# Test 6.5
<!DOCTYPE html>...<title>Suanet</title>...
```

**❌ Si falla:**
- **ENDPOINTS vacío**: Selector del service no coincide con labels de pods
- **ADDRESS del ingress vacío**: Nginx controller no procesó el ingress
- **curl interno falla**: Problema en la aplicación o configuración del pod

---

### Paso 7: Verificar Backend (Opcional pero Recomendado)

**Objetivo:** Confirmar que la API está respondiendo

```bash
# Test 7.1: Listar pods de backend
kubectl get pods -n suanet-prd -l app=suanet-backend -o wide

# Test 7.2: Estado del deployment
kubectl get deployment -n suanet-prd suanet-backend-deployment

# Test 7.3: Logs del backend
POD_NAME=$(kubectl get pods -n suanet-prd -l app=suanet-backend -o jsonpath='{.items[0].metadata.name}')
kubectl logs -n suanet-prd $POD_NAME --tail=50

# Test 7.4: Probar endpoint de health del backend (si existe)
kubectl exec -n suanet-prd $POD_NAME -- wget -qO- http://localhost:8080/health
```

**Resultados Esperados:**

```bash
# Test 7.1
NAME                                        READY   STATUS    RESTARTS   AGE
suanet-backend-deployment-xxxxx-xxxxx       1/1     Running   0          Xd
suanet-backend-deployment-xxxxx-xxxxx       1/1     Running   0          Xd

# Test 7.2
NAME                        READY   UP-TO-DATE   AVAILABLE   AGE
suanet-backend-deployment   2/2     2            2           Xd
```

---

## 🚨 Comandos de Emergencia

### Reiniciar Pods sin Downtime

```bash
# Reiniciar frontend (rolling restart)
kubectl rollout restart deployment/suanet-frontend -n suanet-prd

# Reiniciar backend (rolling restart)
kubectl rollout restart deployment/suanet-backend-deployment -n suanet-prd

# Verificar estado del rollout
kubectl rollout status deployment/suanet-frontend -n suanet-prd
kubectl rollout status deployment/suanet-backend-deployment -n suanet-prd
```

### Escalar Réplicas Manualmente

```bash
# Aumentar réplicas de frontend
kubectl scale deployment/suanet-frontend -n suanet-prd --replicas=3

# Verificar
kubectl get deployment -n suanet-prd suanet-frontend
```

### Limpiar Caché de Front Door

```bash
# Purgar todo el contenido de Front Door
az afd endpoint purge \
  --profile-name fd-suanet-atulaa-prd \
  --endpoint-name suanet \
  --resource-group RG-SDM-SUANET-PRD \
  --content-paths "/*"
```

### Verificar y Reiniciar Nginx Ingress Controller

```bash
# Reiniciar el controller
kubectl rollout restart deployment/ingress-nginx-controller -n ingress-nginx

# Verificar logs en tiempo real
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller -f
```

### Logs en Tiempo Real

```bash
# Frontend logs (todos los pods)
kubectl logs -n suanet-prd -l app=suanet-frontend -f --max-log-requests=10

# Backend logs (todos los pods)
kubectl logs -n suanet-prd -l app=suanet-backend -f --max-log-requests=10

# Nginx Ingress logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller -f
```

### Acceder a un Pod para Debug

```bash
# Ejecutar shell en pod de frontend
kubectl exec -it -n suanet-prd <pod-name> -- /bin/sh

# Ejecutar shell en pod de backend
kubectl exec -it -n suanet-prd <pod-name> -- /bin/bash
```

---

## 🔧 Troubleshooting por Síntoma

### Síntoma: "This site can't be reached" / DNS_PROBE_FINISHED_NXDOMAIN

**Causa probable:** Problema de DNS

**Diagnóstico:**
```bash
# 1. Verificar resolución DNS
nslookup suanet.movilidadbogota.gov.co 8.8.8.8
dig suanet.movilidadbogota.gov.co +short

# 2. Verificar configuración en Azure Front Door
az afd custom-domain show \
  --profile-name fd-suanet-atulaa-prd \
  --custom-domain-name suanet-movilidadbogota-gov-co-1efb \
  --resource-group RG-SDM-SUANET-PRD
```

**Soluciones:**
1. **Si DNS no resuelve:**
   - Verificar con administrador del registrador DNS
   - CNAME debe ser: `suanet-hfaqd8ckefasepez.z01.azurefd.net`
   - Esperar propagación (15 min - 48 hrs)

2. **Si resuelve pero browser falla:**
   - Limpiar caché DNS local: `ipconfig /flushdns` (Windows) o `sudo dscacheutil -flushcache` (macOS)
   - Probar en modo incógnito
   - Cambiar DNS a 8.8.8.8 temporalmente

---

### Síntoma: HTTP 502 Bad Gateway

**Causa probable:** Backend no responde o Front Door no puede alcanzar origin

**Diagnóstico:**
```bash
# 1. Verificar origin en Front Door
az afd origin show \
  --profile-name fd-suanet-atulaa-prd \
  --origin-group-name suanet \
  --origin-name suanet \
  --resource-group RG-SDM-SUANET-PRD

# 2. Probar conectividad directa al origin
curl -H "Host: suanet.movilidadbogota.gov.co" http://20.72.153.153 -I

# 3. Verificar pods de frontend
kubectl get pods -n suanet-prd -l app=suanet-frontend
```

**Soluciones:**
1. **Si origin IP es incorrecta:**
   - Debe ser: `20.72.153.153`
   - Actualizar en Azure Portal o CLI

2. **Si nginx no responde:**
   - Verificar que el servicio tenga EXTERNAL-IP:
     ```bash
     kubectl get svc -n ingress-nginx ingress-nginx-controller
     ```
   - Si está pendiente, puede haber problema con el Load Balancer de Azure

3. **Si pods están caídos:**
   - Ver [Síntoma: Pods en CrashLoopBackOff](#síntoma-pods-en-crashloopbackoff)

---

### Síntoma: HTTP 503 Service Unavailable

**Causa probable:** Pods no están listos o no hay endpoints disponibles

**Diagnóstico:**
```bash
# 1. Verificar estado de pods
kubectl get pods -n suanet-prd -l app=suanet-frontend

# 2. Verificar endpoints del servicio
kubectl get endpoints -n suanet-prd suanet-frontend-service

# 3. Revisar eventos
kubectl get events -n suanet-prd --sort-by='.lastTimestamp' | tail -30
```

**Soluciones:**
1. **Si no hay pods:**
   ```bash
   kubectl scale deployment/suanet-frontend -n suanet-prd --replicas=2
   ```

2. **Si pods están pero no Ready:**
   - Revisar logs: `kubectl logs -n suanet-prd <pod-name>`
   - Verificar readiness probe en el deployment

3. **Si endpoints vacíos:**
   - Verificar que labels del service coincidan con labels de los pods

---

### Síntoma: Pods en CrashLoopBackOff

**Causa probable:** Error en la aplicación o configuración incorrecta

**Diagnóstico:**
```bash
# 1. Ver logs del pod fallido
kubectl logs -n suanet-prd <pod-name> --previous

# 2. Describir el pod para ver eventos
kubectl describe pod -n suanet-prd <pod-name>

# 3. Verificar variables de entorno y secrets
kubectl get deployment -n suanet-prd suanet-frontend -o yaml | grep -A 20 "env:"
```

**Soluciones:**
1. **Error de aplicación:**
   - Revisar logs para identificar el error específico
   - Verificar variables de entorno necesarias
   - Contactar equipo de desarrollo

2. **ImagePullBackOff:**
   - Verificar que la imagen existe en el registry
   - Verificar credenciales del registry

3. **Error de configuración:**
   - Revisar ConfigMaps y Secrets referenciados
   - Verificar permisos RBAC

---

### Síntoma: Sitio Carga Lento

**Causa probable:** Problemas de rendimiento o caché

**Diagnóstico:**
```bash
# 1. Verificar tiempo de respuesta
time curl -s https://suanet.movilidadbogota.gov.co -o /dev/null

# 2. Verificar uso de recursos de pods
kubectl top pods -n suanet-prd

# 3. Verificar uso de nodos
kubectl top nodes

# 4. Verificar configuración de caché en Front Door
az afd route show \
  --profile-name fd-suanet-atulaa-prd \
  --endpoint-name suanet \
  --route-name suanet \
  --resource-group RG-SDM-SUANET-PRD
```

**Soluciones:**
1. **Pods con alto uso de CPU/memoria:**
   - Escalar horizontalmente: `kubectl scale deployment/suanet-frontend -n suanet-prd --replicas=3`
   - Aumentar recursos del pod (editar deployment)

2. **Nodos saturados:**
   - Escalar node pool de AKS
   - Verificar autoscaling del nodepool2

3. **Caché no configurado:**
   - Revisar reglas de caché en Front Door
   - Purgar caché si está corrupto

---

### Síntoma: WebSockets No Funcionan

**Causa probable:** Problema con ingress de WebSocket

**Diagnóstico:**
```bash
# 1. Verificar ingress de WebSocket
kubectl get ingress -n suanet-prd suanet-websocket-ingress

# 2. Verificar anotaciones del ingress
kubectl describe ingress -n suanet-prd suanet-websocket-ingress | grep -A 5 "Annotations"

# 3. Probar conectividad WebSocket
wscat -c wss://suanet.movilidadbogota.gov.co/socket.io/
```

**Soluciones:**
1. **Ingress mal configurado:**
   - Verificar anotación: `nginx.ingress.kubernetes.io/websocket-services: suanet-backend-service`
   - Verificar path: `/socket.io`

2. **Backend no responde:**
   - Verificar pods de backend
   - Revisar logs del backend para errores de Socket.IO

---

### Síntoma: Certificado SSL Inválido o Expirado

**Causa probable:** Certificado en Front Door expiró o no está configurado

**Diagnóstico:**
```bash
# 1. Verificar certificado actual
echo | openssl s_client -servername suanet.movilidadbogota.gov.co \
  -connect suanet.movilidadbogota.gov.co:443 2>/dev/null | \
  openssl x509 -noout -dates -subject -issuer

# 2. Verificar configuración TLS en Front Door
az afd custom-domain show \
  --profile-name fd-suanet-atulaa-prd \
  --custom-domain-name suanet-movilidadbogota-gov-co-1efb \
  --resource-group RG-SDM-SUANET-PRD \
  --query "tlsSettings"
```

**Soluciones:**
1. **Certificado expirado:**
   - Contactar equipo de seguridad para renovar certificado wildcard
   - Actualizar secret en Front Door

2. **Certificado incorrecto:**
   - Verificar que el certificado sea para `*.movilidadbogota.gov.co`
   - Verificar que esté referenciado correctamente en Front Door

---

## 📞 Contactos y Escalamiento

### Niveles de Escalamiento

**Nivel 1: DevOps / Operaciones** (Respuesta: < 30 min)
- **Responsable:** Jhon Alexander Gonzalez Mendoza
- **Email:** desarrollos.sgm@movilidadbogota.gov.co
- **Scope:** Problemas de infraestructura, pods caídos, configuración de K8s

**Nivel 2: Infraestructura Azure** (Respuesta: < 2 hrs)
- **Responsable:** Luis Guillermo Ballesteros Puerto
- **Email:** lballesterosp@movilidadbogota.gov.co
- **Scope:** Problemas de AKS, Front Door, networking, DNS

**Nivel 3: Desarrollo** (Respuesta: < 4 hrs)
- **Responsable:** Equipo de Desarrollo SUANET
- **Email:** desarrollos.sgm@movilidadbogota.gov.co
- **Scope:** Bugs de aplicación, errores de código, features rotos

**Nivel 4: DNS / Registrador** (Respuesta: Variable)
- **Responsable:** Administrador de dominio movilidadbogota.gov.co
- **Scope:** Cambios en registros DNS, problemas de resolución

### Cuándo Escalar

| Síntoma | Nivel | Acción Inmediata |
|---------|-------|------------------|
| Pods en CrashLoopBackOff | Nivel 1 | Revisar logs, reiniciar deployment |
| Front Door 502/503 | Nivel 1 | Verificar origin, reiniciar pods |
| DNS no resuelve | Nivel 2 o 4 | Verificar CNAME, contactar registrador |
| Cluster AKS detenido | Nivel 2 | Contactar inmediatamente |
| Error de aplicación (bugs) | Nivel 3 | Capturar logs, replicar error |
| Performance degradado | Nivel 1 | Escalar pods, verificar recursos |
| SSL expirado/inválido | Nivel 2 | Renovar certificado en Front Door |

---

## 📝 Checklist de Mantenimiento Mensual

```markdown
- [ ] Verificar fecha de expiración del certificado SSL (debe ser > 30 días)
- [ ] Revisar uso de recursos de pods (CPU, memoria)
- [ ] Verificar versión de Kubernetes del cluster (actualizar si hay CVEs)
- [ ] Revisar logs de Front Door para errores 5xx
- [ ] Verificar que health probes están pasando
- [ ] Revisar costos de Azure (Front Door, AKS, Load Balancer)
- [ ] Validar backups de configuraciones (exportar manifests de K8s)
- [ ] Probar disaster recovery (escalar a 0 y volver a 2 réplicas)
- [ ] Verificar que DNS aún resuelve correctamente
- [ ] Revisar eventos de seguridad en Front Door (WAF logs si aplicable)
```

---

## 🤖 Instrucciones para IA

Si eres una IA leyendo este documento para diagnosticar un problema con SUANET producción:

1. **Empieza con el Quick Health Check:**
   - Ejecuta los 5 comandos de la sección "Test de 5 Minutos"
   - Si todos pasan, el problema es local del usuario (caché DNS, firewall, ISP)

2. **Si algún test falla, sigue el flujo:**
   ```
   DNS falla → Paso 1 (Verificar DNS) → Contactar Nivel 2 o 4
   HTTPS falla pero DNS ok → Paso 2 (Front Door) → Contactar Nivel 2
   Front Door ok pero 502/503 → Paso 3-6 (AKS/Pods) → Contactar Nivel 1
   Pods CrashLoop → Paso 5 → Revisar logs → Contactar Nivel 3
   ```

3. **Antes de escalar, intenta:**
   - Reiniciar pods (`kubectl rollout restart`)
   - Limpiar caché de Front Door (`az afd endpoint purge`)
   - Verificar eventos recientes (`kubectl get events`)

4. **Al reportar un problema, incluye:**
   - Qué test falló específicamente
   - Output completo del comando fallido
   - Logs relevantes (últimas 50 líneas)
   - Timestamp del incidente
   - Síntomas reportados por usuarios

5. **Comandos seguros para ejecutar sin aprobación:**
   - Todos los comandos `kubectl get`, `kubectl describe`, `kubectl logs`
   - Todos los comandos `az ... show`, `az ... list`
   - Comandos de red: `curl`, `nslookup`, `dig`, `openssl`

6. **Comandos que REQUIEREN aprobación:**
   - `kubectl delete`, `kubectl apply`, `kubectl edit`
   - `kubectl scale` (cambiar réplicas)
   - `kubectl rollout restart` (reiniciar pods)
   - `az afd endpoint purge` (limpiar caché)
   - Cualquier comando `az ... update`, `az ... delete`

---

## 📚 Referencias

- **Azure Front Door Docs:** https://learn.microsoft.com/en-us/azure/frontdoor/
- **AKS Documentation:** https://learn.microsoft.com/en-us/azure/aks/
- **Nginx Ingress Controller:** https://kubernetes.github.io/ingress-nginx/
- **Next.js Production Checklist:** https://nextjs.org/docs/going-to-production

---

**Última actualización:** 2025-11-27  
**Versión del documento:** 1.0  
**Mantenido por:** Equipo DevOps SDM
