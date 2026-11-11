# Process API (`apps/papi`)

Microservicio **Process API (pAPI)** encargado de la orquestación y aplicación de reglas de negocio (evaluación de riesgo transaccional y estados). No se conecta directamente a PostgreSQL ni expone endpoints públicos a internet; delega toda persistencia a `@poc-mach/sapi`.

## Comandos de Desarrollo Local

```bash
pnpm --filter @poc-mach/papi build
pnpm --filter @poc-mach/papi test
```

## Enlaces a Documentación Central
- [Arquitectura C4](../../docs/ARCHITECTURE.md)
- [Contratos OpenAPI](../../docs/OPENAPI.yaml)
- [Guía de Despliegue](../../docs/DEPLOYMENT_GUIDE.md)
- [Entidad en LLM Wiki](../../wiki/entities/apps-papi.md)
