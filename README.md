# FISH TANK · Fase 1

Base de una exposición colaborativa inspirada en Sketch Aquarium. Esta entrega incluye arquitectura SOA, Supabase Auth, perfiles, rutas protegidas y un frontend estático para GitHub Pages. **No incluye lienzo, procesamiento de imágenes, peces animados, clima ni colecciones funcionales.**

## Arquitectura

| Componente | Puerto local | Responsabilidad y estado |
| --- | --- | --- |
| `frontend` | 5173 | React + Vite + Tailwind CSS; registro, login, sesión persistente y edición de perfil. |
| `auth-user-service` | 3001 | Express; verifica sesiones con Supabase, consulta y actualiza perfiles, consulta creadores. Implementado. |
| `drawing-processing-service` | 3002 | Express; base para recepción, recorte, moderación y subida. Fase 2. |
| `aquarium-ecosystem-service` | 3003 | Express + Socket.io; transporte instalado con conexiones deshabilitadas. Pecera y clima: Fase 3. |
| `gallery-collection-service` | 3004 | Express; base para consultas de peces y colecciones personales. Fase 4. |

Cada servicio tiene su propio proceso, puerto, paquete, variables de entorno y comando de arranque. No dependen de que los otros estén encendidos. `services/_shared` es una biblioteca de infraestructura HTTP, no un quinto servicio. Se instala como dependencia del workspace y no comparte estado ni lógica de negocio. Los despliegues independientes usan la raíz del monorepo como contexto de instalación y ejecutan solo el servicio elegido.

El navegador se autentica directamente con Supabase Auth, que conserva las contraseñas y emite/renueva los tokens. Para perfiles, el frontend envía `Authorization: Bearer <access_token>` a `auth-user-service`. Este valida el token con `auth.getUser()` y consulta PostgreSQL con el JWT del visitante, respetando RLS. Ninguna clave administrativa es necesaria en esta fase.

## 1. Preparar Supabase

1. Crea un proyecto de Supabase.
2. Abre **SQL Editor**, pega **todo el archivo [schema.sql](schema.sql)** y ejecuta el script antes de registrar usuarios.
3. En **Authentication**, habilita el proveedor de correo y contraseña. Conserva **Confirm email** activado para probar el flujo completo.
4. En **Authentication → URL Configuration**, usa `http://localhost:5173/` como Site URL local y añade la misma dirección a Redirect URLs. Si usarás `http://127.0.0.1:5173/`, añade esa dirección también. Para `pnpm preview`, añade `http://localhost:4173/` y/o `http://127.0.0.1:4173/`.
5. Copia la **Project URL** y la **Publishable key** desde la configuración API del proyecto. También se admite la clave pública `anon` heredada. No uses `service_role` ni `sb_secret_...`.

El script crea `profiles`, `fish` y `personal_aquarium_fish`, sus FK, índices, restricciones y RLS. El trigger de `auth.users` crea el perfil en la misma transacción del registro, aun cuando la confirmación de correo deje la sesión pendiente. Los nombres de creador son únicos: 3–40 letras minúsculas, números o `_`. Si el nombre está ocupado, el registro completo se revierte y la interfaz pide otro nombre. No se publican los correos en `profiles`.

Los usuarios creados **antes** de instalar el trigger no reciben un perfil retroactivamente. En esta base nueva, ejecuta el SQL primero y registra cuentas nuevas para la prueba. El archivo puede repetirse sobre su propio esquema sin borrar datos; no reemplaza migraciones de un esquema ajeno.

## 2. Configurar el proyecto local

Requisitos: Node.js 24 o posterior y pnpm 11.25.0. Si aún no tienes pnpm: `npm install --global pnpm@11.25.0`.

Desde la raíz del repositorio, en PowerShell:

```powershell
Copy-Item frontend/.env.example frontend/.env
Copy-Item services/auth-user-service/.env.example services/auth-user-service/.env
pnpm install --frozen-lockfile
```

Edita `frontend/.env`:

```dotenv
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICA
VITE_AUTH_USER_SERVICE_URL=http://localhost:3001
```

Edita `services/auth-user-service/.env` con **el mismo proyecto**:

```dotenv
PORT=3001
HOST=127.0.0.1
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICA
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173
TRUST_PROXY_HOPS=0
```

Los `.env` están excluidos de Git. Las variables `VITE_*` se incorporan al JavaScript público durante el build: aquí solo se incluyen una clave pública y URLs. Después de modificar variables, reinicia Vite; en GitHub Pages debes volver a compilar/publicar.

## 3. Probar registro e inicio de sesión

```powershell
pnpm dev
```

Este comando levanta **solo el frontend y auth-user-service**. Comprueba `http://localhost:3001/health` si el perfil no carga.

