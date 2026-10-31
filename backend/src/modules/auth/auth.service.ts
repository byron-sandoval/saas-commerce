import { Injectable } from '@nestjs/common';
import type { Auth, BetterAuthOptions } from 'better-auth';
import { betterAuth } from 'better-auth/minimal';
import { PrismaService } from '../../prisma/prisma.service.js';
import { createAuthOptions } from './auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { BadRequestException } from '@nestjs/common';

@Injectable()
export class AuthService {
  readonly auth: Auth<BetterAuthOptions>;

  constructor(prisma: PrismaService) {
    this.auth = betterAuth(createAuthOptions(prisma));
  }

  // Adapter ligado a la transaccion de Nest: identidad y credencial se confirman juntas.
  private contexto(tx: Prisma.TransactionClient) {
    return betterAuth(createAuthOptions(tx, false)).$context;
  }

  async crearEmpleado(
    tx: Prisma.TransactionClient,
    datos: {
      nombre: string;
      email: string;
      username: string;
      empresaId: string;
      rolId: string;
      passwordTemporalExpiraEn: Date;
    },
    password: string,
  ) {
    const ctx = await this.contexto(tx);
    const hash = await ctx.password.hash(password);
    const usuario = await ctx.internalAdapter.createUser(
      {
        name: datos.nombre,
        email: datos.email,
        emailVerified: false,
        username: datos.username,
        displayUsername: datos.username,
        empresaId: datos.empresaId,
        rolId: datos.rolId,
        activo: true,
        debeCambiarPassword: true,
        passwordTemporalExpiraEn: datos.passwordTemporalExpiraEn,
      },
      { method: 'email-password' },
    );
    await ctx.internalAdapter.linkAccount({
      userId: usuario.id,
      accountId: usuario.id,
      providerId: 'credential',
      password: hash,
    });
    return usuario.id;
  }

  async actualizarEmpleado(
    tx: Prisma.TransactionClient,
    id: string,
    datos: Record<string, unknown>,
  ) {
    return (await this.contexto(tx)).internalAdapter.updateUser(id, datos);
  }

  async guardarPassword(
    tx: Prisma.TransactionClient,
    id: string,
    nueva: string,
    actual?: string,
  ) {
    const ctx = await this.contexto(tx);
    const cuenta = await ctx.internalAdapter.findCredentialAccount(id);
    if (!cuenta?.password)
      throw new BadRequestException(
        'El empleado no tiene una credencial de password.',
      );
    if (
      actual !== undefined &&
      !(await ctx.password.verify({ hash: cuenta.password, password: actual }))
    )
      throw new BadRequestException('La password actual no es correcta.');
    if (actual === nueva)
      throw new BadRequestException('La nueva password debe ser diferente.');
    await ctx.internalAdapter.updateAccount(cuenta.id, {
      password: await ctx.password.hash(nueva),
    });
  }

  async revocarSesiones(tx: Prisma.TransactionClient, id: string) {
    await (await this.contexto(tx)).internalAdapter.deleteUserSessions(id);
  }
}
