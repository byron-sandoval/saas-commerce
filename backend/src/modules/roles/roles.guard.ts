import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import type { NombreRolInicial } from './roles.constants.js';
import { ROLES_PERMITIDOS } from './roles.decorator.js';

export type SolicitudConUsuario = Request & {
  usuario?: { id: string; empresaId: string; rolId: string };
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SolicitudConUsuario>();
    const session = await this.authService.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      throw new UnauthorizedException('Debes iniciar sesion.');
    }

    // Consultar el estado actual: no confiar en roles enviados por el cliente
    // ni en permisos que pudieran haber cambiado desde el inicio de sesion.
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        empresaId: true,
        rolId: true,
        activo: true,
        debeCambiarPassword: true,
        empresa: { select: { estado: true } },
        rol: { select: { nombre: true, activo: true, empresaId: true } },
      },
    });

    if (!usuario || !usuario.activo || usuario.debeCambiarPassword) {
      throw new ForbiddenException(
        'El usuario no esta habilitado para operar.',
      );
    }

    const rol = usuario.rol;
    if (
      !usuario.empresaId ||
      !usuario.rolId ||
      usuario.empresa?.estado !== 'ACTIVA' ||
      !rol?.activo ||
      rol.empresaId !== usuario.empresaId
    ) {
      throw new ForbiddenException('Necesitas una empresa y un rol activos.');
    }

    const permitidos = this.reflector.getAllAndOverride<NombreRolInicial[]>(
      ROLES_PERMITIDOS,
      [context.getHandler(), context.getClass()],
    );

    if (!permitidos?.some((nombre) => nombre === rol.nombre)) {
      throw new ForbiddenException(
        'Tu rol no tiene permiso para esta operacion.',
      );
    }

    request.usuario = {
      id: usuario.id,
      empresaId: usuario.empresaId,
      rolId: usuario.rolId,
    };
    return true;
  }
}
