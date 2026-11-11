---
title: Registro Cronológico de Operaciones (Log)
updated: 2026-11-11
---

# Bitácora del LLM Wiki (`log.md`)

Registro cronológico (`append-only`) de ingestas, consultas, actualizaciones arquitectónicas y pases de verificación.
Para consultar las últimas 5 operaciones vía terminal: `grep "^## \[" wiki/log.md | tail -5`.

---

## [2026-11-11] init | Inicialización de la estructura LLM Wiki (Karpathy Pattern)
- Se creó la arquitectura de tres capas (`wiki/raw/`, `wiki/` compilado y esquema en `AGENTS.md` + `wiki/conventions.md`).
- Se inicializaron los catálogos `index.md`, `overview.md`, `conventions.md` y los directorios `sources/`, `concepts/`, `entities/` y `analyses/`.

## [2026-11-11] ingest | Prompt Maestro: Generación Autónoma de PoC MACH en AWS (`prompt-setup-poc-aws-vscode.md`)
- Fuente original copiada/referenciada en `wiki/raw/` y sintetizada en `wiki/sources/prompt-setup-poc-aws-vscode.md`.
- Páginas de conceptos creadas: `mach-architecture.md`, `api-led-connectivity.md`, `w3c-trace-context.md`, `zero-static-credentials-oidc.md`.
- Páginas de entidades creadas: `apps-web.md`, `apps-xapi.md`, `apps-papi.md`, `apps-sapi.md`, `infra-cdk.md`.
- Análisis creado: `mach-api-led-synergy.md`.

## [2026-11-11] update | Ejecución integral del Monorepo PoC MACH en AWS e indexación en Codebase Memory
- Se verificó e instaló el toolchain local (`Node.js v22`, `pnpm v12`, `AWS CLI v2`, `AWS CDK v2`, `uv`).
- Se generaron todos los paquetes compartidos (`@poc-mach/types`, `@poc-mach/database`, `@poc-mach/tsconfig`, `@poc-mach/eslint-config`), las aplicaciones (`web`, `xapi`, `papi`, `sapi`), la infraestructura (`@poc-mach/infra`), los flujos CI/CD (`.github/workflows/`) y la documentación técnica (`docs/`).
- Se indexó el repositorio completo en `codebase-memory`.

## [2026-11-11] update | Regla obligatoria de Codebase Memory, verificación con gh CLI y primer despliegue de Frontend en GitHub Pages
- Se añadió la sección `1.B REGLA INQUEBRANTABLE DE USO OBLIGATORIO DE CODEBASE MEMORY` en `AGENTS.md`.
- Se creó la página `wiki/concepts/codebase-memory-and-gh-cli.md` y se actualizó `wiki/index.md`.
- Se re-indexó el proyecto en `codebase-memory` y se ejecutó el despliegue de `apps/web` hacia GitHub Pages verificando los workflows con `gh run`.

## [2026-11-11] update | Nomenclatura WPP Enterprise Solutions, separación en Pestañas y Diagrama Interactivo por Capas
- Se estandarizaron todos los nombres de recursos AWS bajo la convención `wppes-mach-poc-dev-use1-*` en `infra/lib/poc-stack.ts`, `infra/bin/infra.ts` y `docs/DEPLOYMENT_GUIDE.md`.
- Se rediseñó `apps/web/src/app/page.tsx` con identidad de **WPP Enterprise Solutions** (`https://www.wpp.com/en/wpp-enterprise-solutions`), navegación por pestañas con estados persistentes independientes para `POST` y `GET`, y un diagrama interactivo en vivo de las 6 capas hasta PostgreSQL.
- Se re-indexó el grafo en `codebase-memory` y se desplegó la nueva versión en GitHub Pages.

