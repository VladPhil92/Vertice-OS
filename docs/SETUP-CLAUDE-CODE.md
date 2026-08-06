# VÉRTICE OS — Guía de Setup: Claude Code + GitHub

> Tiempo estimado: 20–30 minutos  
> Resultado: Claude Code trabajando autónomamente en tu repo

---

## ¿Qué tendrás al final?

1. **Claude Code en tu terminal** — trabaja el código localmente con IA
2. **GitHub MCP conectado** — Claude Code puede leer/escribir en el repo
3. **GitHub Actions con Claude** — @claude trabaja desde Issues y PRs automáticamente
4. **CI/CD completo** — lint + tests + deploy en cada PR

---

## PASO 1 — Instalar Claude Code

```bash
# Requisito: Node.js 18+ instalado
node --version  # Debe ser 18+

# Instalar Claude Code globalmente
npm install -g @anthropic-ai/claude-code

# Verificar instalación
claude --version
```

**Iniciar sesión** (usa tu cuenta de Claude.ai):
```bash
claude
# Sigue las instrucciones de autenticación en el navegador
```

---

## PASO 2 — Clonar el repositorio

```bash
git clone https://github.com/VladPhil92/Vertice-OS.git
cd Vertice-OS
```

---

## PASO 3 — Crear GitHub Personal Access Token (PAT)

Este token permite que Claude Code lea y escriba en tu repositorio.

1. Ve a: **GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)**
2. Click **"Generate new token (classic)"**
3. Nombre: `VERTICE-OS Claude Code`
4. Expiración: 90 días (o la que prefieras)
5. Permisos a activar:
   ```
   ✅ repo          (acceso completo al repo)
   ✅ workflow      (para GitHub Actions)
   ✅ read:org      (si el repo es de organización)
   ```
6. Click **"Generate token"**
7. **COPIA EL TOKEN AHORA** — solo se muestra una vez

```bash
# Guardar el token en variable de entorno (no en archivos)
export GITHUB_PAT="ghp_xxxxxxxxxxxxxxxxxxxx"

# Para que persista entre sesiones (añadir a ~/.zshrc o ~/.bashrc):
echo 'export GITHUB_PAT="ghp_xxxxxxxxxxxxxxxxxxxx"' >> ~/.zshrc
source ~/.zshrc
```

---

## PASO 4 — Conectar GitHub MCP a Claude Code

```bash
# Desde la raíz del proyecto Vertice-OS/
cd Vertice-OS

# Agregar GitHub MCP (versión Claude Code 2.1.1+)
claude mcp add-json github '{
  "type": "http",
  "url": "https://api.githubcopilot.com/mcp",
  "headers": {
    "Authorization": "Bearer '"$GITHUB_PAT"'"
  }
}'

# Verificar que quedó configurado
claude mcp list
# Debe aparecer: github → https://api.githubcopilot.com/mcp
```

---

## PASO 5 — Configurar Anthropic API Key

```bash
export ANTHROPIC_API_KEY="sk-ant-xxxxxxxxxxxxxxxxxxxx"

# Para que persista:
echo 'export ANTHROPIC_API_KEY="sk-ant-xxxxxxxxxxxxxxxxxxxx"' >> ~/.zshrc
source ~/.zshrc
```

Obtener API key: https://console.anthropic.com → API Keys

---

## PASO 6 — Levantar el entorno de desarrollo

```bash
# Copiar variables de entorno
cp .env.example .env
# Editar .env con tus valores reales

# Levantar bases de datos (Docker requerido)
docker-compose up -d postgres redis mongodb neo4j

# Verificar que todo está corriendo
docker-compose ps

# Instalar dependencias Node.js
npm install -g pnpm
pnpm install

# Instalar dependencias Python
cd apps/ai && pip install -r requirements.txt && cd ../..
```

---

## PASO 7 — Activar Claude Code con GitHub Actions

Para que **@claude** funcione en GitHub Issues y PRs:

### 7.1 — Agregar el ANTHROPIC_API_KEY como Secret en GitHub

1. Ve a: **GitHub → Vertice-OS → Settings → Secrets and variables → Actions**
2. Click **"New repository secret"**
3. Nombre: `ANTHROPIC_API_KEY`
4. Valor: tu API key de Anthropic
5. Click **"Add secret"**

Repetir para:
- `GITHUB_PAT` — tu Personal Access Token
- `MAPBOX_TOKEN` — para el mapa (obtener en mapbox.com)

### 7.2 — Los workflows ya están configurados

