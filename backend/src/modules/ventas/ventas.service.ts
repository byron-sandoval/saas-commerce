import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InventarioService } from '../inventario/inventario.service.js';
import type { CreateVentaDto } from './dto/create-venta.dto.js';
import type { ListarVentasDto } from './dto/listar-ventas.dto.js';

@Injectable()
export class VentasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventario: InventarioService,
  ) {}

  create(empresaId: string, usuarioId: string, dto: CreateVentaDto) {
    return this.transaccion(async (tx) => {
      const caja = await tx.sesionCaja.findFirst({
        where: { empresaId, abiertoPorId: usuarioId, estado: 'ABIERTA' },
      });
      if (!caja)
        throw new ConflictException(
          'Debes abrir tu propia caja antes de registrar ventas.',
        );
      const cliente = await tx.cliente.findUnique({
        where: { empresaId_id: { empresaId, id: dto.clienteId }, activo: true },
        select: { id: true },
      });
      if (!cliente)
        throw new BadRequestException(
          'El cliente no esta disponible en tu empresa.',
        );
      const empresa = await tx.empresa.findUnique({
        where: { id: empresaId, estado: 'ACTIVA' },
        select: { porcentajeIva: true },
      });
      if (
        !empresa ||
        empresa.porcentajeIva.isNegative() ||
        empresa.porcentajeIva.greaterThan(100)
      ) {
        throw new BadRequestException(
          'La empresa no tiene un porcentaje de IVA valido.',
        );
      }
      const productos = await tx.producto.findMany({
        where: {
          empresaId,
          activo: true,
          id: { in: dto.detalles.map((detalle) => detalle.productoId) },
        },
      });
      if (productos.length !== dto.detalles.length)
        throw new BadRequestException(
          'Uno de los productos no esta disponible en tu empresa.',
        );
      // La lectura del stock debe usar la misma transaccion que registra las salidas.
      const existencias = await this.inventario.agregarExistencias(
        empresaId,
        productos,
        tx,
      );
      const porId = new Map(
        existencias.map((producto) => [producto.id, producto]),
      );
      const detalles = dto.detalles.map((detalle) => {
        const producto = porId.get(detalle.productoId)!;
        const cantidad = new Prisma.Decimal(detalle.cantidad);
        if (producto.stockDisponible.lessThan(cantidad)) {
          throw new ConflictException(
            `Existencias insuficientes para el producto ${producto.sku}.`,
          );
        }
        if (
          producto.precioBase.isNegative() ||
          producto.precioCosto.isNegative()
        ) {
          throw new BadRequestException(
            'Uno de los productos tiene un precio o costo invalido.',
          );
        }
        return {
          productoId: producto.id,
          cantidad,
          precioUnitario: producto.precioBase,
          costoEnVenta: producto.precioCosto,
          subtotal: this.dinero(producto.precioBase.times(cantidad)),
        };
      });
      const subtotal = this.dinero(
        detalles.reduce(
          (suma, detalle) => suma.plus(detalle.subtotal),
          new Prisma.Decimal(0),
        ),
      );
      const montoIVA = this.dinero(
        subtotal.times(empresa.porcentajeIva).dividedBy(100),
      );
      const total = this.dinero(subtotal.plus(montoIVA));
      if (dto.metodoPago !== 'EFECTIVO' && dto.importeRecibido !== undefined) {
        throw new BadRequestException(
          'importeRecibido solo se utiliza para pagos en efectivo.',
        );
      }
      const importeRecibido =
        dto.metodoPago === 'EFECTIVO'
          ? new Prisma.Decimal(dto.importeRecibido ?? total)
          : null;
      if (importeRecibido && importeRecibido.lessThan(total)) {
        throw new BadRequestException(
          'El importe recibido no cubre el total de la venta.',
        );
      }
      const cambio = importeRecibido
        ? this.dinero(importeRecibido.minus(total))
        : null;
      const campoPago =
        dto.metodoPago === 'EFECTIVO'
          ? 'totalEfectivo'
          : dto.metodoPago === 'TARJETA'
            ? 'totalTarjeta'
            : 'totalTransfer';
      this.dinero(caja.totalVentas.plus(total));
      this.dinero(caja[campoPago].plus(total));
      const secuencia = await tx.secuencia.upsert({
        where: { empresaId_tipo: { empresaId, tipo: 'FACTURA' } },
        create: { empresaId, tipo: 'FACTURA', prefijo: 'F-', ultimoValor: 1 },
        update: { ultimoValor: { increment: 1 } },
      });
      const venta = await tx.venta.create({
        data: {
          empresaId,
          usuarioId,
          sesionCajaId: caja.id,
          clienteId: cliente.id,
          numeroFactura: `${secuencia.prefijo}${String(secuencia.ultimoValor).padStart(4, '0')}`,
          subtotal,
          montoIVA,
          montoDescuento: new Prisma.Decimal(0),
          total,
          metodoPago: dto.metodoPago,
          referenciaPago: dto.referenciaPago,
          importeRecibido,
          cambio,
          estado: 'COMPLETADA',
          detalles: { create: detalles },
        },
        include: { detalles: true },
      });
      await tx.movimientoAlmacen.createMany({
        data: detalles.map((detalle) => ({
          empresaId,
          usuarioId,
          productoId: detalle.productoId,
          tipo: 'VENTA' as const,
          cantidad: detalle.cantidad.negated(),
          costoUnidad: detalle.costoEnVenta,
          ventaId: venta.id,
          nota: `Venta ${venta.numeroFactura}`,
        })),
      });
      const actualizada = await tx.sesionCaja.updateMany({
        where: {
          empresaId,
          id: caja.id,
          abiertoPorId: usuarioId,
          estado: 'ABIERTA',
        },
        data: {
          totalVentas: { increment: total },
          [campoPago]: { increment: total },
          cantidadVentas: { increment: 1 },
        },
      });
      if (actualizada.count !== 1)
        throw new ConflictException('La caja ya no esta abierta.');
      return venta;
    });
  }

  async findAll(
    empresaId: string,
    usuarioId: string,
    esAdmin: boolean,
    { pagina, limite, estado }: ListarVentasDto,
  ) {
    const datos = await this.prisma.venta.findMany({
      where: { empresaId, usuarioId: esAdmin ? undefined : usuarioId, estado },
      orderBy: [{ creadoEn: 'desc' }, { id: 'asc' }],
      skip: (pagina - 1) * limite,
      take: limite,
    });
    return { datos, pagina, limite };
  }

  async findOne(
    empresaId: string,
    usuarioId: string,
    esAdmin: boolean,
    id: string,
  ) {
    const venta = await this.prisma.venta.findUnique({
      where: {
        empresaId_id: { empresaId, id },
        usuarioId: esAdmin ? undefined : usuarioId,
      },
      include: { detalles: true },
    });
    if (!venta) throw new NotFoundException('Venta no encontrada.');
    return venta;
  }

  private dinero(valor: Prisma.Decimal) {
    const redondeado = valor.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    if (redondeado.isNegative() || redondeado.greaterThan('999999999999.99')) {
      throw new BadRequestException(
        'El importe excede el rango monetario permitido.',
      );
    }
    return redondeado;
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
          if (error.code === 'P2034' || error.code === 'P2002') {
            throw new ConflictException(
              'La venta no se pudo completar por un cambio simultaneo. Vuelve a intentarlo.',
            );
          }
          if (error.code === 'P2003' || error.code === 'P2025') {
            throw new ConflictException(
              'Un registro de la venta ya no esta disponible.',
            );
          }
        }
        throw error;
      }
    }
    throw new ConflictException('No se pudo registrar la venta.');
  }
}
