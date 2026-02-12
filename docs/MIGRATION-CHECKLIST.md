# Checklist de Implementación: Migración 2-Ingress

**Imprimir esta página y marcar cada paso al completarlo**

---

## 📅 Pre-Implementación

```
□ Revisar plan completo (migration-plan-2-ingress-architecture.md)
□ Equipo notificado de la migración
□ Ventana de mantenimiento coordinada (fecha/hora)
□ Tiempo disponible: mínimo 3-5 días
□ Sistema estable (no hay incidentes críticos)
□ Periodo de baja demanda confirmado
```

---

## 🔧 Fase 1: Preparación (2-3 horas)

### Backups

```
□ Conectar a cluster producción
□ Crear backup ingress: backup-prod-ingress-[DATE].yaml
□ Crear backup services: backup-prod-services-[DATE].yaml
□ Documentar BACKEND_URL actual
□ Guardar backups en lugar seguro
```

### Configuraciones

```
□ Crear: k8s/prd/backend-ingress.yaml
□ Crear: k8s/prd/backend-service.yaml (si no existe)
□ Renombrar: k8s/prd/ingress.yaml → frontend-ingress.yaml
□ Crear: k8s/dev/backend-ingress.yaml
□ Crear: k8s/dev/backend-service.yaml
□ Revisar todos los archivos YAML (sintaxis correcta)
```

---

## 💻 Fase 2: Código Frontend (3-4 horas)

```
□ Decidir: ¿Eliminar o simplificar server.js?
□ Actualizar server.js (remover proxy)
□ Actualizar .env.production (BACKEND_URL)
□ Actualizar package.json (remover http-proxy)
□ Ejecutar: npm install
□ Ejecutar: npm run build (verificar build OK)
□ Test local (npm run dev)
```

---

## 🚀 Fase 3: Pipelines (1-2 horas)

```
□ Actualizar: azure-pipelines-prd.yml
□ Agregar deploy de backend-ingress.yaml
□ Actualizar deploy de frontend-ingress.yaml
□ Eliminar deploy de websocket-ingress.yaml
□ Revisar sintaxis YAML del pipeline
```

---

## 🧪 Fase 4: Testing en Dev (4-6 horas)

### Deployment Dev

```
□ Conectar a cluster dev
□ Aplicar backend service
□ Aplicar backend ingress
□ Aplicar frontend ingress
□ Verificar: kubectl get ingress -n suanet-dev
□ Verificar: kubectl get svc -n suanet-dev
```

### Tests Funcionales

```
□ Test: curl https://suanet-test.movilidadbogota.gov.co/api/health
□ Test: curl https://suanet-test.movilidadbogota.gov.co/
□ Test: Frontend carga en browser
□ Test: Login funciona
□ Test: API calls desde frontend funcionan
□ Test: WebSocket connection (node websocket_client.js)
```

### Test Video Analítica

```
□ Seleccionar cámara
□ Dibujar polígono (4 puntos)
□ Iniciar procesamiento (5 min)
□ Verificar: DevTools → Network → WS → 101 Switching Protocols
□ Verificar: Console → "Conectado al servidor WebSocket"
□ Verificar: Datos llegando en tiempo real
□ Verificar: Imágenes de debug mostrándose
□ Completar procesamiento completo
```

### Performance Testing

```
□ Medir latency API (5-10 requests)
□ Comparar con baseline anterior
□ Verificar: Igual o mejor performance
□ Test de carga (opcional): ab -n 1000 -c 10
```

### Resultado Testing Dev

```
□ TODOS los tests pasaron ✅
□ Performance igual o mejor ✅
□ WebSockets funcionan ✅
□ Sin errores en logs ✅
```

**Si algún test falla, NO continuar a producción. Investigar y resolver primero.**

---

## 🎯 Fase 5: Deployment Producción (2-3 horas)

### Pre-Deployment

```
□ Verificar: Testing dev completado 100%
□ Verificar: Backups creados
□ Verificar: Scripts de rollback listos
□ Verificar: Equipo notificado
□ Notificar: Inicio de deployment
```

### Deployment Gradual

```
□ Conectar a cluster producción
□ Crear backup final (justo antes)
□ Aplicar backend service (verificar OK)
□ Aplicar backend ingress (verificar OK)
□ Esperar 60 segundos (propagación)
□ Test: curl https://suanet.movilidadbogota.gov.co/api/health
□ Si OK, continuar. Si NO, ejecutar rollback-quick.sh
□ Aplicar frontend ingress
□ Esperar 60 segundos (propagación)
□ Eliminar ingress antiguo (suanet-ingress)
□ Eliminar websocket-ingress
□ Verificar: kubectl get ingress -n suanet-prd
```

### Verificación Inmediata

```
□ Test: curl https://suanet.movilidadbogota.gov.co/health
□ Test: curl https://suanet.movilidadbogota.gov.co/api/health
□ Test: Frontend en browser (página principal)
□ Test: Login
□ Ver logs: Frontend (sin errores)
□ Ver logs: Backend (sin errores)
□ Verificar: kubectl get pods -n suanet-prd (todos Running)
```

### Si algo falla:

```
EJECUTAR INMEDIATAMENTE: ./scripts/rollback-quick.sh
```

---

## ✅ Fase 6: Validación (1-2 horas)

### Tests Completos Producción

```
□ Test: Video analítica end-to-end
□ Test: WebSockets funcionando
□ Test: Todos los endpoints API
□ Test: Performance (latency < 25ms)
□ Verificar: No errores en logs (15 minutos)
□ Verificar: Usuarios reportan OK
```

### Monitoreo (primeras 24 horas)

```
□ Hora 1: Monitoreo activo cada 15 min
□ Hora 2-4: Monitoreo cada 30 min
□ Hora 4-24: Monitoreo cada 2 horas
□ Ver métricas: Error rate, latency, CPU, memory
```

### Cleanup (después de 1 semana estable)

```
□ Commit cambios: git add k8s/prd/*
□ Commit: git add azure-pipelines-prd.yml
□ Commit: git add server.js package.json
□ Push: git push origin prd
□ Eliminar backups locales (después de 1 semana)
□ Actualizar documentación
□ Notificar equipo: Migración exitosa
```

---

## 🆘 Contactos de Emergencia

En caso de problemas críticos:

```
□ Ejecutar: ./scripts/rollback-quick.sh
□ Si no resuelve: ./scripts/rollback-complete.sh
□ Notificar: [NOMBRE/EMAIL LÍDER TÉCNICO]
□ Escalar: [NOMBRE/EMAIL MANAGER]
```

---

## 📊 Métricas de Éxito

Después de 1 semana:

```
□ Downtime total: _____ minutos (meta: < 5 min)
□ Latency API promedio: _____ ms (meta: igual o mejor)
□ Errores reportados: _____ (meta: 0)
□ Tests de video analítica: _____ % exitosos (meta: 100%)
□ Satisfacción equipo: _____ /10
```

---

## 📝 Notas de Implementación

Fecha de implementación: __________________

Notas/Observaciones:
```
_________________________________________________________

_________________________________________________________

_________________________________________________________

_________________________________________________________
```

Problemas encontrados:
```
_________________________________________________________

_________________________________________________________

_________________________________________________________
```

Lecciones aprendidas:
```
_________________________________________________________

_________________________________________________________

_________________________________________________________
```

---

**Implementado por**: __________________
**Fecha de completación**: __________________
**Resultado**: ✅ Exitoso / ❌ Fallido / ⏸️ Rollback

---

**Documentación completa**: `docs/migration-plan-2-ingress-architecture.md`
