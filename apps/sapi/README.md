# System API (`apps/sapi`)

Microservicio **System API (sAPI)** dentro de la arquitectura **API-Led Connectivity**.
Se despliega dentro de las subredes privadas aisladas de la VPC y es el único servicio con acceso al puerto `5432` de Amazon RDS PostgreSQL / YugabyteDB a través de `@poc-mach/database`.

## Comandos de Desarrollo Local

```bash
pnpm --filter @poc-mach/sapi build
pnpm --filter @poc-mach/sapi test
```

## Enlaces a Documentación Central
- [Arquitectura C4](../../docs/ARCHITECTURE.md)
- [Contratos OpenAPI](../../docs/OPENAPI.yaml)
- [Guía de Despliegue](../../docs/DEPLOYMENT_GUIDE.md)
- [Entidad en LLM Wiki](../../wiki/entities/apps-sapi.md)
