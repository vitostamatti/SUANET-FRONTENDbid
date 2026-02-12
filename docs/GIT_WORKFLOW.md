# Flujo Git para SUANET-FRONTEND

> **Última actualización**: 2024-11-07
> **Tag baseline**: v2024.11.baseline
> **Versión**: 2.0 - Trunk-Based Development

## 📋 Resumen Ejecutivo

**Flujo unidireccional basado en trunk (master):**

```
master → feature → master → dev → prd
  ↓         ↓         ↓       ↓      ↓
trunk   trabajo   merge   test  producción
                    ↓
              (auto-sync)
```

**Principio clave**: Master es el **trunk** (fuente de verdad). Dev sincroniza automáticamente después de cada merge a master.

---

## 🎯 Filosofía del Flujo

### Master como Trunk
- **Master** = Trunk principal del proyecto
- Siempre debe ser estable y deployable
- Todas las features nacen de master
- Todas las features regresan a master

### Dev como Ambiente de Testing
- **Dev** = Espejo automático de master
- Se sincroniza automáticamente después de cada merge a master
- Ambiente donde QA prueba cada feature
- Nunca se hacen commits directos a dev

### Prd como Producción
- **Prd** = Código en producción
- Solo recibe cambios desde dev
- Solo después de aprobación de QA
- Representa lo último que pasó testing exitoso

---

## 🚀 Flujo de Trabajo Detallado

### 1️⃣ Crear Nueva Feature

```bash
# Siempre desde master (trunk)
git checkout master
git pull origin master              # Traer últimos cambios
git checkout -b feature/nombre-descriptivo

# Ejemplo:
git checkout -b feature/add-user-profile
git checkout -b feature/fix-login-bug
git checkout -b hotfix/critical-security-patch
```

**¿Por qué desde master?**
- Master es el trunk (fuente única de verdad)
- Garantiza que todas las features tienen la misma base
- Evita divergencias entre branches

---

### 2️⃣ Desarrollar Feature

```bash
# Trabajar en la feature
git add .
git commit -m "feat: add user profile page"
git commit -m "test: add user profile tests"
git commit -m "docs: update user profile documentation"

# Pushear regularmente
git push origin feature/add-user-profile
```

**Buenas prácticas:**
- Commits pequeños y frecuentes
- Mensajes descriptivos
- Features cortas (1-3 días máximo)
- Tests incluidos

---

### 3️⃣ Pull Request: Feature → Master

```bash
# En Azure DevOps:
# 1. Crear PR: feature/add-user-profile → master
# 2. Code review por el equipo
# 3. CI/CD corre tests automáticos
# 4. Merge (squash o merge commit según preferencia)
# 5. Borrar feature branch automáticamente
```

**Después del merge:**
✅ Feature está en master
✅ Pipeline de master corre automáticamente
✅ Master → Dev se sincroniza automáticamente (nuevo)
✅ Feature disponible en ambiente dev para testing

---

### 4️⃣ Sincronización Automática: Master → Dev

**Este paso es AUTOMÁTICO** (configurado en pipeline de master)

```yaml
# En azure-pipelines-master.yml
- stage: SyncToDev
  displayName: 'Sync Master to Dev'
  dependsOn: Build
  condition: succeeded()
  jobs:
  - job: SyncDev
    steps:
    - script: |
        git config user.email "pipeline@azuredevops.com"
        git config user.name "Azure Pipeline"

        git checkout dev
        git pull origin dev
        git merge origin/master --no-ff -m "chore: Auto-sync master to dev [skip ci]"
        git push origin dev
```

**Resultado:**
- Dev tiene exactamente lo mismo que master
- QA puede empezar a probar inmediatamente
- No requiere intervención manual

---

### 5️⃣ Testing en Dev

```
1. QA recibe notificación de nueva feature en dev
2. QA prueba en: https://dev.suanet.movilidadbogota.gov.co (si existe)
3. Tres posibles resultados:

   ✅ PASS → Aprobar para producción
   ❌ FAIL → Crear bug report → Nueva feature desde master → Fix
   ⏸️  HOLD → Feature necesita ajustes → Nueva feature desde master
```

**Importante:**
- Dev puede tener múltiples features en testing simultáneamente
- Cada feature en dev vino de master
- Si una feature falla, el fix es una nueva feature desde master

---

### 6️⃣ Deploy a Producción: Dev → Prd

```bash
# Solo cuando QA aprueba
# En Azure DevOps:
# 1. Crear PR: dev → prd
# 2. Revisión final
# 3. Merge
# 4. Pipeline de prd corre automáticamente:
#    - Build imagen Docker (tag: 1.YYYYMMDD.BuildId)
#    - Deploy a Kubernetes
#    - Rollout status (espera hasta 5min)
#    - Verificación de pods
# 5. Badge en UI muestra nueva versión
```

