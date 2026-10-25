import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RolesService } from '../roles/roles.service.js';
import type { CreateEmpresaDto } from './dto/create-empresa.dto.js';

@Injectable()
export class EmpresasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rolesService: RolesService,
  ) {}

  async create(usuarioId: string, dto: CreateEmpresaDto) {
    return this.prisma.$transaction(async (tx) => {
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
      if (!admin) throw new ConflictException('No se pudo crear el rol ADMIN.');

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
    });
  }

  async findActual(empresaId: string) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
    });
    if (!empresa) throw new NotFoundException('Empresa no encontrada.');
    return empresa;
  }
}