1. Abre [Registro local](http://localhost:5173/#/registro). Elige un nombre de creador que no exista, un correo que puedas recibir, una contraseña de al menos 8 caracteres y un color.
2. Pulsa **Crear mi cuenta**. Con confirmación habilitada verás un aviso para revisar el correo. En Supabase deben aparecer un usuario en **Authentication → Users** y un perfil con el mismo UUID en **Table Editor → profiles**.
3. Abre el enlace del correo **en el mismo navegador y origen donde te registraste**. PKCE guarda el verificador allí. Se vuelve al index estático con `?code=...`; el SDK termina la autenticación antes de montar `HashRouter`. Si confirmas desde otro dispositivo y no se puede abrir la sesión automática, vuelve a login e inicia sesión con correo y contraseña después de confirmar.
4. Abre [Inicio de sesión](http://localhost:5173/#/login) e inicia sesión. Debes llegar a `/#/pecera` y ver tu perfil real. Si desactivaste temporalmente Confirm email en un proyecto de pruebas, el registro entra directamente.
5. Edita tu biografía/color, guarda y recarga. Los cambios deben persistir en Supabase. La sesión debe mantenerse al recargar.
6. Navega a `/#/dibujar` y `/#/mi-pecera`: solo muestran avisos de las fases futuras. Cierra sesión y vuelve a una de esas URLs: debes regresar a login; tras iniciar sesión, se recupera el destino solicitado.
7. Prueba una contraseña incorrecta, contraseñas de registro que no coincidan y un nombre ya ocupado. Verás mensajes de error sin crear un perfil duplicado.

Supabase puede limitar el envío de correos o restringir destinatarios con su proveedor de correo predeterminado. Para recibir confirmaciones durante una exposición configura tu SMTP en Supabase. Si llega un error de entrega/límite, revisa Auth Logs. En un proyecto **solo de pruebas**, puedes desactivar Confirm email para verificar registro y login sin envío de correo; esa variante no comprueba la entrega ni el retorno PKCE.

## Políticas de acceso incluidas

| Tabla | Lectura | Escritura desde clientes anon/authenticated |
| --- | --- | --- |
| `profiles` | Pública: nombre, color, bio y metadatos públicos. | Solo el dueño modifica `username`, `avatar_color` y `bio`. Insertar corresponde al trigger. No puede cambiar `id` ni `created_at`. |
| `fish` | Pública. | Deshabilitada en Fase 1. La publicación moderada se diseñará en Fase 2. |
| `personal_aquarium_fish` | Solo el dueño de la colección. | El dueño puede insertar/eliminar guardados propios. Puede guardar peces ajenos; `UNIQUE(user_id, fish_id)` evita duplicados. No hay API/UI de colección aún. |

Las FK usan eliminación en cascada: al borrar un creador se eliminan sus peces y las referencias a esos peces en colecciones. Las pruebas automatizadas verifican este comportamiento.

## GitHub Pages

`frontend/vite.config.js` contiene **`base: './'`**. React usa **HashRouter**, con rutas `/#/login`, `/#/registro`, `/#/pecera`, `/#/dibujar` y `/#/mi-pecera`. Los enlaces bajo un repositorio quedan como `https://TU-USUARIO.github.io/TU-REPO/#/pecera`; el servidor recibe la ruta del index, por lo que las rutas internas no necesitan reglas de reescritura ni un `404.html` especial.

**GitHub Pages aloja únicamente el frontend estático.** Los servicios Node/Express/Socket.io requieren un hosting de procesos Node con HTTPS y, para Fase 3, soporte de WebSockets. Esta entrega prepara el despliegue; no publica ni crea recursos externos.

1. Despliega `auth-user-service` en tu hosting Node desde la raíz de este monorepo: instala con `pnpm install --frozen-lockfile` y arranca con `pnpm --filter auth-user-service start`. Configura sus variables, usa `HOST=0.0.0.0` y el `PORT` del hosting.
2. Añade `https://TU-USUARIO.github.io` a `CORS_ORIGINS` del servicio (sin `/TU-REPO/`). Ajusta `TRUST_PROXY_HOPS` a la topología real del proveedor; no confíes indiscriminadamente en cabeceras reenviadas.
3. En Supabase añade `https://TU-USUARIO.github.io/TU-REPO/` a **Redirect URLs** y úsala como **Site URL** para producción. No agregues `/#/login` al retorno de confirmación; PKCE vuelve al index.
4. En GitHub → **Settings → Secrets and variables → Actions → Variables**, crea `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y `VITE_AUTH_USER_SERVICE_URL` (la URL HTTPS pública del backend, sin `/api/v1`).
5. En **Settings → Pages → Source**, selecciona **GitHub Actions**.
6. Sube el repositorio a la rama `main` o ejecuta manualmente `.github/workflows/pages.yml`. El workflow valida las variables, corre pruebas, construye `frontend/dist` y lo publica. Si usas otra rama, cambia `branches`.
7. Prueba las URLs completas, recarga y escanea el QR de `https://TU-USUARIO.github.io/TU-REPO/#/pecera`.

No uses `localhost:3001` como backend del despliegue público: apuntaría al equipo de cada visitante. El workflow y RLS no sustituyen desplegar ese servicio.

## Comandos y verificación

```powershell
pnpm test                     # SQL/RLS en PostgreSQL embebido + contratos HTTP/Socket.io
pnpm build                    # Genera frontend/dist
pnpm preview                  # Sirve el build en http://localhost:4173
pnpm dev:services             # Levanta los cuatro procesos, sin implementar fases futuras
pnpm --filter auth-user-service start
pnpm --filter drawing-processing-service start
pnpm --filter aquarium-ecosystem-service start
pnpm --filter gallery-collection-service start
```

Las pruebas SQL ejecutan `schema.sql` en PostgreSQL embebido (PGlite), con un esquema mínimo que representa `auth.users` y `auth.uid()`. Las pruebas del servicio usan un cliente Supabase sustituido para validar autorización, validaciones y contratos. **No acceden a tu proyecto ni verifican el envío real de correos**; esa verificación corresponde a los pasos manuales anteriores con tus variables configuradas.

## Documentación oficial consultada

- [Supabase: perfiles y triggers de usuarios](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [React Router: HashRouter](https://reactrouter.com/api/declarative-routers/HashRouter)
- [Vite: base relativa](https://vite.dev/guide/build.html#relative-base)
- [Tailwind CSS con Vite](https://tailwindcss.com/docs/installation/using-vite)
