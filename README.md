# FISH TANK · Fase 1

Aplicación: **https://kevinbigotes.github.io/FISH-TANK/**

Base SOA de una exposición colaborativa inspirada en Sketch Aquarium. Incluye registro, inicio de sesión, sesión persistente, perfiles y estructura para GitHub Pages. El lienzo, procesamiento de dibujos, peces animados, clima y colecciones se implementarán en las fases 2–4.

## Arrancar en Windows sin npm

Haz doble clic en **`INICIAR.cmd`** o ejecuta desde esta carpeta en PowerShell:

```powershell
.\INICIAR.cmd
```

El lanzador busca Node.js y pnpm, incluyendo el runtime que ya está instalado con Codex en este equipo. Crea la configuración local si no existe, instala dependencias cuando sea necesario y arranca el frontend y `auth-user-service`. No modifica el PATH de Windows ni instala programas globales. Deja esa ventana abierta mientras usas la app.

Abre **http://localhost:5173/#/registro**. Para detener los servidores, usa `Ctrl+C` en la ventana del lanzador.

```powershell
.\INICIAR.cmd doctor    # Comprueba Node y pnpm
.\INICIAR.cmd install   # Instala las versiones del lockfile
.\INICIAR.cmd test      # Ejecuta las pruebas
.\INICIAR.cmd build     # Genera frontend/dist para producción
.\INICIAR.cmd preview   # Sirve el build en http://localhost:4173
```

El gestor es **pnpm 11.25.0**, con **Node.js 24 o posterior**. Si prefieres terminal y ya tienes pnpm disponible, `pnpm install --frozen-lockfile` y `pnpm dev` siguen funcionando. Que PowerShell no encuentre `npm` no significa que la app esté dañada: este lanzador no depende de npm. En otro equipo sin runtime, instala Node desde [nodejs.org](https://nodejs.org/) y pnpm siguiendo su [instalación oficial](https://pnpm.io/installation).

## Supabase configurado

La configuración pública está en `frontend/src/lib/project-config.js`. Incluye la URL y la clave **publishable** proporcionadas por el propietario. Esa clave se entrega al navegador por diseño; no contiene una clave `secret` ni `service_role`. Los datos se protegen mediante Supabase Auth y RLS.

Las variables de `frontend/.env` pueden reemplazarla localmente. El lanzador prepara `services/auth-user-service/.env` con el mismo proyecto sin sobrescribir una configuración existente. Ambos `.env` locales están excluidos de Git.

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

## GitHub Pages: publicar la aplicación

Este repositorio usa **`master`**. El workflow `.github/workflows/pages.yml` se ejecuta al subir cambios a `master` o `main`, y también manualmente. Instala dependencias, prueba los servicios/esquema, compila Vite y publica **`frontend/dist`**, cuyo archivo de entrada es `index.html`.

En [Settings → Pages](https://github.com/KevinBigotes/FISH-TANK/settings/pages), **Source debe ser GitHub Actions**. Publicar `master / (root)` con Jekyll muestra el README porque el index de la aplicación se genera durante la compilación. No muevas el index fuente a la raíz ni guardes `node_modules` o `dist` en Git.

La URL y clave públicas de Supabase ya están incorporadas a la configuración. No hace falta crear variables de Actions para que el registro y login funcionen. Para reemplazarlas en otro despliegue, usa estas variables del repositorio:

| Variable opcional | Uso |
| --- | --- |
| `VITE_SUPABASE_URL` | Reemplaza la URL del proyecto. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Reemplaza su clave pública. |
| `VITE_AUTH_USER_SERVICE_URL` | URL HTTPS del servicio Node, sin `/api/v1`. |

**GitHub Pages aloja el frontend, no los procesos Node.** Registro, confirmación y login se conectan directamente a Supabase y funcionan sin un servidor Node publicado. La consulta/edición de perfiles sigue pasando por `auth-user-service`: hasta desplegarlo y configurar su URL, Pages muestra que el servicio de perfiles está pendiente. No se consulta PostgreSQL directamente desde React como alternativa oculta.

Para habilitar perfiles en producción, despliega el servicio desde la raíz del monorepo con `pnpm install --frozen-lockfile` y `pnpm --filter auth-user-service start`. Configura `HOST=0.0.0.0`, el `PORT` del proveedor, la URL/clave pública de Supabase y `CORS_ORIGINS=https://kevinbigotes.github.io`. Ajusta `TRUST_PROXY_HOPS` a los proxies reales. Añade su URL HTTPS a Actions y vuelve a ejecutar el workflow.

`frontend/.env.production` deja vacía la URL del servicio para impedir que un build local publique `localhost:3001`. La variable de Actions puede reemplazarla. Se conservan `base: './'` y rutas `/#/login`, `/#/registro`, `/#/pecera`, `/#/dibujar` y `/#/mi-pecera`, compatibles con enlaces directos y QR.

## Arquitectura y acceso

| Componente | Puerto local | Estado |
| --- | --- | --- |
| `frontend` | 5173 | React + Vite + Tailwind CSS; autenticación y rutas protegidas. |
| `auth-user-service` | 3001 | Express; verifica JWT, consulta/edita perfiles y consulta creadores. |
| `drawing-processing-service` | 3002 | Base ejecutable. Funcionalidad reservada para Fase 2. |
| `aquarium-ecosystem-service` | 3003 | Express + Socket.io, conexiones deshabilitadas hasta Fase 3. |
| `gallery-collection-service` | 3004 | Base ejecutable. Funcionalidad reservada para Fase 4. |

Cada servicio tiene proceso, puerto, paquete y configuración propios. `services/_shared` es una biblioteca HTTP sin estado ni lógica de negocio. Los despliegues usan la raíz como contexto de instalación y ejecutan solo el servicio elegido. Consulta los [contratos de servicios](services/README.md).

| Tabla | Lectura | Escritura |
| --- | --- | --- |
| `profiles` | Pública, sin correos. | Trigger de registro; el dueño modifica nombre, color y bio. UUID y fecha son inmutables. |
| `fish` | Pública. | Publicación desde navegador bloqueada hasta moderación en Fase 2. |
| `personal_aquarium_fish` | Solo el dueño. | Guardar/eliminar favoritos propios, incluidos peces ajenos; `UNIQUE(user_id, fish_id)` evita duplicados. Sin API/UI todavía. |

Las pruebas ejecutan `schema.sql` en PostgreSQL embebido (PGlite), emulando únicamente el esquema de Auth. Las pruebas HTTP usan un cliente Supabase sustituido. Comprueban RLS, restricciones, autorización y contratos, sin enviar correos ni crear cuentas reales.

Referencias: [Supabase Auth y perfiles](https://supabase.com/docs/guides/auth/managing-user-data), [claves públicas](https://supabase.com/docs/guides/api/api-keys), [publicación de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
