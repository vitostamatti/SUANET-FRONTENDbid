# Bypass de Autenticación para Browser Automation

## Descripción

Este documento describe cómo utilizar el endpoint `/api/auth/bypass-simple` para autenticarse en SUANET sin pasar por Google OAuth ni la verificación de Cloudflare. Este método es útil para:

- **Browser automation** con MCP (Model Context Protocol)
- **Testing automatizado** de la aplicación
- **Integración con herramientas de CI/CD**

---

## Requisitos Previos

### 1. Variable de Entorno

El secreto `BYPASS_SIMPLE_SECRET` debe estar configurado en:

- **Azure DevOps**: Variable group `suanet-backend-secrets-dev`
- **Kubernetes**: Secret `suanet-backend-secret` en namespace `suanet-dev`

> **Nota**: El valor actual del secreto se genera con `openssl rand -base64 24` y debe mantenerse confidencial.

---

## Uso del Endpoint

### Endpoint

```
POST /api/auth/bypass-simple
```

### Request

```bash
curl -X POST https://suanet-test.movilidadbogota.gov.co/api/auth/bypass-simple \
  -H "Content-Type: application/json" \
  -d '{"secret": "TU_BYPASS_SIMPLE_SECRET"}'
```

### Response Exitosa (200)

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "usuario@ejemplo.com",
    "nombre": "Nombre Usuario",
    "avatar_url": "https://...",
    "rol": "Administrador",
    "permisos": [],
    "activo": true
  },
  "session_id": 123
}
```

### Responses de Error

| Código | Mensaje | Causa |
|--------|---------|-------|
| 403 | "Secreto inválido" | El secreto proporcionado no coincide |
| 404 | "No hay usuarios activos" | No existe ningún usuario activo en la base de datos |
| 500 | "Bypass no configurado" | `BYPASS_SIMPLE_SECRET` no está en variables de entorno |

---

## Flujo de Autenticación

### Opción A: Usando el Token Directamente (Recomendado)

1. **Obtener token** del endpoint bypass-simple
2. **Almacenar en cookie** `suanet_token`
3. **Navegar** a la aplicación

```javascript
// Ejemplo con Puppeteer/Playwright
const response = await fetch('https://suanet-test.movilidadbogota.gov.co/api/auth/bypass-simple', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ secret: 'TU_SECRET' })
});

const { token } = await response.json();

// Establecer cookie en el navegador
await page.setCookie({
  name: 'suanet_token',
  value: token,
  domain: 'suanet-test.movilidadbogota.gov.co',
  path: '/',
  httpOnly: false,
  secure: true,
  sameSite: 'Lax'
});

// Navegar al dashboard
await page.goto('https://suanet-test.movilidadbogota.gov.co/');
```

### Opción B: Usando localStorage (Frontend)

El frontend soporta recibir el token via `localStorage`:

```javascript
// El frontend detectará este token y lo usará automáticamente
localStorage.setItem('bypass_auth_token', token);

// Luego navegar a la página principal
window.location.href = '/';
```

---

## Ejemplo Completo con MCP Browser Automation

### 1. Obtener Token

```bash
# Usando curl para obtener el token
TOKEN=$(curl -s -X POST https://suanet-test.movilidadbogota.gov.co/api/auth/bypass-simple \
  -H "Content-Type: application/json" \
  -d '{"secret": "TU_SECRET"}' | jq -r '.token')

echo "Token obtenido: ${TOKEN:0:50}..."
```

### 2. Usar con MCP Browser Automation

Una vez que tengas el token, puedes usar las herramientas MCP:

1. **Navegar** a la página de éxito de autenticación con el token:
   ```
   https://suanet-test.movilidadbogota.gov.co/auth/success?token=TU_TOKEN
   ```

2. **O establecer la cookie directamente** usando `evaluate_script`:
   ```javascript
   // En MCP browser-automation
   document.cookie = "suanet_token=TU_TOKEN; path=/; secure; samesite=lax";
   ```

3. **Navegar al dashboard**:
   ```
   https://suanet-test.movilidadbogota.gov.co/
   ```

---

## Notas de Seguridad

1. **No usar en producción pública**: Este endpoint está diseñado para ambientes de desarrollo y testing.

2. **Secreto confidencial**: El `BYPASS_SIMPLE_SECRET` debe tratarse como una contraseña y no compartirse públicamente.

3. **Auditoría**: Todos los accesos via bypass quedan registrados en la tabla `suanet_auth_auditoria` con el tipo `login_bypass_simple`.

4. **Permisos vacíos**: El usuario autenticado por bypass no tiene permisos granulares configurados (`permisos: []`). El frontend maneja esto gracefully mostrando la interfaz básica.

---

## Troubleshooting

### Error: "Bypass no configurado en el servidor"

**Causa**: La variable `BYPASS_SIMPLE_SECRET` no está en el pod.

**Solución**:
1. Verificar que la variable esté en el variable group de Azure DevOps
2. Re-ejecutar el pipeline para actualizar el secret de Kubernetes
3. O parchear directamente:
   ```bash
   kubectl patch secret suanet-backend-secret -n suanet-dev \
     --type='json' \
     -p='[{"op": "add", "path": "/data/BYPASS_SIMPLE_SECRET", "value": "'$(echo -n "TU_SECRET" | base64)'"}]'
   ```

### Error: "Secreto inválido"

**Causa**: El secreto enviado no coincide con el configurado.

**Solución**: Verificar el valor correcto en:
```bash
kubectl get secret suanet-backend-secret -n suanet-dev -o jsonpath='{.data.BYPASS_SIMPLE_SECRET}' | base64 -d
```

### El token no funciona

**Posibles causas**:
- Token expirado (válido por 7 días)
- Cookie no establecida correctamente
- Dominio incorrecto en la cookie

---

## Referencias

- **Endpoint**: `/home/azureuser/ALL/SUANET-BACKEND/auth/routes.js` (líneas 372-468)
- **Frontend AuthContext**: `/home/azureuser/ALL/SUANET-FRONTEND/components/auth/AuthContext.tsx`
- **Pipeline**: `/home/azureuser/ALL/SUANET-BACKEND/azure-pipelines.yml`

---

*Última actualización: Noviembre 2025*
