# Frontend Headless (`apps/web`)

Aplicación **Next.js (App Router)** configurada con exportación estática (`output: 'export'`) para su alojamiento en **GitHub Pages**.
Consume exclusivamente la **Experience API (`apps/xapi`)** enviando el token JWT de Cognito y el header de trazabilidad distribuida W3C `traceparent`.

## Comandos de Desarrollo Local

```bash
pnpm --filter web dev
pnpm --filter web build
```

## Enlaces a Documentación Central
- [Arquitectura C4](../../docs/ARCHITECTURE.md)
- [Contratos OpenAPI](../../docs/OPENAPI.yaml)
- [Guía de Despliegue](../../docs/DEPLOYMENT_GUIDE.md)
- [Entidad en LLM Wiki](../../wiki/entities/apps-web.md)
