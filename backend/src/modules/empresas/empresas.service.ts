import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RolesService } from '../roles/roles.service.js';
import type { CreateEmpresaDto } from './dto/create-empresa.dto.js';
import type { ConfiguracionEmpresaDto } from './dto/configuracion-empresa.dto.js';
import { Prisma } from '../../generated/prisma/client.js';
import { randomUUID } from 'node:crypto';
import { contextoRls } from '../../prisma/contexto-rls.js';

@Injectable()
export class EmpresasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rolesService: RolesService,
  ) {}

  async create(usuarioId: string, dto: CreateEmpresaDto) {
    const empresaId = randomUUID();
    return contextoRls.run({ usuarioId, empresaId }, () =>
      this.prisma.$transaction(async (tx) => {
        const usuario = await tx.usuario.findUnique({
          where: { id: usuarioId },
          select: {
            activo: true,
            debeCambiarPassword: true,
            empresaId: true,
            rolId: true,
            superAdmin: { select: { id: true } },
          },
        });
        if (
          !usuario?.activo ||
          usuario.debeCambiarPassword ||
          usuario.superAdmin
        ) {
          throw new ForbiddenException(
            'Esta cuenta no puede registrar una ferreteria.',
          );
        }
        if (usuario.empresaId || usuario.rolId) {
          throw new ConflictException('El usuario ya pertenece a una empresa.');
        }

        const empresa = await tx.empresa.create({
          data: {
            id: empresaId,
            nombre: dto.nombre,
            direccion: dto.direccion,
            ruc: dto.ruc,
            telefono: dto.telefono,
            correo: dto.correo,
          },
        });
        await this.rolesService.crearRolesIniciales(empresa.id, tx);
        const roles = await tx.rol.findMany({
          where: { empresaId: empresa.id },
          select: { id: true, nombre: true, activo: true },
        });
        const admin = roles.find((rol) => rol.nombre === 'ADMIN' && rol.activo);
        if (!admin)
          throw new ConflictException('No se pudo crear el rol ADMIN.');

        // La condicion se comprueba de nuevo bajo el bloqueo de la actualizacion.
        // Si hay dos altas simultaneas, la que pierde revierte toda su empresa.
        const resultado = await tx.usuario.updateMany({
          where: {
            id: usuarioId,
            empresaId: null,
            rolId: null,
            activo: true,
            debeCambiarPassword: false,
          },
          data: { empresaId: empresa.id, rolId: admin.id },
        });
        if (resultado.count !== 1) {
          throw new ConflictException(
            'El usuario ya fue vinculado o su estado cambio.',
          );
        }
        return { ...empresa, roles };
      }),
    );
  }

  async findActual(empresaId: string) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
    });
    if (!empresa) throw new NotFoundException('Empresa no encontrada.');
    return empresa;
  }

  async configurar(empresaId: string, dto: ConfiguracionEmpresaDto) {
    if (!Object.values(dto).some((value) => value !== undefined))
      throw new BadRequestException(
        'Debes indicar al menos un dato para actualizar.',
      );
    const porcentajeIva =
      dto.porcentajeIva === undefined
        ? undefined
        : new Prisma.Decimal(dto.porcentajeIva);
    if (
      porcentajeIva &&
      (!porcentajeIva.isFinite() ||
        porcentajeIva.isNegative() ||
        porcentajeIva.greaterThan(100))
    )
      throw new BadRequestException('El IVA debe estar entre 0 y 100.');
    try {
      return await this.prisma.empresa.update({
        where: { id: empresaId },
        data: {
          nombre: dto.nombre,
          direccion: dto.direccion,
          ruc: dto.ruc,
          telefono: dto.telefono,
          correo: dto.correo,
          porcentajeIva,
          devolucionesHabilitadas: dto.devolucionesHabilitadas,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      )
        throw new NotFoundException('Empresa no encontrada.');
      throw error;
    }
  }
}
