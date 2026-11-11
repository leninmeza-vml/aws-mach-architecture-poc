# Experience API (`apps/xapi`)

Microservicio **Experience API (xAPI)** expuesto mediante **Amazon API Gateway v2 (HTTP API)**.
Valida el token JWT en `Authorization: Bearer <token>`, verifica el contrato Zod de entrada, preserva el `traceId` del estándar W3C `traceparent` y delega la orquestación hacia `@poc-mach/papi`.

## Comandos de Desarrollo Local

```bash
pnpm --filter @poc-mach/xapi build
pnpm --filter @poc-mach/xapi test
```

## Enlaces a Documentación Central
- [Arquitectura C4](../../docs/ARCHITECTURE.md)
- [Contratos OpenAPI](../../docs/OPENAPI.yaml)
- [Guía de Despliegue](../../docs/DEPLOYMENT_GUIDE.md)
- [Entidad en LLM Wiki](../../wiki/entities/apps-xapi.md)
