import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InventarioService } from '../inventario/inventario.service.js';
import type { CreateDevolucionDto } from './dto/create-devolucion.dto.js';
import type { ListarDevolucionesDto } from './dto/listar-devoluciones.dto.js';

@Injectable()
export class DevolucionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventario: InventarioService,
  ) {}

  create(
    empresaId: string,
    usuarioId: string,
    ventaId: string,
    dto: CreateDevolucionDto,
  ) {
    return this.transaccion(async (tx) => {
      // La escritura serializa el alta con un cambio simultaneo de configuracion.
      const habilitada = await tx.empresa.updateMany({
        where: { id: empresaId, devolucionesHabilitadas: true },
        data: { devolucionesHabilitadas: true },
      });
      if (habilitada.count !== 1)
        throw new ForbiddenException(
          'Las devoluciones estan desactivadas para esta empresa.',
        );
      const venta = await tx.venta.findUnique({
        where: { empresaId_id: { empresaId, id: ventaId } },
        include: { detalles: true, credito: { select: { id: true } } },
      });
      if (!venta) throw new NotFoundException('Venta no encontrada.');
      if (venta.estado !== 'COMPLETADA' || venta.anuladaEn !== null)
        throw new ConflictException(
          'Solo se pueden devolver ventas completadas.',
        );
      if (venta.tipoVenta !== 'CONTADO' || venta.credito)
        throw new ConflictException(
          'Las devoluciones de ventas a credito aun no estan disponibles.',
        );
      const caja = await tx.sesionCaja.findUnique({
        where: { empresaId_id: { empresaId, id: venta.sesionCajaId } },
      });
      if (!caja || caja.estado !== 'ABIERTA')
        throw new ConflictException(
          'La caja original de la venta debe seguir abierta.',
        );
      const vigente = await tx.venta.updateMany({
        where: {
          empresaId,
          id: ventaId,
          estado: 'COMPLETADA',
          anuladaEn: null,
        },
        data: { estado: 'COMPLETADA' },
      });
      if (vigente.count !== 1)
        throw new ConflictException('La venta cambio durante la devolucion.');
      const anteriores = await tx.devolucion.findMany({
        where: { empresaId, ventaId },
        include: { detalles: true },
      });
      if (
        anteriores.some((d) => !['COMPLETADA', 'RECHAZADA'].includes(d.estado))
      )
        throw new ConflictException(
          'La venta tiene una devolucion pendiente de resolver.',
        );
      const devueltas = new Map<string, Prisma.Decimal>();
      for (const anterior of anteriores.filter(
        (d) => d.estado === 'COMPLETADA',
      )) {
        for (const detalle of anterior.detalles)
          devueltas.set(
            detalle.productoId,
            (devueltas.get(detalle.productoId) ?? new Prisma.Decimal(0)).plus(
              detalle.cantidad,
            ),
          );
      }
      const items = dto.detalles.map((item) => {
        const original = venta.detalles.find(
          (d) => d.productoId === item.productoId,
        );
        if (!original)
          throw new BadRequestException(
            'Un producto no pertenece a esta venta.',
          );
        const cantidad = new Prisma.Decimal(item.cantidad);
        const acumulada = (
          devueltas.get(item.productoId) ?? new Prisma.Decimal(0)
        ).plus(cantidad);
        if (
          !cantidad.greaterThan(0) ||
          acumulada.greaterThan(original.cantidad)
        )
          throw new BadRequestException(
            'La cantidad supera lo que queda por devolver de esta venta.',
          );
        devueltas.set(item.productoId, acumulada);
        return {
          empresaId,
          productoId: item.productoId,
          cantidad,
          estadoProducto: item.estadoProducto,
          reintegrarStock: item.estadoProducto === 'BUENO',
          costoUnidad: original.costoEnVenta,
        };
      });
      if (
        !venta.montoDescuento.isZero() ||
        venta.detalles.length === 0 ||
        !venta.subtotal.plus(venta.montoIVA).equals(venta.total) ||
        !venta.detalles
          .reduce((s, d) => s.plus(d.subtotal), new Prisma.Decimal(0))
          .equals(venta.subtotal)
      )
        throw new ConflictException(
          'Los importes originales de la venta no admiten este cambio.',
        );
      // Compara los articulos con su precio historico; no genera reembolsos.
      const subtotalDevuelto = items.reduce((suma, item) => {
        const original = venta.detalles.find(
          (d) => d.productoId === item.productoId,
        )!;
        return suma.plus(
          this.dinero(original.precioUnitario.times(item.cantidad)),
        );
      }, new Prisma.Decimal(0));
      const ivaDevuelto = venta.subtotal.isZero()
        ? new Prisma.Decimal(0)
        : this.dinero(
            venta.montoIVA.times(subtotalDevuelto).div(venta.subtotal),
          );
      const valorDisponible = this.dinero(subtotalDevuelto.plus(ivaDevuelto));
      const empresa = await tx.empresa.findUnique({ where: { id: empresaId } });
      if (
        !empresa ||
        empresa.porcentajeIva.isNegative() ||
        empresa.porcentajeIva.greaterThan(100)
      )
        throw new ConflictException('El IVA de la empresa no es valido.');
      const productos = await tx.producto.findMany({
        where: {
          empresaId,
          activo: true,
          id: { in: dto.productosCambio.map((item) => item.productoId) },
        },
      });
      if (productos.length !== dto.productosCambio.length)
        throw new BadRequestException(
          'Un producto de reemplazo no esta disponible en tu empresa.',
        );
      const existencias = await this.inventario.agregarExistencias(
        empresaId,
        productos,
        tx,
      );
      let subtotalCambio = new Prisma.Decimal(0);
      const cambios = dto.productosCambio.map((item) => {
        const producto = existencias.find((p) => p.id === item.productoId)!;
        const cantidad = new Prisma.Decimal(item.cantidad);
        const entrada =
          items.find(
            (i) => i.productoId === item.productoId && i.reintegrarStock,
          )?.cantidad ?? new Prisma.Decimal(0);
        if (producto.stockDisponible.plus(entrada).lessThan(cantidad))
          throw new ConflictException(
            'No hay stock suficiente para entregar el reemplazo.',
          );
        if (
          producto.precioBase.isNegative() ||
          producto.precioCosto.isNegative()
        )
          throw new ConflictException(
            'El producto de reemplazo tiene importes invalidos.',
          );
        subtotalCambio = subtotalCambio.plus(
          this.dinero(producto.precioBase.times(cantidad)),
        );
        return {
          productoId: item.productoId,
          cantidad,
          costoUnidad: producto.precioCosto,
        };
      });
      const valorCambio = this.dinero(
        subtotalCambio.plus(
          this.dinero(subtotalCambio.times(empresa.porcentajeIva).div(100)),
        ),
      );
      if (!valorCambio.equals(valorDisponible))
        throw new BadRequestException(
          'El reemplazo debe tener exactamente el mismo valor, IVA incluido. No se cobra ni devuelve diferencia.',
        );
      const devolucion = await tx.devolucion.create({
        data: {
          empresaId,
          ventaId,
          usuarioId,
          tipo: 'CLIENTE',
          estado: 'COMPLETADA',
          motivo: dto.motivo,
          detalles: {
            create: items.map(({ costoUnidad: _costo, ...item }) => item),
          },
        },
        include: { detalles: true },
      });
      const entradas = items
        .filter((item) => item.reintegrarStock)
        .map((item) => ({
          empresaId,
          usuarioId,
          ventaId,
          devolucionId: devolucion.id,
          productoId: item.productoId,
          tipo: 'DEVOLUCION_CLIENTE' as const,
          cantidad: item.cantidad,
          costoUnidad: item.costoUnidad,
          nota: `Devolucion ${venta.numeroFactura}: ${dto.motivo}`,
        }));
      const salidas = cambios.map((item) => ({
        empresaId,
        usuarioId,
        ventaId,
        devolucionId: devolucion.id,
        productoId: item.productoId,
        tipo: 'DEVOLUCION_CLIENTE' as const,
        cantidad: item.cantidad.negated(),
        costoUnidad: item.costoUnidad,
        nota: `Cambio de producto ${venta.numeroFactura}: ${dto.motivo}`,
      }));
      await tx.movimientoAlmacen.createMany({
        data: [...entradas, ...salidas],
      });
      const actualizada = await tx.sesionCaja.updateMany({
        where: {
          empresaId,
          id: caja.id,
          estado: 'ABIERTA',
        },
        data: {
          estado: 'ABIERTA',
        },
      });
      if (actualizada.count !== 1)
        throw new ConflictException('La caja cambio durante la devolucion.');
      return {
        ...devolucion,
        productosCambio: cambios.map(
          ({ costoUnidad: _costo, ...item }) => item,
        ),
      };
    });
  }

  async findAll(
    empresaId: string,
    ventaId: string,
    { pagina, limite }: ListarDevolucionesDto,
  ) {
    const venta = await this.prisma.venta.findUnique({
      where: { empresaId_id: { empresaId, id: ventaId } },
      select: { id: true },
    });
    if (!venta) throw new NotFoundException('Venta no encontrada.');
    const datos = await this.prisma.devolucion.findMany({
      where: { empresaId, ventaId },
      include: { detalles: true, movimientos: true },
      orderBy: [{ creadoEn: 'desc' }, { id: 'asc' }],
      skip: (pagina - 1) * limite,
      take: limite,
    });
    return {
      datos,
      pagina,
      limite,
    };
  }

  private dinero(valor: Prisma.Decimal) {
    const importe = valor.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    if (
      !importe.isFinite() ||
      importe.isNegative() ||
      importe.greaterThan('999999999999.99')
    )
      throw new ConflictException('El importe de devolucion no es valido.');
    return importe;
  }

  private async transaccion<T>(
    operacion: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let intento = 0; intento < 3; intento++) {
      try {
        return await this.prisma.$transaction(operacion, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2034' && intento < 2) continue;
          if (['P2034', 'P2003', 'P2025'].includes(error.code))
            throw new ConflictException(
              'La devolucion no se pudo completar por un cambio simultaneo. Consulta el historial antes de reintentar.',
            );
        }
        throw error;
      }
    }
    throw new ConflictException('No se pudo registrar la devolucion.');
  }
}
