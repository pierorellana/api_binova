# BInova API

API REST modular de BInova construida con NestJS, TypeScript, Prisma y PostgreSQL. El contrato ejecutable se encuentra en ../context_specs/contracts/openapi.yaml y la API se expone bajo /v1.

## Estado actual

La API cubre autenticación con refresh rotatorio, dashboard, cuentas, movimientos, operaciones financieras demo, tarjetas virtuales, preferencias, dispositivos, inbox de notificaciones, Firebase Admin, observabilidad estructurada, idempotencia y tipos de cambio mediante adapter.

La implementación está en main. La validación automatizada registrada incluye la suite API y el build de NestJS aprobados. La evidencia consolidada se mantiene en ../context_specs/evidence/.

## Primera ejecución local

Requisitos:

- Node.js compatible con el lockfile del proyecto.
- Docker y Docker Compose, o una instancia PostgreSQL local.
- Variables de entorno configuradas en .env.
- Archivo de cuenta de servicio Firebase solo si se desean probar envíos push reales.

Comandos:

    cp .env.example .env
    npm ci
    npm run prisma:generate
    docker compose up -d postgres
    npm run prisma:deploy
    npm run seed
    npm run start:dev

Si PostgreSQL ya está disponible, Docker Compose es opcional. DATABASE_URL debe apuntar a la base binova.

Endpoints locales:

- API: http://localhost:3000/v1
- Health: http://localhost:3000/v1/health
- Swagger: http://localhost:3000/docs
- Credencial demo: demo@binova.local / Demo1234!

## Variables principales

Revisa .env.example antes de iniciar. Las variables relevantes son:

- NODE_ENV y PORT.
- DATABASE_URL.
- JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_ACCESS_TTL y JWT_REFRESH_TTL.
- FX_PROVIDER_BASE_URL, FX_PROVIDER_NAME, FX_PROVIDER_API_KEY, FX_PROVIDER_TIMEOUT_MS, FX_CACHE_TTL_SECONDS y FX_STALE_MAX_AGE_SECONDS.
- FIREBASE_SERVICE_ACCOUNT_PATH, PUSH_ENABLED y PUSH_TEST_ENDPOINT_ENABLED.

No se deben versionar .env, cuentas de servicio, claves privadas, tokens, API keys ni dumps de base de datos.

## Contrato de respuestas

Las respuestas HTTP exitosas usan el envelope estándar:

    {
      "data": {},
      "message": "Operación exitosa.",
      "statusCode": 200,
      "meta": {
        "traceId": "api-...",
        "generatedAt": "2026-10-05T12:00:00.000Z",
        "nextCursor": null
      }
    }

Los errores conservan data como null y agregan code, details y meta. Los códigos estables permiten que Flutter resuelva sesión expirada, validaciones, conflictos de idempotencia y dependencias no disponibles sin interpretar mensajes técnicos.

Las solicitudes pueden enviar X-Correlation-Id. Si falta, la API genera uno y lo devuelve en el mismo header. Las escrituras financieras requieren Idempotency-Key.

## Logs y observabilidad

NestJS emite logs estructurados en JSON. Cada solicitud genera un evento api_request con método, ruta, status, latencia, error seguro y correlación. Las llamadas al proveedor FX generan dependency_call con latencia y resultado.

La redacción se aplica antes de serializar el evento. No se registran cuerpos, headers de autorización, access/refresh tokens, credenciales, API keys, saldos, PAN/CVV, números completos de cuenta o tarjeta ni claves de idempotencia.

Smoke de health con correlación:

    curl -i http://localhost:3000/v1/health \
      -H 'X-Correlation-Id: smoke-health-2026-10-05'

## Notificaciones push Android

Firebase Admin está integrado para Android. Los dispositivos activos se registran en /v1/devices. Las operaciones financieras nuevas y la creación de una tarjeta virtual persisten primero una notificación en el inbox; después del commit se intenta el envío push. Una falla de FCM no revierte la operación ni elimina la notificación persistida.

Configuración local, sin versionar el JSON:

    FIREBASE_SERVICE_ACCOUNT_PATH=./binova-92083-firebase-adminsdk-fbsvc-9500400d3b.json
    PUSH_ENABLED=true
    PUSH_TEST_ENDPOINT_ENABLED=true

FIREBASE_SERVICE_ACCOUNT_PATH apunta al JSON descargado desde Firebase Console > Project settings > Service accounts. En un ambiente desplegado se recomienda montar el secreto desde el proveedor de infraestructura y mantener PUSH_TEST_ENDPOINT_ENABLED=false.

Con un access token válido, la ruta de prueba crea una notificación no sensible:

    curl -i -X POST http://localhost:3000/v1/notifications/test \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H 'X-Correlation-Id: push-smoke-2026-10-05'

La respuesta es 202 con el envelope estándar. El payload FCM solo contiene type, notificationId, resourceType y resourceId. Nunca contiene saldos, montos, tokens, PAN/CVV ni números completos de cuenta o tarjeta. Los logs registran conteos, estado y códigos seguros del proveedor, nunca el token FCM ni el cuerpo de negocio.

La funcionalidad Android fue validada manualmente por el usuario en primer plano, segundo plano y app terminada. La evidencia está en ../context_specs/evidence/android-push-validation-2026-10-05.md. iOS queda fuera del alcance de esta iteración.

## FX y dependencias externas

Cuando FX_PROVIDER_BASE_URL está vacío se usa el adapter demo determinista. Al configurarlo, el adapter HTTP aplica timeout, caché fresh/stale y responde FX_UNAVAILABLE (503) fuera de la ventana stale. Las credenciales del proveedor solo se leen en el backend mediante variables de entorno.

## Verificación

    npm test -- --runInBand --watchman=false
    npm run build
    npx prisma validate

La estrategia, los comandos y los resultados documentados se encuentran en ../context_specs/testing/test-strategy.md y ../context_specs/evidence/technical-test-gap-report-2026-10-05.md.

## Pendientes reales

Frente a la prueba técnica todavía quedan tareas de integración o entrega:

- Recuperación de contraseña completa en backend.
- Demostración con proveedor FX externo real configurado.
- CI para análisis, tests, build, contrato OpenAPI, migraciones desde cero y secret scan.
- Crashlytics/Sentry, métricas persistidas, dashboards y alertas de producción.
- Secretos y despliegue reproducible para un ambiente remoto.
- Runbook de release, rollback y operación.
- Segundo smoke financiero con transferencias, Face ID, procesamiento y resultado.

El reporte completo de alcance está en ../context_specs/evidence/technical-test-gap-report-2026-10-05.md.
