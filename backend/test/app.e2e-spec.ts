// Pruebas HTTP con el codigo fuente y almacenamiento simulado.
// No conectan ni escriben en Neon. Ejecutar npm run test:e2e.
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { Prisma } from '../src/generated/prisma/client.js';

type Row = Record<string, any>;

function baseSimulada() {
  const usuario = (id: string) => ({
    id,
    activo: true,
    debeCambiarPassword: false,
    empresaId: null,
    rolId: null,
    superAdmin: null,
  });
  let state: Record<string, Row[]> = {
    usuarios: [usuario('usuario-1'), usuario('usuario-2')],
    empresas: [],
    roles: [],
    productos: [],
    categorias: [],
    unidades: [],
  };
  let impedirVinculo = false;
  const error = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('Error simulado', {
      code,
      clientVersion: '7',
    });
  const limpiar = (data: Row) =>
    Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    );
  const buscar = (tabla: string, where: Row) => {
    const filtro = { ...where, ...where.empresaId_id };
    delete filtro.empresaId_id;
    return (
      state[tabla].find((row) =>
        Object.entries(filtro).every(([key, value]) => row[key] === value),
      ) ?? null
    );
  };
  const db = {
    usuario: {
      findUnique: vi.fn(async ({ where }: Row) => {
        const row = buscar('usuarios', where);
        return row
          ? {
              ...row,
              empresa: buscar('empresas', { id: row.empresaId }),
              rol: buscar('roles', { id: row.rolId }),
            }
          : null;
      }),
      updateMany: vi.fn(async ({ where, data }: Row) => {
        const row = buscar('usuarios', where);
        if (!row || impedirVinculo) return { count: 0 };
        Object.assign(row, limpiar(data));
        return { count: 1 };
      }),
    },
    empresa: {
      findUnique: vi.fn(async ({ where }: Row) => buscar('empresas', where)),
      create: vi.fn(async ({ data }: Row) => {
        const row = { id: randomUUID(), estado: 'ACTIVA', ...limpiar(data) };
        state.empresas.push(row);
        return row;
      }),
    },
    rol: {
      createMany: vi.fn(async ({ data }: Row) => {
        let count = 0;
        for (const rol of data) {
          if (
            !state.roles.some(
              (row) =>
                row.empresaId === rol.empresaId && row.nombre === rol.nombre,
            )
          ) {
            state.roles.push({ id: randomUUID(), activo: true, ...rol });
            count++;
          }
        }
        return { count };
      }),
      findMany: vi.fn(async ({ where }: Row) =>
        state.roles.filter((row) => row.empresaId === where.empresaId),
      ),
    },
    categoria: {
      findUnique: vi.fn(async ({ where }: Row) => buscar('categorias', where)),
      create: vi.fn(async ({ data }: Row) => {
        const row = { id: randomUUID(), activo: true, ...limpiar(data) };
        state.categorias.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where, skip, take }: Row) =>
        state.categorias
          .filter((row) =>
            Object.entries(where).every(([key, value]) => row[key] === value),
          )
          .slice(skip, skip + take),
      ),
      update: vi.fn(async ({ where, data }: Row) => {
        const row = buscar('categorias', where);
        if (!row) throw error('P2025');
        Object.assign(row, limpiar(data));
        return row;
      }),
    },
    unidadMedida: {
      findUnique: vi.fn(async ({ where }: Row) => buscar('unidades', where)),
      create: vi.fn(async ({ data }: Row) => {
        if (
          state.unidades.some(
            (row) =>
              row.empresaId === data.empresaId && row.nombre === data.nombre,
          )
        ) {
          throw error('P2002');
        }
        const row = { id: randomUUID(), activo: true, ...limpiar(data) };
        state.unidades.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where, skip, take }: Row) =>
        state.unidades
          .filter((row) =>
            Object.entries(where).every(([key, value]) => row[key] === value),
          )
          .slice(skip, skip + take),
      ),
      update: vi.fn(async ({ where, data }: Row) => {
        const row = buscar('unidades', where);
        if (!row) throw error('P2025');
        if (
          data.nombre !== undefined &&
          state.unidades.some(
            (otra) =>
              otra.id !== row.id &&
              otra.empresaId === row.empresaId &&
              otra.nombre === data.nombre,
          )
        ) {
          throw error('P2002');
        }
        Object.assign(row, limpiar(data));
        return row;
      }),
    },
    producto: {
      create: vi.fn(async ({ data }: Row) => {
        if (
          state.productos.some(
            (row) =>
              row.empresaId === data.empresaId &&
              (row.sku === data.sku ||
                (data.codigoBarras && row.codigoBarras === data.codigoBarras)),
          )
        )
          throw error('P2002');
        const row = {
          id: randomUUID(),
          activo: true,
          precioCosto: new Prisma.Decimal(0),
          ...limpiar(data),
        };
        state.productos.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: Row) => buscar('productos', where)),
      findMany: vi.fn(async ({ where, skip, take }: Row) =>
        state.productos
          .filter((row) =>
            Object.entries(where).every(([key, value]) => row[key] === value),
          )
          .slice(skip, skip + take),
      ),
      update: vi.fn(async ({ where, data }: Row) => {
        const row = buscar('productos', where);
        if (!row) throw error('P2025');
        Object.assign(row, limpiar(data));
        return row;
      }),
    },
    $transaction: async <T>(callback: (tx: unknown) => Promise<T>) => {
      const anterior = Object.fromEntries(
        Object.entries(state).map(([key, rows]) => [
          key,
          rows.map((row) => ({ ...row })),
        ]),
      );
      try {
        return await callback(db);
      } catch (error) {
        state = anterior;
        throw error;
      }
    },
  };
  return {
    db,
    estado: () => state,
    fallarVinculo: () => {
      impedirVinculo = true;
    },
  };
}

