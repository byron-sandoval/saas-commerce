-- Ejecutar como propietario de las tablas mediante DATABASE_URL, nunca con el login del backend.
-- No contiene credenciales ni asigna una ferreteria a datos existentes.
BEGIN;
DO $$
DECLARE nombre text;
BEGIN
  FOREACH nombre IN ARRAY ARRAY['saas_negocio','saas_identidad'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=nombre) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION', nombre);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=nombre AND
      (rolcanlogin OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) OR
      EXISTS (SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=nombre)) THEN
      RAISE EXCEPTION 'El grupo reservado % tiene atributos o membresias no permitidos', nombre;
    END IF;
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), nombre);
  END LOOP;
END $$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO saas_negocio, saas_identidad;
CREATE SCHEMA saas_contexto;
REVOKE ALL ON SCHEMA saas_contexto FROM PUBLIC;
GRANT USAGE ON SCHEMA saas_contexto TO saas_negocio, saas_identidad;
CREATE FUNCTION saas_contexto.empresa_id() RETURNS text LANGUAGE sql STABLE PARALLEL SAFE
AS $$ SELECT nullif(pg_catalog.current_setting('app.empresa_id', true), '') $$;
CREATE FUNCTION saas_contexto.usuario_id() RETURNS text LANGUAGE sql STABLE PARALLEL SAFE
AS $$ SELECT nullif(pg_catalog.current_setting('app.usuario_id', true), '') $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA saas_contexto FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA saas_contexto TO saas_negocio, saas_identidad;

-- Tablas de negocio compartidas: tanto la fila existente como la nueva deben ser de la empresa.
DO $$
DECLARE tabla text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['AceptacionLegal','Secuencia','Suscripcion','Rol','Categoria','UnidadMedida',
    'Producto','Proveedor','Cliente','SesionCaja','Venta','DetalleVenta','OrdenCompra','ItemOrdenCompra',
    'MovimientoAlmacen','Devolucion','DetalleDevolucion','Credito','Abono'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabla);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tabla);
    EXECUTE format('CREATE POLICY empresa_aislada ON public.%I TO saas_negocio USING ("empresaId" = saas_contexto.empresa_id()) WITH CHECK ("empresaId" = saas_contexto.empresa_id())', tabla);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO saas_negocio', tabla);
  END LOOP;
END $$;
REVOKE INSERT, UPDATE, DELETE ON "Suscripcion" FROM saas_negocio;
REVOKE UPDATE, DELETE ON "AceptacionLegal" FROM saas_negocio;

ALTER TABLE "Empresa" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Empresa" FORCE ROW LEVEL SECURITY;
CREATE POLICY empresa_propia ON "Empresa" TO saas_negocio
  USING (id = saas_contexto.empresa_id()) WITH CHECK (id = saas_contexto.empresa_id());
GRANT SELECT, INSERT, UPDATE ON "Empresa" TO saas_negocio;
-- El autenticador necesita consultar estado y roles para validar la sesion; no puede editarlos.
CREATE POLICY identidad_estado_empresa ON "Empresa" FOR SELECT TO saas_identidad USING (true);
CREATE POLICY identidad_roles ON "Rol" FOR SELECT TO saas_identidad USING (true);
GRANT SELECT ON "Empresa", "Rol" TO saas_identidad;

ALTER TABLE "Usuario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Usuario" FORCE ROW LEVEL SECURITY;
CREATE POLICY usuario_visible ON "Usuario" FOR SELECT TO saas_negocio USING (
  "empresaId" = saas_contexto.empresa_id() OR
  ("empresaId" IS NULL AND id = saas_contexto.usuario_id()));
CREATE POLICY usuario_alta_empresa ON "Usuario" FOR INSERT TO saas_negocio
  WITH CHECK ("empresaId" = saas_contexto.empresa_id());
CREATE POLICY usuario_editar_empresa ON "Usuario" FOR UPDATE TO saas_negocio
  USING ("empresaId" = saas_contexto.empresa_id() OR ("empresaId" IS NULL AND id = saas_contexto.usuario_id()))
  WITH CHECK ("empresaId" = saas_contexto.empresa_id());
GRANT SELECT, INSERT, UPDATE ON "Usuario" TO saas_negocio;
-- Identidad global: inicio de sesion por email/username y registro de un fundador sin empresa.
CREATE POLICY identidad_consultar_usuario ON "Usuario" FOR SELECT TO saas_identidad USING (true);
CREATE POLICY identidad_registrar_usuario ON "Usuario" FOR INSERT TO saas_identidad
  WITH CHECK ("empresaId" IS NULL AND "rolId" IS NULL AND activo AND NOT "debeCambiarPassword" AND "passwordTemporalExpiraEn" IS NULL);
CREATE POLICY identidad_editar_perfil ON "Usuario" FOR UPDATE TO saas_identidad USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON "Usuario" TO saas_identidad;
GRANT UPDATE (nombre,email,"emailVerified",image,username,"displayUsername","creadoEn","actualizadoEn") ON "Usuario" TO saas_identidad;

DO $$
DECLARE tabla text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['account','session'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabla);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tabla);
    EXECUTE format('CREATE POLICY identidad_credenciales ON public.%I TO saas_identidad USING (true) WITH CHECK (true)', tabla);
    EXECUTE format('CREATE POLICY credenciales_empresa ON public.%I TO saas_negocio USING (EXISTS (SELECT 1 FROM public."Usuario" u WHERE u.id="userId" AND u."empresaId"=saas_contexto.empresa_id())) WITH CHECK (EXISTS (SELECT 1 FROM public."Usuario" u WHERE u.id="userId" AND u."empresaId"=saas_contexto.empresa_id()))', tabla);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO saas_negocio,saas_identidad', tabla);
  END LOOP;
END $$;
ALTER TABLE verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification FORCE ROW LEVEL SECURITY;
CREATE POLICY identidad_verificacion ON verification TO saas_identidad USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON verification TO saas_identidad;

ALTER TABLE "SuperAdmin" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SuperAdmin" FORCE ROW LEVEL SECURITY;
CREATE POLICY identidad_superadmin ON "SuperAdmin" FOR SELECT TO saas_identidad USING (true);
CREATE POLICY detectar_superadmin ON "SuperAdmin" FOR SELECT TO saas_negocio USING (
  "usuarioId"=saas_contexto.usuario_id() OR EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id="usuarioId" AND u."empresaId"=saas_contexto.empresa_id()));
GRANT SELECT ON "SuperAdmin" TO saas_identidad,saas_negocio;

-- Catalogos de plataforma: lectura compartida, sin administracion desde el negocio.
DO $$
DECLARE tabla text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['Plan','LandingPage','DocumentoLegal'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabla);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tabla);
    EXECUTE format('CREATE POLICY lectura_catalogo ON public.%I FOR SELECT TO saas_negocio USING (true)', tabla);
    EXECUTE format('GRANT SELECT ON public.%I TO saas_negocio', tabla);
  END LOOP;
END $$;
COMMIT;
