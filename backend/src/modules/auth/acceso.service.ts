import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { AuthPrismaService } from '../../prisma/auth-prisma.service.js';
import { AuthService } from './auth.service.js';

@Injectable()
export class AccesoService {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: AuthPrismaService,
  ) {}

  async consultar(headers: Request['headers']) {
    const sesion = await this.auth.auth.api.getSession({
      headers: fromNodeHeaders(headers),
    });
    if (!sesion) throw new UnauthorizedException('Debes iniciar sesion.');
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: sesion.user.id },
      select: {
        id: true,
        nombre: true,
        activo: true,
        empresaId: true,
        rolId: true,
        debeCambiarPassword: true,
        passwordTemporalExpiraEn: true,
        empresa: { select: { id: true, nombre: true, estado: true } },
        rol: { select: { nombre: true, activo: true, empresaId: true } },
        superAdmin: { select: { id: true } },
      },
    });
    if (!usuario?.activo)
      throw new ForbiddenException('La cuenta no esta habilitada.');
    const perfil = { usuario: { id: usuario.id, nombre: usuario.nombre } };
    // La plataforma no concede acceso automatico a una ferreteria.
    if (usuario.superAdmin)
      return { ...perfil, acceso: 'SUPERADMIN', empresa: null };
    if (!usuario.empresaId && !usuario.rolId && !usuario.debeCambiarPassword) {
      return { ...perfil, acceso: 'SIN_EMPRESA', empresa: null };
    }
    if (
      !usuario.empresaId ||
      !usuario.rolId ||
      usuario.empresa?.estado !== 'ACTIVA' ||
      !usuario.rol?.activo ||
      usuario.rol.empresaId !== usuario.empresaId ||
      !['ADMIN', 'CAJERO', 'BODEGUERO'].includes(usuario.rol.nombre)
    ) {
      throw new ForbiddenException('Necesitas una empresa y un rol activos.');
    }
    const empresa = { id: usuario.empresa.id, nombre: usuario.empresa.nombre };
    if (usuario.debeCambiarPassword) {
      if (
        !usuario.passwordTemporalExpiraEn ||
        usuario.passwordTemporalExpiraEn.getTime() <= Date.now()
      ) {
        throw new ForbiddenException(
          'La password temporal vencio. Solicita una nueva al ADMIN.',
        );
      }
      return { ...perfil, acceso: 'CAMBIAR_PASSWORD', empresa };
    }
    return { ...perfil, acceso: usuario.rol.nombre, empresa };
  }
}
