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
idempotencia. Tarjetas, insights y FX se incorporan sobre los mismos puertos,
envelope y migraciones forward-only.
