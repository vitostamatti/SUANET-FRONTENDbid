# Scripts de Utilidad - SUANET Frontend

Scripts de automatización para operaciones comunes en producción.

---

## 📜 Scripts Disponibles

### 1. `enable-websocket-production.sh`

**Propósito**: Configurar soporte de websockets en producción

**Uso**:
```bash
./scripts/enable-websocket-production.sh
```

**Qué hace**:
- Habilita session affinity en Azure Front Door
- Despliega websocket ingress en AKS
- Verifica configuración completa

**Cuándo usar**:
- Primera vez configurando websockets
- Después de cambios en Front Door
- Para verificar estado de websockets

**Documentación**: `docs/fix-websocket-production.md`

---

### 2. `rollback-quick.sh`

**Propósito**: Rollback rápido de configuración de ingress (< 1 minuto)

**Uso**:
```bash
./scripts/rollback-quick.sh [backup-file]
# O dejar que encuentre el backup más reciente:
./scripts/rollback-quick.sh
```

**Qué hace**:
- Restaura configuración de ingress desde backup
- Espera propagación (30s)
- Verifica conectividad básica

**Cuándo usar**:
- Problema inmediato después de cambio de ingress
- Errores 5xx o servicio down
- Necesitas revertir AHORA

**Tiempo**: ~1 minuto

---

### 3. `rollback-complete.sh`

**Propósito**: Rollback completo de migración a 2-ingress (< 5 minutos)

**Uso**:
```bash
./scripts/rollback-complete.sh [backup-file]
```

**Qué hace**:
- Crea backup del estado actual
- Restaura configuración anterior completa
- Elimina ingress de nueva arquitectura
- Restaura websocket ingress (si existía)
- Verifica estado del sistema completo
- Ejecuta tests de conectividad

**Cuándo usar**:
- Múltiples problemas después de migración
- Necesitas volver completamente a arquitectura anterior
- Problemas que rollback-quick.sh no resuelve

**Tiempo**: ~5 minutos

**Requiere**: Archivo de backup de configuración anterior

---

## 🔄 Flujo de Rollback Recomendado

### Problema Menor (API lenta, intermitente)
1. Monitorear logs
2. Verificar métricas
3. NO hacer rollback inmediato
4. Investigar causa raíz

### Problema Medio (Algunos usuarios afectados)
1. **Ejecutar**: `rollback-quick.sh`
2. Verificar si problema se resolvió
3. Si NO: Ejecutar `rollback-complete.sh`
4. Investigar causa raíz

### Problema Crítico (Servicio down, errores 5xx)
1. **Ejecutar inmediatamente**: `rollback-quick.sh`
2. Si NO resuelve en 2 min: `rollback-complete.sh`
3. Notificar equipo
4. Investigar causa raíz

---

## 📋 Pre-requisitos

Antes de ejecutar cualquier script:

```bash
# 1. Conectar a cluster de producción
az aks get-credentials \
  --resource-group RG-SDM-SUANET-PRD \
  --name aks-suanet-atulaa-prd \
  --admin

# 2. Verificar conexión
kubectl get namespace suanet-prd

# 3. Verificar que existe backup
ls -l backup-prod-ingress-*.yaml
```

---

## 🛡️ Seguridad

- ✅ Scripts solo modifican configuración de Kubernetes (ingress)
- ✅ NO modifican pods, deployments o servicios
- ✅ Crean backups antes de cambios
- ✅ Requieren confirmación explícita
- ✅ Safe para ejecutar múltiples veces

---

## 📚 Documentación Relacionada

- **Plan de migración completo**: `docs/migration-plan-2-ingress-architecture.md`
- **Resumen ejecutivo**: `docs/migration-2-ingress-resumen-ejecutivo.md`
- **Fix websockets**: `docs/fix-websocket-production.md`

---

## 🆘 Ayuda

Si tienes problemas con los scripts:

1. Verificar que estás conectado al cluster correcto
2. Verificar que tienes permisos de admin
3. Revisar logs del script (stderr)
4. Consultar documentación en `docs/`

---

**Última actualización**: 2025-11-11
**Autor**: Claude Code + Luis Ballesteros
