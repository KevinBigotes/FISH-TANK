# Contratos SOA · Fases 1 a 4

Todos los servicios exponen `GET /health` como liveness (no comprueba disponibilidad de Supabase). Todas las APIs están versionadas bajo `/api/v1`. Los procesos comparten únicamente utilidades HTTP mediante `@fish-tank/service-core`; cada servicio verifica sus propias solicitudes. La base de datos central es Supabase PostgreSQL.

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

## drawing-processing-service · puerto 3002

| Método y ruta | Autenticación | Resultado |
| --- | --- | --- |
| `GET /health` | Pública | `{ service, status: "ok" o "configuration_required", phase: 2 }`. |
| `GET /api/v1/capabilities` | Pública | `{ data: { ready, maxUploadBytes, moderationSimulated } }`. Comprueba configuración, no conectividad. |
| `POST /api/v1/drawings` | Bearer JWT | Multipart: `name` (1–80 caracteres), `submission_id` (UUID estable por envío), `image` (PNG). Devuelve 201 al crear o 200 al recuperar el mismo envío. |

El JWT se verifica con Supabase Auth **antes** de recibir el archivo. El servidor deriva `creator_id` exclusivamente de ese usuario; rechaza campos adicionales. Límite: 10 envíos por usuario/minuto, 5 MB y 2048 × 2048 píxeles. Se valida la firma PNG y se decodifica la imagen, no se confía solo en su MIME.

Secuencia: consulta del perfil y del envío previo → recorte exacto por canal alfa → moderación → subida a `fish-sprites/<user_id>/<submission_id>.png` → inserción en `fish`. La clave secreta se usa solo en este servicio. La descarga pública del bucket no concede permisos de subida al navegador.

Respuesta de creación:

```json
{
  "data": {
    "fish": { "id": "uuid", "name": "Burbuja", "image_url": "https://.../fish-sprites/usuario/pez.png", "creator_id": "uuid", "created_at": "..." },
    "creator": { "id": "uuid", "username": "creador", "avatar_color": "#36b6aa" },
    "sprite": { "width": 450, "height": 270 },
    "moderation": { "approved": true, "provider": "mock", "simulated": true },
    "replayed": false
  }
}
```

En una recuperación idempotente se devuelven `fish`, `creator` y `replayed: true`; no se repite moderación ni subida. Conserva `submission_id` tras un error de red; genera otro si cambia el nombre o el dibujo.

Errores controlados: 400 datos inválidos, 401 sesión inválida, 409 perfil ausente/envío en curso, 413 tamaño excesivo, 415 formato distinto de PNG, 422 dibujo vacío/corrupto o rechazado, 429 límite de envíos y 503 dependencia no disponible. Un fallo confirmado de inserción intenta eliminar únicamente el PNG de ese envío; ante un resultado incierto se conserva para evitar borrar un archivo que ya tiene registro. Una limpieza fallida queda en los logs para reconciliación.

`MOCK_EXTERNAL_APIS=true` simula únicamente moderación aprobada. En modo real, las claves de Sightengine son obligatorias y cualquier error de su respuesta impide publicar. Se envía a Sightengine una copia con fondo blanco para analizarla; el PNG almacenado conserva transparencia. Los umbrales están en `src/moderation.js`.

Después de guardar, el servicio encola el UUID para el namespace `/publishers` del ecosistema. La cola tiene confirmación y reintentos; una caída de la pecera no revierte el guardado. Si reinicia el proceso, la sincronización desde Supabase recupera los avisos pendientes. La cola está limitada a 1000 UUID en memoria y no se presenta como una cola durable.

## aquarium-ecosystem-service · puerto 3003

La exhibición y sus datos son públicos y de solo lectura. El servicio usa la clave publishable de Supabase con RLS. No utiliza la clave secreta de publicación ni acepta datos de peces desde espectadores.

| Método y ruta | Resultado |
| --- | --- |
| `GET /health` | `{ service, status: "ok", phase: 3 }`; liveness. |
| `GET /api/v1/aquarium` | `{ data: { fish, weather, loaded, source, limit, revision } }`. `source`: loading, ready o unavailable. |
| `GET /api/v1/weather` | Lectura normalizada y su estado ready, stale o unavailable. Nunca devuelve la clave del proveedor. |

| Namespace / evento Socket.io | Dirección y contrato |
| --- | --- |
| `/` · `aquarium:snapshot` | Servidor a pantalla: mismo objeto que `GET /api/v1/aquarium`, al conectar/reconectar y en cada reconciliación. |
| `/` · `fish:added` | Servidor a pantalla: `{ fish, revision, limit }`. Entrada inmediata y deduplicada por UUID. |
| `/` · `weather:updated` | Servidor a pantalla: lectura meteorológica normalizada. |
| `/publishers` · `fish:published` | Dibujos a ecosistema: `{ id: UUID }`; ack `{ ok: boolean, code?: string }`. Requiere `auth.token` igual a `ECOSYSTEM_SERVICE_TOKEN`, rechaza conexiones con Origin de navegador y campos adicionales. |