**Verificación post-deploy:**
- Badge muestra versión correcta (ej: `1.20251107.55381`)
- Pods corriendo con nueva imagen
- Funcionalidad crítica testeada en producción

---

## 📐 Reglas de Oro

### ✅ PERMITIDO (Y REQUERIDO)

| Acción | Cuándo | Quién | Automático |
|--------|--------|-------|------------|
| `master → feature` | Crear feature | Developer | No |
| `feature → master` | Feature completa | Developer + Review | No |
| `master → dev` | Después de merge | Pipeline | **SÍ** ✨ |
| `dev → prd` | QA aprobó | Tech Lead | No |

### ❌ PROHIBIDO (NUNCA HACER)

| Acción | Por qué | Consecuencia |
|--------|---------|--------------|
| `dev → feature` | Dev no es trunk | Feature desactualizada |
| `prd → feature` | Prd no es trunk | Código de producción en desarrollo |
| `feature → dev` | Saltarse master | Bypass de trunk |
| `dev → master` | Flujo inverso | Rompe trunk-based |
| `prd → dev` | Flujo inverso | Confusión de ambientes |
| `prd → master` | Flujo inverso | Rompe trunk-based |
| Commits directos a dev | Dev es auto-sync | Se perderá en próximo sync |
| Commits directos a prd | Prd es deploy target | Bypass de QA |

---

## 🔄 Visualización del Flujo Completo

### Timeline de una Feature

```
DÍA 1 - DESARROLLO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
master: A → B → C
dev:    A → B → C (sync automático previo)
prd:    A → B

Dev crea feature/user-profile desde master:
feature: A → B → C → U1 → U2 → U3
                     ↑    ↑    ↑
                  add  test  docs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DÍA 2 - MERGE Y AUTO-SYNC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PR: feature/user-profile → master (merge)

master: A → B → C → [U]  ← Feature mergeada

Pipeline automático ejecuta:
1. Build & Test en master ✅
2. master → dev (auto-sync)

dev:    A → B → C → [U]  ← Sincronizado automáticamente
                    ↑
            QA empieza testing aquí

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DÍA 3 - QA TESTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QA prueba [U] en ambiente dev

Resultado: ✅ PASS - Feature aprobada para producción

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DÍA 4 - DEPLOY A PRODUCCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PR: dev → prd (merge)

prd:    A → B → [U]  ← Feature en producción
                ↑
        Badge muestra: 1.20251107.55400
```

### Flujo con Múltiples Features Simultáneas

```
SEMANA 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Lunes: Dev1 crea feature/X desde master
master: A → B → C
feature/X: A → B → C → X1 → X2

Martes: Dev2 crea feature/Y desde master (en paralelo)
master: A → B → C
feature/Y: A → B → C → Y1 → Y2 → Y3

Miércoles: feature/X → master (merge)
master: A → B → C → [X]
        ↓ (auto-sync)
dev:    A → B → C → [X]  ← QA empieza a probar X

Jueves: feature/Y → master (merge)
master: A → B → C → [X] → [Y]
        ↓ (auto-sync)
dev:    A → B → C → [X] → [Y]  ← QA prueba Y (X ya está ahí)

Viernes: QA aprueba ambas, dev → prd
prd:    A → B → [X] → [Y]  ← Ambas features en producción
```

---

## 🆘 Casos Especiales

### Caso 1: Bug Encontrado en Dev Durante Testing

```bash
# QA encuentra bug en feature/user-profile que está en dev

# Developer:
git checkout master          # Desde master (no desde dev)
git pull origin master
git checkout -b fix/user-profile-validation

# Fix el bug
git commit -m "fix: user profile validation"
git push origin fix/user-profile-validation

# PR: fix/user-profile-validation → master
# Después del merge:
# - Auto-sync: master → dev
# - QA vuelve a probar en dev
```

**Importante:** El fix va a master primero, luego auto-sync a dev. NO hacer fix directo en dev.

### Caso 2: Hotfix Crítico en Producción

```bash
# Producción tiene bug crítico que necesita fix inmediato

# Opción A: Desde master (PREFERIDO si master = prd)
git checkout master
git pull origin master
git checkout -b hotfix/critical-security

# Fix
git commit -m "fix: critical security vulnerability"
git push origin hotfix/critical-security

# PR urgente: hotfix → master (merge inmediato)
# Auto-sync: master → dev
# PR urgente: dev → prd (merge inmediato)
```

