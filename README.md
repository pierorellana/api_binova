# BInova API

API NestJS modular de BInova. La fuente de contrato es
`../BInova_Specs_v2.0/BInova_Specs_v2.0/contracts/openapi.yaml`.

## Primera ejecución

```powershell
Copy-Item .env.example .env
npm install
npm run prisma:generate
npm run prisma:deploy
npm run seed
npm run start:dev
```

`DATABASE_URL` debe apuntar a una instancia PostgreSQL disponible. No es necesario
usar Docker; `docker-compose.yml` queda únicamente como alternativa local.

La API escucha en `http://localhost:3000/v1`. Swagger queda disponible en
`http://localhost:3000/docs`.

Credencial demo: `demo@binova.local` / `Demo1234!`.

El API no implementa recuperación de contraseña. Firebase/FCM se integra al cierre,
cuando estén disponibles las credenciales del ambiente.

La vertical actual contiene salud, autenticación con refresh rotatorio, dashboard
server-driven, cuentas, movimientos, perfil/preferencias, dispositivos,
notificaciones y operaciones demo de transferencias, pagos y recargas con
idempotencia. También expone tarjetas virtuales, congelamiento, límites y Wallet,
insights financieros y tipos de cambio detrás de un proveedor FX configurable.

Cuando `FX_PROVIDER_BASE_URL` está vacío se usa el adapter demo determinista. Al
configurarlo, el API usa el proveedor HTTP con timeout, caché fresh/stale y
`FX_UNAVAILABLE` (503) fuera de la ventana stale. La API key, si aplica, solo se
lee en backend mediante variables de entorno.