El ecosistema consulta el UUID en Supabase antes de difundirlo. La instantánea y los eventos usan una misma caché; una lectura iniciada antes de una publicación no puede borrar ese alta concurrente. Los espectadores no tienen eventos de escritura. CORS valida los orígenes tanto en HTTP como en los handshakes de Socket.io; el token del namespace interno autoriza al publicador.

Se mantienen los 200 peces más recientes (`AQUARIUM_MAX_FISH`, entre 1 y 1000) y se reconcilian cada 30 segundos (`AQUARIUM_SYNC_SECONDS`). Este límite corresponde a la exhibición, no elimina registros. Cada pantalla aplica física local; se comparten peces y clima, no posiciones por frame. En esta fase se despliega una instancia del ecosistema; escalar horizontalmente requerirá compartir caché y eventos mediante un adaptador/broker.

El clima usa exclusivamente Current Weather Data 2.5 (`https://api.openweathermap.org/data/2.5/weather`), con coordenadas configurables, idioma español y unidades métricas. No utiliza One Call 3.0. `OPENWEATHER_API_KEY` se configura como variable privada en Render, nunca en React ni en Git. Una consulta por servicio cada 10 minutos abastece a todos los clientes. Amanecer/ocaso se comparan como timestamps UTC; `WEATHER_TIMEZONE` se utiliza para la hora local visible. Los errores 401, respuestas incompletas y fallos de red producen un estado explícito; las lecturas se conservan como stale hasta una hora desde la última consulta correcta (o dos horas desde la observación original). No hay clima ficticio de respaldo.

## gallery-collection-service · puerto 3004

Las rutas siguientes también tienen alias bajo `/api/v1`. El servicio valida el JWT mediante Supabase Auth y usa un cliente con ese token para conservar RLS. Solo necesita la clave publishable/anon.

| Método y ruta | Autenticación | Resultado |
| --- | --- | --- |
| `GET /health` | Pública | `{ service, status: "ok", phase: 4 }`. |
| `GET /api/creators/:id/fish?limit=40&offset=0` | Pública | `{ data: fish[], hasMore }`; máximo 100 por página. Orden por fecha descendente e id. |
| `GET /api/personal-aquarium` | Bearer JWT | `{ data: fish[] }`; unión sin duplicados de propios (`kind: "created"`) y adoptados (`kind: "adopted"`, `saved_at`). |
| `GET /api/personal-aquarium/:fishId` | Bearer JWT | `{ data: { saved: boolean } }` para ese usuario. |
| `POST /api/personal-aquarium/:fishId` | Bearer JWT | Sin cuerpo. 201 al guardar, 200 si ya estaba guardado; `{ data: { saved: true } }`. |
| `DELETE /api/personal-aquarium/:fishId` | Bearer JWT | 204 idempotente; elimina únicamente la relación de guardado del usuario. |

El propietario siempre se deriva de la sesión verificada. No se aceptan datos de propietario en POST. Guardar un pez propio devuelve 409; ya se incluye automáticamente en la colección. UUID/paginación inválidos devuelven 400, sesión inválida 401, pez inexistente 404 y dependencias no disponibles 503. La restricción única resuelve guardados simultáneos sin duplicar filas. Ninguna ruta elimina dibujos ni relaciones de otros usuarios.

El frontend reutiliza el motor Canvas en ambas peceras. La selección invierte traslación, rotación, escala y giro del sprite y consulta su máscara alfa; se elige el pez visible más cercano cuando se superponen. Hay selector de teclado alternativo. La ficha obtiene el perfil de `auth-user-service` y la galería/estado de guardado de este servicio. El avatar usa el color e inicial del perfil existente.

## Configuración y despliegue independiente

Cada directorio incluye `.env.example`. Los servicios de usuarios, ecosistema y colecciones necesitan URL y clave pública reales. El de dibujos necesita además la clave secreta y la configuración de moderación. `INICIAR.cmd` prepara los archivos locales sin sobrescribirlos; los secretos deben configurarse por equipo o en el hosting. Las variables existentes del hosting prevalecen sobre `--env-file-if-exists`.

El monorepo usa pnpm workspaces. En cada despliegue instala desde la raíz y ejecuta `pnpm --filter NOMBRE-DEL-SERVICIO start`. Se puede publicar/versionar `services/_shared` como paquete de infraestructura en una evolución posterior; hoy el contexto de instalación incluye esa biblioteca local. No despliegues una carpeta aislada sin resolver su dependencia `workspace:*`.

CORS permite una lista explícita de orígenes y solicitudes de clientes sin cabecera Origin. CORS no autentica usuarios; la autorización se realiza con JWT + RLS. Cada proceso aplica headers de Helmet, límite JSON de 32 KB, 120 solicitudes/minuto por IP y cierre ordenado. El límite es local al proceso y se puede adaptar para redes compartidas de una exposición antes de abrirla al público.
