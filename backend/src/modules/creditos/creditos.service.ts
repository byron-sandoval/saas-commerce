import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { Venta } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateCreditoDto } from './dto/create-credito.dto.js';
import type { ListarCreditosDto } from './dto/listar-creditos.dto.js';
import type { CreateAbonoDto } from './dto/create-abono.dto.js';
import type { ListarAbonosDto } from './dto/listar-abonos.dto.js';

@Injectable()
export class CreditosService {
  constructor(private readonly prisma: PrismaService) {}

  cobrarAbono(
    empresaId: string,
    usuarioId: string,
    creditoId: string,
    dto: CreateAbonoDto,
  ) {
    const monto = new Prisma.Decimal(dto.monto);
    if (
      !monto.isFinite() ||
      !monto.greaterThan(0) ||
      monto.greaterThan('999999999999.99')
    )
      throw new BadRequestException(
        'El monto debe ser positivo y estar dentro del rango monetario.',
      );

    return this.transaccion(async (tx) => {
      const credito = await tx.credito.findUnique({
        where: { empresaId_id: { empresaId, id: creditoId } },
        include: { venta: { select: { estado: true } } },
      });
      if (!credito) throw new NotFoundException('Credito no encontrado.');
      if (
        !['PENDIENTE', 'VENCIDO'].includes(credito.estado) ||
        !credito.saldoPendiente.isFinite() ||
        !credito.saldoPendiente.greaterThan(0) ||
        credito.saldoPendiente.greaterThan(credito.montoOriginal)
      )
        throw new ConflictException('El credito no admite nuevos abonos.');
      if (credito.ventaId && credito.venta?.estado !== 'COMPLETADA')
        throw new ConflictException(
          'La venta vinculada al credito no esta vigente.',
        );
      if (monto.greaterThan(credito.saldoPendiente))
        throw new BadRequestException(
          'El abono no puede superar el saldo pendiente.',
        );

      const caja = await tx.sesionCaja.findFirst({
        where: { empresaId, abiertoPorId: usuarioId, estado: 'ABIERTA' },
      });
      if (!caja)
        throw new ConflictException(
          'Debes abrir tu propia caja antes de cobrar abonos.',
        );

      const saldoAnterior = credito.saldoPendiente;
      const saldoNuevo = saldoAnterior.minus(monto);
      const vencido =
        credito.estado === 'VENCIDO' ||
        (credito.fechaVencimiento !== null &&
          credito.fechaVencimiento.getTime() <= Date.now());
      const actualizado = await tx.credito.updateMany({
        where: {
          empresaId,
          id: creditoId,
          estado: credito.estado,
          saldoPendiente: saldoAnterior,
        },
        data: {
          saldoPendiente: saldoNuevo,
          estado: saldoNuevo.isZero()
            ? 'PAGADO'
            : vencido
              ? 'VENCIDO'
              : 'PENDIENTE',
        },
      });
      if (actualizado.count !== 1)
        throw new ConflictException(
          'El saldo cambio durante el cobro. Vuelve a consultarlo.',
        );

      // La estructura actual no vincula Abono con SesionCaja; no altera sus totales.
      return tx.abono.create({
        data: {
          empresaId,
          creditoId,
          usuarioId,
          monto,
          saldoAnterior,
          saldoNuevo,
          metodoPago: dto.metodoPago,
          referenciaPago: dto.referenciaPago,
          descripcion: dto.descripcion,
        },
      });
    });
  }

  async listarAbonos(
    empresaId: string,
    creditoId: string,
    { pagina, limite }: ListarAbonosDto,
  ) {
    const credito = await this.prisma.credito.findUnique({
      where: { empresaId_id: { empresaId, id: creditoId } },
      select: { id: true },
    });
    if (!credito) throw new NotFoundException('Credito no encontrado.');
    const datos = await this.prisma.abono.findMany({
      where: { empresaId, creditoId },
      orderBy: [{ fecha: 'desc' }, { id: 'asc' }],
      skip: (pagina - 1) * limite,
      take: limite,
    });
    return { datos, pagina, limite };
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
              'No se pudo completar el abono por un cambio simultaneo. Consulta el saldo antes de intentarlo otra vez.',
            );
        }
        throw error;
      }
    }
    throw new ConflictException('No se pudo registrar el abono.');
  }

  crearDesdeVenta(
    tx: Prisma.TransactionClient,
    venta: Pick<
      Venta,
      'id' | 'empresaId' | 'clienteId' | 'total' | 'numeroFactura'
    >,
    dto: CreateCreditoDto = {},
  ) {
    if (!venta.total.greaterThan(0))
      throw new BadRequestException(
        'Una venta a credito debe tener un total mayor que cero.',
      );
    const fechaVencimiento =
      dto.fechaVencimiento === undefined
        ? null
        : new Date(dto.fechaVencimiento);
    if (
      fechaVencimiento &&
      (Number.isNaN(fechaVencimiento.getTime()) ||
        fechaVencimiento.getTime() <= Date.now())
    ) {
      throw new BadRequestException('La fecha de vencimiento debe ser futura.');
    }
    return tx.credito.create({
      data: {
        empresaId: venta.empresaId,
        clienteId: venta.clienteId,
        ventaId: venta.id,
        montoOriginal: venta.total,
        saldoPendiente: venta.total,
        estado: 'PENDIENTE',
        fechaVencimiento,
        descripcion: dto.descripcion ?? `Venta ${venta.numeroFactura}`,
      },
    });
  }

  async findAll(
    empresaId: string,
    { pagina, limite, estado, clienteId }: ListarCreditosDto,
  ) {
    const datos = await this.prisma.credito.findMany({
      where: { empresaId, estado, clienteId },
      orderBy: [{ fechaCredito: 'desc' }, { id: 'asc' }],
      skip: (pagina - 1) * limite,
      take: limite,
      include: {
        cliente: { select: { id: true, nombre: true } },
        venta: { select: { id: true, numeroFactura: true, estado: true } },
      },
    });
    return { datos, pagina, limite };
  }

  async findOne(empresaId: string, id: string) {
    const credito = await this.prisma.credito.findUnique({
      where: { empresaId_id: { empresaId, id } },
      include: {
        cliente: { select: { id: true, nombre: true } },
        venta: { select: { id: true, numeroFactura: true, estado: true } },
      },
    });
    if (!credito) throw new NotFoundException('Credito no encontrado.');
    return credito;
  }
}
