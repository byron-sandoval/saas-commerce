# Instrucciones del proyecto

## Contexto
SaaS multitenant exclusivo para ferreterías.
Incluye inventario, ventas, caja, compras y facturación.
Trabajar únicamente en el backend por ahora; no modificar el frontend
salvo que el usuario lo solicite.

## Tecnologías
- Backend: NestJS con TypeScript.
- ORM: Prisma.
- Base de datos: PostgreSQL en Neon.
- Autenticación: Better Auth.
- Frontend: se implementará después.

## Estado actual
- Prisma está conectado a PostgreSQL en Neon.
- La migración inicial está aplicada en la base de desarrollo.
- Better Auth está instalado y su integración base con NestJS y Prisma
  está configurada para correo o username y contraseña.
- El registro de empresa crea sus tres roles y vincula al usuario fundador
  como ADMIN dentro de una misma transacción.
- Productos tiene operaciones reales en /catalogo/productos, con validación,
  consultas por empresa y baja lógica para conservar su historial.
- El usuario probó manualmente registro, empresa y productos como ADMIN,
  y consulta y restricciones de productos como CAJERO en desarrollo.
- Usuarios, inventario, compras, ventas, caja y créditos tienen guards y roles
  en sus controladores; sus servicios siguen siendo plantillas sin lógica real.
- Google, recuperación de contraseña y verificación de correo están pendientes.
- RLS está pendiente de implementación y pruebas.
- No considerar una función implementada solo porque exista su modelo en Prisma.

## Arquitectura
- Usar un monolito modular en NestJS.
- Mantener backend y frontend en carpetas separadas.
- Agrupar los módulos por función del negocio; no crear uno por cada tabla.
- Usar módulos, controladores, servicios y DTOs según sean necesarios.
- Validar las entradas de la API; declarar un DTO por sí solo no las valida.
- Los servicios pueden acceder a los datos mediante PrismaService.
- Agregar repositories u otras capas solo cuando aporten una ventaja concreta.
- Mantener las responsabilidades de cada módulo y coordinar las operaciones
  entre módulos sin perder la atomicidad de las transacciones.
- Usar una base de datos con tablas compartidas.
- Separar los datos de cada ferretería mediante empresaId.
- Mantener una sola tabla Usuario para identidad y perfil.
- Los roles de cada empresa se administran en la tabla Rol.
- Los roles iniciales por empresa son ADMIN, CAJERO y BODEGUERO.
- Crear esos roles sin duplicados. El seed no asigna roles a usuarios.
- Al registrar una empresa, asignar ADMIN únicamente al usuario autenticado
  que la crea; no aceptar usuarioId, empresaId o rolId desde el cliente.
- El modulo roles proporciona su creacion; el comando roles:seed es manual.
- La creacion de roles no sustituye la implementacion de permisos y guards.
- SuperAdmin representa al propietario de la plataforma.
- No incorporar Redis por ahora.

## Seguridad
- Obtener empresaId del usuario autenticado.
- No confiar en empresaId ni roles enviados por el cliente.
- Validar permisos y pertenencia a la empresa en cada operación.
- Mantener las relaciones compuestas que impiden vínculos entre empresas.
- Aplicar RLS mediante migraciones SQL.
- El rol de ejecución de la aplicación no debe omitir RLS.
- Nunca guardar contraseñas en texto plano.
- Administrar credenciales y sesiones mediante Better Auth.
- Bloquear operaciones del negocio si el usuario está inactivo
  o debe cambiar su contraseña temporal.
- No guardar secretos ni archivos .env en Git.
- Mantener un .env.example con valores de ejemplo.
- Permisos actuales de las rutas existentes:
  - Usuarios: solo ADMIN.
  - Productos: consultar los tres roles; crear, editar y dar de baja solo ADMIN.
  - Categorías: consultar los tres roles; crear, editar y dar de baja solo ADMIN.
  - Unidades de medida: consultar los tres roles; crear, editar y dar de baja solo ADMIN.
  - Inventario y compras: consultar y crear ADMIN/BODEGUERO;
    editar y eliminar solo ADMIN.
  - Ventas: consultar y crear ADMIN/CAJERO; editar y eliminar solo ADMIN.
  - Caja: consultar, crear y actualizar ADMIN/CAJERO; eliminar solo ADMIN.
  - Créditos: consultar ADMIN/CAJERO; crear, editar y eliminar solo ADMIN.
- Al implementar operaciones reales, comprobar también la empresa y,
  cuando corresponda, la propiedad de la caja o del registro. El guard de rol
  no sustituye esas comprobaciones ni RLS.
- Definir permisos específicos para recepción de compras y abonos cuando
  se creen sus rutas; no deducirlos del permiso de editar compras o créditos.
- SuperAdmin no tiene un acceso automático a los módulos de una ferretería.

## Reglas de negocio
- SKU y número de factura únicos dentro de cada empresa.
- Admitir cantidades decimales para metros, kilos y litros.
- Usar Decimal para dinero y cantidades; evitar cálculos
  monetarios con punto flotante.
- Validar el límite de usuarios al crear o reactivar empleados.
- Crear ventas, detalles y movimientos de inventario
  dentro de una transacción.
- Evitar sobreventa y números de factura duplicados
  ante solicitudes simultáneas.
- Si un crédito está vinculado a una venta, ambos deben pertenecer
  al mismo cliente y a la misma empresa.
- Los gastos quedan fuera del sistema por ahora; el dueño los administra aparte.
- No presentar el margen bruto de ventas como ganancia neta,
  porque el sistema no registra los gastos del negocio.

## Forma de trabajar
- Revisar el código y las instrucciones existentes antes de editar.
- Consultar documentación oficial cuando haya dudas sobre APIs.
- No inventar métodos, opciones ni configuraciones.
- No cambiar versiones principales de dependencias sin justificarlo.
- Preparar los modelos y archivos de migración y proporcionar los comandos
  para que el usuario los ejecute. No aplicar migraciones ni ejecutar
  comandos que modifiquen la base de datos por cuenta propia,
  salvo que el usuario lo solicite explícitamente.
- No ejecutar migraciones sobre producción ni eliminar datos
  sin autorización explícita.
- Ejecutar las verificaciones apropiadas para cada cambio.
- Explicar qué se modificó, cómo se verificó y qué queda pendiente.
- No afirmar que algo funciona si no se ha comprobado.
