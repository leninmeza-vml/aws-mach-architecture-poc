# AGENTS.md — Esquema Operativo, Reglas de Arquitectura y Gobernanza de LLM Wiki

Este archivo define las directivas obligatorias para cualquier Agente de IA (GitHub Copilot, Claude Code, Codex, Cline, Roo Code) que opere sobre el repositorio `aws-mach-architecture-poc`.

---

## 1. REGLAS ESTRICTAS DE GOBERNANZA DEL LLM WIKI (`wiki/`)

Este proyecto implementa el patrón **LLM Wiki** (basado en la arquitectura de Andrej Karpathy: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), el cual actúa como una base de conocimiento persistente y acumulativa entre las fuentes crudas y el código del proyecto.

### Regla Inquebrantable #1: Consulta Obligatoria Pre-Acción (Query First)
- **ANTES** de responder cualquier pregunta arquitectónica, modificar código, crear endpoints, alterar infraestructura AWS CDK, escribir esquemas de datos o ejecutar scripts:
  1. **DEBES leer `wiki/index.md`** primero para localizar las páginas relevantes del dominio.
  2. **DEBES revisar `wiki/log.md`** (las últimas entradas) para comprender el contexto reciente y decisiones tomadas.
  3. **DEBES consultar las páginas específicas** en `wiki/concepts/`, `wiki/entities/`, `wiki/analyses/` y `wiki/sources/` vinculadas a la tarea.
  4. **DEBES consultar el grafo de código (`codebase-memory`)** antes de hacer búsquedas a ciegas en el código fuente.

### Regla Inquebrantable #2: Actualización Obligatoria Post-Acción (Update Always)
- **DESPUÉS** de realizar cualquier cambio en el código, agregar una fuente, tomar una decisión arquitectónica (ADR), modificar contratos Zod/OpenAPI o cambiar recursos en AWS CDK:
  1. **Actualiza las páginas existentes** en `wiki/entities/`, `wiki/concepts/` o `wiki/analyses/` reflejando el nuevo estado (extiende y sintetiza; **nunca** crees páginas duplicadas ni sobrescribas silenciosamente historial válido).
  2. **Actualiza `wiki/index.md`** si se creó una página nueva o cambió el resumen/alcance de una existente.
  3. **Registra la operación en `wiki/log.md`** usando estrictamente el formato cronológico parseable:
     `## [YYYY-MM-DD] <operación: ingest|query|update|lint> | <Título corto de la acción>`

### Regla Inquebrantable #3: Arquitectura de 3 Capas del Wiki
1. **Fuentes Crudas (`wiki/raw/`)**: Documentos originales, especificaciones y prompts base. **Inmutables** para el LLM (solo lectura).
2. ** Conocimiento Compilado (`wiki/`)**: Páginas Markdown interconectadas (`[[wikilinks]]` o enlaces relativos Markdown). Propiedad total del LLM; el agente sintetiza, mantiene referencias cruzadas y señala contradicciones.
3. **Esquema (`AGENTS.md` y `wiki/conventions.md`)**: Reglas de operación y mantenimiento disciplinado.

### Operaciones Estándar del Wiki
- **Ingest (`ingest`)**: Leer nueva fuente en `wiki/raw/` o documento del repo -> crear resumen en `wiki/sources/` -> extraer/actualizar conceptos en `wiki/concepts/` y entidades en `wiki/entities/` -> actualizar `wiki/index.md` -> registrar en `wiki/log.md`.
- **Query (`query`)**: Leer `wiki/index.md` -> navegar a las páginas relevantes -> responder con citas a la wiki y al código -> si el análisis generado aporta valor duradero, archivarlo en `wiki/analyses/` y registrarlo en `wiki/log.md`.
- **Lint (`lint`)**: Verificar páginas huérfanas, enlaces rotos, contradicciones entre la wiki y el código real (`apps/`, `packages/`, `infra/`), o afirmaciones obsoletas -> corregir y registrar en `wiki/log.md`.

---

## 1.B REGLA INQUEBRANTABLE DE USO OBLIGATORIO DE CODEBASE MEMORY (`codebase-memory`)

