import { prismaAdapter } from '@better-auth/prisma-adapter';
import type { BetterAuthOptions } from 'better-auth';
import { username } from 'better-auth/plugins/username';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthPrismaService } from '../../prisma/auth-prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { APIError } from 'better-auth/api';

export function createAuthOptions(
  prisma: PrismaService | AuthPrismaService | Prisma.TransactionClient,
  transaction = true,
): BetterAuthOptions {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;

  if (!secret || secret.length < 32) {
    throw new Error(
      'Configura BETTER_AUTH_SECRET con al menos 32 caracteres aleatorios.',
    );
  }

  if (!baseURL) {
    throw new Error('Falta configurar BETTER_AUTH_URL en backend/.env.');
  }

  const url = new URL(baseURL);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('BETTER_AUTH_URL debe ser una URL HTTP o HTTPS.');
  }

  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('BETTER_AUTH_URL debe usar HTTPS en produccion.');
  }

  return {
    appName: 'SaaS Ferreterias',
    secret,
    baseURL,
    basePath: '/api/auth',
    trustedOrigins: [url.origin],
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
      transaction,
    }),
    emailAndPassword: { enabled: true },
    databaseHooks: {
      session: {
        create: {
          before: async (session, context) => {
            // El registro crea usuario y sesion en una misma transaccion de Better Auth.
            // El adapter respeta esa transaccion; consultar el Prisma raiz no veria el alta.
            const usuario = (
              context
                ? await context.context.internalAdapter.findUserById(
                    session.userId,
                  )
                : await prisma.usuario.findUnique({
                    where: { id: session.userId },
                  })
            ) as {
              activo?: boolean;
              debeCambiarPassword?: boolean;
              passwordTemporalExpiraEn?: Date | null;
            } | null;
            if (
              !usuario?.activo ||
              (usuario.debeCambiarPassword &&
                (!usuario.passwordTemporalExpiraEn ||
                  usuario.passwordTemporalExpiraEn.getTime() <= Date.now()))
            )
              throw new APIError('FORBIDDEN', {
                message:
                  'La cuenta esta inactiva o su password temporal vencio.',
              });
          },
        },
      },
    },
    user: {
      // Prisma expone el modelo Usuario mediante prisma.usuario.
      modelName: 'usuario',
      fields: {
        name: 'nombre',
        createdAt: 'creadoEn',
        updatedAt: 'actualizadoEn',
      },
      additionalFields: {
        empresaId: { type: 'string', required: false, input: false },
        rolId: { type: 'string', required: false, input: false },
        activo: { type: 'boolean', defaultValue: true, input: false },
        debeCambiarPassword: {
          type: 'boolean',
          defaultValue: false,
          input: false,
        },
        passwordTemporalExpiraEn: {
          type: 'date',
          required: false,
          input: false,
          returned: false,
        },
      },
    },
    plugins: [username()],
  };
}
