import type { PrismaClient } from '../generated/prisma/client.js';

export async function verificarConexionRls(
  prisma: PrismaClient,
  grupo: 'saas_negocio' | 'saas_identidad',
) {
  const filas = await prisma.$queryRaw<Array<{ seguro: boolean }>>`
    SELECT (
      NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcreaterole AND NOT r.rolcreatedb AND NOT r.rolreplication
      AND EXISTS (SELECT 1 FROM pg_roles g WHERE g.rolname=${grupo} AND pg_has_role(r.oid,g.oid,'USAGE'))
      AND NOT EXISTS (SELECT 1 FROM pg_roles g WHERE g.oid<>r.oid AND g.rolname<>${grupo} AND pg_has_role(r.oid,g.oid,'MEMBER'))
      AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind IN ('r','p') AND pg_has_role(r.oid,c.relowner,'MEMBER'))
      AND (SELECT count(*)=28 AND bool_and(c.relrowsecurity AND c.relforcerowsecurity)
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname<>'_prisma_migrations')
    ) AS seguro FROM pg_roles r WHERE r.rolname=current_user`;
  if (filas[0]?.seguro !== true)
    throw new Error(
      `La conexion ${grupo} no cumple RLS. Aplica la migracion y usa un login limitado, sin propiedad de tablas ni permisos elevados.`,
    );
}
