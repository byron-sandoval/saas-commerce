import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateCompraDto } from './dto/create-compra.dto.js';
import type { UpdateCompraDto } from './dto/update-compra.dto.js';
import type { ItemCompraDto } from './dto/item-compra.dto.js';
import type { ListarComprasDto } from './dto/listar-compras.dto.js';

@Injectable()
export class ComprasService {
  constructor(private readonly prisma: PrismaService) {}

  create(empresaId: string, usuarioId: string, dto: CreateCompraDto) {
    return this.transaccion(async (tx) => {
      await this.validarReferencias(tx, empresaId, dto);
      const secuencia = await tx.secuencia.upsert({
        where: { empresaId_tipo: { empresaId, tipo: 'ORDEN_COMPRA' } },
        create: {
          empresaId,
          tipo: 'ORDEN_COMPRA',
          prefijo: 'OC-',
          ultimoValor: 1,
        },
        update: { ultimoValor: { increment: 1 } },
      });
      return tx.ordenCompra.create({
        data: {
          empresaId,
          usuarioId,
          proveedorId: dto.proveedorId,
          numeroOrden: `${secuencia.prefijo}${String(secuencia.ultimoValor).padStart(6, '0')}`,
          estado: 'BORRADOR',
          fechaEntregaEst: dto.fechaEntregaEst
            ? new Date(dto.fechaEntregaEst)
            : null,
          nota: dto.nota,
          items: { create: this.datosItems(dto.items) },
        },
        include: { items: true },
      });
    });
  }

  async findAll(
    empresaId: string,
    { pagina, limite, estado }: ListarComprasDto,
  ) {
    const datos = await this.prisma.ordenCompra.findMany({
      where: { empresaId, estado },
      orderBy: [{ creadoEn: 'desc' }, { id: 'asc' }],
      skip: (pagina - 1) * limite,
      take: limite,
    });
    return { datos, pagina, limite };
  }

  async findOne(empresaId: string, id: string) {
    const orden = await this.prisma.ordenCompra.findUnique({
      where: { empresaId_id: { empresaId, id } },
      include: { items: true },
    });
    if (!orden) throw new NotFoundException('Orden de compra no encontrada.');
    return orden;
  }

  update(empresaId: string, id: string, dto: UpdateCompraDto) {
    return this.transaccion(async (tx) => {
      await this.exigirBorrador(tx, empresaId, id);
      await this.validarReferencias(tx, empresaId, dto);
      return tx.ordenCompra.update({
        where: { empresaId_id: { empresaId, id }, estado: 'BORRADOR' },
        data: {
          proveedorId: dto.proveedorId,
          nota: dto.nota,
          fechaEntregaEst:
            dto.fechaEntregaEst === undefined
              ? undefined
              : dto.fechaEntregaEst === null
                ? null
                : new Date(dto.fechaEntregaEst),
          // Reemplaza todos los detalles solo cuando el cliente envia items.
          items:
            dto.items === undefined
              ? undefined
              : {
                  deleteMany: { empresaId },
                  create: this.datosItems(dto.items),
                },
        },
        include: { items: true },
      });
    });
  }

  async remove(empresaId: string, id: string): Promise<void> {
    await this.transaccion(async (tx) => {
      await this.exigirBorrador(tx, empresaId, id);
      // Cancelar conserva el documento y no crea movimientos de almacen.
      await tx.ordenCompra.update({
        where: { empresaId_id: { empresaId, id }, estado: 'BORRADOR' },
        data: { estado: 'CANCELADA' },
      });
    });
  }

