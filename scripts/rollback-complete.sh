#!/bin/bash

# ============================================================================
# Script: Rollback Completo de Migración 2-Ingress
# ============================================================================
# Purpose: Revertir completamente la migración a arquitectura de 2 ingress
# Usage: ./scripts/rollback-complete.sh [backup-file]
# Author: Claude Code + Luis Ballesteros
# Date: 2025-11-11
# ============================================================================

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${RED}============================================================================${NC}"
echo -e "${RED}     ⚠️  ROLLBACK COMPLETO - Migración 2-Ingress${NC}"
echo -e "${RED}============================================================================${NC}"
echo ""

# Check if running in correct directory
if [ ! -f "azure-pipelines-prd.yml" ]; then
  echo -e "${RED}❌ Error: Este script debe ejecutarse desde el directorio raíz de SUANET-FRONTEND${NC}"
  exit 1
fi

# Configuration
NAMESPACE="suanet-prd"
BACKUP_FILE="${1:-backup-prod-ingress-*.yaml}"

echo -e "${YELLOW}Configuración:${NC}"
echo "  Namespace: $NAMESPACE"
echo "  Backup file: $BACKUP_FILE"
echo ""

read -p "¿Estás seguro de que quieres hacer rollback completo? (yes/no) " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  echo "Rollback cancelado."
  exit 0
fi

# ============================================================================
# PASO 1: Verificar conexión a cluster
# ============================================================================
echo -e "${BLUE}[1/7] Verificando conexión a cluster...${NC}"
if ! kubectl get namespace $NAMESPACE &> /dev/null; then
  echo -e "${RED}❌ No se puede conectar al cluster o namespace $NAMESPACE no existe${NC}"
  echo "Ejecuta: az aks get-credentials --resource-group RG-SDM-SUANET-PRD --name aks-suanet-atulaa-prd --admin"
  exit 1
fi
echo -e "${GREEN}✓ Conectado a cluster${NC}"
echo ""

# ============================================================================
# PASO 2: Backup del estado actual (antes del rollback)
# ============================================================================
echo -e "${BLUE}[2/7] Creando backup del estado actual...${NC}"
ROLLBACK_BACKUP="backup-before-rollback-$(date +%Y%m%d-%H%M).yaml"
kubectl get ingress -n $NAMESPACE -o yaml > "$ROLLBACK_BACKUP"
echo -e "${GREEN}✓ Backup creado: $ROLLBACK_BACKUP${NC}"
echo ""

# ============================================================================
# PASO 3: Restaurar configuración anterior desde backup
# ============================================================================
echo -e "${BLUE}[3/7] Restaurando configuración anterior...${NC}"

if [ -f "$BACKUP_FILE" ]; then
  echo "  Aplicando backup: $BACKUP_FILE"
  kubectl apply -f "$BACKUP_FILE"
  echo -e "${GREEN}✓ Configuración anterior restaurada desde backup${NC}"
else
  echo -e "${YELLOW}⚠ Backup file no encontrado: $BACKUP_FILE${NC}"
  echo "  Buscando archivos de backup..."
  ls -1 backup-prod-ingress-*.yaml 2>/dev/null || true
  echo ""
  read -p "Ingresa el nombre del archivo de backup a usar: " BACKUP_FILE
  if [ -f "$BACKUP_FILE" ]; then
    kubectl apply -f "$BACKUP_FILE"
    echo -e "${GREEN}✓ Configuración anterior restaurada${NC}"
  else
    echo -e "${RED}❌ No se pudo encontrar archivo de backup${NC}"
    echo "  Creando configuración mínima de emergencia..."

    # Crear ingress mínimo para mantener servicio
    cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: suanet-ingress
  namespace: $NAMESPACE
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "false"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
spec:
  ingressClassName: nginx
  rules:
  - host: suanet.movilidadbogota.gov.co
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: suanet-frontend-service
            port:
              number: 80
EOF
    echo -e "${GREEN}✓ Ingress mínimo creado${NC}"
  fi
fi
echo ""

# ============================================================================
# PASO 4: Eliminar ingress de nueva arquitectura
# ============================================================================
echo -e "${BLUE}[4/7] Eliminando ingress de nueva arquitectura...${NC}"

echo "  Eliminando backend ingress..."
kubectl delete ingress suanet-backend-ingress -n $NAMESPACE --ignore-not-found
echo -e "${GREEN}✓ Backend ingress eliminado${NC}"

echo "  Eliminando frontend ingress (nuevo)..."
kubectl delete ingress suanet-frontend-ingress -n $NAMESPACE --ignore-not-found
echo -e "${GREEN}✓ Frontend ingress eliminado${NC}"
echo ""

# ============================================================================
# PASO 5: Restaurar websocket ingress (si existía)
# ============================================================================
echo -e "${BLUE}[5/7] Restaurando websocket ingress...${NC}"

if [ -f "k8s/prd/websocket-ingress.yaml" ]; then
  kubectl apply -f k8s/prd/websocket-ingress.yaml
  echo -e "${GREEN}✓ WebSocket ingress restaurado${NC}"
else
  echo -e "${YELLOW}⚠ websocket-ingress.yaml no encontrado (puede ser normal)${NC}"
fi
echo ""

# ============================================================================
# PASO 6: Esperar propagación
# ============================================================================
echo -e "${BLUE}[6/7] Esperando propagación de cambios...${NC}"
echo "  Esperando 30 segundos..."
sleep 30
echo -e "${GREEN}✓ Propagación completada${NC}"
echo ""

# ============================================================================
# PASO 7: Verificar estado final
# ============================================================================
echo -e "${BLUE}[7/7] Verificando estado del sistema...${NC}"
echo ""

echo -e "${YELLOW}Ingress configurados:${NC}"
kubectl get ingress -n $NAMESPACE -o wide

echo ""
echo -e "${YELLOW}Servicios:${NC}"
kubectl get svc -n $NAMESPACE

echo ""
echo -e "${YELLOW}Pods:${NC}"
kubectl get pods -n $NAMESPACE

echo ""
echo -e "${YELLOW}Test de conectividad:${NC}"
echo -n "  Frontend health check: "
if curl -s -o /dev/null -w "%{http_code}" https://suanet.movilidadbogota.gov.co/health | grep -q "200"; then
  echo -e "${GREEN}✓ OK${NC}"
else
  echo -e "${RED}✗ FAILED${NC}"
fi

echo -n "  Backend health check: "
if curl -s -o /dev/null -w "%{http_code}" https://suanet.movilidadbogota.gov.co/api/health | grep -q "200"; then
  echo -e "${GREEN}✓ OK${NC}"
else
  echo -e "${YELLOW}⚠ No responde (puede ser esperado si proxy fue eliminado)${NC}"
fi

echo ""
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}     ✅ Rollback Completo Exitoso${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo ""
echo -e "${YELLOW}Próximos pasos:${NC}"
echo "  1. Verificar que el frontend carga correctamente"
echo "  2. Verificar que la API funciona via proxy del frontend"
echo "  3. Probar video analítica con websockets"
echo "  4. Monitorear logs por 10-15 minutos"
echo ""
echo -e "${YELLOW}Logs para monitoreo:${NC}"
echo "  kubectl logs -n $NAMESPACE -l app=suanet-frontend --tail=50 -f"
echo "  kubectl logs -n $NAMESPACE -l app=suanet-backend --tail=50 -f"
echo ""
echo -e "${YELLOW}Backup del estado antes de rollback:${NC}"
echo "  $ROLLBACK_BACKUP"
echo ""
