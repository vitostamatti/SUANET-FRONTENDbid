# SUANET Health Check Script

Script automatizado de diagnóstico rápido (5 minutos) para verificar el estado de SUANET en producción.

## 📋 ¿Qué hace este script?

Ejecuta **5 tests críticos** en orden:

1. **DNS Resolution** - Verifica que el dominio resuelve correctamente a Azure Front Door
2. **HTTPS Connectivity** - Verifica que HTTPS responde con 200 OK
3. **HTTP → HTTPS Redirect** - Verifica que HTTP redirige a HTTPS (seguridad)
4. **SSL Certificate Validation** - Valida el certificado y fecha de expiración
5. **Application Response** - Verifica que la aplicación Next.js está respondiendo

## 🚀 Uso Rápido

```bash
# Ejecución básica
./suanet-health-check.sh

# Con output detallado (verbose)
./suanet-health-check.sh --verbose

# Formato JSON para automatización/CI-CD
./suanet-health-check.sh --json

# Ver ayuda
./suanet-health-check.sh --help
```

## 📊 Ejemplos de Output

### Output Normal (Humano)

```bash
$ ./suanet-health-check.sh

╔════════════════════════════════════════════════════════════════╗
║  SUANET Production Health Check - Test de 5 Minutos           ║
╚════════════════════════════════════════════════════════════════╝
Dominio: suanet.movilidadbogota.gov.co
Timestamp: 2025-11-27T15:48:28Z

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST 1/5: DNS Resolution
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ CNAME correcto: suanet-hfaqd8ckefasepez.z01.azurefd.net
✓ IP encontrada: 13.107.213.41
✓ IP encontrada: 13.107.246.41

...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REPORTE FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Duración: 1s
Tests ejecutados: 5
Tests pasados: 5
Tests fallidos: 0

╔════════════════════════════════════════════╗
║  ✓ SISTEMA OPERATIVO AL 100%              ║
╚════════════════════════════════════════════╝

Todos los tests pasaron exitosamente.
SUANET está funcionando correctamente.
```

### Output JSON (Automatización)

```bash
$ ./suanet-health-check.sh --json

{
  "timestamp": "2025-11-27T15:48:39Z",
  "domain": "suanet.movilidadbogota.gov.co",
  "duration_seconds": 2,
  "tests_passed": 5,
  "tests_failed": 0,
  "tests_total": 5,
  "overall_status": "HEALTHY",
  "results": [
    {
      "test": "dns_resolution",
      "status": "PASS",
      "message": "DNS resuelve correctamente a Azure Front Door",
      "details": "CNAME: suanet-hfaqd8ckefasepez.z01.azurefd.net, IPs: 2/2"
    },
    {
      "test": "https_connectivity",
      "status": "PASS",
      "message": "HTTPS responde correctamente",
      "details": "HTTP 200, tiempo: 0.277832s"
    },
    ...
  ]
}
```

## 🔄 Exit Codes

El script retorna códigos de salida estándar para integración con CI/CD:

| Exit Code | Significado | Acción |
|-----------|-------------|--------|
| `0` | ✅ Todos los tests pasaron | Sistema OK |
| `1` | ❌ Al menos un test falló | Requiere diagnóstico |
| `2` | ⚠️ Error en el script | Verificar parámetros |

### Ejemplo de uso en CI/CD

```bash
#!/bin/bash

# Ejecutar health check
./suanet-health-check.sh --json > health-report.json

# Verificar exit code
if [ $? -eq 0 ]; then
    echo "✓ Health check passed - deploying..."
    # Continuar con deployment
else
    echo "✗ Health check failed - aborting deployment"
    cat health-report.json
    exit 1
fi
```

## 📁 Guardar Resultados

```bash
# Guardar log con timestamp
./suanet-health-check.sh --verbose > "health-check-$(date +%Y%m%d-%H%M%S).log"

# Guardar JSON para análisis posterior
./suanet-health-check.sh --json | jq '.' > health-report-$(date +%Y%m%d).json

# Monitoreo continuo (cada 5 minutos)
watch -n 300 './suanet-health-check.sh'
```

## 🔧 Troubleshooting

### Si DNS falla

```
✗ CNAME incorrecto o no encontrado
```

**Solución:**
1. Verificar con el administrador del registrador DNS
2. El CNAME debe ser: `suanet-hfaqd8ckefasepez.z01.azurefd.net`
3. Esperar propagación DNS (15 min - 48 hrs)

### Si HTTPS falla

```
✗ No se pudo conectar via HTTPS
```

**Solución:**
1. Verificar que Azure Front Door está activo
2. Verificar que el origin (20.72.153.153) está respondiendo
3. Ejecutar diagnóstico completo (ver documentación)

### Si SSL falla

```
✗ Certificado expirado o fecha inválida
```

**Solución:**
1. Renovar certificado wildcard `*.movilidadbogota.gov.co`
2. Actualizar en Azure Front Door
3. Contactar equipo de seguridad

### Si la aplicación no responde

```
✗ No se recibió respuesta de la aplicación
```

**Solución:**
1. Verificar pods de frontend: `kubectl get pods -n suanet-prd`
2. Revisar logs: `kubectl logs -n suanet-prd <pod-name>`
3. Ver sección "Paso 5" en el documento de diagnóstico completo

## 📚 Documentación Completa

Para diagnóstico paso a paso detallado, consultar:

```
/home/lballesterosp/ALL/SUANET-FRONTEND/docs/PRODUCTION_TESTING_PROTOCOL.md
```

Este documento incluye:
- Arquitectura completa con diagramas
- Diagnóstico paso a paso (7 pasos)
- Troubleshooting por síntoma
- Comandos de emergencia
- Contactos para escalamiento

## 🤖 Uso desde IA

Este script está diseñado para ser ejecutado por IAs durante diagnósticos:

```
"El sitio suanet.movilidadbogota.gov.co no carga. 
Ejecuta /home/lballesterosp/ALL/SUANET-FRONTEND/scripts/suanet-health-check.sh 
y analiza los resultados."
```

La IA recibirá output estructurado que puede parsear y determinar:
- Qué componente falló
- Causa probable
- Pasos siguientes

## ⏱️ Tiempos Esperados

- **Ejecución normal:** 1-3 segundos
- **Con --verbose:** 2-5 segundos
- **Con problemas de red:** Hasta 60 segundos (timeouts)

## 🔐 Permisos Requeridos

El script NO requiere permisos especiales:
- ✅ No necesita sudo
- ✅ No necesita acceso a Azure CLI
- ✅ No necesita acceso a kubectl
- ✅ Solo necesita: curl, nslookup, openssl, date

## 📞 Soporte

Si el script falla o necesitas ayuda:

1. **Nivel 1 - DevOps:** desarrollos.sgm@movilidadbogota.gov.co
2. **Nivel 2 - Infraestructura:** lballesterosp@movilidadbogota.gov.co
3. **Documentación:** Ver `PRODUCTION_TESTING_PROTOCOL.md`

---

**Versión:** 1.0  
**Última actualización:** 2025-11-27  
**Mantenido por:** Equipo DevOps SDM
