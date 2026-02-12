# ACR Secret Setup - SUANET-FRONTEND Project

## Overview

This project pulls Docker images from Azure Container Registry (ACR): `crsuanetsdmdev.azurecr.io`

To allow Kubernetes to pull these images, we need to configure authentication credentials as a Kubernetes secret called `acr-secret`.

## Why Do We Need This?

When you create an AKS cluster, the `--attach-acr` parameter is supposed to automatically grant the cluster permission to pull images from ACR. However, this often fails due to permission issues.

**The reliable alternative:** Use Kubernetes `imagePullSecrets` - a standard mechanism that works consistently without requiring elevated Azure permissions.

## Quick Start

### 1. Run the Setup Script

```bash
./scripts/setup-acr-secret.sh
```

The script will:
- ✅ Check prerequisites (kubectl, Azure CLI)
- ✅ Verify namespace exists (creates if needed)
- ✅ Check if secret already exists
- ✅ Retrieve ACR credentials from Azure
- ✅ Create the Kubernetes secret
- ✅ Verify the setup

### 2. Verify the Secret Exists

```bash
kubectl get secret acr-secret -n suanet-dev
```

Expected output:
```
NAME         TYPE                             DATA   AGE
acr-secret   kubernetes.io/dockerconfigjson   1      5m
```

### 3. Check Your Deployment Configuration

Your `deployment.yaml` should include:

```yaml
spec:
  template:
    spec:
      imagePullSecrets:
      - name: acr-secret
      containers:
      - name: suanet-frontend
        image: crsuanetsdmdev.azurecr.io/suanet-frontend-dev:latest
```

✅ **This configuration is already present in this project's deployment.yaml**

## Manual Setup (Alternative)

If you prefer to run commands manually:

```bash
# 1. Get ACR credentials
ACR_PASSWORD=$(az acr credential show -n crsuanetsdmdev --query "passwords[0].value" -o tsv)

# 2. Create the secret
kubectl create secret docker-registry acr-secret \
  --docker-server=crsuanetsdmdev.azurecr.io \
  --docker-username=crsuanetsdmdev \
  --docker-password=$ACR_PASSWORD \
  -n suanet-dev

# 3. Verify
kubectl get secret acr-secret -n suanet-dev
```

## Recreating the Secret

If you need to recreate the secret (e.g., after password rotation):

```bash
# Option 1: Use the script (it will prompt to recreate)
./scripts/setup-acr-secret.sh

# Option 2: Manual deletion and recreation
kubectl delete secret acr-secret -n suanet-dev
./scripts/setup-acr-secret.sh
```

## Troubleshooting

### Error: "ImagePullBackOff"

If you see this error in pod status:

```bash
kubectl get pods -n suanet-dev
# NAME                             READY   STATUS             RESTARTS   AGE
# suanet-frontend-deployment-xxx               0/1     ImagePullBackOff   0          2m
```

**Solution:**
1. Check if secret exists: `kubectl get secret acr-secret -n suanet-dev`
2. If missing, run: `./scripts/setup-acr-secret.sh`
3. Verify deployment has `imagePullSecrets` configured
4. Restart the deployment: `kubectl rollout restart deployment/suanet-frontend-deployment -n suanet-dev`

### Error: "Failed to retrieve ACR credentials"

**Cause:** Not logged into Azure CLI

**Solution:**
```bash
az login
# Or if using service principal:
az login --service-principal -u <app-id> -p <password> --tenant <tenant-id>
```

### Secret Exists But Pods Still Can't Pull Images

**Possible causes:**
1. Secret is in wrong namespace
2. Deployment doesn't reference the secret
3. ACR credentials have been rotated

**Solution:**
```bash
# Recreate the secret with fresh credentials
kubectl delete secret acr-secret -n suanet-dev
./scripts/setup-acr-secret.sh

# Restart pods to use new secret
kubectl rollout restart deployment/suanet-frontend-deployment -n suanet-dev
```

## Technical Details

### What is imagePullSecrets?

`imagePullSecrets` is a standard Kubernetes mechanism for authenticating with private container registries. It works by:

1. Storing Docker registry credentials in a Kubernetes secret
2. Referencing that secret in pod specifications
3. Kubelet uses those credentials when pulling images

### Why Not Use --attach-acr?

The `az aks create --attach-acr` command should automatically grant AKS permission to pull from ACR, but:

- ❌ Often requires elevated permissions (role assignment creation)
- ❌ May fail silently
- ❌ Requires coordination with Azure administrators

**imagePullSecrets approach:**
- ✅ Works with standard developer permissions
- ✅ Consistent and predictable
- ✅ No dependency on Azure administrators
- ✅ Industry-standard Kubernetes practice

### Security Considerations

- The `acr-secret` contains sensitive credentials
- Only exists in the Kubernetes cluster (not in Git)
- Scoped to a single namespace (suanet-dev)
- Can be rotated independently of AKS cluster

## CI/CD Integration

When using Azure DevOps pipelines, the secret creation can be automated:

```yaml
- task: AzureCLI@2
  displayName: 'Setup ACR Secret'
  inputs:
    azureSubscription: 'SCSuanetDev'
    scriptType: 'bash'
    scriptLocation: 'scriptPath'
    scriptPath: './scripts/setup-acr-secret.sh'
```

Or inline in the pipeline:
```yaml
- script: |
    ACR_PASSWORD=$(az acr credential show -n crsuanetsdmdev --query "passwords[0].value" -o tsv)
    kubectl delete secret acr-secret -n suanet-dev --ignore-not-found=true
    kubectl create secret docker-registry acr-secret \
      --docker-server=crsuanetsdmdev.azurecr.io \
      --docker-username=crsuanetsdmdev \
      --docker-password=$ACR_PASSWORD \
      -n suanet-dev
  displayName: 'Create ACR Secret'
```

## Resources

- [Kubernetes imagePullSecrets Documentation](https://kubernetes.io/docs/concepts/containers/images/#specifying-imagepullsecrets-on-a-pod)
- [Azure Container Registry Authentication](https://docs.microsoft.com/en-us/azure/container-registry/container-registry-authentication)
- [AKS and ACR Integration](https://docs.microsoft.com/en-us/azure/aks/cluster-container-registry-integration)
