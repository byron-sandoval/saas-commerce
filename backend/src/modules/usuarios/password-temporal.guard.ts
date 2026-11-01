import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { AuthService } from '../auth/auth.service.js';
import { AuthPrismaService } from '../../prisma/auth-prisma.service.js';
import { CONTEXTO_RLS } from '../../prisma/contexto-rls.js';
import type { ContextoRls } from '../../prisma/contexto-rls.js';

export type SolicitudPasswordTemporal = Request & {
  empleadoId: string;
  [CONTEXTO_RLS]?: ContextoRls;
};

@Injectable()
export class PasswordTemporalGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: AuthPrismaService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<SolicitudPasswordTemporal>();
    const sesion = await this.auth.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (!sesion) throw new UnauthorizedException('Debes iniciar sesion.');
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: sesion.user.id },
      include: { empresa: true, rol: true },
    });
    if (
      !usuario?.activo ||
      !usuario.empresaId ||
      usuario.empresa?.estado !== 'ACTIVA' ||
      !usuario.rol?.activo ||
      usuario.rol.empresaId !== usuario.empresaId ||
      !usuario.debeCambiarPassword
    )
      throw new ForbiddenException(
        'La cuenta no admite cambio de password temporal.',
      );
    request.empleadoId = usuario.id;
    request[CONTEXTO_RLS] = {
      usuarioId: usuario.id,
      empresaId: usuario.empresaId,
    };
    return true;
  }
}
