// Ejecucion manual: npm run roles:seed. No se ejecuta al iniciar NestJS.
import 'reflect-metadata';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RolesService } from './roles.service.js';

const prisma = new PrismaService();

try {
  const empresas = await prisma.empresa.findMany({ select: { id: true } });

  if (empresas.length === 0) {
    console.log('No hay empresas registradas. No se crearon roles.');
  } else {
    const roles = new RolesService(prisma);
    let creados = 0;

    for (const empresa of empresas) {
      const resultado = await roles.crearRolesIniciales(empresa.id);
      creados += resultado.count;
    }

    console.log(
      `Empresas revisadas: ${empresas.length}. Roles nuevos: ${creados}. Los existentes se conservaron.`,
    );
  }
} catch {
  console.error(
    'No se pudo completar la creacion de roles. Revisa la conexion, las migraciones y los permisos. Puedes repetir el comando sin duplicar roles.',
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
