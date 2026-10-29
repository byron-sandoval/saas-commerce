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
import type { CreateVentaDto } from './dto/create-venta.dto.js';
import type { ListarVentasDto } from './dto/listar-ventas.dto.js';
import type { AnularVentaDto } from './dto/anular-venta.dto.js';
import { CreditosService } from '../creditos/creditos.service.js';

@Injectable()
export class VentasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventario: InventarioService,
    private readonly creditos: CreditosService,
  ) {}

  create(
    empresaId: string,
    usuarioId: string,
    dto: CreateVentaDto,
    puedeCrearCredito = false,
  ) {
    const esCredito = dto.tipoVenta === 'CREDITO';
    if (esCredito && !puedeCrearCredito)
      throw new ForbiddenException(
        'Solo ADMIN puede otorgar ventas a credito.',
      );
    if (
      esCredito &&
      (dto.metodoPago !== undefined ||
        dto.importeRecibido !== undefined ||
        dto.referenciaPago !== undefined)
    ) {
      throw new BadRequestException(
        'Una venta a credito no recibe pago inicial en esta etapa. No envies metodoPago, importeRecibido ni referenciaPago.',
      );
    }
    if (!esCredito && dto.credito !== undefined)
      throw new BadRequestException(
        'Las condiciones de credito solo se aceptan en ventas a credito.',
      );
    const metodoPago = esCredito ? null : (dto.metodoPago ?? 'EFECTIVO');
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
        select: { id: true, esGenerico: true },
      });
      if (!cliente)
        throw new BadRequestException(
          'El cliente no esta disponible en tu empresa.',
        );
      if (esCredito && cliente.esGenerico)
        throw new BadRequestException(
          'No se puede otorgar credito al cliente generico.',
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
      if (metodoPago !== 'EFECTIVO' && dto.importeRecibido !== undefined) {
        throw new BadRequestException(
          'importeRecibido solo se utiliza para pagos en efectivo.',
        );
      }
      const importeRecibido =
        metodoPago === 'EFECTIVO'
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
      const campoPago = esCredito
        ? 'totalCredito'
        : metodoPago === 'EFECTIVO'
          ? 'totalEfectivo'
          : metodoPago === 'TARJETA'
            ? 'totalTarjeta'
            : 'totalTransfer';
      this.dinero(caja.totalVentas.plus(total));
      this.dinero(caja[campoPago].plus(total));
      if (metodoPago === 'EFECTIVO') {
        this.dinero(caja.efectivoInicial.plus(caja.totalEfectivo).plus(total));
      }
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
          metodoPago,
          tipoVenta: esCredito ? 'CREDITO' : 'CONTADO',
          referenciaPago: dto.referenciaPago,
          importeRecibido,
          cambio,
          estado: 'COMPLETADA',
          detalles: { create: detalles },
        },
        include: { detalles: true, credito: true },
      });
      const credito = esCredito
        ? await this.creditos.crearDesdeVenta(tx, venta, dto.credito)
        : null;
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
      return { ...venta, credito };
    });
  }

  anular(
    empresaId: string,
    usuarioId: string,
    id: string,
    dto: AnularVentaDto,
  ) {
    return this.transaccion(async (tx) => {
      const venta = await tx.venta.findUnique({
        where: { empresaId_id: { empresaId, id } },
        include: {
          detalles: true,
          credito: { select: { id: true } },
          devoluciones: { select: { id: true } },
          movimientos: { where: { tipo: 'VENTA' } },
        },
      });
      if (!venta) throw new NotFoundException('Venta no encontrada.');
      if (venta.estado !== 'COMPLETADA' || venta.anuladaEn !== null) {
        throw new ConflictException(
          'La venta ya esta anulada o no se puede anular.',
        );
      }
      if (venta.credito || venta.devoluciones.length > 0) {
        throw new ConflictException(
          'Las ventas con credito o devoluciones vinculadas requieren un flujo de anulacion especifico.',
        );
      }
      const caja = await tx.sesionCaja.findUnique({
        where: { empresaId_id: { empresaId, id: venta.sesionCajaId } },
      });
      if (!caja || caja.estado !== 'ABIERTA') {
        throw new ConflictException(
          'Solo se pueden anular ventas cuya caja sigue abierta.',
        );
      }
      const campoPago =
        venta.metodoPago === 'EFECTIVO'
          ? 'totalEfectivo'
          : venta.metodoPago === 'TARJETA'
            ? 'totalTarjeta'
            : venta.metodoPago === 'TRANSFERENCIA'
              ? 'totalTransfer'
              : null;
      if (
        !campoPago ||
        !venta.total.isFinite() ||
        venta.total.isNegative() ||
        caja.totalVentas.lessThan(venta.total) ||
        caja[campoPago].lessThan(venta.total) ||
        caja.cantidadVentas < 1
      ) {
        throw new ConflictException(
          'Los acumulados de caja no permiten revertir esta venta.',
        );
      }
      // Comprueba las salidas originales antes de generar sus movimientos inversos.
      const salidas = new Map<string, Prisma.Decimal>();
      for (const movimiento of venta.movimientos) {
        if (!movimiento.cantidad.isNegative())
          throw new ConflictException(
            'La venta tiene movimientos de inventario inconsistentes.',
          );
        salidas.set(
          movimiento.productoId,
          (salidas.get(movimiento.productoId) ?? new Prisma.Decimal(0)).minus(
            movimiento.cantidad,
          ),
        );
      }
      if (
        venta.detalles.length === 0 ||
        salidas.size !== venta.detalles.length ||
        venta.detalles.some(
          (detalle) =>
            !detalle.cantidad.greaterThan(0) ||
            !salidas.get(detalle.productoId)?.equals(detalle.cantidad),
        )
      )
        throw new ConflictException(
          'Las salidas de inventario no coinciden con los detalles de la venta.',
        );
      const anulada = await tx.venta.updateMany({
        where: { empresaId, id, estado: 'COMPLETADA', anuladaEn: null },
        data: {
          estado: 'ANULADA',
          anuladaPorId: usuarioId,
          anuladaEn: new Date(),
          motivoAnulacion: dto.motivo,
        },
      });
      if (anulada.count !== 1)
        throw new ConflictException('La venta ya fue modificada o anulada.');
      await tx.movimientoAlmacen.createMany({
        data: venta.movimientos.map((movimiento) => ({
          empresaId,
          usuarioId,
          ventaId: id,
          productoId: movimiento.productoId,
          tipo: 'ANULACION_VENTA' as const,
          cantidad: movimiento.cantidad.negated(),
          costoUnidad: movimiento.costoUnidad,
          nota: `Anulacion ${venta.numeroFactura}: ${dto.motivo}`,
        })),
      });
      const actualizada = await tx.sesionCaja.updateMany({
        where: {
          empresaId,
          id: caja.id,
          estado: 'ABIERTA',
          cantidadVentas: caja.cantidadVentas,
          totalVentas: caja.totalVentas,
          [campoPago]: caja[campoPago],
        },
        data: {
          totalVentas: { increment: venta.total.negated() },
          [campoPago]: { increment: venta.total.negated() },
          cantidadVentas: { increment: -1 },
        },
      });
      if (actualizada.count !== 1)
        throw new ConflictException(
          'La caja cambio durante la anulacion. Vuelve a consultarla.',
        );
      return tx.venta.findUniqueOrThrow({
        where: { empresaId_id: { empresaId, id } },
        include: { detalles: true },
      });
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
      include: { detalles: true, credito: true },
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
