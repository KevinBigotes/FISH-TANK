# FISH TANK · Fase 3

Aplicación: **https://kevinbigotes.github.io/FISH-TANK/**

Aplicación SOA para una exposición colaborativa inspirada en Sketch Aquarium. Incluye autenticación, lienzo táctil, publicación de peces y una pecera comunitaria con Canvas 2D, Socket.io, clima de OpenWeatherMap y acceso por QR. Los clics sobre peces y las colecciones personales quedan pendientes para Fase 4. Esta fase se prueba en local; la URL de Pages conserva la última versión publicada.

## Arrancar en Windows sin npm

Haz doble clic en **`INICIAR.cmd`** o ejecuta desde esta carpeta en PowerShell:

```powershell
.\INICIAR.cmd
```

El lanzador busca Node.js y pnpm, incluyendo el runtime que ya está instalado con Codex en este equipo. Prepara los `.env` locales, instala dependencias cuando cambia el lockfile y arranca el frontend, `auth-user-service`, `drawing-processing-service` y `aquarium-ecosystem-service`. Genera un secreto compartido entre los dos últimos sin mostrarlo ni enviarlo al frontend. No modifica el PATH de Windows ni instala programas globales. Deja esa ventana abierta mientras usas la app.

Abre **http://localhost:5173/#/pecera**. La exhibición es pública; **Dibujar** requiere iniciar sesión. Para detener los servidores, usa `Ctrl+C` en la ventana del lanzador.

```powershell
.\INICIAR.cmd doctor    # Comprueba Node y pnpm
.\INICIAR.cmd install   # Instala las versiones del lockfile
.\INICIAR.cmd test      # Ejecuta las pruebas
.\INICIAR.cmd build     # Genera frontend/dist para producción
.\INICIAR.cmd preview   # Sirve el build en http://localhost:4173
.\INICIAR.cmd lan       # Permite probar el QR desde el teléfono en la misma red
```