  recibir(empresaId: string, usuarioId: string, id: string) {
    return this.transaccion(async (tx) => {
      const orden = await tx.ordenCompra.findUnique({
        where: { empresaId_id: { empresaId, id } },
        include: { items: true },
      });
      if (!orden) throw new NotFoundException('Orden de compra no encontrada.');
      if (orden.estado !== 'BORRADOR') {
        throw new ConflictException(
          'Solo se puede recibir por completo una orden en BORRADOR y sin recepciones previas.',
        );
      }
      if (
        orden.items.length === 0 ||
        orden.items.some(
          (item) =>
            !item.cantidadSolicitada.greaterThan(0) ||
            !item.cantidadRecibida.isZero() ||
            item.costoUnitario.isNegative(),
        )
      ) {
        throw new ConflictException(
          'La orden no tiene detalles validos para una recepcion completa.',
        );
      }
      await this.validarReferencias(tx, empresaId, {
        proveedorId: orden.proveedorId,
        items: orden.items.map((item) => ({
          productoId: item.productoId,
          cantidadSolicitada: item.cantidadSolicitada.toString(),
          costoUnitario: item.costoUnitario.toString(),
        })),
      });
      // La transicion condicional impide que dos solicitudes reciban la misma orden.
      const cambio = await tx.ordenCompra.updateMany({
        where: { empresaId, id, estado: 'BORRADOR' },
        data: { estado: 'RECIBIDA' },
      });
      if (cambio.count !== 1) {
        throw new ConflictException('La orden ya fue modificada o recibida.');
      }
      await tx.movimientoAlmacen.createMany({
        data: orden.items.map((item) => ({
          empresaId,
          usuarioId,
          ordenCompraId: id,
          proveedorId: orden.proveedorId,
          productoId: item.productoId,
          tipo: 'COMPRA' as const,
          cantidad: item.cantidadSolicitada,
          costoUnidad: item.costoUnitario,
          nota: `Recepcion completa de ${orden.numeroOrden}`,
        })),
      });
      // Copia los decimales en SQL en una sola operacion, sin redondearlos en JS.
      const actualizados = await tx.$executeRaw`
        UPDATE "ItemOrdenCompra"
        SET "cantidadRecibida" = "cantidadSolicitada"
        WHERE "empresaId" = ${empresaId} AND "ordenCompraId" = ${id}
          AND "cantidadRecibida" = 0
      `;
      if (actualizados !== orden.items.length) {
        throw new ConflictException(
          'Los detalles de la orden cambiaron durante la recepcion.',
        );
      }
      return tx.ordenCompra.findUniqueOrThrow({
        where: { empresaId_id: { empresaId, id } },
        include: { items: true },
      });
    });
  }

  private async exigirBorrador(
    tx: Prisma.TransactionClient,
    empresaId: string,
    id: string,
  ) {
    const orden = await tx.ordenCompra.findUnique({
      where: { empresaId_id: { empresaId, id } },
      select: { estado: true },
    });
    if (!orden) throw new NotFoundException('Orden de compra no encontrada.');
    if (orden.estado !== 'BORRADOR') {
      throw new ConflictException(
        'Solo se puede editar o cancelar una orden en BORRADOR.',
      );
    }
  }

  private async validarReferencias(
    tx: Prisma.TransactionClient,
    empresaId: string,
    dto: UpdateCompraDto,
  ) {
    if (dto.proveedorId !== undefined) {
      const proveedor = await tx.proveedor.findUnique({
        where: {
          empresaId_id: { empresaId, id: dto.proveedorId },
          activo: true,
        },
        select: { id: true },
      });
      if (!proveedor)
        throw new BadRequestException(
          'El proveedor no esta disponible en tu empresa.',
        );
    }
    if (dto.items !== undefined) {
      const productos = await tx.producto.findMany({
        where: {
          empresaId,
          activo: true,
          id: { in: dto.items.map((item) => item.productoId) },
        },
        select: { id: true },
      });
      if (productos.length !== dto.items.length)
        throw new BadRequestException(
          'Uno de los productos no esta disponible en tu empresa.',
        );
    }
  }

  private datosItems(items: ItemCompraDto[]) {
    return items.map((item) => ({
      productoId: item.productoId,
      cantidadSolicitada: new Prisma.Decimal(item.cantidadSolicitada),
      costoUnitario: new Prisma.Decimal(item.costoUnitario),
      nota: item.nota,
    }));
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
              'La orden cambio durante la operacion. Vuelve a intentarlo.',
            );
          }
          if (error.code === 'P2025')
            throw new NotFoundException(
              'Orden de compra no encontrada o ya modificada.',
            );
          if (error.code === 'P2003')
            throw new BadRequestException(
              'Una referencia de la orden ya no esta disponible.',
            );
        }
        throw error;
      }
    }
    throw new ConflictException('No se pudo completar la operacion.');
  }
}
