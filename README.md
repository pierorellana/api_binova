# BInova API

API REST modular NestJS de BInova. El contrato ejecutable está en [`../context_specs/contracts/openapi.yaml`](../context_specs/contracts/openapi.yaml) y la API se expone bajo `/v1`.

## Primera ejecución

```bash
cp .env.example .env
npm ci
npm run prisma:generate
docker compose up -d postgres
npm run prisma:deploy
npm run seed
npm run start:dev
```

`DATABASE_URL` debe apuntar a PostgreSQL. Docker Compose es opcional si ya existe una instancia local.

- API: `http://localhost:3000/v1`
- Swagger: `http://localhost:3000/docs`
- Credencial demo: `demo@binova.local` / `Demo1234!`

## Respuestas

Todas las respuestas HTTP generadas por la API contienen `data`, `message` y `statusCode`. `meta` preserva correlación y paginación:

```json
{
  "data": [{ "id": "account-1" }],
  "message": "Operación exitosa.",
  "statusCode": 200,
  "meta": {
    "traceId": "api-...",
    "generatedAt": "2026-10-05T12:00:00.000Z",
    "nextCursor": null
  }
}
```

Los errores usan `data: null`, `message`, `statusCode`, `code`, `details` y `meta`. Los códigos estables permiten que Flutter resuelva sesión expirada, validaciones, conflictos de idempotencia y dependencias no disponibles sin interpretar mensajes técnicos.

Las solicitudes pueden enviar `X-Correlation-Id`; si falta, NestJS genera uno y lo devuelve en el mismo header. Las escrituras financieras requieren `Idempotency-Key`.

## Logs y observabilidad

La API usa el `ConsoleLogger` JSON de NestJS. El interceptor registra un evento `api_request` por solicitud con evento, método, ruta, status, latencia, código de error y correlación. Las llamadas a FX registran `dependency_call` con latencia y resultado.

No se registran cuerpos, headers de autorización, refresh/access tokens, credenciales, API keys, saldos, PAN/CVV, números completos de cuenta/tarjeta ni claves de idempotencia. La redacción se aplica antes de serializar el evento.

Ejemplo de consulta sin exponer secretos:

```bash
curl -i http://localhost:3000/v1/health \
  -H 'X-Correlation-Id: smoke-health-2026-10-05'
```

## Notificaciones push Android

La API integra Firebase Admin SDK.

Android activos registrados en /v1/devices. Las operaciones financieras nuevas y la
creación de una tarjeta virtual persisten primero una notificación en el inbox; después
del commit se intenta el envío push. Una falla de FCM no revierte la operación ni elimina
la notificación persistida.

Configura localmente, sin versionar el archivo de credenciales:

~~~dotenv
FIREBASE_SERVICE_ACCOUNT_PATH=./binova-92083-firebase-adminsdk-fbsvc-9500400d3b.json
PUSH_ENABLED=true
PUSH_TEST_ENDPOINT_ENABLED=true
~~~

FIREBASE_SERVICE_ACCOUNT_PATH apunta al JSON de cuenta de servicio descargado desde
Firebase Console > Project settings > Service accounts. El JSON y sus claves privadas
están excluidos por .gitignore; en producción se recomienda usar un secreto montado
por el entorno y mantener PUSH_TEST_ENDPOINT_ENABLED=false.

Con un access token válido, la ruta de prueba crea una notificación no sensible y usa el
mismo flujo de persistencia/envío:

~~~bash
curl -i -X POST http://localhost:3000/v1/notifications/test -H "Authorization: Bearer $ACCESS_TOKEN" -H 'X-Correlation-Id: push-smoke-2026-10-05'
~~~

La respuesta es 202 con el envelope estándar. El payload FCM contiene únicamente
type, notificationId, resourceType y resourceId; nunca contiene saldos, montos,
tokens, PAN/CVV ni números completos de cuenta. Los logs de entrega registran conteos,
estado y códigos seguros del proveedor, nunca el token FCM ni el cuerpo de negocio.

## Capacidades implementadas

La vertical actual incluye salud, autenticación con refresh rotatorio, dashboard server-driven, cuentas, movimientos, perfil/preferencias, dispositivos, inbox de notificaciones, operaciones demo de transferencias/pagos/recargas con idempotencia, tarjetas virtuales, congelamiento, límites, provisión a Wallet, insights financieros y tipos de cambio detrás de un adapter.

Cuando `FX_PROVIDER_BASE_URL` está vacío se usa el adapter demo determinista. Al configurarlo, el adapter HTTP aplica timeout, caché fresh/stale y responde `FX_UNAVAILABLE` (503) fuera de la ventana stale. Las credenciales del proveedor solo se leen en el backend mediante variables de entorno.

## Verificación

```bash
npm test -- --runInBand
npm run build
npx prisma validate
```

## Límites conocidos frente a la prueba

El API no implementa recuperación de contraseña. Crashlytics/Sentry, dashboards/alertas
de producción, validación OpenAPI en CI y un flujo E2E crítico todavía necesitan
integración o evidencia adicional. Push está implementado para Android, pero aún falta
la validación manual en un dispositivo/emulador Firebase con el API accesible por red.
El reporte completo está en ../context_specs/evidence/technical-test-gap-report-2026-10-05.md.
