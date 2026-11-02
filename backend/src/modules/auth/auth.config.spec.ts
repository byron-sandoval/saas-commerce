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
    vi.stubEnv('FRONTEND_URL', '');
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('acepta solicitudes del frontend configurado y rechaza origenes ajenos', async () => {
    // Better Auth omite el control de origen bajo Vitest salvo configuracion explicita.
    vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:4000');
    vi.stubEnv('FRONTEND_URL', 'http://localhost:3000');
    const auth = betterAuth({
      ...createAuthOptions(createPrismaMock() as unknown as PrismaService),
      advanced: { disableOriginCheck: false, disableCSRFCheck: false },
    });
    for (const [origin, status] of [
      ['http://localhost:3000', 200],
      ['https://ajeno.example', 403],
    ] as const) {
      const response = await auth.handler(new Request('http://localhost:4000/api/auth/sign-out', {
        method: 'POST',
        headers: { Origin: origin, Cookie: 'comprobacion=1', 'Content-Type': 'application/json' },
        body: '{}',
      }));
      expect(response.status).toBe(status);
    }
  });

  it.each(['https://frontend.example/ruta', 'ftp://frontend.example', 'https://user:password@frontend.example', 'https://frontend.example?x=1'])(
    'rechaza FRONTEND_URL invalido: %s', (origin) => {
      vi.stubEnv('FRONTEND_URL', origin);
      expect(() => createAuthOptions(createPrismaMock() as unknown as PrismaService)).toThrow('FRONTEND_URL');
    },
  );

  it('exige HTTPS tambien en el frontend de produccion', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BETTER_AUTH_URL', 'https://api.example.com');
    vi.stubEnv('FRONTEND_URL', 'http://app.example.com');
    expect(() => createAuthOptions(createPrismaMock() as unknown as PrismaService)).toThrow('FRONTEND_URL');
  });

  function createPrismaMock() {
    type Row = Record<string, any>;
    const matches = (row: Row, where: Row = {}): boolean =>
      Object.entries(where).every(([key, value]) =>
        key === 'AND'
          ? (value as Row[]).every((v) => matches(row, v))
          : key === 'OR'
            ? (value as Row[]).some((v) => matches(row, v))
            : value && typeof value === 'object' && 'equals' in value
              ? value.mode === 'insensitive'
                ? String(row[key]).toLowerCase() ===
                  String(value.equals).toLowerCase()
                : row[key] === value.equals
              : row[key] === value,
      );
    const delegate = () => {
      const rows: Row[] = [];
      return {
        rows,
        findFirst: vi.fn(async ({ where, select }: Row = {}) => {
          const row = rows.find((r) => matches(r, where));
          if (!row) return null;
          return select?.accounts
            ? {
                ...row,
                accounts: database.account.rows.filter(
                  (a) => a.userId === row.id,
                ),
              }
            : row;
        }),
        findUnique: vi.fn(
          async ({ where }: Row) =>
            rows.find((row) => matches(row, where)) ?? null,
        ),
        findMany: vi.fn(async ({ where }: Row = {}) =>
          rows.filter((row) => matches(row, where)),
        ),
        create: vi.fn(async ({ data }: { data: Row }) => {
          rows.push(data);
          return data;
        }),
        update: vi.fn(async ({ where, data }: Row) => {
          const row = rows.find((r) => matches(r, where));
          if (!row) throw new Error('Registro inexistente en doble de prueba.');
          Object.assign(row, data);
          return row;
        }),
        deleteMany: vi.fn(async ({ where }: Row) => {
          let count = 0;
          for (let i = rows.length - 1; i >= 0; i--)
            if (matches(rows[i], where)) {
              rows.splice(i, 1);
              count++;
            }
          return { count };
        }),
      };
    };
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
      expect(() =>
        parseUserInput(options, { [field]: value }, 'create'),
      ).toThrow();
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

  it('crea credenciales de empleado mediante Better Auth sin crear una sesion y permite autenticar su hash', async () => {
    const database = createPrismaMock();
    const service = new AuthService(database as unknown as PrismaService);
    const tx = database as unknown as Parameters<
      AuthService['crearEmpleado']
    >[0];
    const temporal = 'TemporalDePrueba123!';
    const id = await service.crearEmpleado(
      tx,
      {
        nombre: 'Cajero',
        email: 'cajero@example.com',
        username: 'cajero',
        empresaId: 'empresa-1',
        rolId: 'rol-1',
        passwordTemporalExpiraEn: new Date(Date.now() + 86400000),
      },
      temporal,
    );
    expect(database.usuario.rows[0]).toMatchObject({
      id,
      nombre: 'Cajero',
      empresaId: 'empresa-1',
      rolId: 'rol-1',
      debeCambiarPassword: true,
    });
    expect(database.session.rows).toHaveLength(0);
    expect(database.account.rows[0]).toMatchObject({
      providerId: 'credential',
      accountId: id,
      userId: id,
    });
    expect(database.account.rows[0].password).not.toBe(temporal);
    const response = await service.auth.handler(
      new Request('http://localhost:3000/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'cajero@example.com',
          password: temporal,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(database.session.rows).toHaveLength(1);
    await service.guardarPassword(tx, id, 'NuevaPasswordPrueba123!', temporal);
    await service.actualizarEmpleado(tx, id, {
      name: 'Nombre actualizado',
      email: 'actualizado@example.com',
    });
    expect(database.usuario.rows[0]).toMatchObject({
      nombre: 'Nombre actualizado',
      email: 'actualizado@example.com',
    });
    await service.revocarSesiones(tx, id);
    expect(database.session.rows).toHaveLength(0);
    await expect(
      service.guardarPassword(tx, id, 'OtraPasswordPrueba123!', temporal),
    ).rejects.toThrow('actual');
  });

  it.each(['inactivo', 'vencido', 'sin-vencimiento'])(
    'no inicia sesion de empleado %s',
    async (caso) => {
      const database = createPrismaMock();
      const service = new AuthService(database as unknown as PrismaService);
      const tx = database as unknown as Parameters<
        AuthService['crearEmpleado']
      >[0];
      await service.crearEmpleado(
        tx,
        {
          nombre: 'Cajero',
          email: 'cajero@example.com',
          username: 'cajero',
          empresaId: 'e',
          rolId: 'r',
          passwordTemporalExpiraEn: new Date(Date.now() + 86400000),
        },
        'TemporalDePrueba123!',
      );
      Object.assign(
        database.usuario.rows[0],
        caso === 'inactivo'
          ? { activo: false }
          : {
              passwordTemporalExpiraEn:
                caso === 'vencido' ? new Date('2000-01-01') : null,
            },
      );
      const response = await service.auth.handler(
        new Request('http://localhost:3000/api/auth/sign-in/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'cajero@example.com',
            password: 'TemporalDePrueba123!',
          }),
        }),
      );
      expect(response.status).toBe(403);
      expect(database.session.rows).toHaveLength(0);
    },
  );
});
