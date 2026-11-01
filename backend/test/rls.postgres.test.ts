import 'reflect-metadata';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { configureAuthRoutes } from '../src/modules/auth/auth.routes.js';
import { contextoRls } from '../src/prisma/contexto-rls.js';
import { verificarConexionRls } from '../src/prisma/verificar-conexion-rls.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const url = process.env.RLS_TEST_DATABASE_URL;
describe.skipIf(!url)('RLS: PostgreSQL local real, sin Neon', () => {
  let owner: pg.Client;
  let app: NestExpressApplication;
  let negocio: PrismaService;
  let a: ReturnType<typeof request.agent>;
  let b: ReturnType<typeof request.agent>;
  let empresaA: string,
    empresaB: string,
    usuarioA: string,
    usuarioB: string,
    productoA: string,
    productoB: string;
  const origin = 'http://localhost:4000';
  const clave = 'PasswordFicticiaLocal123!';
  const enEmpresa = <T>(empresaId: string, usuarioId: string, tarea: () => T) =>
    contextoRls.run({ empresaId, usuarioId }, tarea);
  const conexion = (login: string) => {
    const u = new URL(url!);
    u.username = login;
    u.password = '';
    return u.toString();
  };

  beforeAll(async () => {
    const u = new URL(url!);
    if (
      !['127.0.0.1', 'localhost'].includes(u.hostname) ||
      !u.pathname.startsWith('/saas_rls_test')
    )
      throw new Error(
        'Las pruebas RLS solo admiten una base LOCAL aislada saas_rls_test*, nunca DATABASE_URL/Neon.',
      );
    owner = new pg.Client({ connectionString: url });
    await owner.connect();
    const existentes = await owner.query(
      "SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'",
    );
    if (existentes.rows[0].n !== 0)
      throw new Error(
        'Usa una base local vacia; no se borran tablas existentes.',
      );
    for (const nombre of readdirSync('prisma/migrations')
      .filter((f) => /^\d/.test(f))
      .sort())
      await owner.query(
        readFileSync(
          join('prisma/migrations', nombre, 'migration.sql'),
          'utf8',
        ),
      );
    await owner.query(
      "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='saas_app') THEN CREATE ROLE saas_app LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE IN ROLE saas_negocio; END IF; IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='saas_auth') THEN CREATE ROLE saas_auth LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE IN ROLE saas_identidad; END IF; END $$",
    );
    vi.stubEnv('APP_DATABASE_URL', conexion('saas_app'));
    vi.stubEnv('AUTH_DATABASE_URL', conexion('saas_auth'));
    vi.stubEnv(
      'BETTER_AUTH_SECRET',
      'secreto-ficticio-local-rls-12345678901234567890',
    );
    vi.stubEnv('BETTER_AUTH_URL', origin);
    vi.stubEnv('NODE_ENV', 'test');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configureAuthRoutes(app);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    negocio = app.get(PrismaService);
    a = request.agent(app.getHttpServer());
    b = request.agent(app.getHttpServer());
    for (const [agente, letra] of [
      [a, 'a'],
      [b, 'b'],
    ] as const) {
      const alta = await agente
        .post('/api/auth/sign-up/email')
        .set('Origin', origin)
        .send({
          name: 'Admin ' + letra,
          email: letra + '@rls.example.com',
          password: clave,
          username: 'admin_' + letra,
        })
        .expect(200);
      const empresa = await agente
        .post('/empresas')
        .send({ nombre: 'Empresa ' + letra, direccion: 'Prueba local' })
        .expect(201);
      const producto = await agente
        .post('/catalogo/productos')
        .send({
          sku: 'MISMO-SKU',
          nombre: 'Producto ' + letra,
          precioBase: '50.00',
          precioCosto: '20.00',
        })
        .expect(201);
      if (letra === 'a') {
        usuarioA = alta.body.user.id;
        empresaA = empresa.body.id;
        productoA = producto.body.id;
      } else {
        usuarioB = alta.body.user.id;
        empresaB = empresa.body.id;
        productoB = producto.body.id;
      }
      await owner.query(
        'INSERT INTO "MovimientoAlmacen" (id,"empresaId","productoId",tipo,cantidad,"usuarioId","creadoEn") VALUES($1,$2,$3,\'COMPRA\',10,$4,now())',
        [randomUUID(), empresa.body.id, producto.body.id, alta.body.user.id],
      );
    }
  });
  afterAll(async () => {
    await app?.close();
    await owner?.end();
    vi.unstubAllEnvs();
  });

  it('activa FORCE RLS en las 28 tablas y no usa propietario ni BYPASSRLS', async () => {
    const filas = await owner.query(
      "SELECT count(*)::int n FROM pg_tables t JOIN pg_class c ON c.relname=t.tablename JOIN pg_namespace s ON s.oid=c.relnamespace AND s.nspname=t.schemaname WHERE t.schemaname='public' AND t.tablename<>'_prisma_migrations' AND c.relrowsecurity AND c.relforcerowsecurity",
    );
    expect(filas.rows[0].n).toBe(28);
  });
  it('rechaza el cliente de negocio sin contexto validado', async () => {
    await expect(async () => negocio.producto.findMany()).rejects.toThrow(
      'contexto',
    );
  });
  it('filtra consultas sin WHERE por empresa y mantiene solicitudes paralelas aisladas', async () => {
    const [aa, bb] = await Promise.all([
      enEmpresa(empresaA, usuarioA, () => negocio.producto.findMany()),
      enEmpresa(empresaB, usuarioB, () => negocio.producto.findMany()),
    ]);
    expect(aa.map((p) => p.id)).toEqual([productoA]);
    expect(bb.map((p) => p.id)).toEqual([productoB]);
    const lote = await enEmpresa(empresaA, usuarioA, () =>
      negocio.$transaction(async (tx) =>
        Promise.all([tx.producto.count(), tx.usuario.count()]),
      ),
    );
    expect(lote).toEqual([1, 1]);
    const [httpA, httpB] = await Promise.all([
      a.get('/catalogo/productos').expect(200),
      b.get('/catalogo/productos').expect(200),
    ]);
    expect(httpA.body.datos.map((p: any) => p.id)).toEqual([productoA]);
    expect(httpB.body.datos.map((p: any) => p.id)).toEqual([productoB]);
  });
  it('rechaza altas y traslados hacia otra empresa aun sin validaciones del servicio', async () => {
    await expect(
      enEmpresa(empresaA, usuarioA, () =>
        negocio.producto.create({
          data: {
            empresaId: empresaB,
            sku: 'INTRUSO',
            nombre: 'No',
            precioBase: '1',
          },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      enEmpresa(empresaA, usuarioA, () =>
        negocio.producto.update({
          where: { id: productoA },
          data: { empresaId: empresaB },
        }),
      ),
    ).rejects.toThrow();
    const filas = await enEmpresa(empresaA, usuarioA, () =>
      negocio.producto.updateMany({
        where: { id: productoB },
        data: { nombre: 'Intruso' },
      }),
    );
    expect(filas.count).toBe(0);
  });
  it('no permite cambiar el id de Empresa hacia otro tenant', async () => {
    await expect(
      enEmpresa(empresaA, usuarioA, () =>
        negocio.empresa.update({
          where: { id: empresaA },
          data: { id: randomUUID() },
        }),
      ),
    ).rejects.toThrow();
  });
  it('borra el contexto LOCAL tras commit/rollback y no deja filas visibles sin contexto', async () => {
    const c = new pg.Client({ connectionString: conexion('saas_app') });
    await c.connect();
    try {
      await c.query('BEGIN');
      await c.query("SELECT set_config('app.empresa_id',$1,true)", [empresaA]);
      expect((await c.query('SELECT * FROM "Producto"')).rows).toHaveLength(1);
      await c.query('COMMIT');
      expect((await c.query('SELECT * FROM "Producto"')).rows).toHaveLength(0);
      await c.query('BEGIN');
      await c.query("SELECT set_config('app.empresa_id',$1,true)", [empresaB]);
      await c.query('ROLLBACK');
      expect((await c.query('SELECT * FROM "Producto"')).rows).toHaveLength(0);
    } finally {
      await c.end();
    }
  });
  it('identidad autentica pero no consulta ventas/inventario ni asigna empresa/roles', async () => {
    const c = new pg.Client({ connectionString: conexion('saas_auth') });
    await c.connect();
    try {
      for (const tabla of [
        'Producto',
        'Venta',
        'MovimientoAlmacen',
        'Suscripcion',
      ])
        await expect(
          c.query('SELECT * FROM "' + tabla + '"'),
        ).rejects.toMatchObject({ code: '42501' });
      await expect(
        c.query('UPDATE "Usuario" SET "empresaId"=$1 WHERE id=$2', [
          empresaB,
          usuarioA,
        ]),
      ).rejects.toMatchObject({ code: '42501' });
      await expect(
        c.query('UPDATE "Usuario" SET "rolId"=NULL WHERE id=$1', [usuarioA]),
      ).rejects.toMatchObject({ code: '42501' });
    } finally {
      await c.end();
    }
  });
  it('negocio no puede desactivar RLS ni asumir el rol de identidad', async () => {
    const c = new pg.Client({ connectionString: conexion('saas_app') });
    await c.connect();
    try {
      await expect(
        c.query('ALTER TABLE "Producto" DISABLE ROW LEVEL SECURITY'),
      ).rejects.toMatchObject({ code: '42501' });
      await expect(c.query('SET ROLE saas_identidad')).rejects.toMatchObject({
        code: '42501',
      });
      await c.query('SET row_security=off');
      await expect(c.query('SELECT * FROM "Producto"')).rejects.toMatchObject({
        code: '42501',
      });
    } finally {
      await c.end();
    }
  });
  it('las rutas tampoco acceden a productos ajenos y editan solo su empresa', async () => {
    await a.get('/catalogo/productos/' + productoB).expect(404);
    await a
      .patch('/catalogo/productos/' + productoB)
      .send({ nombre: 'Intruso' })
      .expect(404);
    await a
      .patch('/empresas/actual/configuracion')
      .send({ nombre: 'Empresa A editada' })
      .expect(200);
    const otra = await b.get('/empresas/actual').expect(200);
    expect(otra.body.nombre).toBe('Empresa b');
  });
  it('mantiene empleados, contrasenas temporales y sesiones dentro de su empresa', async () => {
    const alta = await a
      .post('/usuarios')
      .send({
        nombre: 'Cajero',
        email: 'cajero@rls.example.com',
        username: 'cajero_rls',
        rol: 'CAJERO',
      })
      .expect(201);
    await b.get('/usuarios/' + alta.body.id).expect(404);
    const foreign = await enEmpresa(empresaB, usuarioB, () =>
      negocio.account.findMany({ where: { userId: alta.body.id } }),
    );
    expect(foreign).toHaveLength(0);
    const empleado = request.agent(app.getHttpServer());
    await empleado
      .post('/api/auth/sign-in/email')
      .set('Origin', origin)
      .send({
        email: 'cajero@rls.example.com',
        password: alta.body.passwordTemporal,
      })
      .expect(200);
    await empleado.get('/catalogo/productos').expect(403);
    await empleado
      .post('/usuarios/cambiar-password-temporal')
      .send({
        passwordActual: alta.body.passwordTemporal,
        passwordNueva: 'NuevaPasswordLocal123!',
      })
      .expect(200);
    await empleado
      .post('/api/auth/sign-in/email')
      .set('Origin', origin)
      .send({
        email: 'cajero@rls.example.com',
        password: 'NuevaPasswordLocal123!',
      })
      .expect(200);
    await empleado.get('/catalogo/productos').expect(200);
  });
  it('conserva la transaccion de venta y abono con RLS real', async () => {
    const cliente = await a
      .post('/ventas/clientes')
      .send({ nombre: 'Cliente local' })
      .expect(201);
    await a.post('/caja').send({ efectivoInicial: '100' }).expect(201);
    const venta = await a
      .post('/ventas')
      .send({
        clienteId: cliente.body.id,
        tipoVenta: 'CREDITO',
        detalles: [{ productoId: productoA, cantidad: '1' }],
      })
      .expect(201);
    await a
      .post('/creditos/' + venta.body.credito.id + '/abonos')
      .send({ monto: '10', metodoPago: 'EFECTIVO' })
      .expect(201);
    const caja = await a.get('/caja/actual').expect(200);
    const arqueo = await a.get('/caja/' + caja.body.id + '/arqueo').expect(200);
    expect(arqueo.body.efectivoEsperado).toBe('110');
    await b.get('/creditos/' + venta.body.credito.id).expect(404);
  });
  it('rechaza el propietario como conexion de ejecucion', async () => {
    const privilegiado = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    try {
      await expect(
        verificarConexionRls(privilegiado, 'saas_negocio'),
      ).rejects.toThrow('no cumple');
    } finally {
      await privilegiado.$disconnect();
    }
    expect(app.get(AuthService)).toBeDefined();
  });
  it('recibe una compra y conserva transacciones/raw de inventario bajo RLS', async () => {
    const proveedor = await a
      .post('/compras/proveedores')
      .send({ nombre: 'Proveedor local' })
      .expect(201);
    const compra = await a
      .post('/compras')
      .send({
        proveedorId: proveedor.body.id,
        items: [
          {
            productoId: productoA,
            cantidadSolicitada: '2',
            costoUnitario: '20',
          },
        ],
      })
      .expect(201);
    await a.post('/compras/' + compra.body.id + '/recibir').expect(200);
    await b.get('/compras/' + compra.body.id).expect(404);
  });
  it('SuperAdmin no opera una ferreteria ni puede registrarla por su cuenta', async () => {
    const sa = request.agent(app.getHttpServer());
    const alta = await sa
      .post('/api/auth/sign-up/email')
      .set('Origin', origin)
      .send({
        name: 'Plataforma',
        email: 'sa@rls.example.com',
        password: clave,
      })
      .expect(200);
    await owner.query(
      'INSERT INTO "SuperAdmin" (id,"usuarioId",activo,"creadoEn","actualizadoEn") VALUES ($1,$2,true,now(),now())',
      [randomUUID(), alta.body.user.id],
    );
    await sa
      .post('/empresas')
      .send({ nombre: 'No autorizado', direccion: 'Local' })
      .expect(403);
    await sa.get('/catalogo/productos').expect(403);
  });
});
