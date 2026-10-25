import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { betterAuth } from 'better-auth/minimal';
import { parseUserInput } from 'better-auth/db';
import request from 'supertest';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { createAuthOptions } from './auth.config.js';
import { configureAuthRoutes } from './auth.routes.js';
import { AuthService } from './auth.service.js';

describe('Integracion de Better Auth', () => {
  beforeEach(() => {
    vi.stubEnv(
      'BETTER_AUTH_SECRET',
      'secreto-ficticio-exclusivo-de-pruebas-123456789',
    );
    vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000');
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => vi.unstubAllEnvs());

  function createPrismaMock() {
    const delegate = () => ({
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(
        async ({ data }: { data: Record<string, unknown> }) => data,
      ),
    });
    const database = {
      usuario: delegate(),
      account: delegate(),
      session: delegate(),
      $transaction: async <T>(work: (tx: unknown) => Promise<T>): Promise<T> =>
        work(database),
    };
    return database;
  }

  it('exige un secreto y HTTPS en produccion', () => {
    const prisma = createPrismaMock() as unknown as PrismaService;
    vi.stubEnv('BETTER_AUTH_SECRET', 'corto');
    expect(() => createAuthOptions(prisma)).toThrow('BETTER_AUTH_SECRET');
    vi.stubEnv(
      'BETTER_AUTH_SECRET',
      'secreto-ficticio-exclusivo-de-pruebas-123456789',
    );
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => createAuthOptions(prisma)).toThrow('HTTPS');
  });

  it('impide asignarse empresa, rol y vencimiento desde la entrada del cliente', () => {
    const options = createAuthOptions(
      createPrismaMock() as unknown as PrismaService,
    );
    for (const [field, value] of Object.entries({
      empresaId: 'otra-empresa',
      rolId: 'administrador',
      passwordTemporalExpiraEn: new Date(),
    })) {
      expect(() => parseUserInput(options, { [field]: value }, 'create')).toThrow();
    }
    expect(
      parseUserInput(
        options,
        {
          activo: false,
          debeCambiarPassword: true,
        },
        'create',
      ),
    ).toMatchObject({ activo: true, debeCambiarPassword: false });
  });

  it('registra con los nombres reales de Prisma y guarda un hash de la contrasena', async () => {
    const database = createPrismaMock();
    const auth = betterAuth(
      createAuthOptions(database as unknown as PrismaService),
    );
    const password = 'ContrasenaFicticia123!';
    const response = await auth.handler(
      new Request('http://localhost:3000/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Usuario de prueba',
          email: 'prueba@example.com',
          password,
        }),
      }),
    );
    expect(response.status).toBe(200);
    const userData = database.usuario.create.mock.calls[0][0].data;
    expect(userData.nombre).toBe('Usuario de prueba');
    expect(userData.creadoEn).toBeInstanceOf(Date);
    expect(userData.empresaId).toBeUndefined();
    expect(userData.rolId).toBeUndefined();
    const accountData = database.account.create.mock.calls[0][0].data;
    expect(accountData.password).toBeTruthy();
    expect(accountData.password).not.toBe(password);
  });

  it('expone las rutas de Better Auth en Nest sin consumir antes el cuerpo JSON', async () => {
    const database = createPrismaMock();
    const auth = betterAuth(
      createAuthOptions(database as unknown as PrismaService),
    );
    const module = await Test.createTestingModule({
      providers: [{ provide: AuthService, useValue: { auth } }],
    }).compile();
    const app = module.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    try {
      configureAuthRoutes(app);
      await app.init();
      await request(app.getHttpServer()).get('/api/auth/ok').expect(200);
      await request(app.getHttpServer())
        .get('/api/auth/get-session')
        .expect(200, 'null');
      await request(app.getHttpServer())
        .post('/api/auth/sign-up/email')
        .send({ email: 'invalido' })
        .expect(400);
      expect(database.usuario.create).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
