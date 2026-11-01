import 'reflect-metadata';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthPrismaService } from '../../prisma/auth-prisma.service.js';
import { contextoRls } from '../../prisma/contexto-rls.js';
import { RolesService } from './roles.service.js';

// Ejecucion manual; identidad solo enumera empresas, negocio crea roles con RLS.
const prisma = new PrismaService();
const identidad = new AuthPrismaService();
try {
  await prisma.onModuleInit();
  await identidad.onModuleInit();
  const empresas = await identidad.empresa.findMany({ select: { id: true } });
  const roles = new RolesService(prisma);
  let creados = 0;
  for (const empresa of empresas) {
    const resultado = await contextoRls.run(
      { empresaId: empresa.id, usuarioId: 'seed-roles-manual' },
      () => roles.crearRolesIniciales(empresa.id),
    );
    creados += resultado.count;
  }
  console.log(
    `Empresas revisadas: ${empresas.length}. Roles nuevos: ${creados}. No se asignaron roles a usuarios.`,
  );
} catch {
  console.error(
    'No se pudieron crear los roles. Revisa migraciones y conexiones limitadas APP_DATABASE_URL/AUTH_DATABASE_URL.',
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  await identidad.$disconnect();
}
