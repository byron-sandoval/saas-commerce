# Frontend de SaaS Ferreterias

Next.js con App Router, TypeScript y Tailwind. Organizacion por funcionalidades.

## Desarrollo local

1. Copiar `.env.example` a `.env.local` si no existe.
2. En `backend/.env`, configurar `FRONTEND_URL=http://localhost:3000` y conservar
   `BETTER_AUTH_URL=http://localhost:4000` junto con las conexiones existentes.
3. Iniciar NestJS desde `backend` con `npm run start:dev`.
4. Iniciar Next.js desde `frontend` con `npm run dev` y abrir http://localhost:3000.

Reiniciar los servidores despues de cambiar las variables. Usar `localhost` en ambos,
sin alternarlo con `127.0.0.1`. No colocar conexiones de Neon ni secretos de Better Auth aqui.

## Conexion

El navegador llama al mismo origen de Next.js:

- `/api/auth/*` se reenvia a NestJS `/api/auth/*`.
- `/api/backend/*` se reenvia a NestJS `/*`.

`BACKEND_URL` solo configura el destino en el servidor Next.js. Las rewrites se
resuelven al iniciar/desarrollar o compilar; configurar esa variable tambien al construir.
En produccion es obligatoria. `FRONTEND_URL` en NestJS debe ser el origen HTTPS real.
Este frontend requiere un servidor Next.js; no se publica como exportacion estatica.

Las sesiones usan las cookies HttpOnly administradas por Better Auth; no se guardan
tokens en localStorage. Las solicitudes no se cachean. No se desactiva la proteccion
de origen de Better Auth ni se necesitan llamadas CORS directas desde el navegador.

## Organizacion

- `src/app`: rutas, layouts y estilos del login y del acceso protegido.
- `src/lib/api/http.ts`: cliente HTTP de navegador y `ApiError` con estado/mensaje.
- `src/features/auth`: iniciar sesion por correo/username, consultar sesion y cerrar sesion.
- `src/features/empresas`: consulta de la empresa actual, asignada por el backend.

Estas funciones se usan desde componentes cliente. No usarlas directamente desde
Server Components: las rutas relativas y las cookies corresponden al navegador.
El cliente servidor de `features/auth/server.ts` reenvia la cookie al endpoint
`GET /auth/contexto` de NestJS, sin cache compartida. Este consulta usuario, empresa y
rol actuales. La sesion no proporciona el nombre del rol; `rolId` no se interpreta como permiso.
NestJS sigue validando permisos, empresa, usuario y reglas en cada operacion.
Dinero/Decimal y fechas se reciben como cadenas; los tipos no convierten los importes a number.

## Verificacion

Requiere Node.js 24. Ejecutar `npm test`, `npm run lint`, `npx tsc --noEmit` y `npm run build`.
La compilacion requiere acceso a las fuentes de Google que usa la plantilla.

Con ambos servidores activos se puede comprobar sin escribir datos:

```powershell
Invoke-RestMethod http://localhost:3000/api/auth/ok
Invoke-RestMethod http://localhost:3000/api/auth/get-session
```

La primera devuelve el estado de Better Auth y la segunda `null` sin sesion.
`/api/backend/empresas/actual` debe responder 401 sin iniciar sesion.
## Acceso

- `/iniciar-sesion`: correo o username y password, errores y estado de envio.
- `/inicio`: estructura del Dashboard protegida para ADMIN, con indicadores y tablas
  pendientes de conectar a datos reales.
- `/cambiar-password`: cambio obligatorio de temporal; al terminar exige nuevo login.
- `/acceso`: cuenta sin empresa o perfiles cuyos paneles todavia no estan implementados.

El inicio de ADMIN se verifica en el servidor. No basta con ocultar un boton o modificar
datos del navegador. Los destinos son internos y fijos. Cerrar sesion usa Better Auth
y vuelve al login; no se guardan passwords ni tokens en localStorage.

El registro de empresa, registro publico, recuperacion de password y los paneles de
CAJERO/BODEGUERO/SuperAdmin no forman parte de esta etapa.

## Panel ADMIN

`src/components/layout` contiene el menu, la cabecera y la navegacion compartida.
`src/features/dashboard` contiene la vista inicial del resumen.
El layout y cada pagina validan ADMIN en servidor. React `cache` deduplica la
consulta de acceso durante el mismo render; no comparte sesiones entre usuarios.

Las secciones del menu abren pantallas provisionales, marcadas como "En preparacion".
La ruta `[...modulo]` solo acepta las rutas definidas en el menu y se sustituira por las rutas
especificas al implementar cada funcionalidad. Los indicadores muestran un guion:
no son ceros ni cifras de ejemplo. No se han implementado filtros de fechas,
estadisticas, reportes ni administracion de planes en esta etapa.

El menu lateral se organiza en grupos desplegables: Inventario, Ventas, Compras,
Caja y Creditos; Dashboard, Usuarios, Reportes y Configuracion son accesos directos.
Cada grupo contiene sus pantallas. El grupo de la ruta actual se abre al navegar y
su opcion se resalta. Las rutas de la primera estructura redirigen a las nuevas.
