import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { Venta } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateCreditoDto } from './dto/create-credito.dto.js';
import type { ListarCreditosDto } from './dto/listar-creditos.dto.js';

@Injectable()
export class CreditosService {
  constructor(private readonly prisma: PrismaService) {}

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
