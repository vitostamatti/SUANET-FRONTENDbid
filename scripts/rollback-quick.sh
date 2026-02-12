#!/bin/bash

# ============================================================================
# Script: Rollback Rápido de Migración 2-Ingress
# ============================================================================
# Purpose: Revertir rápidamente solo la configuración de ingress (< 1 min)
# Usage: ./scripts/rollback-quick.sh [backup-file]
# Author: Claude Code + Luis Ballesteros
# Date: 2025-11-11
# ============================================================================

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}⚠️  ROLLBACK RÁPIDO - Restaurando ingress anterior${NC}"

# Configuration
NAMESPACE="suanet-prd"
BACKUP_FILE="${1:-backup-prod-ingress-*.yaml}"

# Find most recent backup if wildcard
if [[ "$BACKUP_FILE" == *"*"* ]]; then
  BACKUP_FILE=$(ls -t backup-prod-ingress-*.yaml 2>/dev/null | head -1)
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo -e "${RED}❌ No se encontró archivo de backup${NC}"
  echo "Archivos disponibles:"
  ls -1 backup-prod-ingress-*.yaml 2>/dev/null || echo "  (ninguno)"
  exit 1
fi

echo "Restaurando desde: $BACKUP_FILE"
echo ""

# Apply backup
kubectl apply -f "$BACKUP_FILE"

echo ""
echo "Esperando propagación (30s)..."
sleep 30

# Verify
echo ""
echo "Verificando..."
kubectl get ingress -n $NAMESPACE

echo ""
curl -I https://suanet.movilidadbogota.gov.co/health

echo ""
echo -e "${GREEN}✅ Rollback rápido completado${NC}"