describe('Empresa y productos: HTTP sin escrituras en Neon', () => {
  let app: INestApplication;
  let fixture: ReturnType<typeof baseSimulada>;
  const ruta = '/catalogo/productos';
  const producto = {
    sku: 'MART-001',
    nombre: 'Martillo',
    precioBase: '125.50',
    precioCosto: '80.25',
  };

  beforeEach(async () => {
    fixture = baseSimulada();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(fixture.db)
      .overrideProvider(AuthService)
      .useValue({
        auth: {
          api: {
            // Esta cabecera solo existe en el doble de prueba, nunca en produccion.
            getSession: async ({ headers }: { headers: Headers }) => {
              const id = headers.get('x-usuario-prueba');
              return id ? { user: { id } } : null;
            },
          },
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  async function crearEmpresa(usuario = 'usuario-1') {
    const response = await request(app.getHttpServer())
      .post('/empresas')
      .set('x-usuario-prueba', usuario)
      .send({ nombre: 'Ferreteria de prueba', direccion: 'Managua' })
      .expect(201);
    return response.body;
  }

  it('valida categorias, aisla empresas y conserva productos al dar de baja', async () => {
    const rutaCategorias = '/catalogo/categorias';
    await request(app.getHttpServer()).get(rutaCategorias).expect(401);
    const empresa = await crearEmpresa();
    const otraEmpresa = await crearEmpresa('usuario-2');
    for (const body of [
      { nombre: '   ' },
      { nombre: null },
      { nombre: 'a'.repeat(101) },
      { nombre: 'Herramientas', empresaId: otraEmpresa.id },
    ]) {
      await request(app.getHttpServer())
        .post(rutaCategorias)
        .set('x-usuario-prueba', 'usuario-1')
        .send(body)
        .expect(400);
    }
    const crear = await request(app.getHttpServer())
      .post(rutaCategorias)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ nombre: ' Herramientas ', descripcion: 'Manuales' })
      .expect(201);
    const id = crear.body.id;
    expect(crear.body.nombre).toBe('Herramientas');
    expect(crear.body.empresaId).toBe(empresa.id);
    const lista = await request(app.getHttpServer())
      .get(rutaCategorias)
      .set('x-usuario-prueba', 'usuario-2')
      .expect(200);
    expect(lista.body.datos).toEqual([]);
    await request(app.getHttpServer())
      .get(`${rutaCategorias}/${id}`)
      .set('x-usuario-prueba', 'usuario-2')
      .expect(404);
    await request(app.getHttpServer())
      .patch(`${rutaCategorias}/${id}`)
      .set('x-usuario-prueba', 'usuario-2')
      .send({ nombre: 'Ajena' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`${rutaCategorias}/${id}`)
      .set('x-usuario-prueba', 'usuario-2')
      .expect(404);
    await request(app.getHttpServer())
      .get(`${rutaCategorias}/invalido`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(400);
    await request(app.getHttpServer())
      .get(`${rutaCategorias}?limite=101`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(400);
    await request(app.getHttpServer())
      .patch(`${rutaCategorias}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ nombre: null })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`${rutaCategorias}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ nombre: 'Herramientas manuales', descripcion: null })
      .expect(200);
    const productoCreado = await request(app.getHttpServer())
      .post(ruta)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ ...producto, categoriaId: id })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`${rutaCategorias}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(204);
    expect(fixture.estado().categorias[0].activo).toBe(false);
    await request(app.getHttpServer())
      .get(`${ruta}/${productoCreado.body.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    const activas = await request(app.getHttpServer())
      .get(rutaCategorias)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(activas.body.datos).toEqual([]);
    await request(app.getHttpServer())
      .get(`${rutaCategorias}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(404);
    await request(app.getHttpServer())
      .post(ruta)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ ...producto, sku: 'OTRO', categoriaId: id })
      .expect(400);
  });

  it.each(['CAJERO', 'BODEGUERO'])(
    'aplica permisos de categorias para %s',
    async (nombre) => {
      const empresa = await crearEmpresa();
      const rutaCategorias = '/catalogo/categorias';
      const crear = await request(app.getHttpServer())
        .post(rutaCategorias)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ nombre: 'Herramientas' })
        .expect(201);
      fixture.estado().usuarios[0].rolId = empresa.roles.find(
        (rol: Row) => rol.nombre === nombre,
      ).id;
      await request(app.getHttpServer())
        .get(rutaCategorias)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(200);
      await request(app.getHttpServer())
        .get(`${rutaCategorias}/${crear.body.id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(200);
      await request(app.getHttpServer())
        .post(rutaCategorias)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ nombre: 'Pinturas' })
        .expect(403);
      expect(fixture.estado().categorias).toHaveLength(1);
      await request(app.getHttpServer())
        .patch(`${rutaCategorias}/${crear.body.id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ nombre: 'Otra' })
        .expect(403);
      await request(app.getHttpServer())
        .delete(`${rutaCategorias}/${crear.body.id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(403);
    },
  );

  it('valida unidades, limita duplicados por empresa y conserva productos al dar de baja', async () => {
    await crearEmpresa();
    await crearEmpresa('usuario-2');
    const base = '/catalogo/unidades-medida';
    const http = request(app.getHttpServer());
    const unidad = { nombre: 'Kilogramo', simbolo: 'kg' };
    await http.get(base).expect(401);
    for (const body of [
      { nombre: '   ', simbolo: 'kg' },
      { nombre: null, simbolo: 'kg' },
      { nombre: 'Kilogramo' },
      { ...unidad, simbolo: ' ' },
      { ...unidad, nombre: 'x'.repeat(61) },
      { ...unidad, simbolo: 'x'.repeat(21) },
      { ...unidad, empresaId: 'ajena' },
    ]) {
      await http
        .post(base)
        .set('x-usuario-prueba', 'usuario-1')
        .send(body)
        .expect(400);
    }
    const creada = await http
      .post(base)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ nombre: ' Kilogramo ', simbolo: ' kg ' })
      .expect(201);
    const id = creada.body.id;
    expect(creada.body.nombre).toBe('Kilogramo');
    expect(creada.body.simbolo).toBe('kg');
    await http
      .post(base)
      .set('x-usuario-prueba', 'usuario-1')
      .send(unidad)
      .expect(409);
    await http
      .post(base)
      .set('x-usuario-prueba', 'usuario-2')
      .send(unidad)
      .expect(201);
    for (const method of ['get', 'patch', 'delete'] as const) {
      const req = http[method](`${base}/${id}`).set(
        'x-usuario-prueba',
        'usuario-2',
      );
      if (method === 'patch') req.send({ simbolo: 'otro' });
      await req.expect(404);
    }
    const lista = await http
      .get(`${base}?pagina=1&limite=1`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(lista.body.datos.map((row: Row) => row.id)).toEqual([id]);
    await http
      .get(`${base}?limite=0`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(400);
    await http
      .get(`${base}/invalido`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(400);
    await http
      .patch(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ simbolo: null })
      .expect(400);
    await http
      .patch(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ simbolo: 'KG' })
      .expect(200);
    const otra = await http
      .post(base)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ nombre: 'Metro', simbolo: 'm' })
      .expect(201);
    await http
      .patch(`${base}/${otra.body.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ nombre: 'Kilogramo' })
      .expect(409);
    const creado = await http
      .post(ruta)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ ...producto, unidadMedidaId: id })
      .expect(201);
    await http
      .delete(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(204);
    expect(fixture.estado().unidades.find((row) => row.id === id)?.activo).toBe(
      false,
    );
    await http
      .get(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(404);
    await http
      .patch(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ simbolo: 'kg' })
      .expect(404);
    await http
      .get(`${ruta}/${creado.body.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    const activas = await http
      .get(base)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(activas.body.datos.map((row: Row) => row.id)).toEqual([
      otra.body.id,
    ]);
    await http
      .post(ruta)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ ...producto, sku: 'OTRO', unidadMedidaId: id })
      .expect(400);
  });

  it.each(['CAJERO', 'BODEGUERO'])(
    'restringe unidades de medida a consulta para %s',
    async (nombre) => {
      const empresa = await crearEmpresa();
      const base = '/catalogo/unidades-medida';
      const http = request(app.getHttpServer());
      const crear = await http
        .post(base)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ nombre: 'Litro', simbolo: 'L' })
        .expect(201);
      fixture.estado().usuarios[0].rolId = empresa.roles.find(
        (rol: Row) => rol.nombre === nombre,
      ).id;
      await http.get(base).set('x-usuario-prueba', 'usuario-1').expect(200);
      await http
        .get(`${base}/${crear.body.id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(200);
      await http
        .post(base)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ nombre: 'Metro', simbolo: 'm' })
        .expect(403);
      await http
        .patch(`${base}/${crear.body.id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ simbolo: 'l' })
        .expect(403);
      await http
        .delete(`${base}/${crear.body.id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(403);
      expect(fixture.estado().unidades).toHaveLength(1);
      expect(fixture.estado().unidades[0]).toMatchObject({
        simbolo: 'L',
        activo: true,
      });
    },
  );

  it('exige sesion para crear empresa o consultar productos', async () => {
    await request(app.getHttpServer())
      .post('/empresas')
      .send({ nombre: 'A', direccion: 'B' })
      .expect(401);
    await request(app.getHttpServer()).get(ruta).expect(401);
    expect(fixture.estado().empresas).toHaveLength(0);
  });

  it('crea empresa, roles y administrador; no permite una segunda alta al mismo usuario', async () => {
    const empresa = await crearEmpresa();
    expect(empresa.roles.map((rol: Row) => rol.nombre).sort()).toEqual([
      'ADMIN',
      'BODEGUERO',
      'CAJERO',
    ]);
    const usuario = fixture.estado().usuarios[0];
    expect(usuario.empresaId).toBe(empresa.id);
    expect(
      fixture.estado().roles.find((rol) => rol.id === usuario.rolId)?.nombre,
    ).toBe('ADMIN');
    await request(app.getHttpServer())
      .get('/empresas/actual')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    await request(app.getHttpServer())
      .post('/empresas')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ nombre: 'Otra', direccion: 'B' })
      .expect(409);
    expect(fixture.estado().empresas).toHaveLength(1);
  });

  it('revierte empresa y roles si el usuario ya no puede vincularse al finalizar', async () => {
    fixture.fallarVinculo();
    await request(app.getHttpServer())
      .post('/empresas')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ nombre: 'A', direccion: 'B' })
      .expect(409);
    expect(fixture.estado().empresas).toHaveLength(0);
    expect(fixture.estado().roles).toHaveLength(0);
  });

  it('impide asignar usuario, rol o estado desde el registro de empresa', async () => {
    await request(app.getHttpServer())
      .post('/empresas')
      .set('x-usuario-prueba', 'usuario-1')
      .send({
        nombre: 'A',
        direccion: 'B',
        usuarioId: 'usuario-2',
        rolId: 'ADMIN',
        estado: 'ACTIVA',
      })
      .expect(400);
    expect(fixture.estado().empresas).toHaveLength(0);
  });

  it('permite crear, consultar, editar y dar de baja un producto con precios decimales', async () => {
    const empresa = await crearEmpresa();
    const crear = await request(app.getHttpServer())
      .post(ruta)
      .set('x-usuario-prueba', 'usuario-1')
      .send(producto)
      .expect(201);
    expect(crear.body.precioBase).toBe('125.5');
    expect(crear.body.precioCosto).toBe('80.25');
    expect(crear.body.empresaId).toBe(empresa.id);
    const id = crear.body.id;
    const lista = await request(app.getHttpServer())
      .get(ruta)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(lista.body.datos).toHaveLength(1);
    await request(app.getHttpServer())
      .patch(`${ruta}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ precioBase: '140.75' })
      .expect(200);
    const detalle = await request(app.getHttpServer())
      .get(`${ruta}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(detalle.body.precioBase).toBe('140.75');
    await request(app.getHttpServer())
      .delete(`${ruta}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(204);
    await request(app.getHttpServer())
      .get(`${ruta}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(404);
    expect(fixture.estado().productos[0].activo).toBe(false);
  });

  it.each(['CAJERO', 'BODEGUERO'])(
    'aplica los permisos de %s',
    async (nombre) => {
      const empresa = await crearEmpresa();
      const crear = await request(app.getHttpServer())
        .post(ruta)
        .set('x-usuario-prueba', 'usuario-1')
        .send(producto)
        .expect(201);
      fixture.estado().usuarios[0].rolId = fixture
        .estado()
        .roles.find(
          (rol) => rol.empresaId === empresa.id && rol.nombre === nombre,
        )!.id;
      await request(app.getHttpServer())
        .get(ruta)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(200);
      await request(app.getHttpServer())
        .post(ruta)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ ...producto, sku: 'OTRO' })
        .expect(403);
      expect(fixture.estado().productos).toHaveLength(1);
      await request(app.getHttpServer())
        .patch(`${ruta}/${crear.body.id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ nombre: 'Cambio' })
        .expect(403);
      await request(app.getHttpServer())
        .delete(`${ruta}/${crear.body.id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(403);
    },
  );

  it('aisla productos entre empresas y permite repetir un SKU en otra empresa', async () => {
    await crearEmpresa();
    const crear = await request(app.getHttpServer())
      .post(ruta)
      .set('x-usuario-prueba', 'usuario-1')
      .send(producto)
      .expect(201);
    await request(app.getHttpServer())
      .post(ruta)
      .set('x-usuario-prueba', 'usuario-1')
      .send(producto)
      .expect(409);
    await crearEmpresa('usuario-2');
    for (const method of ['get', 'patch', 'delete'] as const) {
      const req = request(app.getHttpServer())
        [method](`${ruta}/${crear.body.id}`)
        .set('x-usuario-prueba', 'usuario-2');
      if (method === 'patch') req.send({ nombre: 'Otra empresa' });
      await req.expect(404);
    }
    const lista = await request(app.getHttpServer())
      .get(ruta)
      .set('x-usuario-prueba', 'usuario-2')
      .expect(200);
    expect(lista.body.datos).toHaveLength(0);
    await request(app.getHttpServer())
      .post(ruta)
      .set('x-usuario-prueba', 'usuario-2')
      .send(producto)
      .expect(201);
  });

  it.each([
    {
      modulo: 'usuarios',
      leer: ['ADMIN'],
      crear: ['ADMIN'],
      editar: ['ADMIN'],
    },
    {
      modulo: 'inventario',
      leer: ['ADMIN', 'BODEGUERO'],
      crear: ['ADMIN', 'BODEGUERO'],
      editar: ['ADMIN'],
    },
    {
      modulo: 'compras',
      leer: ['ADMIN', 'BODEGUERO'],
      crear: ['ADMIN', 'BODEGUERO'],
      editar: ['ADMIN'],
    },
    {
      modulo: 'ventas',
      leer: ['ADMIN', 'CAJERO'],
      crear: ['ADMIN', 'CAJERO'],
      editar: ['ADMIN'],
    },
    {
      modulo: 'caja',
      leer: ['ADMIN', 'CAJERO'],
      crear: ['ADMIN', 'CAJERO'],
      editar: ['ADMIN', 'CAJERO'],
    },
    {
      modulo: 'creditos',
      leer: ['ADMIN', 'CAJERO'],
      crear: ['ADMIN'],
      editar: ['ADMIN'],
    },
  ])(
    'protege todas las rutas del modulo $modulo segun el rol',
    async (permisos) => {
      const empresa = await crearEmpresa();
      const operaciones = [
        { metodo: 'get', sufijo: '', roles: permisos.leer, exito: 200 },
        { metodo: 'get', sufijo: '/1', roles: permisos.leer, exito: 200 },
        { metodo: 'post', sufijo: '', roles: permisos.crear, exito: 201 },
        { metodo: 'patch', sufijo: '/1', roles: permisos.editar, exito: 200 },
        { metodo: 'delete', sufijo: '/1', roles: ['ADMIN'], exito: 200 },
      ] as const;

      for (const operacion of operaciones) {
        const path = `/${permisos.modulo}${operacion.sufijo}`;
        const anonima = request(app.getHttpServer())[operacion.metodo](path);
        if (operacion.metodo === 'post' || operacion.metodo === 'patch')
          anonima.send({});
        await anonima.expect(401);

        for (const nombre of ['ADMIN', 'CAJERO', 'BODEGUERO']) {
          fixture.estado().usuarios[0].rolId = fixture
            .estado()
            .roles.find(
              (rol) => rol.empresaId === empresa.id && rol.nombre === nombre,
            )!.id;
          const peticion = request(app.getHttpServer())
            [operacion.metodo](path)
            .set('x-usuario-prueba', 'usuario-1');
          if (operacion.metodo === 'post' || operacion.metodo === 'patch')
            peticion.send({});
          const esperado = operacion.roles.some((rol) => rol === nombre)
            ? operacion.exito
            : 403;
          await peticion.expect(esperado);
        }
      }
    },
  );

  it('rechaza importes invalidos, IDs ajenos y campos de control enviados por el cliente', async () => {
    await crearEmpresa();
    for (const precioBase of [-1, '1.001', '-1', null]) {
      await request(app.getHttpServer())
        .post(ruta)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ ...producto, precioBase })
        .expect(400);
    }
    await request(app.getHttpServer())
      .post(ruta)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ ...producto, empresaId: randomUUID() })
      .expect(400);
    await request(app.getHttpServer())
      .post(ruta)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ ...producto, categoriaId: randomUUID() })
      .expect(400);
    await request(app.getHttpServer())
      .get(`${ruta}?empresaId=otra`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(400);
    expect(fixture.estado().productos).toHaveLength(0);
  });
});