El gestor es **pnpm 11.25.0**, con **Node.js 24 o posterior**. Si prefieres terminal y ya tienes pnpm disponible, `pnpm install --frozen-lockfile` y `pnpm dev` siguen funcionando. Que PowerShell no encuentre `npm` no significa que la app esté dañada: este lanzador no depende de npm. En otro equipo sin runtime, instala Node desde [nodejs.org](https://nodejs.org/) y pnpm siguiendo su [instalación oficial](https://pnpm.io/installation).

## Probar la pecera, el QR y la aparición en vivo

1. Detén cualquier instancia anterior con `Ctrl+C`. Haz doble clic en **`INICIAR-LAN.cmd`**, o ejecuta `INICIAR.cmd lan`.
2. Conecta la PC y el teléfono a la misma red. El lanzador muestra direcciones como `http://192.168.1.10:5173/#/pecera`. Abre en la **PC** la dirección de su red Wi-Fi/Ethernet; el QR se construye a partir de esa dirección. Si Windows solicita acceso de Node a la red, permite la red privada que estés utilizando.
3. Pulsa **Ampliar código QR** y escanéalo desde el teléfono. Debe abrir `/#/dibujar`, pedir inicio de sesión si hace falta y conservar el destino tras autenticarte.
4. Publica un pez desde el teléfono. La pantalla de la PC debe incorporarlo sin recargar, con burbujas de entrada, su nombre y movimiento autónomo. Guarda otro para comparar tamaños, velocidades, ondulación y giros suaves en los bordes.
5. Prueba **Pausar animación**, **Pantalla completa** y salir con `Esc`. La animación respeta la preferencia de movimiento reducido y se suspende cuando la pestaña queda oculta.

`localhost` y `127.0.0.1` apuntan al dispositivo que escanea. Para probar un QR entre dispositivos debes abrir la dirección LAN en la PC. Si hay varias direcciones, usa la de la red compartida con el teléfono, no una VPN. En redes que aíslan dispositivos, necesitarás otra red o desplegar los servicios en HTTPS. El modo LAN solo habilita HTTP privado durante desarrollo; los builds de producción mantienen HTTPS para los servicios remotos.

La pecera muestra hasta los **200 peces más recientes**, configurable con `AQUARIUM_MAX_FISH` (hasta 1000) para equilibrar legibilidad y rendimiento. Todos los registros permanecen en Supabase. Una sincronización cada 30 segundos recupera notificaciones perdidas y actualiza eliminaciones; al reconectar, cada pantalla recibe una instantánea y deduplica por UUID. Si no hay peces, se muestra una invitación a crear el primero, sin llenar la base con ejemplos.

El clima se consulta desde `aquarium-ecosystem-service`, una vez cada 10 minutos para todas las pantallas. Configura en su `.env`:

```dotenv
OPENWEATHER_API_KEY=tu_clave
WEATHER_LAT=20.5
WEATHER_LON=-86.95
WEATHER_LOCATION=Cozumel, México
WEATHER_TIMEZONE=America/Cancun
WEATHER_POLL_SECONDS=600
```

La clave entregada ya está guardada localmente. Los horarios de amanecer/ocaso de la API determinan la iluminación, independientemente de la zona horaria de la PC. Lluvia y viento aumentan burbujas, corriente y movimiento de vegetación; de noche aparecen tonos oscuros y brillo bioluminiscente. Si falla la API, se indica la última lectura durante un máximo de una hora; después se muestra **Clima no disponible** y un ambiente neutro. No se inventan lecturas ni se entrega la clave al navegador. Reinicia el lanzador después de cambiar un `.env`.

No hay cambios de esquema SQL en esta fase. Los ejemplos de las pruebas visuales se ejecutan en un servicio temporal con datos en memoria, sin guardar peces de ejemplo en tu Supabase.

## Supabase configurado

La configuración pública está en `frontend/src/lib/project-config.js`. Incluye la URL y la clave **publishable** proporcionadas por el propietario. Esa clave se entrega al navegador por diseño; no contiene una clave `secret` ni `service_role`. Los datos se protegen mediante Supabase Auth y RLS.

Las variables de `frontend/.env` pueden reemplazarla localmente. El lanzador prepara los `.env` de los servicios sin sobrescribir una configuración existente. Todos los `.env` locales están excluidos de Git. La clave secreta de Supabase pertenece únicamente a `services/drawing-processing-service/.env`; nunca a variables `VITE_*` ni al repositorio.

1. Ejecuta completo [schema.sql](schema.sql) en **Supabase → SQL Editor** antes de registrar usuarios nuevos. Puede repetirse sobre su propio esquema sin borrar datos.
2. En **Authentication → URL Configuration**, configura como **Site URL**: `https://kevinbigotes.github.io/FISH-TANK/`.
3. Añade a **Redirect URLs** las direcciones que utilices: `https://kevinbigotes.github.io/FISH-TANK/`, `http://localhost:5173/`, `http://127.0.0.1:5173/`, `http://localhost:4173/` y `http://127.0.0.1:4173/`.
4. Mantén habilitado el proveedor de correo y contraseña. El proyecto requiere confirmación por correo.

El retorno de confirmación apunta al index, **sin `/#/login`**. El SDK intercambia el código PKCE antes de montar `HashRouter`. Abre el correo en el mismo navegador/origen del registro; si lo confirmas en otro dispositivo, vuelve a login y usa correo y contraseña una vez confirmado.

Para comprobar conectividad sin crear usuarios ni leer perfiles: `node scripts/verify-supabase.mjs`.

## Probar registro y login

1. Abre `/#/registro`, elige un nombre de creador único, correo real, contraseña de al menos 8 caracteres y color.
2. Pulsa **Crear mi cuenta** y confirma el correo. El trigger crea automáticamente `profiles` con el mismo UUID que `auth.users`, incluso antes de tener una sesión confirmada. Un nombre ocupado revierte el registro completo.
3. Abre `/#/login`. Después de autenticarte llegarás a `/#/pecera`; la sesión se conserva al recargar.
4. En local, con `auth-user-service` encendido, prueba **Editar mi perfil**, guarda y recarga para comprobar persistencia.
5. Cierra sesión y abre `/#/dibujar` o `/#/mi-pecera`. Debes regresar a login y recuperar el destino tras autenticarte.

Las cuentas anteriores a la instalación del trigger no reciben un perfil retroactivamente. Usa cuentas nuevas después de ejecutar el SQL. Si no llega el correo, revisa **Auth Logs** y la configuración de SMTP de Supabase; la entrega depende del proveedor y sus límites.

## Probar la creación de un pez

La configuración local de este equipo ya incluye la clave secreta proporcionada y `MOCK_EXTERNAL_APIS=true`. El bucket público `fish-sprites` ya está preparado. No necesitas volver a ejecutar `schema.sql` para esta prueba.

1. Ejecuta `INICIAR.cmd` y abre **http://localhost:5173/#/dibujar**. Si no hay sesión, inicia sesión con tu cuenta existente.
2. Dibuja con el dedo, lápiz o ratón. Prueba los colores, tres grosores, borrador, **Deshacer** y **Limpiar**. También puedes deshacer una limpieza. La guía del pez mira a la derecha y no se exporta.
3. Escribe un nombre y pulsa **Soltar a la Pecera Comunitaria**. Se rechazan un lienzo vacío y un nombre en blanco; durante el envío se conservan y bloquean los controles.
4. Comprueba la postal con el dibujo recortado, nombre del pez y `@creador`. **Descargar mi pez** guarda un PNG transparente. **Ir a la Pecera Comunitaria** abre la exhibición en vivo.
5. En **Supabase → Table Editor → fish**, verifica `name`, `image_url` y `creator_id`; este último debe coincidir con el `id` de tu fila en `profiles`. En **Storage → fish-sprites**, encontrarás `<creator_id>/<fish_id>.png`.

Solo se simula la aprobación de moderación: **el PNG y la fila de `fish` son reales**. Si falla una conexión, conserva el dibujo y reintenta sin modificarlo: se reutiliza el identificador para evitar duplicados. La moderación simulada acepta cualquier contenido; úsala solo para las pruebas, no para abrir la exposición al público.

Si copias el proyecto a otro equipo, completa `SUPABASE_SECRET_KEY` en `services/drawing-processing-service/.env`. El servicio puede crear el bucket al publicar el primer pez; también puedes prepararlo con `pnpm --filter drawing-processing-service run setup` o ejecutar [phase-2.sql](services/drawing-processing-service/sql/phase-2.sql) en el SQL Editor. Este SQL no borra datos y mantiene bloqueadas las subidas directas del navegador.

Para activar Sightengine, configura `SIGHTENGINE_API_USER`, `SIGHTENGINE_API_SECRET` y `MOCK_EXTERNAL_APIS=false` en el backend y reinicia el lanzador. Se consultan los modelos `nudity-2.1`, `offensive` y `gore-2.0`. Una respuesta rechazada, incompleta o no disponible impide la publicación. Las credenciales nunca se envían al frontend. Consulta la [documentación oficial de Sightengine](https://sightengine.com/docs/).

## GitHub Pages: publicar la aplicación

Este repositorio usa **`master`**. El workflow `.github/workflows/pages.yml` se ejecuta al subir cambios a `master` o `main`, y también manualmente. Instala dependencias, prueba los servicios/esquema, compila Vite y publica **`frontend/dist`**, cuyo archivo de entrada es `index.html`.

En [Settings → Pages](https://github.com/KevinBigotes/FISH-TANK/settings/pages), **Source debe ser GitHub Actions**. Publicar `master / (root)` con Jekyll muestra el README porque el index de la aplicación se genera durante la compilación. No muevas el index fuente a la raíz ni guardes `node_modules` o `dist` en Git.

La URL y clave públicas de Supabase ya están incorporadas a la configuración. No hace falta crear variables de Actions para que el registro y login funcionen. Para reemplazarlas en otro despliegue, usa estas variables del repositorio:

| Variable opcional | Uso |
| --- | --- |
| `VITE_SUPABASE_URL` | Reemplaza la URL del proyecto. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Reemplaza su clave pública. |
| `VITE_AUTH_USER_SERVICE_URL` | URL HTTPS del servicio Node, sin `/api/v1`. |
| `VITE_DRAWING_PROCESSING_SERVICE_URL` | URL HTTPS del servicio de dibujos, sin `/api/v1`. |
| `VITE_AQUARIUM_ECOSYSTEM_SERVICE_URL` | URL HTTPS del servicio de la pecera, sin `/api/v1` ni namespace. |

**GitHub Pages aloja el frontend, no los procesos Node.** Registro, confirmación y login se conectan directamente a Supabase y funcionan sin un servidor Node publicado. La consulta/edición de perfiles sigue pasando por `auth-user-service`: hasta desplegarlo y configurar su URL, Pages muestra que el servicio de perfiles está pendiente. No se consulta PostgreSQL directamente desde React como alternativa oculta.

Para habilitar perfiles en producción, despliega el servicio desde la raíz del monorepo con `pnpm install --frozen-lockfile` y `pnpm --filter auth-user-service start`. Configura `HOST=0.0.0.0`, el `PORT` del proveedor, la URL/clave pública de Supabase y `CORS_ORIGINS=https://kevinbigotes.github.io`. Ajusta `TRUST_PROXY_HOPS` a los proxies reales. Añade su URL HTTPS a Actions y vuelve a ejecutar el workflow.

Para publicar peces desde Pages, despliega también `drawing-processing-service` con `pnpm --filter drawing-processing-service start`, configura sus variables de servidor y añade su URL HTTPS a `VITE_DRAWING_PROCESSING_SERVICE_URL`. La clave secreta se configura en el hosting del backend. Pages no puede ejecutar Node ni usar el `localhost` de tu PC desde otro dispositivo.

Para la exhibición en Pages, despliega `aquarium-ecosystem-service` con soporte de WebSocket y configura `VITE_AQUARIUM_ECOSYSTEM_SERVICE_URL`. Pon el mismo `ECOSYSTEM_SERVICE_TOKEN` en ambos backends y `AQUARIUM_ECOSYSTEM_SERVICE_URL` en el servicio de dibujos. Ese enlace entre servicios debe usar HTTPS fuera de la PC. Añade `https://kevinbigotes.github.io` a los orígenes permitidos. La pecera solo necesita la clave pública de Supabase; OpenWeatherMap y el token interno permanecen en el backend.

`frontend/.env.production` deja vacías las URLs de los tres servicios para impedir que un build local publique direcciones `localhost`. Las variables de Actions pueden reemplazarlas. Se conservan `base: './'` y rutas `/#/login`, `/#/registro`, `/#/pecera`, `/#/dibujar` y `/#/mi-pecera`, compatibles con enlaces directos y QR.

## Arquitectura y acceso

| Componente | Puerto local | Estado |
| --- | --- | --- |
| `frontend` | 5173 | React + Vite + Tailwind CSS; autenticación, lienzo, postal, Canvas 2D y QR. |
| `auth-user-service` | 3001 | Express; verifica JWT, consulta/edita perfiles y consulta creadores. |
| `drawing-processing-service` | 3002 | JWT verificado, recorte PNG, moderación, Storage y publicación de `fish`. |
| `aquarium-ecosystem-service` | 3003 | Exhibición pública, sincronización de peces, publicación entre servicios y clima. |
| `gallery-collection-service` | 3004 | Base ejecutable. Funcionalidad reservada para Fase 4. |

Cada servicio tiene proceso, puerto, paquete y configuración propios. `services/_shared` es una biblioteca HTTP sin estado ni lógica de negocio. Los despliegues usan la raíz como contexto de instalación y ejecutan solo el servicio elegido. Consulta los [contratos de servicios](services/README.md).

| Tabla | Lectura | Escritura |
| --- | --- | --- |
| `profiles` | Pública, sin correos. | Trigger de registro; el dueño modifica nombre, color y bio. UUID y fecha son inmutables. |
| `fish` | Pública. | Solo el backend publica después de verificar al creador y moderar. Escritura directa desde navegador bloqueada. |
| `personal_aquarium_fish` | Solo el dueño. | Guardar/eliminar favoritos propios, incluidos peces ajenos; `UNIQUE(user_id, fish_id)` evita duplicados. Sin API/UI todavía. |

Las pruebas ejecutan `schema.sql` en PostgreSQL embebido (PGlite), emulando únicamente el esquema de Auth. Comprueban RLS, recorte, moderación, fallos de guardado y publicación HTTP seguida de eventos Socket.io reales entre procesos lógicos. Cubren permisos del namespace interno, reconexión, deduplicación, sincronización concurrente, clima y caducidad, giros y límites de física, y decodifican los QR con un lector independiente. Las dependencias externas se sustituyen en las pruebas; no se crean cuentas ni peces reales. La prueba con tu sesión se realiza siguiendo los pasos anteriores.

Referencias: [Supabase Auth y perfiles](https://supabase.com/docs/guides/auth/managing-user-data), [claves públicas](https://supabase.com/docs/guides/api/api-keys), [publicación de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

Fase 3: [entrega y recuperación de eventos Socket.io](https://socket.io/docs/v4/delivery-guarantees/), [clima actual de OpenWeatherMap](https://openweathermap.org/api/current), [qrcode.react](https://github.com/zpao/qrcode.react).
