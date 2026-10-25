import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ROLES_INICIALES } from './roles.constants.js';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  // Al crear una empresa, pasar su transaccion para crear tambien sus roles.
  async crearRolesIniciales(
    empresaId: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<Prisma.BatchPayload> {
    const empresa = await db.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true },
    });

    if (!empresa) {
      throw new NotFoundException('La empresa no existe.');
    }

    // No modifica descripciones, estados ni asignaciones de roles existentes.
    return db.rol.createMany({
      data: ROLES_INICIALES.map((rol) => ({ ...rol, empresaId })),
      skipDuplicates: true,
    });
  }
}
