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
    proveedores: [],
    ordenes: [],
    itemsCompra: [],
    secuencias: [],
    movimientos: [],
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
  const datosOrden = (row: Row) => ({
    ...row,
    items: state.itemsCompra.filter((item) => item.ordenCompraId === row.id),
  });
  const crearItems = (orden: Row, items: Row[]) => {
    for (const item of items)
      state.itemsCompra.push({
        id: randomUUID(),
        empresaId: orden.empresaId,
        ordenCompraId: orden.id,
        cantidadRecibida: new Prisma.Decimal(0),
        ...limpiar(item),
      });
  };
  const db = {
    movimientoAlmacen: {
      groupBy: vi.fn(async ({ where }: Row) => {
        const sumas = new Map<string, Prisma.Decimal>();
        for (const row of state.movimientos) {
          if (
            row.empresaId === where.empresaId &&
            where.productoId.in.includes(row.productoId)
          ) {
            sumas.set(
              row.productoId,
              (sumas.get(row.productoId) ?? new Prisma.Decimal(0)).plus(
                row.cantidad,
              ),
            );
          }
        }
        return [...sumas].map(([productoId, cantidad]) => ({
          productoId,
          _sum: { cantidad },
        }));
      }),
      create: vi.fn(),
      createMany: vi.fn(async ({ data }: Row) => {
        state.movimientos.push(
          ...data.map((row: Row) => ({ id: randomUUID(), ...row })),
        );
        return { count: data.length };
      }),
    },
    $executeRaw: vi.fn(
      async (
        _sql: TemplateStringsArray,
        empresaId: string,
        ordenCompraId: string,
      ) => {
        let count = 0;
        for (const item of state.itemsCompra) {
          if (
            item.empresaId === empresaId &&
            item.ordenCompraId === ordenCompraId &&
            item.cantidadRecibida.isZero()
          ) {
            item.cantidadRecibida = item.cantidadSolicitada;
            count++;
          }
        }
        return count;
      },
    ),
    secuencia: {
      upsert: vi.fn(async ({ where, create }: Row) => {
        const row = state.secuencias.find(
          (r) =>
            r.empresaId === where.empresaId_tipo.empresaId &&
            r.tipo === where.empresaId_tipo.tipo,
        );
        if (row) {
          row.ultimoValor++;
          return row;
        }
        const nueva = { id: randomUUID(), ...create };
        state.secuencias.push(nueva);
        return nueva;
      }),
    },
    ordenCompra: {
      updateMany: vi.fn(async ({ where, data }: Row) => {
        const row = buscar('ordenes', where);
        if (!row) return { count: 0 };
        Object.assign(row, limpiar(data));
        return { count: 1 };
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: Row) => {
        const row = buscar('ordenes', where);
        if (!row) throw error('P2025');
        return datosOrden(row);
      }),
      create: vi.fn(async ({ data }: Row) => {
        if (
          state.ordenes.some(
            (row) =>
              row.empresaId === data.empresaId &&
              row.numeroOrden === data.numeroOrden,
          )
        )
          throw error('P2002');
        const { items, ...cabecera } = data;
        const row = { id: randomUUID(), ...limpiar(cabecera) };
        state.ordenes.push(row);
        crearItems(row, items.create);
        return datosOrden(row);
      }),
      findUnique: vi.fn(async ({ where, include }: Row) => {
        const row = buscar('ordenes', where);
        return row && include?.items ? datosOrden(row) : row;
      }),
      findMany: vi.fn(async ({ where, skip, take }: Row) =>
        state.ordenes
          .filter((row) =>
            Object.entries(limpiar(where)).every(
              ([key, value]) => row[key] === value,
            ),
          )
          .slice(skip, skip + take),
      ),
      update: vi.fn(async ({ where, data, include }: Row) => {
        const row = buscar('ordenes', where);
        if (!row) throw error('P2025');
        const { items, ...cabecera } = data;
        Object.assign(row, limpiar(cabecera));
        if (items) {
          state.itemsCompra = state.itemsCompra.filter(
            (item) => item.ordenCompraId !== row.id,
          );
          crearItems(row, items.create);
        }
        return include?.items ? datosOrden(row) : row;
      }),
    },
    proveedor: {
      findUnique: vi.fn(async ({ where }: Row) => buscar('proveedores', where)),
      create: vi.fn(async ({ data }: Row) => {
        const row = { id: randomUUID(), activo: true, ...limpiar(data) };
        state.proveedores.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where, skip, take }: Row) =>
        state.proveedores
          .filter((row) =>
            Object.entries(where).every(([key, value]) => row[key] === value),
          )
          .slice(skip, skip + take),
      ),
      update: vi.fn(async ({ where, data }: Row) => {
        const row = buscar('proveedores', where);
        if (!row) throw error('P2025');
        Object.assign(row, limpiar(data));
        return row;
      }),
    },
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
      findMany: vi.fn(async ({ where, skip = 0, take }: Row) =>
        state.productos
          .filter((row) =>
            Object.entries(where).every(([key, value]) =>
              key === 'id' && typeof value === 'object' && value !== null
                ? (value as Row).in.includes(row.id)
                : row[key] === value,
            ),
          )
          .slice(skip, take === undefined ? undefined : skip + take),
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

  async function prepararCompra(usuario = 'usuario-1') {
    const empresa = await crearEmpresa(usuario);
    const http = request(app.getHttpServer());
    const proveedor = await http
      .post('/compras/proveedores')
      .set('x-usuario-prueba', usuario)
      .send({ nombre: 'Proveedor para ordenes' })
      .expect(201);
    const articulo = await http
      .post(ruta)
      .set('x-usuario-prueba', usuario)
      .send(producto)
      .expect(201);
    return {
      empresa,
      articulo: articulo.body,
      dto: {
        proveedorId: proveedor.body.id,
        items: [
          {
            productoId: articulo.body.id,
            cantidadSolicitada: '1.125',
            costoUnitario: '80.25',
          },
        ],
      },
    };
  }

  async function crearOrdenParaRecibir() {
    const compra = await prepararCompra();
    const creada = await request(app.getHttpServer())
      .post('/compras')
      .set('x-usuario-prueba', 'usuario-1')
      .send(compra.dto)
      .expect(201);
    return { ...compra, orden: creada.body };
  }

  it('muestra el stock recibido en Inventario y Catalogo sin duplicarlo al repetir la recepcion', async () => {
    const { orden, articulo } = await crearOrdenParaRecibir();
    const http = request(app.getHttpServer());
    const antes = await http
      .get(`/inventario/${articulo.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(antes.body.stockDisponible).toBe('0');
    await http
      .post(`/compras/${orden.id}/recibir`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    for (const path of [
      `/inventario/${articulo.id}`,
      `${ruta}/${articulo.id}`,
    ]) {
      const consulta = await http
        .get(path)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(200);
      expect(consulta.body.stockDisponible).toBe('1.125');
    }
    for (const path of ['/inventario', ruta]) {
      const consulta = await http
        .get(path)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(200);
      expect(consulta.body.datos[0]).toMatchObject({
        id: articulo.id,
        stockDisponible: '1.125',
      });
    }
    await http
      .post(`/compras/${orden.id}/recibir`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(409);
    const despues = await http
      .get(`/inventario/${articulo.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(despues.body.stockDisponible).toBe('1.125');
    expect(fixture.estado().movimientos).toHaveLength(1);
    expect(fixture.estado().productos[0]).not.toHaveProperty('stockDisponible');
  });

  it('suma cantidades con signo y conserva precision decimal sin ocultar saldos negativos', async () => {
    const { articulo, empresa } = await prepararCompra();
    const movimientos = [
      ['COMPRA', '10.125'],
      ['COMPRA', '0.1'],
      ['COMPRA', '0.2'],
      ['VENTA', '-2.025'],
      ['DEVOLUCION_CLIENTE', '1.005'],
      ['DEVOLUCION_PROVEEDOR', '-0.405'],
      ['AJUSTE', '-0.125'],
      ['AJUSTE', '0.5'],
      ['TRANSFERENCIA', '-1'],
      ['TRANSFERENCIA', '2.625'],
    ];
    for (const [tipo, cantidad] of movimientos)
      fixture.estado().movimientos.push({
        id: randomUUID(),
        empresaId: empresa.id,
        productoId: articulo.id,
        tipo,
        cantidad: new Prisma.Decimal(cantidad),
      });
    const http = request(app.getHttpServer());
    const resultado = await http
      .get(`/inventario/${articulo.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(resultado.body.stockDisponible).toBe('11');
    fixture
      .estado()
      .movimientos.push({
        empresaId: empresa.id,
        productoId: articulo.id,
        tipo: 'AJUSTE',
        cantidad: new Prisma.Decimal('-11.125'),
      });
    const negativo = await http
      .get(`/inventario/${articulo.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(negativo.body.stockDisponible).toBe('-0.125');
  });

  it('aisla saldos entre empresas, pagina productos y excluye los inactivos', async () => {
    const { articulo, empresa } = await prepararCompra();
    const otra = await prepararCompra('usuario-2');
    const http = request(app.getHttpServer());
    const sinMovimientos = await http
      .post(ruta)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ ...producto, sku: 'SIN-MOVIMIENTOS' })
      .expect(201);
    fixture
      .estado()
      .movimientos.push(
        {
          empresaId: empresa.id,
          productoId: articulo.id,
          tipo: 'COMPRA',
          cantidad: new Prisma.Decimal('10'),
        },
        {
          empresaId: otra.empresa.id,
          productoId: otra.articulo.id,
          tipo: 'COMPRA',
          cantidad: new Prisma.Decimal('500'),
        },
        {
          empresaId: otra.empresa.id,
          productoId: articulo.id,
          tipo: 'COMPRA',
          cantidad: new Prisma.Decimal('900'),
        },
      );
    const propia = await http
      .get('/inventario')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(propia.body.datos).toHaveLength(2);
    expect(
      propia.body.datos.find((row: Row) => row.id === articulo.id)
        .stockDisponible,
    ).toBe('10');
    expect(
      propia.body.datos.find((row: Row) => row.id === sinMovimientos.body.id)
        .stockDisponible,
    ).toBe('0');
    const ajena = await http
      .get('/inventario')
      .set('x-usuario-prueba', 'usuario-2')
      .expect(200);
    expect(ajena.body.datos).toHaveLength(1);
    expect(ajena.body.datos[0].stockDisponible).toBe('500');
    await http
      .get(`/inventario/${articulo.id}`)
      .set('x-usuario-prueba', 'usuario-2')
      .expect(404);
    for (const query of ['empresaId=ajena', 'pagina=0', 'limite=101']) {
      await http
        .get(`/inventario?${query}`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(400);
    }
    await http
      .get('/inventario/invalido')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(400);
    await http
      .get(`/inventario/${randomUUID()}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(404);
    fixture.db.movimientoAlmacen.groupBy.mockClear();
    const pagina = await http
      .get('/inventario?pagina=2&limite=1')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(pagina.body.datos).toHaveLength(1);
    expect(pagina.body).toMatchObject({ pagina: 2, limite: 1 });
    expect(fixture.db.movimientoAlmacen.groupBy).toHaveBeenCalledTimes(1);
    expect(fixture.db.movimientoAlmacen.groupBy).toHaveBeenCalledWith({
      by: ['productoId'],
      where: {
        empresaId: empresa.id,
        productoId: { in: [pagina.body.datos[0].id] },
      },
      _sum: { cantidad: true },
    });
    await http
      .delete(`${ruta}/${articulo.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(204);
    await http
      .get(`/inventario/${articulo.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(404);
    const activos = await http
      .get('/inventario')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(activos.body.datos.map((row: Row) => row.id)).toEqual([
      sinMovimientos.body.id,
    ]);
  });

  it('devuelve una lista vacia de inventario sin consultar movimientos si no hay productos', async () => {
    await crearEmpresa();
    const resultado = await request(app.getHttpServer())
      .get('/inventario')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(resultado.body).toEqual({ datos: [], pagina: 1, limite: 20 });
    expect(fixture.db.movimientoAlmacen.groupBy).not.toHaveBeenCalled();
  });

  it.each(['ADMIN', 'BODEGUERO', 'CAJERO'])(
    'controla acceso al inventario y mantiene la consulta de productos para %s',
    async (nombre) => {
      const { articulo, empresa } = await prepararCompra();
      fixture.estado().usuarios[0].rolId = empresa.roles.find(
        (rol: Row) => rol.nombre === nombre,
      ).id;
      const http = request(app.getHttpServer());
      for (const path of ['/inventario', `/inventario/${articulo.id}`]) {
        await http.get(path).expect(401);
        await http
          .get(path)
          .set('x-usuario-prueba', 'usuario-1')
          .expect(nombre === 'CAJERO' ? 403 : 200);
      }
      const consulta = await http
        .get(`${ruta}/${articulo.id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(200);
      expect(consulta.body.stockDisponible).toBe('0');
    },
  );

  it('recibe todos los detalles una vez, con costos decimales y el usuario receptor', async () => {
    const { dto, empresa } = await prepararCompra();
    const http = request(app.getHttpServer());
    const otroProducto = await http
      .post(ruta)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ ...producto, sku: 'SEGUNDO' })
      .expect(201);
    const creada = await http
      .post('/compras')
      .set('x-usuario-prueba', 'usuario-1')
      .send({
        ...dto,
        items: [
          ...dto.items,
          {
            productoId: otroProducto.body.id,
            cantidadSolicitada: '2.500',
            costoUnitario: '12.30',
          },
        ],
      })
      .expect(201);
    const id = creada.body.id;
    Object.assign(fixture.estado().usuarios[1], {
      empresaId: empresa.id,
      rolId: empresa.roles.find((rol: Row) => rol.nombre === 'ADMIN').id,
    });
    const recibida = await http
      .post(`/compras/${id}/recibir`)
      .set('x-usuario-prueba', 'usuario-2')
      .send({
        empresaId: 'ajena',
        usuarioId: 'falso',
        cantidad: '999',
        costoUnidad: '0',
      })
      .expect(200);
    expect(recibida.body).toMatchObject({
      estado: 'RECIBIDA',
      usuarioId: 'usuario-1',
    });
    expect(
      recibida.body.items.map((item: Row) => item.cantidadRecibida),
    ).toEqual(['1.125', '2.5']);
    expect(fixture.estado().movimientos).toHaveLength(2);
    expect(fixture.estado().movimientos[0]).toMatchObject({
      empresaId: empresa.id,
      usuarioId: 'usuario-2',
      ordenCompraId: id,
      proveedorId: dto.proveedorId,
      tipo: 'COMPRA',
      productoId: dto.items[0].productoId,
    });
    expect(
      fixture.estado().movimientos.map((row) => row.cantidad.toString()),
    ).toEqual(['1.125', '2.5']);
    expect(
      fixture.estado().movimientos.map((row) => row.costoUnidad.toString()),
    ).toEqual(['80.25', '12.3']);
    const sql = fixture.db.$executeRaw.mock.calls[0];
    expect(sql[0].join('')).toContain(
      'SET "cantidadRecibida" = "cantidadSolicitada"',
    );
    expect(sql.slice(1)).toEqual([empresa.id, id]);
    await http
      .post(`/compras/${id}/recibir`)
      .set('x-usuario-prueba', 'usuario-2')
      .expect(409);
    expect(fixture.estado().movimientos).toHaveLength(2);
    await http
      .patch(`/compras/${id}`)
      .set('x-usuario-prueba', 'usuario-2')
      .send({ nota: 'Cambio posterior' })
      .expect(409);
    await http
      .delete(`/compras/${id}`)
      .set('x-usuario-prueba', 'usuario-2')
      .expect(409);
    const detalle = await http
      .get(`/compras/${id}`)
      .set('x-usuario-prueba', 'usuario-2')
      .expect(200);
    expect(detalle.body.estado).toBe('RECIBIDA');
    expect(
      fixture
        .estado()
        .productos.every((row) => row.precioCosto.toString() === '80.25'),
    ).toBe(true);
  });

  it.each(['BODEGUERO', 'CAJERO'])(
    'prohibe recibir compras como %s aunque envie ADMIN en cabeceras',
    async (nombre) => {
      const { orden, empresa } = await crearOrdenParaRecibir();
      fixture.estado().usuarios[0].rolId = empresa.roles.find(
        (rol: Row) => rol.nombre === nombre,
      ).id;
      await request(app.getHttpServer())
        .post(`/compras/${orden.id}/recibir`)
        .set('x-usuario-prueba', 'usuario-1')
        .set('x-role', 'ADMIN')
        .expect(403);
      expect(fixture.estado().ordenes[0].estado).toBe('BORRADOR');
      expect(fixture.estado().movimientos).toEqual([]);
    },
  );

  it('exige sesion, UUID y empresa propia; rechaza proveedores y productos inactivos', async () => {
    const { orden } = await crearOrdenParaRecibir();
    const http = request(app.getHttpServer());
    await http.post(`/compras/${orden.id}/recibir`).expect(401);
    await http
      .post('/compras/invalido/recibir')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(400);
    await http
      .post(`/compras/${randomUUID()}/recibir`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(404);
    await crearEmpresa('usuario-2');
    await http
      .post(`/compras/${orden.id}/recibir`)
      .set('x-usuario-prueba', 'usuario-2')
      .expect(404);
    for (const tabla of ['proveedores', 'productos']) {
      fixture.estado()[tabla][0].activo = false;
      await http
        .post(`/compras/${orden.id}/recibir`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(400);
      fixture.estado()[tabla][0].activo = true;
    }
    expect(fixture.estado().movimientos).toEqual([]);
    expect(fixture.estado().ordenes[0].estado).toBe('BORRADOR');
  });

  it('bloquea recepciones de otros estados, ordenes sin detalles o con cantidades previas', async () => {
    const { orden } = await crearOrdenParaRecibir();
    const http = request(app.getHttpServer());
    for (const estado of [
      'CANCELADA',
      'RECIBIDA',
      'PARCIALMENTE_RECIBIDA',
      'ENVIADA',
      'CONFIRMADA',
    ]) {
      fixture.estado().ordenes[0].estado = estado;
      await http
        .post(`/compras/${orden.id}/recibir`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(409);
    }
    fixture.estado().ordenes[0].estado = 'BORRADOR';
    fixture.estado().itemsCompra[0].cantidadRecibida = new Prisma.Decimal(
      '0.125',
    );
    await http
      .post(`/compras/${orden.id}/recibir`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(409);
    fixture.estado().itemsCompra[0].cantidadRecibida = new Prisma.Decimal(0);
    fixture.estado().itemsCompra[0].cantidadSolicitada = new Prisma.Decimal(0);
    await http
      .post(`/compras/${orden.id}/recibir`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(409);
    fixture.estado().itemsCompra = [];
    await http
      .post(`/compras/${orden.id}/recibir`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(409);
    expect(fixture.estado().movimientos).toEqual([]);
  });

  it('revierte recepcion y movimientos si falla una escritura; reintenta sin duplicar entradas', async () => {
    const { orden } = await crearOrdenParaRecibir();
    const http = request(app.getHttpServer());
    fixture.db.movimientoAlmacen.createMany.mockImplementationOnce(async () => {
      fixture.estado().movimientos.push({ id: 'incompleto' });
      throw new Prisma.PrismaClientKnownRequestError('Fallo simulado', {
        code: 'P2003',
        clientVersion: '7',
      });
    });
    await http
      .post(`/compras/${orden.id}/recibir`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(400);
    expect(fixture.estado().movimientos).toEqual([]);
    expect(fixture.estado().ordenes[0].estado).toBe('BORRADOR');
    expect(fixture.estado().itemsCompra[0].cantidadRecibida.toString()).toBe(
      '0',
    );
    fixture.db.$executeRaw.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Conflicto simulado', {
        code: 'P2034',
        clientVersion: '7',
      }),
    );
    await http
      .post(`/compras/${orden.id}/recibir`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(fixture.estado().movimientos).toHaveLength(1);
    expect(fixture.estado().ordenes[0].estado).toBe('RECIBIDA');
    expect(fixture.estado().itemsCompra[0].cantidadRecibida.toString()).toBe(
      '1.125',
    );
  });

  it('no genera entradas si pierde el cambio de estado o cambian los detalles', async () => {
    const { orden } = await crearOrdenParaRecibir();
    const http = request(app.getHttpServer());
    fixture.db.ordenCompra.updateMany.mockResolvedValueOnce({ count: 0 });
    await http
      .post(`/compras/${orden.id}/recibir`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(409);
    expect(fixture.db.movimientoAlmacen.createMany).not.toHaveBeenCalled();
    fixture.db.$executeRaw.mockResolvedValueOnce(0);
    await http
      .post(`/compras/${orden.id}/recibir`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(409);
    expect(fixture.estado().movimientos).toEqual([]);
    expect(fixture.estado().ordenes[0].estado).toBe('BORRADOR');
    expect(fixture.estado().itemsCompra[0].cantidadRecibida.toString()).toBe(
      '0',
    );
  });

  it('guarda orden y detalles, edita solo borradores y cancela sin mover inventario', async () => {
    const { dto, empresa } = await prepararCompra();
    const http = request(app.getHttpServer());
    const creada = await http
      .post('/compras')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ ...dto, fechaEntregaEst: '2026-12-01', nota: 'Pedido de prueba' })
      .expect(201);
    const id = creada.body.id;
    expect(creada.body).toMatchObject({
      numeroOrden: 'OC-000001',
      empresaId: empresa.id,
      usuarioId: 'usuario-1',
      estado: 'BORRADOR',
    });
    expect(creada.body.items[0]).toMatchObject({
      empresaId: empresa.id,
      ordenCompraId: id,
      cantidadSolicitada: '1.125',
      cantidadRecibida: '0',
      costoUnitario: '80.25',
    });
    const segunda = await http
      .post('/compras')
      .set('x-usuario-prueba', 'usuario-1')
      .send(dto)
      .expect(201);
    expect(segunda.body.numeroOrden).toBe('OC-000002');
    const detalle = await http
      .get(`/compras/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(detalle.body.items).toHaveLength(1);
    const editada = await http
      .patch(`/compras/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ nota: 'Nueva nota', fechaEntregaEst: null })
      .expect(200);
    expect(editada.body.items[0].id).toBe(creada.body.items[0].id);
    expect(editada.body.fechaEntregaEst).toBeNull();
    const reemplazo = await http
      .patch(`/compras/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ items: [{ ...dto.items[0], cantidadSolicitada: '2.500' }] })
      .expect(200);
    expect(reemplazo.body.items).toHaveLength(1);
    expect(reemplazo.body.items[0].cantidadSolicitada).toBe('2.5');
    expect(fixture.estado().itemsCompra).toHaveLength(2);
    await http
      .delete(`/compras/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(204);
    const cancelada = await http
      .get(`/compras/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(cancelada.body.estado).toBe('CANCELADA');
    expect(cancelada.body.items).toHaveLength(1);
    await http
      .patch(`/compras/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ nota: 'No debe cambiar' })
      .expect(409);
    await http
      .delete(`/compras/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(409);
    const lista = await http
      .get('/compras?estado=BORRADOR&limite=1')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(lista.body.datos.map((row: Row) => row.id)).toEqual([
      segunda.body.id,
    ]);
    expect(fixture.db.movimientoAlmacen.create).not.toHaveBeenCalled();
    expect(fixture.db.movimientoAlmacen.createMany).not.toHaveBeenCalled();
    expect(fixture.estado().productos[0].precioCosto.toString()).toBe('80.25');
  });

  it('valida detalles y rechaza datos de control, referencias ajenas e inactivas', async () => {
    const { dto } = await prepararCompra();
    const otra = await prepararCompra('usuario-2');
    const http = request(app.getHttpServer());
    const item = dto.items[0];
    for (const body of [
      {},
      { ...dto, items: [] },
      { ...dto, items: null },
      { ...dto, items: [null] },
      { ...dto, items: [item, item] },
      { ...dto, items: Array(101).fill(item) },
      { ...dto, proveedorId: null },
      { ...dto, proveedorId: otra.dto.proveedorId },
      { ...dto, fechaEntregaEst: '2026-02-30' },
      { ...dto, estado: 'RECIBIDA' },
      { ...dto, empresaId: otra.empresa.id },
      { ...dto, usuarioId: 'usuario-2' },
      { ...dto, numeroOrden: 'ELEGIDA' },
      { ...dto, aprobadoPorId: 'usuario-1' },
      ...['0', '-1', '0.000', '1.0001', '100000000000', 1].map(
        (cantidadSolicitada) => ({
          ...dto,
          items: [{ ...item, cantidadSolicitada }],
        }),
      ),
      ...['-1', '1.001', '10000000000', 1].map((costoUnitario) => ({
        ...dto,
        items: [{ ...item, costoUnitario }],
      })),
      { ...dto, items: [{ ...item, cantidadRecibida: '1' }] },
      { ...dto, items: [{ ...item, productoId: otra.articulo.id }] },
    ]) {
      await http
        .post('/compras')
        .set('x-usuario-prueba', 'usuario-1')
        .send(body)
        .expect(400);
    }
    fixture.estado().proveedores[0].activo = false;
    await http
      .post('/compras')
      .set('x-usuario-prueba', 'usuario-1')
      .send(dto)
      .expect(400);
    fixture.estado().proveedores[0].activo = true;
    fixture.estado().productos[0].activo = false;
    await http
      .post('/compras')
      .set('x-usuario-prueba', 'usuario-1')
      .send(dto)
      .expect(400);
    expect(fixture.estado().ordenes).toEqual([]);
    expect(fixture.estado().itemsCompra).toEqual([]);
    expect(fixture.estado().secuencias).toEqual([]);
    await http
      .get('/compras?estado=INVALIDO')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(400);
    await http
      .get('/compras?limite=101')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(400);
    await http
      .get('/compras/invalido')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(400);
  });

  it('revierte cabecera, detalles y secuencia si falla la escritura y reintenta conflictos de transaccion', async () => {
    const { dto } = await prepararCompra();
    fixture.db.ordenCompra.create.mockImplementationOnce(async () => {
      fixture.estado().ordenes.push({ id: 'incompleta' });
      fixture.estado().itemsCompra.push({ id: 'incompleto' });
      throw new Prisma.PrismaClientKnownRequestError('Referencia simulada', {
        code: 'P2003',
        clientVersion: '7',
      });
    });
    const http = request(app.getHttpServer());
    await http
      .post('/compras')
      .set('x-usuario-prueba', 'usuario-1')
      .send(dto)
      .expect(400);
    expect(fixture.estado().ordenes).toEqual([]);
    expect(fixture.estado().itemsCompra).toEqual([]);
    expect(fixture.estado().secuencias).toEqual([]);
    const transaccion = vi
      .spyOn(fixture.db, '$transaction')
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Conflicto simulado', {
          code: 'P2034',
          clientVersion: '7',
        }),
      );
    const creada = await http
      .post('/compras')
      .set('x-usuario-prueba', 'usuario-1')
      .send(dto)
      .expect(201);
    expect(creada.body.numeroOrden).toBe('OC-000001');
    expect(transaccion).toHaveBeenCalledTimes(2);
    expect(transaccion).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    transaccion.mockRestore();
  });

  it('separa ordenes y numeracion por empresa y bloquea cambios fuera de BORRADOR', async () => {
    const primera = await prepararCompra();
    const segunda = await prepararCompra('usuario-2');
    const http = request(app.getHttpServer());
    const creada = await http
      .post('/compras')
      .set('x-usuario-prueba', 'usuario-1')
      .send(primera.dto)
      .expect(201);
    const id = creada.body.id;
    const ajena = await http
      .post('/compras')
      .set('x-usuario-prueba', 'usuario-2')
      .send(segunda.dto)
      .expect(201);
    expect(ajena.body.numeroOrden).toBe(creada.body.numeroOrden);
    for (const method of ['get', 'patch', 'delete'] as const) {
      const req = http[method](`/compras/${id}`).set(
        'x-usuario-prueba',
        'usuario-2',
      );
      if (method === 'patch') req.send({ nota: 'Ajena' });
      await req.expect(404);
    }
    const lista = await http
      .get('/compras')
      .set('x-usuario-prueba', 'usuario-2')
      .expect(200);
    expect(lista.body.datos.map((row: Row) => row.id)).toEqual([ajena.body.id]);
    await http
      .patch(`/compras/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({
        items: [{ ...primera.dto.items[0], productoId: segunda.articulo.id }],
      })
      .expect(400);
    expect(
      fixture.estado().itemsCompra.find((row) => row.ordenCompraId === id)
        ?.productoId,
    ).toBe(primera.articulo.id);
    for (const estado of [
      'ENVIADA',
      'CONFIRMADA',
      'PARCIALMENTE_RECIBIDA',
      'RECIBIDA',
    ]) {
      fixture.estado().ordenes[0].estado = estado;
      await http
        .patch(`/compras/${id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ nota: 'No permitido' })
        .expect(409);
      await http
        .delete(`/compras/${id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(409);
    }
  });

  it.each(['ADMIN', 'BODEGUERO', 'CAJERO'])(
    'aplica permisos de ordenes de compra para %s',
    async (nombre) => {
      const { dto, empresa } = await prepararCompra();
      const http = request(app.getHttpServer());
      const creada = await http
        .post('/compras')
        .set('x-usuario-prueba', 'usuario-1')
        .send(dto)
        .expect(201);
      const id = creada.body.id;
      fixture.estado().usuarios[0].rolId = empresa.roles.find(
        (rol: Row) => rol.nombre === nombre,
      ).id;
      const permitido = nombre !== 'CAJERO';
      await http
        .get('/compras')
        .set('x-usuario-prueba', 'usuario-1')
        .expect(permitido ? 200 : 403);
      await http
        .get(`/compras/${id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(permitido ? 200 : 403);
      await http
        .post('/compras')
        .set('x-usuario-prueba', 'usuario-1')
        .send(dto)
        .expect(permitido ? 201 : 403);
      await http
        .patch(`/compras/${id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ nota: 'Actualizada' })
        .expect(nombre === 'ADMIN' ? 200 : 403);
      await http
        .delete(`/compras/${id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(nombre === 'ADMIN' ? 204 : 403);
      await http.get('/compras').expect(401);
      await http.post('/compras').send(dto).expect(401);
      await http.patch(`/compras/${id}`).send({ nota: 'Anonima' }).expect(401);
      await http.delete(`/compras/${id}`).expect(401);
    },
  );

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

  it('valida proveedores y permite crear, consultar, editar y dar de baja como ADMIN', async () => {
    const base = '/compras/proveedores';
    const http = request(app.getHttpServer());
    await http.get(base).expect(401);
    const empresa = await crearEmpresa();
    for (const body of [
      {},
      { nombre: ' ' },
      { nombre: null },
      { nombre: 'x'.repeat(151) },
      { nombre: 'Proveedor', email: 'invalido' },
      { nombre: 'Proveedor', telefono: 123 },
      { nombre: 'Proveedor', direccion: {} },
      { nombre: 'Proveedor', identificacionFiscal: 123 },
      { nombre: 'Proveedor', notas: [] },
      { nombre: 'Proveedor', empresaId: empresa.id },
      { nombre: 'Proveedor', activo: false },
    ]) {
      await http
        .post(base)
        .set('x-usuario-prueba', 'usuario-1')
        .send(body)
        .expect(400);
    }
    const creado = await http
      .post(base)
      .set('x-usuario-prueba', 'usuario-1')
      .send({
        nombre: ' Distribuidora de prueba ',
        telefono: '2222-3333',
        email: ' ventas@example.com ',
        direccion: 'Managua',
        identificacionFiscal: 'PRUEBA-001',
        notas: 'Contacto de ventas',
      })
      .expect(201);
    const id = creado.body.id;
    expect(creado.body).toMatchObject({
      nombre: 'Distribuidora de prueba',
      empresaId: empresa.id,
      email: 'ventas@example.com',
      activo: true,
      telefono: '2222-3333',
      direccion: 'Managua',
      identificacionFiscal: 'PRUEBA-001',
      notas: 'Contacto de ventas',
    });
    const listado = await http
      .get(`${base}?pagina=1&limite=1`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(listado.body.datos.map((row: Row) => row.id)).toEqual([id]);
    expect(listado.body).toMatchObject({ pagina: 1, limite: 1 });
    await http
      .get(`${base}?pagina=0`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(400);
    await http
      .get(`${base}?limite=101`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(400);
    await http
      .get(`${base}/invalido`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(400);
    await http
      .get(`${base}/${randomUUID()}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(404);
    await http
      .get(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    for (const body of [
      { nombre: null },
      { email: 'invalido' },
      { empresaId: 'ajena' },
      { activo: true },
    ]) {
      await http
        .patch(`${base}/${id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .send(body)
        .expect(400);
    }
    const editado = await http
      .patch(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ nombre: 'Distribuidora actualizada', email: null })
      .expect(200);
    expect(editado.body).toMatchObject({
      nombre: 'Distribuidora actualizada',
      email: null,
      telefono: '2222-3333',
    });
    await http
      .delete(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(204);
    expect(fixture.estado().proveedores[0].activo).toBe(false);
    await http
      .get(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(404);
    await http
      .patch(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ nombre: 'Inactivo' })
      .expect(404);
    await http
      .delete(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(404);
    const activas = await http
      .get(base)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(activas.body.datos).toEqual([]);
  });

  it('impide consultar y modificar proveedores de otra empresa', async () => {
    await crearEmpresa();
    await crearEmpresa('usuario-2');
    const http = request(app.getHttpServer());
    const base = '/compras/proveedores';
    const creado = await http
      .post(base)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ nombre: 'Proveedor propio' })
      .expect(201);
    const id = creado.body.id;
    const listado = await http
      .get(base)
      .set('x-usuario-prueba', 'usuario-2')
      .expect(200);
    expect(listado.body.datos).toEqual([]);
    await http
      .get(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-2')
      .expect(404);
    await http
      .patch(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-2')
      .send({ nombre: 'Cambio ajeno' })
      .expect(404);
    await http
      .delete(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-2')
      .expect(404);
    expect(fixture.estado().proveedores[0]).toMatchObject({
      nombre: 'Proveedor propio',
      activo: true,
    });
  });

  it.each(['CAJERO', 'BODEGUERO'])(
    'aplica permisos de proveedores para %s',
    async (nombre) => {
      const empresa = await crearEmpresa();
      const base = '/compras/proveedores';
      const http = request(app.getHttpServer());
      const creado = await http
        .post(base)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ nombre: 'Proveedor de prueba' })
        .expect(201);
      fixture.estado().usuarios[0].rolId = empresa.roles.find(
        (rol: Row) => rol.nombre === nombre,
      ).id;
      const esperado = nombre === 'BODEGUERO' ? 200 : 403;
      await http
        .get(base)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(esperado);
      await http
        .get(`${base}/${creado.body.id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(esperado);
      await http
        .post(base)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ nombre: 'Otro proveedor' })
        .expect(403);
      expect(fixture.estado().proveedores).toHaveLength(1);
      await http
        .patch(`${base}/${creado.body.id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ nombre: 'Cambio' })
        .expect(403);
      await http
        .delete(`${base}/${creado.body.id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(403);
      expect(fixture.estado().proveedores[0]).toMatchObject({
        nombre: 'Proveedor de prueba',
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