```bash
# Opción B: Si master tiene features NO listas para prd

# 1. Fix desde master
git checkout master
git checkout -b hotfix/critical-security
# ... fix ...
git push origin hotfix/critical-security

# 2. PR: hotfix → master
# 3. Auto-sync: master → dev

# 4. Cherry-pick a prd (solo el hotfix, sin otras features)
git checkout prd
git cherry-pick <commit-hash-del-hotfix>
git push origin prd

# 5. Después sincronizar dev con prd si es necesario
```

### Caso 3: Feature Larga que Toma Semanas

```bash
# Feature grande: feature/new-dashboard (2 semanas de trabajo)

# Día 1:
git checkout master
git checkout -b feature/new-dashboard

# Durante las 2 semanas:
# Mantener feature actualizada con master regularmente

git checkout feature/new-dashboard
git merge origin/master  # Traer cambios recientes de master
# Resolver conflictos
git push origin feature/new-dashboard

# Esto previene conflictos grandes al final
```

**Mejor práctica:** Features no deberían tomar más de 3 días. Si es muy grande, dividir en sub-features.

### Caso 4: Rollback de Producción

```bash
# Último deploy a prd tiene problemas

# Opción 1: Revert en master
git checkout master
git revert <commit-hash-problemático>
git push origin master
# Auto-sync: master → dev
# PR: dev → prd

# Opción 2: Revert directo en prd (emergencia)
git checkout prd
git revert <commit-hash-problemático>
git push origin prd
# Luego sincronizar a master:
git checkout master
git cherry-pick <commit-hash-del-revert>
```

---

## 📊 Estado Típico de las Ramas

### Estado Normal (Post-Deployment)

```
master: A → B → C → D → E → F
        └─────────────────────┘ (auto-synced)
dev:    A → B → C → D → E → F
                            │
                            └── (deployed after QA)
prd:    A → B → C → D → E → F
```

### Estado Durante Desarrollo Activo

```
master: A → B → C → D
        └─────────────┘ (auto-synced)
dev:    A → B → C → D
                    ↑
                QA testing

feature/X: A → B → C → D → X1 → X2 (WIP)
feature/Y: A → B → C → Y1 → Y2 → Y3 (WIP)

prd:    A → B → C
```

---

## 🎯 Beneficios del Nuevo Flujo

### 1. Trunk-Based Development Real
- Master es el único trunk
- Todas las features convergen en master
- Historial lineal y limpio
- Compatible con CI/CD moderno

### 2. Testing Continuo e Individual
- Cada feature va a dev inmediatamente después de merge
- QA puede probar features individualmente
- Feedback rápido (no esperar acumulación)
- Fácil identificar qué feature causó un problema

### 3. Sin Sincronizaciones Manuales
- master → dev es automático
- No hay olvidos de sincronizar
- Siempre sabes que dev = master
- Menos errores humanos

### 4. Sin "Multiple Merge Bases"
- Flujo estrictamente unidireccional
- Git siempre encuentra un merge base único
- No más warnings en Azure DevOps
- Historial de commits limpio

### 5. Escalable para Equipos
- Múltiples developers pueden trabajar en paralelo
- Features independientes no se bloquean
- Master siempre estable
- Deploy rápido cuando sea necesario

---

## 🔧 Configuración del Pipeline

### Crear/Modificar Pipeline de Master

```yaml
# azure-pipelines-master.yml (nuevo o modificar existente)

trigger:
  branches:
    include:
    - master

pool:
  vmImage: 'ubuntu-latest'

stages:
- stage: Build
  displayName: 'Build and Test'
  jobs:
  - job: BuildJob
    steps:
    - task: NodeTool@0
      inputs:
        versionSpec: '18.x'

    - script: |
        npm ci
        npm run build
        npm test
      displayName: 'Build and Test'

- stage: SyncToDev
  displayName: 'Auto-Sync to Dev'
  dependsOn: Build
  condition: succeeded()
  jobs:
  - job: SyncJob
    steps:
    - checkout: self
      persistCredentials: true
      clean: true

    - script: |
        git config user.email "pipeline@azuredevops.com"
        git config user.name "Azure DevOps Pipeline"

        echo "Fetching latest changes..."
        git fetch origin

        echo "Checking out dev branch..."
        git checkout dev
        git pull origin dev

        echo "Merging master into dev..."
        git merge origin/master --no-ff -m "chore: Auto-sync master to dev [skip ci]

        This is an automatic synchronization from master to dev.
        All features merged to master are now available in dev for QA testing.

        Latest commit from master: $(git log origin/master -1 --oneline)"

        echo "Pushing to dev..."
        git push origin dev

        echo "✅ Successfully synced master to dev"
      displayName: 'Sync master to dev'
      condition: succeeded()
```

**Nota:** El `[skip ci]` en el mensaje de commit evita que el pipeline de dev se ejecute innecesariamente.

---

## 📝 Checklists

### Para Desarrolladores

