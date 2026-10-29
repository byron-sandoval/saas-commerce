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
    clientes: [],
    ordenes: [],
    itemsCompra: [],
    secuencias: [],
    movimientos: [],
    cajas: [],
    ventas: [],
    detallesVenta: [],
    creditos: [],
    abonos: [],
    devoluciones: [],
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
    const filtro = {
      ...where,
      ...where.empresaId_id,
    };
    delete filtro.empresaId_id;
    return (
      state[tabla].find((row) =>
        Object.entries(limpiar(filtro)).every(
          ([key, value]) => row[key] === value,
        ),
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
  const datosVenta = (row: Row, include: Row = {}) => ({
    ...row,
    ...(include.detalles
      ? {
          detalles: state.detallesVenta.filter(
            (detalle) => detalle.ventaId === row.id,
          ),
        }
      : {}),
    ...(include.credito
      ? {
          credito:
            state.creditos.find((credito) => credito.ventaId === row.id) ??
            null,
        }
      : {}),
    ...(include.devoluciones
      ? {
          devoluciones: state.devoluciones.filter(
            (devolucion) => devolucion.ventaId === row.id,
          ),
        }
      : {}),
    ...(include.movimientos
      ? {
          movimientos: state.movimientos.filter(
            (movimiento) =>
              movimiento.ventaId === row.id &&
              (!include.movimientos.where?.tipo ||
                movimiento.tipo === include.movimientos.where.tipo),
          ),
        }
      : {}),
  });
  const db = {
    abono: {
      create: vi.fn(async ({ data }: Row) => {
        if (
          !buscar('creditos', {
            empresaId: data.empresaId,
            id: data.creditoId,
          }) ||
          !buscar('usuarios', { empresaId: data.empresaId, id: data.usuarioId })
        )
          throw error('P2003');
        const row = {
          id: randomUUID(),
          fecha: new Date(),
          referenciaPago: null,
          descripcion: null,
          ...limpiar(data),
        };
        state.abonos.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where, skip, take }: Row) =>
        state.abonos
          .filter((row) =>
            Object.entries(limpiar(where)).every(
              ([key, value]) => row[key] === value,
            ),
          )
          .sort(
            (a, b) =>
              b.fecha.getTime() - a.fecha.getTime() || a.id.localeCompare(b.id),
          )
          .slice(skip, skip + take),
      ),
    },
    credito: {
      updateMany: vi.fn(async ({ where, data }: Row) => {
        const row = buscar('creditos', where);
        if (!row) return { count: 0 };
        Object.assign(row, limpiar(data));
        return { count: 1 };
      }),
      create: vi.fn(async ({ data }: Row) => {
        if (state.creditos.some((row) => row.ventaId === data.ventaId))
          throw error('P2002');
        const venta = buscar('ventas', {
          id: data.ventaId,
          empresaId: data.empresaId,
          clienteId: data.clienteId,
        });
        if (!venta) throw error('P2003');
        const row = {
          id: randomUUID(),
          fechaCredito: new Date(),
          ...limpiar(data),
        };
        state.creditos.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where, include }: Row) => {
        const row = buscar('creditos', where);
        return row
          ? {
              ...row,
              ...(include?.cliente
                ? {
                    cliente: buscar('clientes', {
                      empresaId: row.empresaId,
                      id: row.clienteId,
                    }),
                  }
                : {}),
              ...(include?.venta
                ? {
                    venta: buscar('ventas', {
                      empresaId: row.empresaId,
                      id: row.ventaId,
                    }),
                  }
                : {}),
            }
          : null;
      }),
      findMany: vi.fn(async ({ where, skip, take }: Row) =>
        state.creditos
          .filter((row) =>
            Object.entries(limpiar(where)).every(
              ([key, value]) => row[key] === value,
            ),
          )
          .slice(skip, skip + take),
      ),
    },
    venta: {
      updateMany: vi.fn(async ({ where, data }: Row) => {
        const row = buscar('ventas', where);
        if (!row) return { count: 0 };
        Object.assign(row, limpiar(data));
        return { count: 1 };
      }),
      findUniqueOrThrow: vi.fn(async ({ where, include }: Row) => {
        const row = buscar('ventas', where);
        if (!row) throw error('P2025');
        return datosVenta(row, include);
      }),
      create: vi.fn(async ({ data }: Row) => {
        if (
          state.ventas.some(
            (row) =>
              row.empresaId === data.empresaId &&
              row.numeroFactura === data.numeroFactura,
          )
        )
          throw error('P2002');
        const { detalles, ...cabecera } = data;
        const row: Row = {
          id: randomUUID(),
          anuladaEn: null,
          anuladaPorId: null,
          motivoAnulacion: null,
          ...limpiar(cabecera),
        };
        state.ventas.push(row);
        const items = detalles.create.map((detalle: Row) => ({
          id: randomUUID(),
          empresaId: row.empresaId,
          ventaId: row.id,
          ...detalle,
        }));
        state.detallesVenta.push(...items);
        return { ...row, detalles: items };
      }),
      findUnique: vi.fn(async ({ where, include }: Row) => {
        const row = buscar('ventas', where);
        return row ? datosVenta(row, include) : null;
      }),
      findMany: vi.fn(async ({ where, skip, take }: Row) =>
        state.ventas
          .filter((row) =>
            Object.entries(limpiar(where)).every(
              ([key, value]) => row[key] === value,
            ),
          )
          .slice(skip, skip + take),
      ),
    },
    sesionCaja: {
      findUniqueOrThrow: vi.fn(async ({ where }: Row) => {
        const row = buscar('cajas', where);
        if (!row) throw error('P2025');
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: Row) => {
        const row = buscar('cajas', where);
        if (!row) return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === 'object' && 'increment' in value) {
            row[key] =
              typeof row[key] === 'number'
                ? row[key] + (value as Row).increment
                : row[key].plus((value as Row).increment);
          } else row[key] = value;
        }
        return { count: 1 };
      }),
      create: vi.fn(async ({ data }: Row) => {
        const row = {
          id: randomUUID(),
          abiertoEn: new Date(),
          estado: 'ABIERTA',
          cerradoPorId: null,
          cerradoEn: null,
          efectivoCierre: null,
          efectivoEsperado: null,
          diferencia: null,
          totalVentas: new Prisma.Decimal(0),
          totalEfectivo: new Prisma.Decimal(0),
          totalTarjeta: new Prisma.Decimal(0),
          totalTransfer: new Prisma.Decimal(0),
          totalCredito: new Prisma.Decimal(0),
          cantidadVentas: 0,
          ...limpiar(data),
        };
        state.cajas.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where }: Row) => buscar('cajas', where)),
      findUnique: vi.fn(async ({ where }: Row) => buscar('cajas', where)),
      findMany: vi.fn(async ({ where, skip, take }: Row) =>
        state.cajas
          .filter((row) =>
            Object.entries(limpiar(where)).every(
              ([key, value]) => row[key] === value,
            ),
          )
          .slice(skip, skip + take),
      ),
    },
    cliente: {
      create: vi.fn(async ({ data }: Row) => {
        if (
          data.tipoDocumento != null &&
          data.numeroDocumento != null &&
          state.clientes.some(
            (row) =>
              row.empresaId === data.empresaId &&
              row.tipoDocumento === data.tipoDocumento &&
              row.numeroDocumento === data.numeroDocumento,
          )
        )
          throw error('P2002');
        const row = {
          id: randomUUID(),
          activo: true,
          esGenerico: false,
          tipoDocumento: null,
          numeroDocumento: null,
          ...limpiar(data),
        };
        state.clientes.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: Row) => buscar('clientes', where)),
      findMany: vi.fn(async ({ where, skip, take }: Row) =>
        state.clientes
          .filter((row) =>
            Object.entries(where).every(([key, value]) => row[key] === value),
          )
          .slice(skip, skip + take),
      ),
      update: vi.fn(async ({ where, data }: Row) => {
        const row = buscar('clientes', where);
        if (!row) throw error('P2025');
        const nuevo = { ...row, ...limpiar(data) };
        if (
          nuevo.tipoDocumento != null &&
          nuevo.numeroDocumento != null &&
          state.clientes.some(
            (otro) =>
              otro.id !== row.id &&
              otro.empresaId === row.empresaId &&
              otro.tipoDocumento === nuevo.tipoDocumento &&
              otro.numeroDocumento === nuevo.numeroDocumento,
          )
        )
          throw error('P2002');
        Object.assign(row, limpiar(data));
        return row;
      }),
    },
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
        const row = {
          id: randomUUID(),
          estado: 'ACTIVA',
          porcentajeIva: new Prisma.Decimal(15),
          ...limpiar(data),
        };
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

  it('crea, pagina, consulta, edita y da de baja clientes sin eliminarlos', async () => {
    const empresa = await crearEmpresa();
    const base = '/ventas/clientes';
    const http = request(app.getHttpServer());
    await http.get(base).expect(401);
    const creado = await http
      .post(base)
      .set('x-usuario-prueba', 'usuario-1')
      .send({
        nombre: ' Ana Lopez ',
        tipoDocumento: 'CEDULA',
        numeroDocumento: ' PRUEBA-001 ',
        telefono: ' 8888-1234 ',
        direccion: ' Managua ',
      })
      .expect(201);
    const id = creado.body.id;
    expect(creado.body).toMatchObject({
      empresaId: empresa.id,
      nombre: 'Ana Lopez',
      numeroDocumento: 'PRUEBA-001',
      tipoDocumento: 'CEDULA',
      telefono: '8888-1234',
      direccion: 'Managua',
      activo: true,
      esGenerico: false,
    });
    const listado = await http
      .get(`${base}?pagina=1&limite=1`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(listado.body).toMatchObject({ pagina: 1, limite: 1 });
    expect(listado.body.datos.map((row: Row) => row.id)).toEqual([id]);
    const consultado = await http
      .get(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(consultado.body.nombre).toBe('Ana Lopez');
    const editado = await http
      .patch(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ nombre: 'Ana Perez', telefono: null })
      .expect(200);
    expect(editado.body).toMatchObject({
      nombre: 'Ana Perez',
      telefono: null,
      numeroDocumento: 'PRUEBA-001',
      tipoDocumento: 'CEDULA',
    });
    const sinDocumento = await http
      .patch(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ tipoDocumento: null, numeroDocumento: null })
      .expect(200);
    expect(sinDocumento.body).toMatchObject({
      tipoDocumento: null,
      numeroDocumento: null,
    });
    await http
      .delete(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(204);
    expect(fixture.estado().clientes).toHaveLength(1);
    expect(fixture.estado().clientes[0].activo).toBe(false);
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
    const activos = await http
      .get(base)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(activos.body.datos).toEqual([]);
  });

  it('valida clientes y exige tipo y numero de documento coherentes tambien al editar', async () => {
    await crearEmpresa();
    const base = '/ventas/clientes';
    const http = request(app.getHttpServer());
    for (const body of [
      {},
      { nombre: null },
      { nombre: '   ' },
      { nombre: 'x'.repeat(51) },
      { nombre: 'Ana', telefono: 123 },
      { nombre: 'Ana', telefono: 'x'.repeat(16) },
      { nombre: 'Ana', direccion: 'x'.repeat(151) },
      { nombre: 'Ana', tipoDocumento: 'INVALIDO', numeroDocumento: 'PRUEBA' },
      { nombre: 'Ana', tipoDocumento: 'CEDULA' },
      { nombre: 'Ana', numeroDocumento: 'PRUEBA' },
      {
        nombre: 'Ana',
        tipoDocumento: 'CEDULA',
        numeroDocumento: 'x'.repeat(21),
      },
      { nombre: 'Ana', tipoDocumento: 'CEDULA', numeroDocumento: ' ' },
      { nombre: 'Ana', empresaId: 'ajena' },
      { nombre: 'Ana', activo: false },
      { nombre: 'Ana', esGenerico: true },
      { nombre: 'Ana', rolId: 'ADMIN' },
    ])
      await http
        .post(base)
        .set('x-usuario-prueba', 'usuario-1')
        .send(body)
        .expect(400);
    expect(fixture.estado().clientes).toEqual([]);
    const creado = await http
      .post(base)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ nombre: 'Ana' })
      .expect(201);
    const id = creado.body.id;
    for (const body of [
      { nombre: null },
      { activo: true },
      { empresaId: 'ajena' },
      { tipoDocumento: 'CEDULA' },
      { numeroDocumento: 'PRUEBA' },
    ]) {
      await http
        .patch(`${base}/${id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .send(body)
        .expect(400);
    }
    await http
      .patch(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ tipoDocumento: 'PASAPORTE', numeroDocumento: 'PAS-001' })
      .expect(200);
    await http
      .patch(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ tipoDocumento: null })
      .expect(400);
    await http
      .patch(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ numeroDocumento: null })
      .expect(400);
    const numeroEditado = await http
      .patch(`${base}/${id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ numeroDocumento: 'PAS-002' })
      .expect(200);
    expect(numeroEditado.body).toMatchObject({
      tipoDocumento: 'PASAPORTE',
      numeroDocumento: 'PAS-002',
    });
    for (const query of ['pagina=0', 'limite=101', 'empresaId=ajena']) {
      await http
        .get(`${base}?${query}`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(400);
    }
    await http
      .get(`${base}/invalido`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(400);
    await http
      .get(`${base}/${randomUUID()}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(404);
  });

  it('aisla clientes entre empresas y evita documentos duplicados incluso al editar', async () => {
    await crearEmpresa();
    await crearEmpresa('usuario-2');
    const http = request(app.getHttpServer());
    const base = '/ventas/clientes';
    const cliente = {
      nombre: 'Ana',
      tipoDocumento: 'CEDULA',
      numeroDocumento: 'PRUEBA-001',
    };
    const creado = await http
      .post(base)
      .set('x-usuario-prueba', 'usuario-1')
      .send(cliente)
      .expect(201);
    await http
      .post(base)
      .set('x-usuario-prueba', 'usuario-1')
      .send(cliente)
      .expect(409);
    await http
      .post(base)
      .set('x-usuario-prueba', 'usuario-2')
      .send(cliente)
      .expect(201);
    const otro = await http
      .post(base)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ nombre: 'Luis' })
      .expect(201);
    await http
      .patch(`${base}/${otro.body.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ tipoDocumento: 'CEDULA', numeroDocumento: 'PRUEBA-001' })
      .expect(409);
    expect(
      fixture.estado().clientes.find((row) => row.id === otro.body.id)
        ?.tipoDocumento,
    ).toBeNull();
    for (const method of ['get', 'patch', 'delete'] as const) {
      const req = http[method](`${base}/${creado.body.id}`).set(
        'x-usuario-prueba',
        'usuario-2',
      );
      if (method === 'patch') req.send({ nombre: 'Ajeno' });
      await req.expect(404);
    }
    const lista = await http
      .get(base)
      .set('x-usuario-prueba', 'usuario-2')
      .expect(200);
    expect(lista.body.datos).toHaveLength(1);
    expect(lista.body.datos[0].id).not.toBe(creado.body.id);
  });

  it.each(['CAJERO', 'BODEGUERO'])(
    'aplica permisos de clientes para %s',
    async (nombre) => {
      const empresa = await crearEmpresa();
      const base = '/ventas/clientes';
      const http = request(app.getHttpServer());
      const creado = await http
        .post(base)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ nombre: 'Ana' })
        .expect(201);
      fixture.estado().usuarios[0].rolId = empresa.roles.find(
        (rol: Row) => rol.nombre === nombre,
      ).id;
      for (const path of [base, `${base}/${creado.body.id}`]) {
        await http.get(path).expect(401);
        await http
          .get(path)
          .set('x-usuario-prueba', 'usuario-1')
          .expect(nombre === 'CAJERO' ? 200 : 403);
      }
      await http
        .post(base)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ nombre: 'Luis' })
        .expect(403);
      await http
        .patch(`${base}/${creado.body.id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ nombre: 'Otro' })
        .expect(403);
      await http
        .delete(`${base}/${creado.body.id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(403);
      expect(fixture.estado().clientes).toHaveLength(1);
      expect(fixture.estado().clientes[0]).toMatchObject({
        nombre: 'Ana',
        activo: true,
      });
    },
  );

  it('abre una caja con decimales, permite consultarla y bloquea otra apertura del mismo usuario', async () => {
    const empresa = await crearEmpresa();
    const http = request(app.getHttpServer());
    await http
      .get('/caja/actual')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(404);
    const abierta = await http
      .post('/caja')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoInicial: '500.10', notas: 'Fondo inicial de prueba' })
      .expect(201);
    expect(abierta.body).toMatchObject({
      empresaId: empresa.id,
      abiertoPorId: 'usuario-1',
      estado: 'ABIERTA',
      efectivoInicial: '500.1',
      totalVentas: '0',
      totalEfectivo: '0',
      totalTarjeta: '0',
      totalTransfer: '0',
      cantidadVentas: 0,
      cerradoEn: null,
      cerradoPorId: null,
      notas: 'Fondo inicial de prueba',
    });
    const actual = await http
      .get('/caja/actual')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(actual.body.id).toBe(abierta.body.id);
    await http
      .get(`/caja/${abierta.body.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    await http
      .post('/caja')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoInicial: '0' })
      .expect(409);
    expect(fixture.estado().cajas).toHaveLength(1);
    // Simula una caja historica cerrada; el cierre HTTP se implementara despues.
    fixture.estado().cajas[0].estado = 'CERRADA';
    await http
      .get('/caja/actual')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(404);
    await http
      .post('/caja')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoInicial: '0' })
      .expect(201);
    const lista = await http
      .get('/caja?estado=CERRADA&pagina=1&limite=1')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(lista.body.datos.map((row: Row) => row.id)).toEqual([
      abierta.body.id,
    ]);
    expect(lista.body).toMatchObject({ pagina: 1, limite: 1 });
  });

  it('valida el fondo inicial y rechaza campos de control en la apertura de caja', async () => {
    await crearEmpresa();
    const http = request(app.getHttpServer());
    for (const efectivoInicial of [
      undefined,
      null,
      500,
      '-1',
      '1.001',
      '1000000000000',
      '1e2',
      '',
      'NaN',
      '1\n',
    ]) {
      await http
        .post('/caja')
        .set('x-usuario-prueba', 'usuario-1')
        .send({ efectivoInicial })
        .expect(400);
    }
    for (const campo of [
      'empresaId',
      'abiertoPorId',
      'cerradoPorId',
      'estado',
      'abiertoEn',
      'cerradoEn',
      'totalVentas',
      'efectivoCierre',
      'efectivoEsperado',
      'diferencia',
      'cantidadVentas',
    ]) {
      await http
        .post('/caja')
        .set('x-usuario-prueba', 'usuario-1')
        .send({ efectivoInicial: '100', [campo]: 'valor-no-permitido' })
        .expect(400);
    }
    await http
      .post('/caja')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoInicial: '100', notas: 123 })
      .expect(400);
    expect(fixture.estado().cajas).toEqual([]);
    for (const query of [
      'pagina=0',
      'limite=101',
      'estado=INVALIDO',
      'empresaId=ajena',
      'esAdmin=true',
    ]) {
      await http
        .get(`/caja?${query}`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(400);
    }
    await http
      .get('/caja/invalido')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(400);
    await http
      .get(`/caja/${randomUUID()}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(404);
    const maxima = await http
      .post('/caja')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoInicial: '999999999999.99' })
      .expect(201);
    expect(maxima.body.efectivoInicial).toBe('999999999999.99');
  });

  it('limita cajeros a sus propias cajas y permite a ADMIN consultar solo las de su empresa', async () => {
    const empresa = await crearEmpresa();
    fixture
      .estado()
      .usuarios.push({ ...fixture.estado().usuarios[1], id: 'usuario-3' });
    await crearEmpresa('usuario-3');
    Object.assign(fixture.estado().usuarios[1], {
      empresaId: empresa.id,
      rolId: empresa.roles.find((rol: Row) => rol.nombre === 'CAJERO').id,
    });
    const http = request(app.getHttpServer());
    const cajas: Record<string, Row> = {};
    for (const usuario of ['usuario-1', 'usuario-2', 'usuario-3']) {
      const response = await http
        .post('/caja')
        .set('x-usuario-prueba', usuario)
        .send({ efectivoInicial: '100' })
        .expect(201);
      cajas[usuario] = response.body;
    }
    const admin = await http
      .get('/caja')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(admin.body.datos.map((row: Row) => row.id).sort()).toEqual(
      [cajas['usuario-1'].id, cajas['usuario-2'].id].sort(),
    );
    const cajero = await http
      .get('/caja')
      .set('x-usuario-prueba', 'usuario-2')
      .set('x-role', 'ADMIN')
      .expect(200);
    expect(cajero.body.datos.map((row: Row) => row.id)).toEqual([
      cajas['usuario-2'].id,
    ]);
    await http
      .get(`/caja/${cajas['usuario-1'].id}`)
      .set('x-usuario-prueba', 'usuario-2')
      .set('x-role', 'ADMIN')
      .expect(404);
    await http
      .get(`/caja/${cajas['usuario-2'].id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    await http
      .get(`/caja/${cajas['usuario-3'].id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(404);
    await http
      .get(`/caja/${cajas['usuario-1'].id}`)
      .set('x-usuario-prueba', 'usuario-3')
      .expect(404);
    const actual = await http
      .get('/caja/actual')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(actual.body.id).toBe(cajas['usuario-1'].id);
    const pagina = await http
      .get('/caja?pagina=2&limite=1')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(pagina.body.datos).toHaveLength(1);
  });

  it.each(['ADMIN', 'CAJERO', 'BODEGUERO'])(
    'aplica permisos y exige sesion en apertura y consultas de caja para %s',
    async (nombre) => {
      const empresa = await crearEmpresa();
      fixture.estado().usuarios[0].rolId = empresa.roles.find(
        (rol: Row) => rol.nombre === nombre,
      ).id;
      const http = request(app.getHttpServer());
      await http.post('/caja').send({ efectivoInicial: '0' }).expect(401);
      const creada = await http
        .post('/caja')
        .set('x-usuario-prueba', 'usuario-1')
        .send({ efectivoInicial: '0' })
        .expect(nombre === 'BODEGUERO' ? 403 : 201);
      const id = nombre === 'BODEGUERO' ? randomUUID() : creada.body.id;
      for (const path of ['/caja', '/caja/actual', `/caja/${id}`]) {
        await http.get(path).expect(401);
        await http
          .get(path)
          .set('x-usuario-prueba', 'usuario-1')
          .expect(nombre === 'BODEGUERO' ? 403 : 200);
      }
      expect(fixture.estado().cajas).toHaveLength(
        nombre === 'BODEGUERO' ? 0 : 1,
      );
    },
  );

  it('revierte aperturas fallidas y reintenta conflictos serializables sin dejar cajas duplicadas', async () => {
    await crearEmpresa();
    const http = request(app.getHttpServer());
    const fallo = (code: string) =>
      new Prisma.PrismaClientKnownRequestError('Fallo simulado', {
        code,
        clientVersion: '7',
      });
    fixture.db.sesionCaja.create.mockImplementationOnce(async () => {
      fixture.estado().cajas.push({ id: 'incompleta' });
      throw fallo('P2003');
    });
    await http
      .post('/caja')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoInicial: '20.10' })
      .expect(409);
    expect(fixture.estado().cajas).toEqual([]);
    fixture.db.sesionCaja.create.mockImplementationOnce(async () => {
      fixture.estado().cajas.push({ id: 'incompleta' });
      throw fallo('P2034');
    });
    const transaccion = vi.spyOn(fixture.db, '$transaction');
    await http
      .post('/caja')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoInicial: '20.10' })
      .expect(201);
    expect(transaccion).toHaveBeenCalledTimes(2);
    expect(transaccion).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(fixture.estado().cajas).toHaveLength(1);
    expect(fixture.estado().cajas[0].efectivoInicial.toString()).toBe('20.1');
    transaccion.mockRestore();
  });

  it('detecta una caja abierta por otra solicitud al reintentar y limita los reintentos', async () => {
    const empresa = await crearEmpresa();
    const fallo = () =>
      new Prisma.PrismaClientKnownRequestError('Conflicto simulado', {
        code: 'P2034',
        clientVersion: '7',
      });
    const transaccion = vi
      .spyOn(fixture.db, '$transaction')
      .mockImplementationOnce(async () => {
        // Representa el resultado confirmado de otra solicitud de apertura.
        fixture.estado().cajas.push({
          id: randomUUID(),
          empresaId: empresa.id,
          abiertoPorId: 'usuario-1',
          estado: 'ABIERTA',
        });
        throw fallo();
      });
    const http = request(app.getHttpServer());
    await http
      .post('/caja')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoInicial: '0' })
      .expect(409);
    expect(fixture.db.sesionCaja.create).not.toHaveBeenCalled();
    expect(fixture.estado().cajas).toHaveLength(1);
    transaccion.mockClear().mockRejectedValue(fallo());
    await http
      .post('/caja')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoInicial: '0' })
      .expect(409);
    expect(transaccion).toHaveBeenCalledTimes(3);
    transaccion.mockRestore();
  });

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

  async function prepararVenta(usuario = 'usuario-1') {
    const compra = await prepararCompra(usuario);
    const http = request(app.getHttpServer());
    const orden = await http
      .post('/compras')
      .set('x-usuario-prueba', usuario)
      .send({
        ...compra.dto,
        items: [{ ...compra.dto.items[0], cantidadSolicitada: '10.000' }],
      })
      .expect(201);
    await http
      .post(`/compras/${orden.body.id}/recibir`)
      .set('x-usuario-prueba', usuario)
      .expect(200);
    const cliente = await http
      .post('/ventas/clientes')
      .set('x-usuario-prueba', usuario)
      .send({ nombre: 'Cliente de ventas' })
      .expect(201);
    const caja = await http
      .post('/caja')
      .set('x-usuario-prueba', usuario)
      .send({ efectivoInicial: '100.00' })
      .expect(201);
    return {
      ...compra,
      cliente: cliente.body,
      caja: caja.body,
      venta: {
        clienteId: cliente.body.id,
        metodoPago: 'EFECTIVO',
        importeRecibido: '500.00',
        detalles: [{ productoId: compra.articulo.id, cantidad: '2.000' }],
      },
    };
  }

  it('registra venta, IVA, cambio, factura y salida de inventario junto con los totales de caja', async () => {
    const { venta, empresa, caja, articulo } = await prepararVenta();
    const http = request(app.getHttpServer());
    const creada = await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(venta)
      .expect(201);
    expect(creada.body).toMatchObject({
      empresaId: empresa.id,
      usuarioId: 'usuario-1',
      sesionCajaId: caja.id,
      numeroFactura: 'F-0001',
      estado: 'COMPLETADA',
      subtotal: '251',
      montoDescuento: '0',
      montoIVA: '37.65',
      total: '288.65',
      importeRecibido: '500',
      cambio: '211.35',
    });
    expect(creada.body.detalles).toHaveLength(1);
    expect(creada.body.detalles[0]).toMatchObject({
      productoId: articulo.id,
      empresaId: empresa.id,
      ventaId: creada.body.id,
      cantidad: '2',
      precioUnitario: '125.5',
      costoEnVenta: '80.25',
      subtotal: '251',
    });
    const movimientos = fixture
      .estado()
      .movimientos.filter((row) => row.tipo === 'VENTA');
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0]).toMatchObject({
      ventaId: creada.body.id,
      empresaId: empresa.id,
      usuarioId: 'usuario-1',
    });
    expect(movimientos[0].cantidad.toString()).toBe('-2');
    const cajaActual = await http
      .get('/caja/actual')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(cajaActual.body).toMatchObject({
      efectivoInicial: '100',
      totalVentas: '288.65',
      totalEfectivo: '288.65',
      totalTarjeta: '0',
      totalTransfer: '0',
      cantidadVentas: 1,
    });
    const stock = await http
      .get(`${ruta}/${articulo.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(stock.body.stockDisponible).toBe('8');
    const detalle = await http
      .get(`/ventas/${creada.body.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(detalle.body.detalles[0].id).toBe(creada.body.detalles[0].id);
    const segunda = await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ ...venta, detalles: [{ ...venta.detalles[0], cantidad: '1' }] })
      .expect(201);
    expect(segunda.body.numeroFactura).toBe('F-0002');
    const listado = await http
      .get('/ventas?estado=COMPLETADA&pagina=1&limite=1')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(listado.body.datos).toHaveLength(1);
    expect(listado.body).toMatchObject({ pagina: 1, limite: 1 });
  });

  it.each(['TARJETA', 'TRANSFERENCIA'])(
    'registra pago por %s en su acumulado de caja sin aumentar el efectivo',
    async (metodoPago) => {
      const { venta } = await prepararVenta();
      const { importeRecibido: _importe, ...sinEfectivo } = venta;
      const http = request(app.getHttpServer());
      const creada = await http
        .post('/ventas')
        .set('x-usuario-prueba', 'usuario-1')
        .send({ ...sinEfectivo, metodoPago, referenciaPago: ' REF-PRUEBA ' })
        .expect(201);
      expect(creada.body).toMatchObject({
        metodoPago,
        importeRecibido: null,
        cambio: null,
        referenciaPago: 'REF-PRUEBA',
        total: '288.65',
      });
      const caja = await http
        .get('/caja/actual')
        .set('x-usuario-prueba', 'usuario-1')
        .expect(200);
      expect(caja.body).toMatchObject({
        totalVentas: '288.65',
        totalEfectivo: '0',
        cantidadVentas: 1,
        totalTarjeta: metodoPago === 'TARJETA' ? '288.65' : '0',
        totalTransfer: metodoPago === 'TRANSFERENCIA' ? '288.65' : '0',
      });
    },
  );

  it('redondea detalles e IVA con Decimal y conserva precios historicos', async () => {
    const { venta } = await prepararVenta();
    const http = request(app.getHttpServer());
    fixture.estado().productos[0].precioBase = new Prisma.Decimal('12.35');
    const { importeRecibido: _importe, metodoPago: _metodo, ...base } = venta;
    const primera = await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send({
        ...base,
        detalles: [{ ...venta.detalles[0], cantidad: '0.125' }],
      })
      .expect(201);
    expect(primera.body).toMatchObject({
      subtotal: '1.54',
      montoIVA: '0.23',
      total: '1.77',
      importeRecibido: '1.77',
      cambio: '0',
    });
    fixture.estado().empresas[0].porcentajeIva = new Prisma.Decimal(0);
    fixture.estado().productos[0].precioBase = new Prisma.Decimal('0.10');
    const segunda = await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send({
        ...base,
        detalles: [{ ...venta.detalles[0], cantidad: '0.300' }],
      })
      .expect(201);
    expect(segunda.body).toMatchObject({
      subtotal: '0.03',
      montoIVA: '0',
      total: '0.03',
    });
    const historica = await http
      .get(`/ventas/${primera.body.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(historica.body.detalles[0].precioUnitario).toBe('12.35');
  });

  it('valida cantidades y pagos y rechaza precios, totales y datos de control del cliente', async () => {
    const { venta } = await prepararVenta();
    const http = request(app.getHttpServer());
    const item = venta.detalles[0];
    const invalidos = [
      {},
      { ...venta, detalles: [] },
      { ...venta, detalles: null },
      { ...venta, detalles: [null] },
      { ...venta, detalles: [item, item] },
      { ...venta, detalles: Array(101).fill(item) },
      { ...venta, clienteId: null },
      { ...venta, metodoPago: 'OTRO' },
      { ...venta, referenciaPago: 'X'.repeat(101) },
      ...['0', '-1', '0.000', '1.0001', '100000000000', '1\n', 1].map(
        (cantidad) => ({ ...venta, detalles: [{ ...item, cantidad }] }),
      ),
      ...[null, '-1', '1.001', '1000000000000', '1\n', 1].map(
        (importeRecibido) => ({ ...venta, importeRecibido }),
      ),
      ...['precioUnitario', 'costoEnVenta', 'subtotal', 'empresaId'].map(
        (campo) => ({ ...venta, detalles: [{ ...item, [campo]: '1' }] }),
      ),
      ...[
        'empresaId',
        'usuarioId',
        'sesionCajaId',
        'numeroFactura',
        'subtotal',
        'montoIVA',
        'total',
        'montoDescuento',
        'estado',
        'cambio',
      ].map((campo) => ({ ...venta, [campo]: 'valor-no-permitido' })),
    ];
    for (const body of invalidos)
      await http
        .post('/ventas')
        .set('x-usuario-prueba', 'usuario-1')
        .send(body)
        .expect(400);
    expect(fixture.estado().ventas).toEqual([]);
    expect(fixture.estado().detallesVenta).toEqual([]);
    expect(fixture.estado().movimientos).toHaveLength(1);
    expect(fixture.estado().cajas[0].cantidadVentas).toBe(0);
    for (const query of [
      'pagina=0',
      'limite=101',
      'estado=INVALIDO',
      'empresaId=ajena',
      'esAdmin=true',
    ]) {
      await http
        .get(`/ventas?${query}`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(400);
    }
    await http
      .get('/ventas/invalido')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(400);
    await http
      .get(`/ventas/${randomUUID()}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(404);
  });

  it('exige caja propia abierta, cliente y producto activos y un pago suficiente', async () => {
    const { venta } = await prepararVenta();
    const http = request(app.getHttpServer());
    fixture.estado().cajas[0].estado = 'CERRADA';
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(venta)
      .expect(409);
    fixture.estado().cajas[0].estado = 'ABIERTA';
    Object.assign(fixture.estado().usuarios[1], {
      empresaId: fixture.estado().usuarios[0].empresaId,
      rolId: fixture.estado().usuarios[0].rolId,
    });
    fixture.estado().cajas[0].abiertoPorId = 'usuario-2';
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(venta)
      .expect(409);
    fixture.estado().cajas[0].abiertoPorId = 'usuario-1';
    for (const tabla of ['clientes', 'productos']) {
      fixture.estado()[tabla][0].activo = false;
      await http
        .post('/ventas')
        .set('x-usuario-prueba', 'usuario-1')
        .send(venta)
        .expect(400);
      fixture.estado()[tabla][0].activo = true;
    }
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ ...venta, importeRecibido: '1' })
      .expect(400);
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ ...venta, metodoPago: 'TARJETA' })
      .expect(400);
    expect(fixture.estado().ventas).toEqual([]);
    expect(
      fixture.estado().secuencias.some((row) => row.tipo === 'FACTURA'),
    ).toBe(false);
  });

  it('evita vender mas existencias de las disponibles y no deja una venta parcial', async () => {
    const { venta, articulo } = await prepararVenta();
    const http = request(app.getHttpServer());
    const sinStock = await http
      .post(ruta)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ ...producto, sku: 'SIN-STOCK' })
      .expect(201);
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send({
        ...venta,
        detalles: [
          ...venta.detalles,
          { productoId: sinStock.body.id, cantidad: '1' },
        ],
      })
      .expect(409);
    expect(fixture.estado().ventas).toEqual([]);
    const seis = {
      ...venta,
      importeRecibido: '1000',
      detalles: [{ ...venta.detalles[0], cantidad: '6' }],
    };
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(seis)
      .expect(201);
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(seis)
      .expect(409);
    expect(fixture.estado().ventas).toHaveLength(1);
    const stock = await http
      .get(`/inventario/${articulo.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(stock.body.stockDisponible).toBe('4');
  });

  it('separa clientes, productos, facturas y ventas entre empresas', async () => {
    const propia = await prepararVenta();
    const ajena = await prepararVenta('usuario-2');
    const http = request(app.getHttpServer());
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ ...propia.venta, clienteId: ajena.cliente.id })
      .expect(400);
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send({
        ...propia.venta,
        detalles: [{ productoId: ajena.articulo.id, cantidad: '1' }],
      })
      .expect(400);
    const primera = await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(propia.venta)
      .expect(201);
    const segunda = await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-2')
      .send(ajena.venta)
      .expect(201);
    expect(primera.body.numeroFactura).toBe('F-0001');
    expect(segunda.body.numeroFactura).toBe('F-0001');
    await http
      .get(`/ventas/${primera.body.id}`)
      .set('x-usuario-prueba', 'usuario-2')
      .expect(404);
    const lista = await http
      .get('/ventas')
      .set('x-usuario-prueba', 'usuario-2')
      .expect(200);
    expect(lista.body.datos.map((row: Row) => row.id)).toEqual([
      segunda.body.id,
    ]);
  });

  it.each(['ADMIN', 'CAJERO', 'BODEGUERO'])(
    'aplica permisos de venta para %s',
    async (nombre) => {
      const { venta, empresa } = await prepararVenta();
      fixture.estado().usuarios[0].rolId = empresa.roles.find(
        (rol: Row) => rol.nombre === nombre,
      ).id;
      const http = request(app.getHttpServer());
      await http.post('/ventas').send(venta).expect(401);
      await http.get('/ventas').expect(401);
      const creada = await http
        .post('/ventas')
        .set('x-usuario-prueba', 'usuario-1')
        .send(venta)
        .expect(nombre === 'BODEGUERO' ? 403 : 201);
      await http
        .get('/ventas')
        .set('x-usuario-prueba', 'usuario-1')
        .expect(nombre === 'BODEGUERO' ? 403 : 200);
      const id = nombre === 'BODEGUERO' ? randomUUID() : creada.body.id;
      await http
        .get(`/ventas/${id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(nombre === 'BODEGUERO' ? 403 : 200);
      expect(fixture.estado().ventas).toHaveLength(
        nombre === 'BODEGUERO' ? 0 : 1,
      );
    },
  );

  it('permite a ADMIN consultar ventas de su empresa y a CAJERO solo las propias', async () => {
    const { venta, empresa } = await prepararVenta();
    const http = request(app.getHttpServer());
    const admin = await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(venta)
      .expect(201);
    const rolCajero = empresa.roles.find(
      (rol: Row) => rol.nombre === 'CAJERO',
    ).id;
    Object.assign(fixture.estado().usuarios[1], {
      empresaId: empresa.id,
      rolId: rolCajero,
    });
    await http
      .post('/caja')
      .set('x-usuario-prueba', 'usuario-2')
      .send({ efectivoInicial: '0' })
      .expect(201);
    const cajero = await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-2')
      .send(venta)
      .expect(201);
    await http
      .get(`/ventas/${admin.body.id}`)
      .set('x-usuario-prueba', 'usuario-2')
      .set('x-role', 'ADMIN')
      .expect(404);
    const propias = await http
      .get('/ventas')
      .set('x-usuario-prueba', 'usuario-2')
      .expect(200);
    expect(propias.body.datos.map((row: Row) => row.id)).toEqual([
      cajero.body.id,
    ]);
    await http
      .get(`/ventas/${cajero.body.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    const todas = await http
      .get('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(todas.body.datos).toHaveLength(2);
  });

  it('revierte venta, detalles, secuencia, inventario y caja si falla una escritura', async () => {
    const { venta } = await prepararVenta();
    const http = request(app.getHttpServer());
    const fallo = (code: string) =>
      new Prisma.PrismaClientKnownRequestError('Fallo simulado', {
        code,
        clientVersion: '7',
      });
    fixture.db.movimientoAlmacen.createMany.mockImplementationOnce(async () => {
      fixture.estado().movimientos.push({ id: 'incompleto' });
      throw fallo('P2003');
    });
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(venta)
      .expect(409);
    fixture.db.sesionCaja.updateMany.mockResolvedValueOnce({ count: 0 });
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(venta)
      .expect(409);
    expect(fixture.estado().ventas).toEqual([]);
    expect(fixture.estado().detallesVenta).toEqual([]);
    expect(fixture.estado().movimientos).toHaveLength(1);
    expect(fixture.estado().cajas[0].totalVentas.toString()).toBe('0');
    expect(fixture.estado().cajas[0].cantidadVentas).toBe(0);
    expect(
      fixture.estado().secuencias.some((row) => row.tipo === 'FACTURA'),
    ).toBe(false);
    fixture.db.movimientoAlmacen.createMany.mockImplementationOnce(async () => {
      throw fallo('P2034');
    });
    const transaccion = vi.spyOn(fixture.db, '$transaction');
    const creada = await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(venta)
      .expect(201);
    expect(creada.body.numeroFactura).toBe('F-0001');
    expect(transaccion).toHaveBeenCalledTimes(2);
    expect(transaccion).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(fixture.estado().ventas).toHaveLength(1);
    expect(fixture.estado().movimientos).toHaveLength(2);
    expect(fixture.estado().cajas[0].cantidadVentas).toBe(1);
    transaccion.mockRestore();
  });

  it('relee el inventario tras un conflicto de transaccion y no vende stock ya consumido', async () => {
    const { venta, empresa, articulo } = await prepararVenta();
    const transaccion = vi
      .spyOn(fixture.db, '$transaction')
      .mockImplementationOnce(async () => {
        // Representa una salida confirmada por otra operacion antes del reintento.
        fixture.estado().movimientos.push({
          empresaId: empresa.id,
          productoId: articulo.id,
          tipo: 'AJUSTE',
          cantidad: new Prisma.Decimal('-9'),
        });
        throw new Prisma.PrismaClientKnownRequestError('Conflicto simulado', {
          code: 'P2034',
          clientVersion: '7',
        });
      });
    await request(app.getHttpServer())
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(venta)
      .expect(409);
    expect(transaccion).toHaveBeenCalledTimes(2);
    expect(fixture.estado().ventas).toEqual([]);
    expect(fixture.estado().cajas[0].cantidadVentas).toBe(0);
    transaccion.mockRestore();
  });

  it('rechaza IVA invalido e importes que exceden la precision de venta o caja', async () => {
    const { venta, empresa, articulo } = await prepararVenta();
    const http = request(app.getHttpServer());
    fixture.estado().empresas[0].porcentajeIva = new Prisma.Decimal(101);
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(venta)
      .expect(400);
    fixture.estado().empresas[0].porcentajeIva = new Prisma.Decimal(15);
    fixture.estado().cajas[0].totalVentas = new Prisma.Decimal(
      '999999999999.99',
    );
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(venta)
      .expect(400);
    fixture.estado().cajas[0].totalVentas = new Prisma.Decimal(0);
    fixture.estado().productos[0].precioBase = new Prisma.Decimal(
      '9999999999.99',
    );
    fixture.estado().movimientos.push({
      empresaId: empresa.id,
      productoId: articulo.id,
      tipo: 'COMPRA',
      cantidad: new Prisma.Decimal('200'),
    });
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send({
        ...venta,
        detalles: [{ productoId: articulo.id, cantidad: '101' }],
      })
      .expect(400);
    expect(fixture.estado().ventas).toEqual([]);
  });

  it('calcula el arqueo solo con efectivo, cierra la caja y conserva el historial', async () => {
    const { caja, venta, articulo } = await prepararVenta();
    fixture.estado().cajas[0].notas = 'Apertura de prueba';
    const http = request(app.getHttpServer());
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(venta)
      .expect(201);
    const { importeRecibido: _importe, ...sinEfectivo } = venta;
    for (const metodoPago of ['TARJETA', 'TRANSFERENCIA']) {
      await http
        .post('/ventas')
        .set('x-usuario-prueba', 'usuario-1')
        .send({ ...sinEfectivo, metodoPago })
        .expect(201);
    }
    const arqueo = await http
      .get(`/caja/${caja.id}/arqueo`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(arqueo.body).toMatchObject({
      estado: 'ABIERTA',
      efectivoInicial: '100',
      totalVentas: '865.95',
      totalEfectivo: '288.65',
      totalTarjeta: '288.65',
      totalTransfer: '288.65',
      cantidadVentas: 3,
      efectivoEsperado: '388.65',
      efectivoCierre: null,
      diferencia: null,
    });
    expect(fixture.estado().cajas[0].efectivoEsperado).toBeNull();
    const cerrada = await http
      .post(`/caja/${caja.id}/cerrar`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoCierre: '388.65', notas: ' Conteo verificado ' })
      .expect(200);
    expect(cerrada.body).toMatchObject({
      estado: 'CERRADA',
      abiertoPorId: 'usuario-1',
      cerradoPorId: 'usuario-1',
      efectivoCierre: '388.65',
      efectivoEsperado: '388.65',
      diferencia: '0',
      cantidadVentas: 3,
      notas: 'Apertura de prueba\nCierre: Conteo verificado',
    });
    expect(new Date(cerrada.body.cerradoEn).getTime()).not.toBeNaN();
    await http
      .post(`/caja/${caja.id}/cerrar`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoCierre: '0', notas: 'No debe sobrescribir' })
      .expect(409);
    const historica = await http
      .get(`/caja/${caja.id}/arqueo`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(historica.body).toMatchObject({
      efectivoCierre: '388.65',
      diferencia: '0',
      cerradoEn: cerrada.body.cerradoEn,
    });
    await http
      .get('/caja/actual')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(404);
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(venta)
      .expect(409);
    expect(fixture.estado().ventas).toHaveLength(3);
    const stock = await http
      .get(`${ruta}/${articulo.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(stock.body.stockDisponible).toBe('4');
    const nueva = await http
      .post('/caja')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoInicial: '0' })
      .expect(201);
    expect(nueva.body.id).not.toBe(caja.id);
    expect(fixture.estado().cajas).toHaveLength(2);
  });

  it.each([
    { contado: '99.90', diferencia: '-0.1' },
    { contado: '100.10', diferencia: '0.1' },
    { contado: '100.00', diferencia: '0' },
  ])(
    'conserva la diferencia de arqueo con efectivo contado $contado',
    async ({ contado, diferencia }) => {
      await crearEmpresa();
      const http = request(app.getHttpServer());
      const caja = await http
        .post('/caja')
        .set('x-usuario-prueba', 'usuario-1')
        .send({ efectivoInicial: '100' })
        .expect(201);
      const cerrada = await http
        .post(`/caja/${caja.body.id}/cerrar`)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ efectivoCierre: contado })
        .expect(200);
      expect(cerrada.body).toMatchObject({
        estado: 'CERRADA',
        efectivoEsperado: '100',
        diferencia,
      });
    },
  );

  it('valida el conteo y rechaza totales, propietario y fecha de cierre enviados por el cliente', async () => {
    await crearEmpresa();
    const http = request(app.getHttpServer());
    const caja = await http
      .post('/caja')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoInicial: '100' })
      .expect(201);
    const id = caja.body.id;
    for (const efectivoCierre of [
      undefined,
      null,
      100,
      '-1',
      '1.001',
      '1000000000000',
      '',
      '1e2',
      '1\n',
    ]) {
      await http
        .post(`/caja/${id}/cerrar`)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ efectivoCierre })
        .expect(400);
    }
    for (const campo of [
      'empresaId',
      'abiertoPorId',
      'cerradoPorId',
      'cerradoEn',
      'estado',
      'efectivoEsperado',
      'diferencia',
      'totalEfectivo',
      'totalVentas',
      'esAdmin',
    ]) {
      await http
        .post(`/caja/${id}/cerrar`)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ efectivoCierre: '100', [campo]: 'no-permitido' })
        .expect(400);
    }
    for (const notas of [null, 1, ' ', 'x'.repeat(1001)]) {
      await http
        .post(`/caja/${id}/cerrar`)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ efectivoCierre: '100', notas })
        .expect(400);
    }
    await http
      .get('/caja/invalido/arqueo')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(400);
    await http
      .post('/caja/invalido/cerrar')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoCierre: '0' })
      .expect(400);
    const desconocida = randomUUID();
    await http
      .get(`/caja/${desconocida}/arqueo`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(404);
    await http
      .post(`/caja/${desconocida}/cerrar`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoCierre: '0' })
      .expect(404);
    expect(fixture.estado().cajas[0]).toMatchObject({
      estado: 'ABIERTA',
      cerradoPorId: null,
      cerradoEn: null,
      efectivoCierre: null,
      efectivoEsperado: null,
      diferencia: null,
    });
  });

  it('ADMIN puede cerrar la caja del cajero de su empresa y registra quien efectuo el cierre', async () => {
    const empresa = await crearEmpresa();
    fixture
      .estado()
      .usuarios.push({ ...fixture.estado().usuarios[1], id: 'usuario-3' });
    await crearEmpresa('usuario-3');
    Object.assign(fixture.estado().usuarios[1], {
      empresaId: empresa.id,
      rolId: empresa.roles.find((rol: Row) => rol.nombre === 'CAJERO').id,
    });
    const http = request(app.getHttpServer());
    const admin = await http
      .post('/caja')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoInicial: '10' })
      .expect(201);
    const cajero = await http
      .post('/caja')
      .set('x-usuario-prueba', 'usuario-2')
      .send({ efectivoInicial: '20' })
      .expect(201);
    await http
      .get(`/caja/${admin.body.id}/arqueo`)
      .set('x-usuario-prueba', 'usuario-2')
      .set('x-role', 'ADMIN')
      .expect(404);
    await http
      .post(`/caja/${admin.body.id}/cerrar`)
      .set('x-usuario-prueba', 'usuario-2')
      .set('x-role', 'ADMIN')
      .send({ efectivoCierre: '10' })
      .expect(404);
    await http
      .get(`/caja/${admin.body.id}/arqueo`)
      .set('x-usuario-prueba', 'usuario-3')
      .expect(404);
    await http
      .post(`/caja/${cajero.body.id}/cerrar`)
      .set('x-usuario-prueba', 'usuario-3')
      .send({ efectivoCierre: '20' })
      .expect(404);
    const cerrada = await http
      .post(`/caja/${cajero.body.id}/cerrar`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoCierre: '20' })
      .expect(200);
    expect(cerrada.body).toMatchObject({
      abiertoPorId: 'usuario-2',
      cerradoPorId: 'usuario-1',
      estado: 'CERRADA',
    });
    expect(
      fixture.estado().cajas.find((row) => row.id === admin.body.id)?.estado,
    ).toBe('ABIERTA');
  });

  it.each(['ADMIN', 'CAJERO', 'BODEGUERO'])(
    'verifica sesion y permiso para arqueo y cierre como %s',
    async (nombre) => {
      const empresa = await crearEmpresa();
      const http = request(app.getHttpServer());
      const caja = await http
        .post('/caja')
        .set('x-usuario-prueba', 'usuario-1')
        .send({ efectivoInicial: '0' })
        .expect(201);
      fixture.estado().usuarios[0].rolId = empresa.roles.find(
        (rol: Row) => rol.nombre === nombre,
      ).id;
      await http.get(`/caja/${caja.body.id}/arqueo`).expect(401);
      await http
        .post(`/caja/${caja.body.id}/cerrar`)
        .send({ efectivoCierre: '0' })
        .expect(401);
      const esperado = nombre === 'BODEGUERO' ? 403 : 200;
      await http
        .get(`/caja/${caja.body.id}/arqueo`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(esperado);
      await http
        .post(`/caja/${caja.body.id}/cerrar`)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ efectivoCierre: '0' })
        .expect(esperado);
      expect(fixture.estado().cajas[0].estado).toBe(
        nombre === 'BODEGUERO' ? 'ABIERTA' : 'CERRADA',
      );
    },
  );

  it('revierte un cierre fallido y reintenta sin duplicar notas ni sobrescribir el primer cierre', async () => {
    await crearEmpresa();
    const http = request(app.getHttpServer());
    const caja = await http
      .post('/caja')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoInicial: '100', notas: 'Apertura' })
      .expect(201);
    const fallo = (code: string) =>
      new Prisma.PrismaClientKnownRequestError('Fallo simulado', {
        code,
        clientVersion: '7',
      });
    fixture.db.sesionCaja.findUniqueOrThrow.mockRejectedValueOnce(
      fallo('P2003'),
    );
    await http
      .post(`/caja/${caja.body.id}/cerrar`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoCierre: '100', notas: 'Revisado' })
      .expect(409);
    expect(fixture.estado().cajas[0]).toMatchObject({
      estado: 'ABIERTA',
      cerradoEn: null,
      efectivoCierre: null,
      efectivoEsperado: null,
      diferencia: null,
      notas: 'Apertura',
    });
    fixture.db.sesionCaja.updateMany.mockResolvedValueOnce({ count: 0 });
    await http
      .post(`/caja/${caja.body.id}/cerrar`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoCierre: '100' })
      .expect(409);
    fixture.db.sesionCaja.findUniqueOrThrow.mockRejectedValueOnce(
      fallo('P2034'),
    );
    const transaccion = vi.spyOn(fixture.db, '$transaction');
    const cerrada = await http
      .post(`/caja/${caja.body.id}/cerrar`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoCierre: '100', notas: 'Revisado' })
      .expect(200);
    expect(transaccion).toHaveBeenCalledTimes(2);
    expect(transaccion).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(cerrada.body.notas).toBe('Apertura\nCierre: Revisado');
    transaccion.mockRestore();
  });

  it('recalcula el esperado si otra venta confirma efectivo durante un reintento del cierre', async () => {
    await crearEmpresa();
    const http = request(app.getHttpServer());
    const caja = await http
      .post('/caja')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoInicial: '100' })
      .expect(201);
    const transaccion = vi
      .spyOn(fixture.db, '$transaction')
      .mockImplementationOnce(async () => {
        // Representa los acumulados confirmados por una venta concurrente.
        fixture.estado().cajas[0].totalEfectivo = new Prisma.Decimal('30.10');
        fixture.estado().cajas[0].cantidadVentas = 1;
        throw new Prisma.PrismaClientKnownRequestError('Conflicto simulado', {
          code: 'P2034',
          clientVersion: '7',
        });
      });
    const cerrada = await http
      .post(`/caja/${caja.body.id}/cerrar`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoCierre: '130.10' })
      .expect(200);
    expect(cerrada.body).toMatchObject({
      efectivoEsperado: '130.1',
      efectivoCierre: '130.1',
      diferencia: '0',
    });
    expect(transaccion).toHaveBeenCalledTimes(2);
    transaccion.mockRestore();
  });

  it('una venta reintentada tras un cierre confirmado no deja factura, movimientos ni detalles', async () => {
    const { venta } = await prepararVenta();
    const transaccion = vi
      .spyOn(fixture.db, '$transaction')
      .mockImplementationOnce(async () => {
        // Representa el resultado confirmado de otra solicitud de cierre.
        Object.assign(fixture.estado().cajas[0], {
          estado: 'CERRADA',
          cerradoPorId: 'usuario-1',
          cerradoEn: new Date(),
          efectivoCierre: new Prisma.Decimal(100),
          efectivoEsperado: new Prisma.Decimal(100),
          diferencia: new Prisma.Decimal(0),
        });
        throw new Prisma.PrismaClientKnownRequestError('Conflicto simulado', {
          code: 'P2034',
          clientVersion: '7',
        });
      });
    await request(app.getHttpServer())
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(venta)
      .expect(409);
    expect(fixture.estado().ventas).toEqual([]);
    expect(fixture.estado().detallesVenta).toEqual([]);
    expect(fixture.estado().movimientos).toHaveLength(1);
    expect(
      fixture.estado().secuencias.some((row) => row.tipo === 'FACTURA'),
    ).toBe(false);
    expect(fixture.estado().cajas[0].estado).toBe('CERRADA');
    transaccion.mockRestore();
  });

  it('evita exceder la precision del arqueo y protege nuevas ventas en efectivo', async () => {
    const { venta, caja } = await prepararVenta();
    fixture.estado().cajas[0].efectivoInicial = new Prisma.Decimal(
      '999999999999.99',
    );
    const http = request(app.getHttpServer());
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(venta)
      .expect(400);
    expect(fixture.estado().ventas).toEqual([]);
    fixture.estado().cajas[0].totalEfectivo = new Prisma.Decimal('0.01');
    await http
      .get(`/caja/${caja.id}/arqueo`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(400);
    await http
      .post(`/caja/${caja.id}/cerrar`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoCierre: '999999999999.99' })
      .expect(400);
    expect(fixture.estado().cajas[0].estado).toBe('ABIERTA');
  });

  async function prepararAnulacion(usuario = 'usuario-1') {
    const contexto = await prepararVenta(usuario);
    const creada = await request(app.getHttpServer())
      .post('/ventas')
      .set('x-usuario-prueba', usuario)
      .send(contexto.venta)
      .expect(201);
    return { ...contexto, registrada: creada.body };
  }

  it('anula una venta conservando factura y detalles, devuelve el stock y revierte caja con auditoria', async () => {
    const { registrada, articulo, caja, cliente, venta } =
      await prepararAnulacion();
    const http = request(app.getHttpServer());
    await http
      .patch(`${ruta}/${articulo.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ activo: false, precioBase: '999.99', precioCosto: '199.99' })
      .expect(200);
    await http
      .delete(`/ventas/clientes/${cliente.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(204);
    const anulada = await http
      .post(`/ventas/${registrada.id}/anular`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ motivo: ' Error de registro ' })
      .expect(200);
    expect(anulada.body).toMatchObject({
      id: registrada.id,
      estado: 'ANULADA',
      numeroFactura: 'F-0001',
      usuarioId: 'usuario-1',
      anuladaPorId: 'usuario-1',
      motivoAnulacion: 'Error de registro',
      subtotal: '251',
      montoIVA: '37.65',
      total: '288.65',
      importeRecibido: '500',
      cambio: '211.35',
    });
    expect(new Date(anulada.body.anuladaEn).getTime()).not.toBeNaN();
    expect(anulada.body.detalles).toEqual(registrada.detalles);
    expect(fixture.estado().ventas).toHaveLength(1);
    expect(fixture.estado().detallesVenta).toHaveLength(1);
    const salida = fixture
      .estado()
      .movimientos.find((row) => row.tipo === 'VENTA');
    expect(salida?.cantidad.toString()).toBe('-2');
    const inversos = fixture
      .estado()
      .movimientos.filter((row) => row.tipo === 'ANULACION_VENTA');
    expect(inversos).toHaveLength(1);
    expect(inversos[0]).toMatchObject({
      ventaId: registrada.id,
      productoId: articulo.id,
      usuarioId: 'usuario-1',
      nota: 'Anulacion F-0001: Error de registro',
    });
    expect(inversos[0].cantidad.toString()).toBe('2');
    expect(inversos[0].costoUnidad.toString()).toBe('80.25');
    const cajaFinal = await http
      .get(`/caja/${caja.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(cajaFinal.body).toMatchObject({
      efectivoInicial: '100',
      totalVentas: '0',
      totalEfectivo: '0',
      cantidadVentas: 0,
    });
    await http
      .post(`/ventas/${registrada.id}/anular`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ motivo: 'No sobrescribir' })
      .expect(409);
    expect(
      fixture
        .estado()
        .movimientos.filter((row) => row.tipo === 'ANULACION_VENTA'),
    ).toHaveLength(1);
    await http
      .patch(`${ruta}/${articulo.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ activo: true })
      .expect(200);
    const stock = await http
      .get(`/inventario/${articulo.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(stock.body.stockDisponible).toBe('10');
    const lista = await http
      .get('/ventas?estado=ANULADA')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(lista.body.datos[0].id).toBe(registrada.id);
    const nuevoCliente = await http
      .post('/ventas/clientes')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ nombre: 'Otro cliente' })
      .expect(201);
    const { importeRecibido: _importe, ...pagoExacto } = venta;
    const siguiente = await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ ...pagoExacto, clienteId: nuevoCliente.body.id })
      .expect(201);
    expect(siguiente.body.numeroFactura).toBe('F-0002');
  });

  it.each(['TARJETA', 'TRANSFERENCIA'])(
    'revierte solo el acumulado de %s sin alterar el efectivo',
    async (metodoPago) => {
      const { venta } = await prepararVenta();
      const http = request(app.getHttpServer());
      const { importeRecibido: _importe, ...base } = venta;
      const creada = await http
        .post('/ventas')
        .set('x-usuario-prueba', 'usuario-1')
        .send({ ...base, metodoPago })
        .expect(201);
      await http
        .post(`/ventas/${creada.body.id}/anular`)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ motivo: 'Venta duplicada' })
        .expect(200);
      const caja = await http
        .get('/caja/actual')
        .set('x-usuario-prueba', 'usuario-1')
        .expect(200);
      expect(caja.body).toMatchObject({
        totalVentas: '0',
        totalEfectivo: '0',
        totalTarjeta: '0',
        totalTransfer: '0',
        cantidadVentas: 0,
      });
      const arqueo = await http
        .get(`/caja/${caja.body.id}/arqueo`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(200);
      expect(arqueo.body.efectivoEsperado).toBe('100');
    },
  );

  it.each(['CAJERO', 'BODEGUERO'])(
    'prohibe anular ventas a %s aunque envie un rol administrativo',
    async (nombre) => {
      const { registrada, empresa } = await prepararAnulacion();
      fixture.estado().usuarios[0].rolId = empresa.roles.find(
        (rol: Row) => rol.nombre === nombre,
      ).id;
      await request(app.getHttpServer())
        .post(`/ventas/${registrada.id}/anular`)
        .set('x-usuario-prueba', 'usuario-1')
        .set('x-role', 'ADMIN')
        .send({ motivo: 'No permitido' })
        .expect(403);
      expect(fixture.estado().ventas[0].estado).toBe('COMPLETADA');
      expect(fixture.estado().movimientos).toHaveLength(2);
    },
  );

  it('valida motivo, UUID y sesion y rechaza cantidades o auditoria proporcionadas por el cliente', async () => {
    const { registrada } = await prepararAnulacion();
    const http = request(app.getHttpServer());
    const base = `/ventas/${registrada.id}/anular`;
    await http.post(base).send({ motivo: 'Prueba' }).expect(401);
    for (const motivo of [undefined, null, 1, '', ' ', 'x'.repeat(501)]) {
      await http
        .post(base)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ motivo })
        .expect(400);
    }
    for (const campo of [
      'empresaId',
      'usuarioId',
      'anuladaPorId',
      'anuladaEn',
      'estado',
      'total',
      'detalles',
      'cantidad',
      'sesionCajaId',
    ]) {
      await http
        .post(base)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ motivo: 'Prueba', [campo]: 'no-permitido' })
        .expect(400);
    }
    await http
      .post('/ventas/invalido/anular')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ motivo: 'Prueba' })
      .expect(400);
    await http
      .post(`/ventas/${randomUUID()}/anular`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ motivo: 'Prueba' })
      .expect(404);
    expect(fixture.estado().ventas[0]).toMatchObject({
      estado: 'COMPLETADA',
      anuladaPorId: null,
      anuladaEn: null,
      motivoAnulacion: null,
    });
  });

  it('permite a ADMIN anular ventas del cajero en su caja original, sin acceso entre empresas', async () => {
    const { empresa, venta, caja } = await prepararVenta();
    fixture
      .estado()
      .usuarios.push({ ...fixture.estado().usuarios[1], id: 'usuario-3' });
    await crearEmpresa('usuario-3');
    Object.assign(fixture.estado().usuarios[1], {
      empresaId: empresa.id,
      rolId: empresa.roles.find((rol: Row) => rol.nombre === 'CAJERO').id,
    });
    const http = request(app.getHttpServer());
    await http
      .post(`/caja/${caja.id}/cerrar`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoCierre: '100' })
      .expect(200);
    const cajaCajero = await http
      .post('/caja')
      .set('x-usuario-prueba', 'usuario-2')
      .send({ efectivoInicial: '0' })
      .expect(201);
    const creada = await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-2')
      .send(venta)
      .expect(201);
    await http
      .post(`/ventas/${creada.body.id}/anular`)
      .set('x-usuario-prueba', 'usuario-3')
      .send({ motivo: 'Ajena' })
      .expect(404);
    const anulada = await http
      .post(`/ventas/${creada.body.id}/anular`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ motivo: 'Correccion administrativa' })
      .expect(200);
    expect(anulada.body).toMatchObject({
      usuarioId: 'usuario-2',
      anuladaPorId: 'usuario-1',
      sesionCajaId: cajaCajero.body.id,
    });
    const original = await http
      .get(`/caja/${cajaCajero.body.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(original.body).toMatchObject({
      totalVentas: '0',
      totalEfectivo: '0',
      cantidadVentas: 0,
    });
    expect(
      fixture.estado().cajas.find((row) => row.id === caja.id)?.estado,
    ).toBe('CERRADA');
  });

  it('rechaza anular ventas de cajas cerradas y conserva su arqueo', async () => {
    const { registrada, caja } = await prepararAnulacion();
    const http = request(app.getHttpServer());
    const cierre = await http
      .post(`/caja/${caja.id}/cerrar`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoCierre: '388.65' })
      .expect(200);
    await http
      .post(`/ventas/${registrada.id}/anular`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ motivo: 'Fuera de plazo' })
      .expect(409);
    const conservada = await http
      .get(`/caja/${caja.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(conservada.body).toEqual(cierre.body);
    expect(fixture.estado().ventas[0].estado).toBe('COMPLETADA');
    expect(fixture.estado().movimientos).toHaveLength(2);
  });

  it.each(['creditos', 'devoluciones'])(
    'no anula ventas con registros vinculados de %s sin implementar su tratamiento',
    async (tabla) => {
      const { registrada } = await prepararAnulacion();
      fixture
        .estado()
        [tabla].push({ id: randomUUID(), ventaId: registrada.id });
      await request(app.getHttpServer())
        .post(`/ventas/${registrada.id}/anular`)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ motivo: 'Prueba' })
        .expect(409);
      expect(fixture.estado().ventas[0].estado).toBe('COMPLETADA');
      expect(fixture.estado().movimientos).toHaveLength(2);
    },
  );

  it('bloquea anulaciones con salidas de inventario o acumulados de caja inconsistentes', async () => {
    const { registrada } = await prepararAnulacion();
    const http = request(app.getHttpServer());
    const originales = fixture.estado().movimientos.map((row) => ({ ...row }));
    fixture.estado().movimientos = fixture
      .estado()
      .movimientos.filter((row) => row.tipo !== 'VENTA');
    await http
      .post(`/ventas/${registrada.id}/anular`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ motivo: 'Prueba' })
      .expect(409);
    fixture.estado().movimientos = originales;
    fixture.estado().cajas[0].totalEfectivo = new Prisma.Decimal(0);
    await http
      .post(`/ventas/${registrada.id}/anular`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ motivo: 'Prueba' })
      .expect(409);
    expect(fixture.estado().ventas[0].estado).toBe('COMPLETADA');
    expect(fixture.estado().movimientos).toHaveLength(2);
  });

  it('revierte toda la anulacion si falla inventario o caja y reintenta sin duplicar devolucion de stock', async () => {
    const { registrada } = await prepararAnulacion();
    const http = request(app.getHttpServer());
    const fallo = (code: string) =>
      new Prisma.PrismaClientKnownRequestError('Fallo simulado', {
        code,
        clientVersion: '7',
      });
    const enviar = () =>
      http
        .post(`/ventas/${registrada.id}/anular`)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ motivo: 'Prueba' });
    fixture.db.venta.updateMany.mockResolvedValueOnce({ count: 0 });
    await enviar().expect(409);
    fixture.db.movimientoAlmacen.createMany.mockImplementationOnce(async () => {
      fixture.estado().movimientos.push({ id: 'incompleto' });
      throw fallo('P2003');
    });
    await enviar().expect(409);
    fixture.db.sesionCaja.updateMany.mockResolvedValueOnce({ count: 0 });
    await enviar().expect(409);
    expect(fixture.estado().ventas[0]).toMatchObject({
      estado: 'COMPLETADA',
      anuladaEn: null,
      anuladaPorId: null,
    });
    expect(fixture.estado().movimientos).toHaveLength(2);
    expect(fixture.estado().cajas[0].totalEfectivo.toString()).toBe('288.65');
    expect(fixture.estado().cajas[0].cantidadVentas).toBe(1);
    fixture.db.venta.findUniqueOrThrow.mockRejectedValueOnce(fallo('P2034'));
    const transaccion = vi.spyOn(fixture.db, '$transaction');
    await enviar().expect(200);
    expect(transaccion).toHaveBeenCalledTimes(2);
    expect(transaccion).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(
      fixture
        .estado()
        .movimientos.filter((row) => row.tipo === 'ANULACION_VENTA'),
    ).toHaveLength(1);
    expect(fixture.estado().cajas[0].totalVentas.toString()).toBe('0');
    expect(fixture.estado().cajas[0].cantidadVentas).toBe(0);
    transaccion.mockRestore();
  });

  it('vuelve a comprobar el estado de la caja cuando un cierre concurrente obliga a reintentar', async () => {
    const { registrada } = await prepararAnulacion();
    const transaccion = vi
      .spyOn(fixture.db, '$transaction')
      .mockImplementationOnce(async () => {
        // Representa un cierre ya confirmado por otra solicitud.
        Object.assign(fixture.estado().cajas[0], {
          estado: 'CERRADA',
          efectivoEsperado: new Prisma.Decimal('388.65'),
          efectivoCierre: new Prisma.Decimal('388.65'),
          diferencia: new Prisma.Decimal(0),
          cerradoEn: new Date(),
        });
        throw new Prisma.PrismaClientKnownRequestError('Conflicto simulado', {
          code: 'P2034',
          clientVersion: '7',
        });
      });
    await request(app.getHttpServer())
      .post(`/ventas/${registrada.id}/anular`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ motivo: 'Prueba concurrente' })
      .expect(409);
    expect(fixture.estado().ventas[0].estado).toBe('COMPLETADA');
    expect(fixture.estado().movimientos).toHaveLength(2);
    expect(fixture.estado().cajas[0].efectivoEsperado.toString()).toBe(
      '388.65',
    );
    transaccion.mockRestore();
  });

  function datosVentaCredito(venta: Row) {
    return {
      clienteId: venta.clienteId,
      tipoVenta: 'CREDITO',
      detalles: venta.detalles,
      credito: {
        fechaVencimiento: new Date(Date.now() + 86_400_000).toISOString(),
        descripcion: 'Credito de prueba',
      },
    };
  }

  it('crea venta y credito del mismo cliente y empresa sin registrar cobro, y permite cerrar la caja', async () => {
    const { venta, empresa, caja, cliente, articulo } = await prepararVenta();
    const http = request(app.getHttpServer());
    const creada = await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(datosVentaCredito(venta))
      .expect(201);
    expect(creada.body).toMatchObject({
      tipoVenta: 'CREDITO',
      metodoPago: null,
      importeRecibido: null,
      cambio: null,
      total: '288.65',
    });
    expect(creada.body.credito).toMatchObject({
      empresaId: empresa.id,
      clienteId: cliente.id,
      ventaId: creada.body.id,
      montoOriginal: '288.65',
      saldoPendiente: '288.65',
      estado: 'PENDIENTE',
      descripcion: 'Credito de prueba',
    });
    expect(fixture.estado().creditos).toHaveLength(1);
    const actual = await http
      .get('/caja/actual')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(actual.body).toMatchObject({
      totalVentas: '288.65',
      totalCredito: '288.65',
      totalEfectivo: '0',
      totalTarjeta: '0',
      totalTransfer: '0',
      cantidadVentas: 1,
    });
    const stock = await http
      .get(`${ruta}/${articulo.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(stock.body.stockDisponible).toBe('8');
    const registrada = await http
      .get(`/ventas/${creada.body.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(registrada.body.credito.id).toBe(creada.body.credito.id);
    const leido = await http
      .get(`/creditos/${creada.body.credito.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(leido.body.cliente.id).toBe(cliente.id);
    expect(leido.body.venta.id).toBe(creada.body.id);
    const listado = await http
      .get(`/creditos?clienteId=${cliente.id}&estado=PENDIENTE&limite=1`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(listado.body.datos.map((row: Row) => row.id)).toEqual([
      creada.body.credito.id,
    ]);
    await http
      .post(`/ventas/${creada.body.id}/anular`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ motivo: 'No debe borrar la deuda' })
      .expect(409);
    const cerrada = await http
      .post(`/caja/${caja.id}/cerrar`)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ efectivoCierre: '100.00' })
      .expect(200);
    expect(cerrada.body).toMatchObject({
      efectivoEsperado: '100',
      diferencia: '0',
      totalCredito: '288.65',
    });
    const pendiente = await http
      .get(`/creditos/${creada.body.credito.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(pendiente.body).toMatchObject({
      saldoPendiente: '288.65',
      estado: 'PENDIENTE',
    });
  });

  it('separa ventas cobradas y financiadas en la misma caja y mantiene el arqueo correcto', async () => {
    const { venta, caja } = await prepararVenta();
    const http = request(app.getHttpServer());
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(datosVentaCredito(venta))
      .expect(201);
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(venta)
      .expect(201);
    const arqueo = await http
      .get(`/caja/${caja.id}/arqueo`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(arqueo.body).toMatchObject({
      totalVentas: '577.3',
      totalCredito: '288.65',
      totalEfectivo: '288.65',
      efectivoEsperado: '388.65',
      cantidadVentas: 2,
    });
    expect(fixture.estado().creditos).toHaveLength(1);
    expect(fixture.estado().ventas.map((row) => row.tipoVenta)).toEqual([
      'CREDITO',
      'CONTADO',
    ]);
  });

  it.each(['ADMIN', 'CAJERO', 'BODEGUERO'])(
    'verifica creacion de credito y consulta de cartera para %s',
    async (nombre) => {
      const { venta, empresa } = await prepararVenta();
      const http = request(app.getHttpServer());
      const creada = await http
        .post('/ventas')
        .set('x-usuario-prueba', 'usuario-1')
        .send(datosVentaCredito(venta))
        .expect(201);
      fixture.estado().usuarios[0].rolId = empresa.roles.find(
        (rol: Row) => rol.nombre === nombre,
      ).id;
      await http.get('/creditos').expect(401);
      await http.get(`/creditos/${creada.body.credito.id}`).expect(401);
      await http
        .get('/creditos')
        .set('x-usuario-prueba', 'usuario-1')
        .expect(nombre === 'BODEGUERO' ? 403 : 200);
      await http
        .get(`/creditos/${creada.body.credito.id}`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(nombre === 'BODEGUERO' ? 403 : 200);
      await http
        .post('/ventas')
        .set('x-usuario-prueba', 'usuario-1')
        .set('x-role', 'ADMIN')
        .send(datosVentaCredito(venta))
        .expect(nombre === 'ADMIN' ? 201 : 403);
      expect(fixture.estado().creditos).toHaveLength(
        nombre === 'ADMIN' ? 2 : 1,
      );
    },
  );

  it('valida condiciones de credito y rechaza cobros, montos de deuda y clientes genericos', async () => {
    const { venta } = await prepararVenta();
    const credito = datosVentaCredito(venta);
    const http = request(app.getHttpServer());
    const invalidas = [
      { ...credito, tipoVenta: 'INVALIDO' },
      { ...credito, metodoPago: 'EFECTIVO' },
      { ...credito, importeRecibido: '1' },
      { ...credito, referenciaPago: 'REF' },
      { ...credito, credito: null },
      { ...credito, credito: [] },
      { ...credito, credito: { fechaVencimiento: 'no-es-fecha' } },
      { ...credito, credito: { fechaVencimiento: '2000-01-01T00:00:00Z' } },
      { ...credito, credito: { fechaVencimiento: null } },
      { ...credito, credito: { descripcion: 'x'.repeat(401) } },
      ...[
        'empresaId',
        'clienteId',
        'ventaId',
        'saldoPendiente',
        'montoOriginal',
        'estado',
      ].map((campo) => ({
        ...credito,
        credito: { [campo]: 'dato-no-permitido' },
      })),
      { ...venta, credito: {} },
    ];
    for (const body of invalidas)
      await http
        .post('/ventas')
        .set('x-usuario-prueba', 'usuario-1')
        .send(body)
        .expect(400);
    fixture.estado().clientes[0].esGenerico = true;
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(credito)
      .expect(400);
    fixture.estado().clientes[0].esGenerico = false;
    fixture.estado().productos[0].precioBase = new Prisma.Decimal(0);
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(credito)
      .expect(400);
    fixture.estado().productos[0].precioBase = new Prisma.Decimal('125.50');
    fixture.estado().cajas[0].totalCredito = new Prisma.Decimal(
      '999999999999.99',
    );
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(credito)
      .expect(400);
    expect(fixture.estado().creditos).toEqual([]);
    expect(fixture.estado().ventas).toEqual([]);
    expect(fixture.estado().movimientos).toHaveLength(1);
    expect(
      fixture.estado().secuencias.some((row) => row.tipo === 'FACTURA'),
    ).toBe(false);
    for (const query of [
      'pagina=0',
      'limite=101',
      'estado=INVALIDO',
      'clienteId=invalido',
      'empresaId=ajena',
    ]) {
      await http
        .get(`/creditos?${query}`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(400);
    }
    await http
      .get('/creditos/invalido')
      .set('x-usuario-prueba', 'usuario-1')
      .expect(400);
    await http
      .get(`/creditos/${randomUUID()}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(404);
  });

  it('separa creditos por empresa y permite al cajero consultar los de su empresa', async () => {
    const propia = await prepararVenta();
    const ajena = await prepararVenta('usuario-2');
    const http = request(app.getHttpServer());
    const creditoPropio = datosVentaCredito(propia.venta);
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ ...creditoPropio, clienteId: ajena.cliente.id })
      .expect(400);
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send({
        ...creditoPropio,
        detalles: [{ productoId: ajena.articulo.id, cantidad: '1' }],
      })
      .expect(400);
    const primera = await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(creditoPropio)
      .expect(201);
    const segunda = await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-2')
      .send(datosVentaCredito(ajena.venta))
      .expect(201);
    await http
      .get(`/creditos/${primera.body.credito.id}`)
      .set('x-usuario-prueba', 'usuario-2')
      .expect(404);
    const lista = await http
      .get('/creditos')
      .set('x-usuario-prueba', 'usuario-2')
      .expect(200);
    expect(lista.body.datos.map((row: Row) => row.id)).toEqual([
      segunda.body.credito.id,
    ]);
    const filtro = await http
      .get(`/creditos?clienteId=${ajena.cliente.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(filtro.body.datos).toEqual([]);
    fixture.estado().usuarios.push({
      ...fixture.estado().usuarios[0],
      id: 'usuario-3',
      rolId: propia.empresa.roles.find((rol: Row) => rol.nombre === 'CAJERO')
        .id,
    });
    const cartera = await http
      .get('/creditos')
      .set('x-usuario-prueba', 'usuario-3')
      .expect(200);
    expect(cartera.body.datos.map((row: Row) => row.id)).toEqual([
      primera.body.credito.id,
    ]);
  });

  it('revierte venta, credito, inventario y caja ante fallos y reintenta sin duplicar deuda', async () => {
    const { venta } = await prepararVenta();
    const http = request(app.getHttpServer());
    const datos = datosVentaCredito(venta);
    const fallo = (code: string) =>
      new Prisma.PrismaClientKnownRequestError('Fallo simulado', {
        code,
        clientVersion: '7',
      });
    fixture.db.credito.create.mockImplementationOnce(async () => {
      fixture.estado().creditos.push({ id: 'incompleto' });
      throw fallo('P2003');
    });
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(datos)
      .expect(409);
    fixture.db.movimientoAlmacen.createMany.mockRejectedValueOnce(
      fallo('P2003'),
    );
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(datos)
      .expect(409);
    fixture.db.sesionCaja.updateMany.mockResolvedValueOnce({ count: 0 });
    await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(datos)
      .expect(409);
    expect(fixture.estado().ventas).toEqual([]);
    expect(fixture.estado().creditos).toEqual([]);
    expect(fixture.estado().detallesVenta).toEqual([]);
    expect(fixture.estado().movimientos).toHaveLength(1);
    expect(fixture.estado().cajas[0].cantidadVentas).toBe(0);
    expect(
      fixture.estado().secuencias.some((row) => row.tipo === 'FACTURA'),
    ).toBe(false);
    fixture.db.credito.create.mockRejectedValueOnce(fallo('P2034'));
    const transaccion = vi.spyOn(fixture.db, '$transaction');
    const creada = await http
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(datos)
      .expect(201);
    expect(transaccion).toHaveBeenCalledTimes(2);
    expect(transaccion).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(creada.body.numeroFactura).toBe('F-0001');
    expect(fixture.estado().creditos).toHaveLength(1);
    expect(fixture.estado().ventas).toHaveLength(1);
    expect(fixture.estado().cajas[0].totalCredito.toString()).toBe('288.65');
    expect(fixture.estado().cajas[0].totalEfectivo.toString()).toBe('0');
    transaccion.mockRestore();
  });

  async function prepararAbono() {
    const datos = await prepararVenta();
    const venta = await request(app.getHttpServer())
      .post('/ventas')
      .set('x-usuario-prueba', 'usuario-1')
      .send(datosVentaCredito(datos.venta))
      .expect(201);
    return {
      ...datos,
      credito: venta.body.credito,
      rutaAbonos: `/creditos/${venta.body.credito.id}/abonos`,
    };
  }

  it('cobra pagos parciales y completos con los campos actuales sin alterar caja ni inventario', async () => {
    const { rutaAbonos, credito, empresa, caja } = await prepararAbono();
    const http = request(app.getHttpServer());
    const cajasAntes = JSON.stringify(fixture.estado().cajas);
    const movimientosAntes = JSON.stringify(fixture.estado().movimientos);
    const primero = await http
      .post(rutaAbonos)
      .set('x-usuario-prueba', 'usuario-1')
      .send({
        monto: '50.10',
        descripcion: ' Pago parcial ',
        referenciaPago: ' REC-001 ',
      })
      .expect(201);
    expect(primero.body).toMatchObject({
      empresaId: empresa.id,
      creditoId: credito.id,
      usuarioId: 'usuario-1',
      monto: '50.1',
      saldoAnterior: '288.65',
      saldoNuevo: '238.55',
      metodoPago: 'EFECTIVO',
      descripcion: 'Pago parcial',
      referenciaPago: 'REC-001',
    });
    expect(primero.body).not.toHaveProperty('claveOperacion');
    expect(primero.body).not.toHaveProperty('sesionCajaId');
    const leido = await http
      .get(`/creditos/${credito.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(leido.body).toMatchObject({
      saldoPendiente: '238.55',
      estado: 'PENDIENTE',
    });
    await http
      .post(rutaAbonos)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ monto: '238.55' })
      .expect(201);
    const pagado = await http
      .get(`/creditos/${credito.id}`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(pagado.body).toMatchObject({
      saldoPendiente: '0',
      estado: 'PAGADO',
    });
    await http
      .post(rutaAbonos)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ monto: '1' })
      .expect(409);
    const lista = await http
      .get(rutaAbonos)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(lista.body.datos).toHaveLength(2);
    const pagina = await http
      .get(`${rutaAbonos}?pagina=2&limite=1`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(pagina.body).toMatchObject({ pagina: 2, limite: 1 });
    expect(pagina.body.datos).toHaveLength(1);
    expect(JSON.stringify(fixture.estado().cajas)).toBe(cajasAntes);
    expect(JSON.stringify(fixture.estado().movimientos)).toBe(movimientosAntes);
    const arqueo = await http
      .get(`/caja/${caja.id}/arqueo`)
      .set('x-usuario-prueba', 'usuario-1')
      .expect(200);
    expect(arqueo.body.efectivoEsperado).toBe('100');
  });

  it.each(['ADMIN', 'CAJERO', 'BODEGUERO'])(
    'protege cobro e historial de abonos para %s',
    async (nombre) => {
      const { empresa, rutaAbonos } = await prepararAbono();
      fixture.estado().usuarios[0].rolId = empresa.roles.find(
        (rol: Row) => rol.nombre === nombre,
      ).id;
      const http = request(app.getHttpServer());
      await http.post(rutaAbonos).send({ monto: '1' }).expect(401);
      await http.get(rutaAbonos).expect(401);
      await http
        .post(rutaAbonos)
        .set('x-usuario-prueba', 'usuario-1')
        .set('x-role', 'ADMIN')
        .send({ monto: '1' })
        .expect(nombre === 'BODEGUERO' ? 403 : 201);
      await http
        .get(rutaAbonos)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(nombre === 'BODEGUERO' ? 403 : 200);
    },
  );

  it('rechaza montos invalidos, sobrepagos y campos que asigna el backend', async () => {
    const { rutaAbonos } = await prepararAbono();
    const http = request(app.getHttpServer());
    for (const monto of [
      undefined,
      null,
      1,
      '0',
      '-1',
      '0.001',
      '1e2',
      '1\n',
      '1000000000000',
      '288.66',
    ])
      await http
        .post(rutaAbonos)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ monto })
        .expect(400);
    for (const campo of [
      'empresaId',
      'usuarioId',
      'creditoId',
      'saldoAnterior',
      'saldoNuevo',
      'fecha',
      'sesionCajaId',
      'claveOperacion',
    ])
      await http
        .post(rutaAbonos)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ monto: '1', [campo]: 'ajeno' })
        .expect(400);
    for (const extra of [
      { metodoPago: null },
      { metodoPago: 'CREDITO' },
      { referenciaPago: null },
      { descripcion: 4 },
      { referenciaPago: 'x'.repeat(101) },
      { descripcion: 'x'.repeat(401) },
    ])
      await http
        .post(rutaAbonos)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ monto: '1', ...extra })
        .expect(400);
    for (const query of ['pagina=0', 'limite=101', 'empresaId=ajena'])
      await http
        .get(`${rutaAbonos}?${query}`)
        .set('x-usuario-prueba', 'usuario-1')
        .expect(400);
    await http
      .post('/creditos/invalido/abonos')
      .set('x-usuario-prueba', 'usuario-1')
      .send({ monto: '1' })
      .expect(400);
    expect(fixture.estado().abonos).toEqual([]);
    expect(fixture.estado().creditos[0].saldoPendiente.toString()).toBe(
      '288.65',
    );
  });

  it('separa abonos por empresa y exige caja propia abierta para cobrar', async () => {
    const { empresa, rutaAbonos } = await prepararAbono();
    await prepararVenta('usuario-2');
    const http = request(app.getHttpServer());
    await http
      .post(rutaAbonos)
      .set('x-usuario-prueba', 'usuario-2')
      .send({ monto: '1' })
      .expect(404);
    await http.get(rutaAbonos).set('x-usuario-prueba', 'usuario-2').expect(404);
    fixture
      .estado()
      .usuarios.push({
        ...fixture.estado().usuarios[0],
        id: 'usuario-3',
        rolId: empresa.roles.find((rol: Row) => rol.nombre === 'CAJERO').id,
      });
    await http
      .post(rutaAbonos)
      .set('x-usuario-prueba', 'usuario-3')
      .send({ monto: '1' })
      .expect(409);
    await http
      .post('/caja')
      .set('x-usuario-prueba', 'usuario-3')
      .send({ efectivoInicial: '0' })
      .expect(201);
    const cobrado = await http
      .post(rutaAbonos)
      .set('x-usuario-prueba', 'usuario-3')
      .send({ monto: '1' })
      .expect(201);
    expect(cobrado.body.usuarioId).toBe('usuario-3');
    const caja = fixture
      .estado()
      .cajas.find((row) => row.abiertoPorId === 'usuario-3')!;
    caja.estado = 'CERRADA';
    await http
      .post(rutaAbonos)
      .set('x-usuario-prueba', 'usuario-3')
      .send({ monto: '1' })
      .expect(409);
    expect(fixture.estado().abonos).toHaveLength(1);
  });

  it.each(['TARJETA', 'TRANSFERENCIA'])(
    'registra un abono por %s',
    async (metodoPago) => {
      const { rutaAbonos } = await prepararAbono();
      const respuesta = await request(app.getHttpServer())
        .post(rutaAbonos)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ monto: '0.10', metodoPago, referenciaPago: 'REF-001' })
        .expect(201);
      expect(respuesta.body).toMatchObject({
        monto: '0.1',
        saldoNuevo: '288.55',
        metodoPago,
        referenciaPago: 'REF-001',
      });
    },
  );

  it('mantiene VENCIDO con saldo y cambia a PAGADO al liquidar; bloquea creditos cancelados y ventas anuladas', async () => {
    const { rutaAbonos } = await prepararAbono();
    const http = request(app.getHttpServer());
    fixture.estado().creditos[0].fechaVencimiento = new Date('2000-01-01');
    await http
      .post(rutaAbonos)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ monto: '0.10' })
      .expect(201);
    expect(fixture.estado().creditos[0].estado).toBe('VENCIDO');
    fixture.estado().creditos[0].estado = 'CANCELADO';
    await http
      .post(rutaAbonos)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ monto: '1' })
      .expect(409);
    fixture.estado().creditos[0].estado = 'VENCIDO';
    fixture.estado().ventas[0].estado = 'ANULADA';
    await http
      .post(rutaAbonos)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ monto: '1' })
      .expect(409);
    fixture.estado().ventas[0].estado = 'COMPLETADA';
    await http
      .post(rutaAbonos)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ monto: '288.55' })
      .expect(201);
    expect(fixture.estado().creditos[0].estado).toBe('PAGADO');
  });

  it('revierte el saldo si falla el comprobante y reintenta conflictos sin duplicar abonos', async () => {
    const { rutaAbonos } = await prepararAbono();
    const fallo = (code: string) =>
      new Prisma.PrismaClientKnownRequestError('Fallo simulado', {
        code,
        clientVersion: '7',
      });
    const cobrar = () =>
      request(app.getHttpServer())
        .post(rutaAbonos)
        .set('x-usuario-prueba', 'usuario-1')
        .send({ monto: '50' });
    fixture.db.abono.create.mockImplementationOnce(async () => {
      fixture.estado().abonos.push({ id: 'incompleto' });
      throw fallo('P2003');
    });
    await cobrar().expect(409);
    expect(fixture.estado().creditos[0].saldoPendiente.toString()).toBe(
      '288.65',
    );
    expect(fixture.estado().abonos).toEqual([]);
    fixture.db.credito.updateMany.mockResolvedValueOnce({ count: 0 });
    await cobrar().expect(409);
    expect(fixture.estado().abonos).toEqual([]);
    fixture.db.abono.create.mockRejectedValueOnce(fallo('P2034'));
    const tx = vi.spyOn(fixture.db, '$transaction');
    await cobrar().expect(201);
    expect(tx).toHaveBeenCalledTimes(2);
    expect(tx).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(fixture.estado().creditos[0].saldoPendiente.toString()).toBe(
      '238.65',
    );
    expect(fixture.estado().abonos).toHaveLength(1);
    tx.mockClear();
    fixture.db.abono.create.mockRejectedValue(fallo('P2034'));
    await cobrar().expect(409);
    expect(tx).toHaveBeenCalledTimes(3);
    expect(fixture.estado().creditos[0].saldoPendiente.toString()).toBe(
      '238.65',
    );
    expect(fixture.estado().abonos).toHaveLength(1);
    tx.mockRestore();
  });

  it('vuelve a leer la deuda tras un cobro concurrente e impide superar el saldo restante', async () => {
    const { rutaAbonos } = await prepararAbono();
    const fallo = new Prisma.PrismaClientKnownRequestError('Conflicto', {
      code: 'P2034',
      clientVersion: '7',
    });
    const tx = vi
      .spyOn(fixture.db, '$transaction')
      .mockImplementationOnce(async () => {
        const credito = fixture.estado().creditos[0];
        credito.saldoPendiente = new Prisma.Decimal('88.65');
        fixture
          .estado()
          .abonos.push({
            id: randomUUID(),
            empresaId: credito.empresaId,
            creditoId: credito.id,
            usuarioId: 'usuario-1',
            fecha: new Date(),
            monto: new Prisma.Decimal('200'),
            saldoAnterior: new Prisma.Decimal('288.65'),
            saldoNuevo: credito.saldoPendiente,
            metodoPago: 'EFECTIVO',
          });
        throw fallo;
      });
    await request(app.getHttpServer())
      .post(rutaAbonos)
      .set('x-usuario-prueba', 'usuario-1')
      .send({ monto: '150' })
      .expect(400);
    expect(tx).toHaveBeenCalledTimes(2);
    expect(fixture.estado().creditos[0].saldoPendiente.toString()).toBe(
      '88.65',
    );
    expect(fixture.estado().abonos).toHaveLength(1);
    tx.mockRestore();
  });

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
    fixture.estado().movimientos.push({
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
    fixture.estado().movimientos.push(
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
