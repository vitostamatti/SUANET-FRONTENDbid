#!/bin/bash
# Setup ACR Secret for ETL Project
# This script ensures that the acr-secret exists in the Kubernetes namespace
# Required for pulling Docker images from Azure Container Registry (ACR)
#
# Usage:
#   ./setup-acr-secret.sh         # Interactive mode
#   ./setup-acr-secret.sh --yes   # Non-interactive mode (for CI/CD)

set -e

# Parse arguments
NON_INTERACTIVE=false
if [[ "$1" == "--yes" ]] || [[ "$1" == "-y" ]]; then
    NON_INTERACTIVE=true
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
ACR_NAME="crsuanetsdmdev"
NAMESPACE="suanet-dev"
SECRET_NAME="acr-secret"

echo "=========================================="
echo "SUANET-FRONTEND - ACR Secret Setup"
echo "=========================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl not found${NC}"
    echo "Please install kubectl: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi
echo -e "${GREEN}✓ kubectl found${NC}"

if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI not found${NC}"
    echo "Please install Azure CLI: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi
echo -e "${GREEN}✓ Azure CLI found${NC}"

echo ""

# Check if namespace exists
echo "Checking if namespace '$NAMESPACE' exists..."
if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
    echo -e "${YELLOW}⚠️  Namespace '$NAMESPACE' does not exist${NC}"
    if [ "$NON_INTERACTIVE" = true ]; then
        echo "Creating namespace (non-interactive mode)..."
        kubectl create namespace "$NAMESPACE"
        echo -e "${GREEN}✓ Namespace created${NC}"
    else
        read -p "Do you want to create it? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kubectl create namespace "$NAMESPACE"
            echo -e "${GREEN}✓ Namespace created${NC}"
        else
            echo -e "${RED}Cannot proceed without namespace${NC}"
            exit 1
        fi
    fi
else
    echo -e "${GREEN}✓ Namespace exists${NC}"
fi

echo ""

# Check if secret already exists
echo "Checking if secret '$SECRET_NAME' exists in namespace '$NAMESPACE'..."
if kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" &> /dev/null; then
    echo -e "${YELLOW}⚠️  Secret '$SECRET_NAME' already exists${NC}"
    echo ""
    kubectl get secret "$SECRET_NAME" -n "$NAMESPACE"
    echo ""
    if [ "$NON_INTERACTIVE" = true ]; then
        echo "Recreating secret (non-interactive mode)..."
        kubectl delete secret "$SECRET_NAME" -n "$NAMESPACE"
        echo -e "${GREEN}✓ Secret deleted${NC}"
    else
        read -p "Do you want to recreate it? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "Deleting existing secret..."
            kubectl delete secret "$SECRET_NAME" -n "$NAMESPACE"
            echo -e "${GREEN}✓ Secret deleted${NC}"
        else
            echo -e "${GREEN}✓ Using existing secret${NC}"
            exit 0
        fi
    fi
fi

echo ""

# Get ACR credentials
echo "Retrieving ACR credentials from Azure..."
ACR_PASSWORD=$(az acr credential show -n "$ACR_NAME" --query "passwords[0].value" -o tsv 2>&1)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to retrieve ACR credentials${NC}"
    echo "$ACR_PASSWORD"
    echo ""
    echo "Make sure you are logged in to Azure CLI:"
    echo "  az login"
    exit 1
fi

echo -e "${GREEN}✓ ACR credentials retrieved${NC}"

echo ""

# Create the secret
echo "Creating Docker registry secret..."
kubectl create secret docker-registry "$SECRET_NAME" \
  --docker-server="${ACR_NAME}.azurecr.io" \
  --docker-username="$ACR_NAME" \
  --docker-password="$ACR_PASSWORD" \
  -n "$NAMESPACE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Secret created successfully${NC}"
else
    echo -e "${RED}❌ Failed to create secret${NC}"
    exit 1
fi

echo ""

# Verify the secret
echo "Verifying secret..."
kubectl get secret "$SECRET_NAME" -n "$NAMESPACE"

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Setup completed successfully!${NC}"
echo "=========================================="
echo ""
echo "The secret '$SECRET_NAME' is now configured in namespace '$NAMESPACE'"
echo "Your deployments can now pull images from ${ACR_NAME}.azurecr.io"
echo ""
echo "Make sure your deployment.yaml includes:"
echo "  spec:"
echo "    template:"
echo "      spec:"
echo "        imagePullSecrets:"
echo "        - name: $SECRET_NAME"
echo ""
