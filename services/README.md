# Contratos SOA · Fase 1

Todos los servicios exponen `GET /health` como liveness (no comprueba disponibilidad de Supabase). Todas las APIs están versionadas bajo `/api/v1`. Los procesos comparten únicamente utilidades HTTP mediante `@soaylemer/service-core`; no se invocan entre sí en Fase 1. La base de datos central es Supabase PostgreSQL.

## auth-user-service · puerto 3001

| Método y ruta | Autenticación | Resultado |
| --- | --- | --- |
| `GET /health` | Pública | `{ service, status: "ok", phase: 1 }` |
| `GET /api/v1/session` | Bearer JWT | Identidad verificada: `id`, `email`, `email_confirmed_at`. No devuelve tokens. |
| `GET /api/v1/me` | Bearer JWT | Perfil propio. |
| `PATCH /api/v1/me` | Bearer JWT | Modifica `username`, `avatar_color`, `bio`. Rechaza campos adicionales. |
| `GET /api/v1/creators?q=&limit=20&offset=0` | Pública | Perfiles públicos, ordenados por username/id. Límite máximo 50. |
| `GET /api/v1/creators/:id` | Pública | Perfil público por UUID. |

Una respuesta de datos usa `{ "data": ... }`. Las listas incluyen `{ "pagination": { "limit": 20, "offset": 0 } }`. Un error usa `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` y el estado HTTP correspondiente (400/401/403/404/409/413/429/500/503).

Ejemplo de edición:

```http
PATCH /api/v1/me
Authorization: Bearer <access_token_de_Supabase>
Content-Type: application/json

{"bio":"Me gusta imaginar océanos.","avatar_color":"#36b6aa"}
```

El usuario se deriva del token verificado, nunca de un `user_id` enviado en el cuerpo. El cliente Supabase de cada solicitud lleva ese mismo JWT: las políticas RLS siguen aplicándose. El cliente público usa una clave publishable/anon, nunca administrativa.

La gestión del ciclo de sesión se divide explícitamente: el SDK oficial en React implementa registro/login, confirmación, almacenamiento local, renovación y cierre de sesión del dispositivo; este servicio valida la identidad para las operaciones de perfiles. Las contraseñas y refresh tokens no atraviesan estos endpoints. `signOut({ scope: 'local' })` cierra la sesión de este navegador. Los JWT ya emitidos tienen su propia caducidad; no se promete revocación instantánea del access token.

## Servicios reservados

| Servicio | Puerto | Contrato provisional |
| --- | --- | --- |
| drawing-processing-service | 3002 | `GET /health` y `501 PHASE_NOT_IMPLEMENTED` bajo `/api/v1`. |
| aquarium-ecosystem-service | 3003 | Lo mismo, más Socket.io instalado sobre su servidor HTTP. Toda conexión devuelve `connect_error` con `data.code = PHASE_NOT_IMPLEMENTED`. |
| gallery-collection-service | 3004 | `GET /health` y `501 PHASE_NOT_IMPLEMENTED` bajo `/api/v1`. |

No hay recepción de archivos, recorte, Storage, moderación, listeners de peces, clima, simulación ni CRUD de colecciones en esta entrega. La autenticación de sockets y los contratos de eventos se definirán al implementar Fase 3, antes de habilitar conexiones.

## Configuración y despliegue independiente

Cada directorio incluye `.env.example`. Copiarlo a `.env` es opcional para los servicios reservados mientras sus puertos y orígenes por defecto sean suficientes. El servicio de usuarios necesita URL y clave pública reales. Las variables existentes del hosting prevalecen sobre `--env-file-if-exists`.

El monorepo usa pnpm workspaces. En cada despliegue instala desde la raíz y ejecuta `pnpm --filter NOMBRE-DEL-SERVICIO start`. Se puede publicar/versionar `services/_shared` como paquete de infraestructura en una evolución posterior; hoy el contexto de instalación incluye esa biblioteca local. No despliegues una carpeta aislada sin resolver su dependencia `workspace:*`.

CORS permite una lista explícita de orígenes y solicitudes de clientes sin cabecera Origin. CORS no autentica usuarios; la autorización se realiza con JWT + RLS. Cada proceso aplica headers de Helmet, límite JSON de 32 KB, 120 solicitudes/minuto por IP y cierre ordenado. El límite es local al proceso y se puede adaptar para redes compartidas de una exposición antes de abrirla al público.