#### Al empezar nueva feature:
- [ ] `git checkout master`
- [ ] `git pull origin master`
- [ ] `git checkout -b feature/nombre-descriptivo`
- [ ] Desarrollar (commits pequeños y frecuentes)
- [ ] `git push origin feature/nombre-descriptivo`
- [ ] Crear PR: feature → master en Azure DevOps

#### Después del merge:
- [ ] Verificar que pipeline de master completó ✅
- [ ] Verificar que auto-sync master → dev completó ✅
- [ ] Notificar a QA que feature está en dev para testing
- [ ] Esperar aprobación de QA

#### Al recibir bug report de QA:
- [ ] Crear fix desde master (no desde dev)
- [ ] PR: fix → master
- [ ] Auto-sync llevará fix a dev automáticamente

### Para QA

#### Al recibir feature en dev:
- [ ] Verificar que feature está en ambiente dev
- [ ] Revisar descripción de PR para entender cambios
- [ ] Ejecutar plan de testing
- [ ] Documentar resultados

#### Si feature PASA testing:
- [ ] Aprobar feature para producción
- [ ] Notificar a Tech Lead para PR dev → prd

#### Si feature FALLA testing:
- [ ] Crear bug report detallado
- [ ] Marcar feature como "needs-fix"
- [ ] Developer creará fix desde master
- [ ] Volver a probar cuando fix llegue a dev

### Para Tech Lead

#### Al aprobar deploy a producción:
- [ ] Verificar que todas las features en dev pasaron QA
- [ ] Crear PR: dev → prd
- [ ] Monitorear pipeline de producción
- [ ] Verificar badge de versión en UI
- [ ] Smoke test de funcionalidad crítica
- [ ] Notificar a equipo que deploy completó

---

## 🔍 Verificación y Debugging

### Ver estado de las ramas

```bash
# Ver commits en master que no están en dev (debería ser 0)
git log origin/dev..origin/master --oneline

# Ver commits en dev que no están en prd
git log origin/prd..origin/dev --oneline

# Ver diferencias de archivos entre master y dev (debería ser vacío)
git diff origin/master origin/dev --stat
```

### Ver historial de auto-syncs

```bash
# Ver merges automáticos de master a dev
git log origin/dev --oneline --grep="Auto-sync master to dev"
```

### Verificar que pipeline está configurado

```bash
# En Azure DevOps:
# Pipelines → SUANET-FRONTEND-MASTER → Recent runs
# Verificar que stage "SyncToDev" existe y completa exitosamente
```

---

## ❓ Preguntas Frecuentes

**Q: ¿Por qué no crear features desde dev como antes?**
A: Master es el trunk oficial. Dev es un ambiente de testing que refleja master. Features deben nacer y volver al trunk.

**Q: ¿Qué pasa si el auto-sync master → dev falla?**
A: El pipeline marcará error. Se debe investigar el conflicto (raro) y resolverlo manualmente. Notificar a Tech Lead.

**Q: ¿Puedo hacer commit directo a dev?**
A: NO. Dev recibe cambios solo desde master via auto-sync. Commits directos se perderán en el próximo sync.

**Q: ¿Qué hago si master tiene features que no quiero en dev todavía?**
A: En trunk-based development, master debe tener solo código estable y listo. Si una feature no está lista, no debe mergearse a master. Usar feature flags si es necesario.

**Q: ¿Cuánto tarda el auto-sync master → dev?**
A: Típicamente 1-2 minutos después del merge a master. Puedes ver el progreso en Azure DevOps Pipelines.

**Q: ¿Qué pasa si dos features se mergean a master casi al mismo tiempo?**
A: El auto-sync maneja esto correctamente. Dev recibirá ambas features en orden. El segundo sync verá que dev ya tiene la primera feature.

**Q: ¿Necesito sincronizar prd a master después de un deploy?**
A: NO. Prd recibe desde dev, y dev recibe desde master. Master ya tiene todo lo que prd tiene.

---

## 📞 Soporte y Contacto

Si tienes dudas sobre este flujo:
1. Consulta este documento primero
2. Revisa el gráfico de commits en Azure DevOps
3. Verifica logs del pipeline de master
4. Consulta con Tech Lead

---

## 📚 Referencias y Recursos

- **Trunk-Based Development**: https://trunkbaseddevelopment.com/
- **Azure Pipelines**: https://docs.microsoft.com/en-us/azure/devops/pipelines/
- **GitFlow vs Trunk-Based**: Comparación de estrategias

---

**Documento creado**: 2024-11-07
**Última actualización**: 2024-11-07
**Baseline tag**: v2024.11.baseline
**Versión**: 2.0 (Trunk-Based Development con auto-sync)
**Autor**: Equipo SUANET