## [2026-11-11] update | Migración íntegra a Región Querétaro, México (mx-central-1 / mxc1) y Protección del Plan Gratuito AWS
- Se actualizaron `infra/lib/poc-stack.ts`, `infra/bin/infra.ts`, `infra/lib/poc-stack.test.ts`, `.vscode/mcp.json`, `.github/workflows/deploy-infra-cdk.yml`, `apps/web` y `docs/` para operar 100% en la región `mx-central-1` (Querétaro, México) bajo el prefijo `wppes-mach-poc-dev-mxc1-*`.
- Se documentó cómo evitar la pérdida del AWS Free Plan (no habilitar AWS Organizations al usar IAM Identity Center; usar *Account Instance* o federación OIDC + CloudShell).
- Se re-indexó el repositorio en `codebase-memory` y se desplegó la actualización a GitHub Pages.

## [2026-11-11] update | Configuración de Proveedor OIDC y Rol IAM en Cuenta 723949187900 para Despliegue en Querétaro (mx-central-1)
- Se creó el proveedor OIDC `arn:aws:iam::723949187900:oidc-provider/token.actions.githubusercontent.com` (Audience: `sts.amazonaws.com`) en IAM de la cuenta `723949187900` (`ljmeza-vml`).
- Se creó el rol IAM `arn:aws:iam::723949187900:role/wppes-mach-poc-dev-global-iam-role-gh-oidc` con política de confianza restringida a `repo:leninmeza-vml/aws-mach-architecture-poc:*`.
- Se configuró el secreto `AWS_OIDC_ROLE_ARN` en GitHub Actions mediante `gh secret set` y se actualizó `deploy-infra-cdk.yml` para ejecutar `cdk bootstrap` y `cdk deploy` en `mx-central-1`.

## [2026-11-11] update | Despliegue 100% CREATE_COMPLETE en mx-central-1 y Acordeón Interactivo con Diagramas Mermaid en Frontend
- El stack `wppes-mach-poc-dev-mxc1-stack` finalizó con `47/47` recursos en `CREATE_COMPLETE` en Querétaro (`mx-central-1`), generando el endpoint `https://x9ghhi1zbc.execute-api.mx-central-1.amazonaws.com` y el User Pool `mx-central-1_mRZ0XCzrm`.
- Se agregó en `apps/web/src/app/page.tsx` el acordeón interactivo de 4 secciones (iniciando cerrado): explicación de la PoC, tabla de servicios, diagrama Mermaid API-Led y diagrama Mermaid E2E desde GitHub Actions hasta RDS PostgreSQL.
- Se re-indexó el repositorio en `codebase-memory` y se desplegó en GitHub Pages.

## [2026-11-11] update | Contexto de WPP Enterprise Solutions & VML, Eliminación de Pestaña Duplicada, Unificación de Botones y Glosario Técnico
- Se actualizó el encabezado de `apps/web/src/app/page.tsx` con el objetivo empresarial de la PoC y la descripción de capacidades de **WPP Enterprise Solutions** y **VML** sobre AWS.
- Se eliminó la tercera pestaña redundante (`Nomenclatura Estándar WPP & Setup AWS SSO`), consolidando la tabla de servicios, nomenclatura y comandos CLI en el Panel 2 del acordeón.
- Se unificó el color y estilo visual de los 4 botones `"Abrir / Cerrar"` del acordeón (`#38bdf8`).
- Se añadió el **Glosario de Términos Técnicos y Arquitectónicos** (`#glosario-tecnico`) al final de la página y enlaces explicativos en el pie de página (`footer`).

## [2026-11-11] update | Limpieza de Textos en Cabecera/Acordeón y Controles de Zoom + Modal a Pantalla Completa en Diagramas
- Se removieron de `apps/web/src/app/page.tsx` el aviso `"¿Dudas con algún término técnico..."` de la cabecera y la insignia `"Stack Activo: wppes-mach-poc-dev-mxc1-stack (CREATE_COMPLETE)"` del acordeón.
- Se eliminó la palabra `"Mermaid"` de los títulos visibles de los paneles 3 y 4 del acordeón y del desplegable de código fuente del diagrama.
- Se incorporaron controles interactivos de zoom (`− Alejar`, `100%`, `+ Acercar`) y un modal `<dialog>` de pantalla completa con zoom hasta `350%` en `MermaidDiagramView` para visualizar ambos diagramas con total nitidez.