- **Siempre se debe usar `codebase-memory` como fuente primaria de exploración, análisis de impacto y comprensión estructural del código:**
  1. **Grafo Primero (Graph-First)**: Antes de utilizar `grep_search`, `file_search` o leer archivos de forma exploratoria, **SIEMPRE** debes consultar las herramientas MCP de `codebase-memory` (`search_graph`, `get_architecture`, `trace_path`, `get_code_snippet`, `query_graph`, `detect_changes`).
  2. **Re-ingesta / Re-indexación Obligatoria**: Siempre que se agreguen, muevan, renombren o modifiquen módulos, rutas, constructos CDK o esquemas en `apps/`, `packages/` o `infra/`, **DEBES** ejecutar `index_repository` con `persistence: true` para mantener sincronizado el artefacto `.codebase-memory/graph.db.zst`.
  3. **Persistencia de ADRs**: Toda decisión arquitectónica relevante debe registrarse también en el ADR del grafo mediante `manage_adr(mode='update')`.

---

## 2. ARQUITECTURA DEL PROYECTO (MACH & API-Led Connectivity)

El repositorio es un **Monorepo** gestionado con `pnpm` workspaces y `Turborepo`:

### Principios MACH
- **M — Microservices**: Funciones AWS Lambda desacopladas por dominio y capa (`apps/xapi`, `apps/papi`, `apps/sapi`).
- **A — API-first**: Todos los contratos se definen primero en `docs/OPENAPI.yaml` y se validan en tiempo de ejecución mediante esquemas Zod compartidos en `packages/types`.
- **C — Cloud-native**: Infraestructura serverless 100% declarativa en AWS CDK v2 (`infra/`), API Gateway v2 HTTP API, Amazon Cognito JWT, VPC aislada, RDS PostgreSQL y Secrets Manager.
- **H — Headless**: Frontend desacoplado en Next.js (`apps/web`) compilado como exportación estática (`output: 'export'`) desplegable en GitHub Pages, consumiendo exclusivamente la capa xAPI.

### Capas API-Led Connectivity
1. **xAPI (`apps/xapi` - Experience API)**:
   - Punto de entrada público vía API Gateway v2.
   - Valida JWT (`Authorization: Bearer <token>`), propaga el header W3C `traceparent` y adapta payloads para el cliente web.
   - **Prohibido**: Acceder directamente a la base de datos o ejecutar reglas de negocio complejas.
2. **pAPI (`apps/papi` - Process API)**:
   - Orquesta procesos y aplica reglas de negocio (validación de límites, antifraude, enriquecimiento de estados).
   - **Prohibido**: Atender clientes externos directamente o conectarse por red directo a PostgreSQL.
3. **sAPI (`apps/sapi` - System API)**:
   - Reside en subredes privadas de la VPC.
   - Único componente autorizado para comunicarse con PostgreSQL/YugabyteDB (puerto `5432`) mediante `packages/database`.

---

## 3. REGLAS DE SEGURIDAD Y DEVSECOPS

- **Cero Credenciales Estáticas**: Prohibido almacenar o solicitar `AWS_ACCESS_KEY_ID` o `AWS_SECRET_ACCESS_KEY`. En local se utiliza exclusivamente AWS IAM Identity Center (`aws sso login --profile poc-mach-dev`) y en GitHub Actions se utiliza federación OIDC (`aws-actions/configure-aws-credentials`).
- **Trazabilidad Distribuida W3C**: Todo request desde `apps/web` hasta `apps/sapi` debe generar/propagar el header `traceparent: 00-{traceId}-{spanId}-01`.
- **Validación Estricta**: Ningún payload entra o sale de una capa sin validación de esquema desde `@poc-mach/types`.
- **Sincronización con Codebase Memory**: Al añadir o refactorizar módulos TypeScript, asegúrate de mantener actualizado el grafo de `codebase-memory`.
- **Verificación de GitHub Actions con `gh` CLI**: Tras realizar despliegues o cambios en `.github/workflows/`, verifica siempre la ejecución mediante `gh run list`, `gh run watch <run-id> --exit-status` y `gh run view <run-id> --log-failed`.