Los archivos en `.github/workflows/` ya están en el repo:
- `ci.yml` — lint + tests + build + deploy automático
- `claude-code.yml` — agente Claude en Issues y PRs

### 7.3 — Probar que funciona

```bash
# Hacer push del repo completo
git add .
git commit -m "feat: setup Claude Code + GitHub MCP + CI/CD"
git push origin main
```

Luego en GitHub, crea un Issue y escribe:
```
@claude Crea el módulo de autenticación básica en apps/api/src/modules/auth/
siguiendo las convenciones del CLAUDE.md
```

Claude Code responderá automáticamente, escribirá el código y creará un PR.

---

## PASO 8 — Usar Claude Code localmente (modo interactivo)

```bash
# Desde la raíz del proyecto
cd Vertice-OS
claude

# Claude Code lee CLAUDE.md automáticamente
# Ejemplos de comandos:

# Trabajar en una tarea específica
> Implementa el DID generation flow del módulo de identidad (Issue #007)

# Revisar código existente
> Revisa orchestrator.py y agrega tests unitarios en pytest

# Crear un PR completo
> Crea el componente MapaTerritorial en apps/web/components/map/ 
  con Mapbox GL, siguiendo el design system del proyecto

# Trabajar con el repo
> Lista los issues abiertos del repo y prioriza por fase
```

---

## PASO 9 — Workflow diario recomendado

```bash
# Inicio de sesión de trabajo
cd Vertice-OS
git pull origin develop        # Actualizar
docker-compose up -d           # Levantar servicios
claude                         # Iniciar Claude Code

# En Claude Code:
> ¿Cuál es el estado actual del Sprint 1? 
  Revisa los issues abiertos en GitHub y dime qué sigue.

# Claude Code:
# - Lee el repo
# - Consulta GitHub Issues via MCP
# - Te da el contexto exacto
# - Implementa lo que le pidas
# - Hace commit y push
# - Crea el PR

# Al final de la sesión
> Genera un resumen de lo que hicimos hoy y 
  actualiza el CLAUDE.md con las decisiones tomadas
```

---

## SOLUCIÓN DE PROBLEMAS COMUNES

### Error: "MCP server not found"
```bash
# Verificar configuración
cat ~/.claude.json
# O si usas .mcp.json del proyecto:
cat .mcp.json

# Re-agregar el MCP
claude mcp remove github
claude mcp add-json github '{ ... }'
```

### Error: "Authentication failed"
```bash
# Verificar que el PAT está en el ambiente
echo $GITHUB_PAT

# Re-exportar
export GITHUB_PAT="tu-token"
```

### Error: "CLAUDE.md not found"
```bash
# Claude Code busca CLAUDE.md en el directorio actual
# Asegúrate de estar en la raíz del proyecto
pwd  # Debe mostrar .../Vertice-OS
ls CLAUDE.md  # Debe existir
```

### Docker no levanta
```bash
docker --version       # Verificar instalación
docker-compose ps      # Ver estado de servicios
docker-compose logs postgres  # Ver errores de postgres
```

---

## ESTRUCTURA DE ARCHIVOS DE CONFIGURACIÓN

```
Vertice-OS/
├── CLAUDE.md              ← Memoria del proyecto (Claude Code lo lee siempre)
├── .mcp.json              ← Configuración GitHub MCP para el proyecto
├── .claude/
│   └── settings.json      ← Permisos y herramientas permitidas
└── .github/
    └── workflows/
        ├── ci.yml          ← CI/CD automático
        └── claude-code.yml ← @claude en Issues/PRs
```

---

## COMANDOS DE REFERENCIA RÁPIDA

```bash
# Claude Code interactivo
claude

# Claude Code con una tarea específica (no interactivo)
claude -p "Implementa el Issue #007 del repo VladPhil92/Vertice-OS"

# Ver configuración MCP
claude mcp list

# Ver logs de Claude Code
claude --debug

# Actualizar Claude Code
npm update -g @anthropic-ai/claude-code
```

---

## FLUJO COMPLETO DE UN SPRINT

```
1. Claude.ai (esta sesión) → Planificar sprint, diseñar arquitectura
2. Claude Code (terminal)  → Implementar código, tests, commits
3. GitHub Actions          → CI automático en cada PR
4. @claude en GitHub       → Revisión de código, fix de bugs, documentación
5. Claude.ai               → Revisar avances, planificar siguiente sprint
```

---

*¿Problemas con el setup? Pega el error en esta conversación de Claude.ai
y lo resolvemos antes de volver a Claude Code.*
