import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

export type SolicitudConSesion = Request & {
  usuarioAutenticado: { id: string };
};

// Permite completar el alta de una empresa antes de tener un rol asignado.
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SolicitudConSesion>();
    const session = await this.authService.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (!session) throw new UnauthorizedException('Debes iniciar sesion.');

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { id: true, activo: true, debeCambiarPassword: true },
    });
    if (!usuario?.activo || usuario.debeCambiarPassword) {
      throw new ForbiddenException(
        'El usuario no esta habilitado para operar.',
      );
    }
    request.usuarioAutenticado = { id: usuario.id };
    return true;
  }
}
