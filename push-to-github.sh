#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# VÉRTICE OS — Script de Push a GitHub
# 
# INSTRUCCIONES:
# 1. Copia todos los archivos de esta carpeta a tu máquina local
# 2. Ejecuta este script desde la raíz del proyecto
# 3. Necesitas tener git configurado con tu cuenta VladPhil92
#
# PREREQUISITOS:
#   git config --global user.email "tu@email.com"
#   git config --global user.name "VladPhil92"
#   gh auth login   # (GitHub CLI, recomendado)
# ═══════════════════════════════════════════════════════════════════════════════

set -e  # Salir si hay error

echo "🔺 VÉRTICE OS — Inicializando repositorio..."

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
  echo "❌ Error: Ejecuta este script desde la raíz del proyecto (donde está package.json)"
  exit 1
fi

# Verificar que git está configurado
if ! git config user.email > /dev/null 2>&1; then
  echo "❌ Git no está configurado. Ejecuta:"
  echo "   git config --global user.email 'tu@email.com'"
  echo "   git config --global user.name 'VladPhil92'"
  exit 1
fi

echo "📁 Inicializando git..."
git init

echo "🔗 Conectando con repositorio remoto..."
git remote add origin https://github.com/VladPhil92/Vertice-OS.git 2>/dev/null || \
  git remote set-url origin https://github.com/VladPhil92/Vertice-OS.git

echo "📋 Agregando archivos..."
git add .

echo "💾 Creando commit inicial..."
git commit -m "feat: initial architecture — VÉRTICE OS v0.1.0

Sistema Operativo Cívico para Cartagena de Indias, Colombia.

Incluye:
- README.md completo con arquitectura y roadmap
- Documentación de arquitectura técnica (docs/architecture/)
- Marco de gobernanza con democracia líquida (docs/governance/)
- Monorepo Next.js (apps/web/) con design tokens
- Orquestador multi-agente IA en Python/LangGraph (apps/ai/)
- Schema SQL completo con PostGIS (infrastructure/db/)
- Docker Compose para desarrollo local (todos los servicios)
- Variables de entorno documentadas (.env.example)
- Configuración de CI/CD ready

Stack: Next.js 14 · Python · LangGraph · Claude API · PostgreSQL+PostGIS
       MongoDB · Neo4j · Pinecone · Redis · Polygon PoS · Mapbox GL

Co-authored-by: CTG One Corporation <ctg@vertice.co>"

echo "🚀 Haciendo push a GitHub..."
git branch -M main
git push -u origin main --force

echo ""
echo "✅ ¡Push exitoso!"
echo "🔺 Repositorio: https://github.com/VladPhil92/Vertice-OS"
echo ""
echo "Próximos pasos:"
echo "  1. Verificar el README en GitHub"
echo "  2. Configurar las GitHub Actions para CI/CD"
echo "  3. Agregar los secrets en GitHub Settings > Secrets"
echo "     - ANTHROPIC_API_KEY"
echo "     - PINECONE_API_KEY"  
echo "     - DATABASE_URL (para staging)"
