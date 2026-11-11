---
title: "Concepto: Codebase Memory y Verificación de GitHub Actions con gh CLI"
updated: 2026-11-11
tags: [concept, codebase-memory, github-cli, gh, github-actions, devsecops]
sources: [AGENTS.md]
---

# Concepto: Codebase Memory y Verificación de GitHub Actions con `gh` CLI

## 1. Uso Obligatorio de `codebase-memory` (Graph-First)
Tal como se establece en [../../AGENTS.md](../../AGENTS.md), `codebase-memory` es el motor de grafo estructural obligatorio para cualquier agente de IA que opere sobre el monorepo:
- **Exploración Estructural (`get_architecture`, `search_graph`, `trace_path`)**: Antes de realizar búsquedas textuales (`grep_search`), se consulta el grafo para identificar puntos de entrada, fan-in/fan-out y cadenas de llamadas (`apps/web` -> `apps/xapi` -> `apps/papi` -> `apps/sapi` -> `packages/database`).
- **Sincronización Continua (`index_repository`)**: Cada modificación de código o estructura debe ir acompañada de `index_repository(mode='full', persistence=true)` para actualizar `.codebase-memory/graph.db.zst`.

---

## 2. Uso del CLI de GitHub (`gh`) para Verificar GitHub Actions
Para garantizar que los flujos CI/CD ([../../.github/workflows/ci-pipeline.yml](../../.github/workflows/ci-pipeline.yml) y [../../.github/workflows/deploy-frontend-ghpages.yml](../../.github/workflows/deploy-frontend-ghpages.yml)) se ejecuten exitosamente, se utilizan los siguientes comandos de `gh`:

### A. Listar ejecuciones recientes de workflows
```bash
gh run list --limit 10
# Filtrar por un workflow específico:
gh run list --workflow="deploy-frontend-ghpages.yml" --limit 5
```

### B. Monitorear una ejecución en tiempo real (con código de salida)
```bash
gh run watch <run-id> --exit-status
```

### C. Inspeccionar el resumen, jobs y logs de error
```bash
# Ver estado detallado de jobs y pasos
gh run view <run-id>

# Ver únicamente los logs de los pasos que fallaron
gh run view <run-id> --log-failed
```

### D. Disparar manualmente un workflow (`workflow_dispatch`)
```bash
gh workflow run deploy-frontend-ghpages.yml --ref main
```

### E. Consultar la URL pública de GitHub Pages vía API
```bash
gh api repos/:owner/:repo/pages --jq '.html_url'
```
