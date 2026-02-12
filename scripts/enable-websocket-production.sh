#!/bin/bash

# ============================================================================
# Script: Enable WebSocket Support in Production
# ============================================================================
# Purpose: Configure Azure Front Door and AKS for Socket.IO WebSocket support
# Environment: Production (suanet-prd)
# Author: Claude Code + Luis Ballesteros
# Date: 2025-11-10
# ============================================================================

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="RG-SDM-SUANET-PRD"
AFD_PROFILE="fd-suanet-atulaa-prd"
ORIGIN_GROUP="suanet"
AKS_CLUSTER="aks-suanet-atulaa-prd"
NAMESPACE="suanet-prd"

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}     SUANET Production - Enable WebSocket Support${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# ============================================================================
# STEP 1: Check current session affinity state
# ============================================================================
echo -e "${YELLOW}[1/4] Checking current Azure Front Door configuration...${NC}"
CURRENT_STATE=$(az afd origin-group show \
  --profile-name "$AFD_PROFILE" \
  --origin-group-name "$ORIGIN_GROUP" \
  --resource-group "$RESOURCE_GROUP" \
  --query "sessionAffinityState" -o tsv)

echo "   Current session affinity state: $CURRENT_STATE"

if [ "$CURRENT_STATE" == "Enabled" ]; then
  echo -e "   ${GREEN}✓ Session affinity already enabled${NC}"
else
  echo -e "   ${YELLOW}⚠ Session affinity is DISABLED (needed for websockets)${NC}"
  read -p "   Enable session affinity now? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   Enabling session affinity..."
    az afd origin-group update \
      --profile-name "$AFD_PROFILE" \
      --origin-group-name "$ORIGIN_GROUP" \
      --resource-group "$RESOURCE_GROUP" \
      --session-affinity-state Enabled \
      --output none

    echo -e "   ${GREEN}✓ Session affinity enabled${NC}"
    echo -e "   ${YELLOW}⏱ Note: Changes take ~5 minutes to propagate globally${NC}"
  else
    echo -e "   ${RED}✗ Skipped. WebSockets may not work without session affinity!${NC}"
  fi
fi

echo ""

# ============================================================================
# STEP 2: Get AKS credentials
# ============================================================================
echo -e "${YELLOW}[2/4] Connecting to AKS cluster...${NC}"
az aks get-credentials \
  --resource-group "$RESOURCE_GROUP" \
  --name "$AKS_CLUSTER" \
  --admin \
  --overwrite-existing \
  --output none

echo -e "   ${GREEN}✓ Connected to $AKS_CLUSTER${NC}"
echo ""

# ============================================================================
# STEP 3: Check if websocket ingress exists
# ============================================================================
echo -e "${YELLOW}[3/4] Checking websocket ingress in AKS...${NC}"

if kubectl get ingress suanet-websocket-ingress -n "$NAMESPACE" &> /dev/null; then
  echo -e "   ${GREEN}✓ WebSocket ingress already exists${NC}"
  kubectl get ingress suanet-websocket-ingress -n "$NAMESPACE" -o wide
else
  echo -e "   ${YELLOW}⚠ WebSocket ingress does NOT exist${NC}"
  read -p "   Deploy websocket ingress now? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   Deploying websocket-ingress.yaml..."
    kubectl apply -f ../k8s/prd/websocket-ingress.yaml
    echo -e "   ${GREEN}✓ WebSocket ingress deployed${NC}"
  else
    echo -e "   ${RED}✗ Skipped. WebSockets will not work without this ingress!${NC}"
  fi
fi

echo ""

# ============================================================================
# STEP 4: Verification
# ============================================================================
echo -e "${YELLOW}[4/4] Verifying configuration...${NC}"
echo ""

echo -e "${BLUE}Frontend Door Configuration:${NC}"
az afd origin-group show \
  --profile-name "$AFD_PROFILE" \
  --origin-group-name "$ORIGIN_GROUP" \
  --resource-group "$RESOURCE_GROUP" \
  --query "{SessionAffinity:sessionAffinityState, HealthProbe:healthProbeSettings.probePath, LoadBalancing:loadBalancingSettings}" \
  -o table

echo ""
echo -e "${BLUE}AKS Ingress Configuration:${NC}"
kubectl get ingress -n "$NAMESPACE" -o wide

echo ""
echo -e "${BLUE}Backend Service:${NC}"
kubectl get service suanet-backend-service -n "$NAMESPACE"

echo ""
echo -e "${BLUE}Backend Pods:${NC}"
kubectl get pods -n "$NAMESPACE" -l app=suanet-backend -o wide

echo ""
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}     Configuration Complete!${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Wait ~5 minutes for Azure Front Door changes to propagate"
echo "  2. Test websocket connection:"
echo "     - Open: https://suanet.movilidadbogota.gov.co"
echo "     - Open DevTools → Network tab → WS filter"
echo "     - Start video analytics processing"
echo "     - Verify '101 Switching Protocols' appears"
echo ""
echo -e "${YELLOW}Troubleshooting:${NC}"
echo "  - View logs: kubectl logs -n $NAMESPACE -l app=suanet-backend --tail=50"
echo "  - Check events: kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp' | head -20"
echo "  - Documentation: docs/fix-websocket-production.md"
echo ""
