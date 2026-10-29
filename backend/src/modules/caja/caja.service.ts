import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateCajaDto } from './dto/create-caja.dto.js';
import type { ListarCajasDto } from './dto/listar-cajas.dto.js';
import type { CerrarCajaDto } from './dto/cerrar-caja.dto.js';

@Injectable()
export class CajaService {
  constructor(private readonly prisma: PrismaService) {}

  create(empresaId: string, usuarioId: string, dto: CreateCajaDto) {
    return this.transaccion(async (tx) => {
      const abierta = await tx.sesionCaja.findFirst({
        where: { empresaId, abiertoPorId: usuarioId, estado: 'ABIERTA' },
      });
      if (abierta) throw new ConflictException('Ya tienes una caja abierta.');
      return tx.sesionCaja.create({
        data: {
          empresaId,
          abiertoPorId: usuarioId,
          estado: 'ABIERTA',
          efectivoInicial: new Prisma.Decimal(dto.efectivoInicial),
          notas: dto.notas,
        },
      });
    });
  }

  async findAll(
    empresaId: string,
    usuarioId: string,
    esAdmin: boolean,
    { pagina, limite, estado }: ListarCajasDto,
  ) {
    const datos = await this.prisma.sesionCaja.findMany({
      where: {
        empresaId,
        abiertoPorId: esAdmin ? undefined : usuarioId,
        estado,
      },
      orderBy: [{ abiertoEn: 'desc' }, { id: 'asc' }],
      skip: (pagina - 1) * limite,
      take: limite,
    });
    return { datos, pagina, limite };
  }

  async findActual(empresaId: string, usuarioId: string) {
    const caja = await this.prisma.sesionCaja.findFirst({
      where: { empresaId, abiertoPorId: usuarioId, estado: 'ABIERTA' },
    });
    if (!caja) throw new NotFoundException('No tienes una caja abierta.');
    return caja;
  }

  async findOne(
    empresaId: string,
    usuarioId: string,
    esAdmin: boolean,
    id: string,
  ) {
    const caja = await this.prisma.sesionCaja.findUnique({
      where: {
        empresaId_id: { empresaId, id },
        abiertoPorId: esAdmin ? undefined : usuarioId,
      },
    });
    if (!caja) throw new NotFoundException('Caja no encontrada.');
    return caja;
  }

  async arqueo(
    empresaId: string,
    usuarioId: string,
    esAdmin: boolean,
    id: string,
  ) {
    const caja = await this.findOne(empresaId, usuarioId, esAdmin, id);
    return {
      ...caja,
      efectivoEsperado:
        caja.estado === 'ABIERTA'
          ? this.calcularEsperado(caja.efectivoInicial, caja.totalEfectivo)
          : caja.efectivoEsperado,
    };
  }

  cerrar(
    empresaId: string,
    usuarioId: string,
    esAdmin: boolean,
    id: string,
    dto: CerrarCajaDto,
  ) {
    return this.transaccion(async (tx) => {
      const caja = await tx.sesionCaja.findUnique({
        where: {
          empresaId_id: { empresaId, id },
          abiertoPorId: esAdmin ? undefined : usuarioId,
        },
      });
      if (!caja) throw new NotFoundException('Caja no encontrada.');
      if (caja.estado !== 'ABIERTA')
        throw new ConflictException('La caja ya esta cerrada.');
      const efectivoEsperado = this.calcularEsperado(
        caja.efectivoInicial,
        caja.totalEfectivo,
      );
      const efectivoCierre = new Prisma.Decimal(dto.efectivoCierre);
      const diferencia = efectivoCierre.minus(efectivoEsperado);
      const notas =
        dto.notas === undefined
          ? caja.notas
          : [caja.notas, `Cierre: ${dto.notas}`].filter(Boolean).join('\n');
      const actualizada = await tx.sesionCaja.updateMany({
        // El estado y los acumulados deben seguir siendo los que acabamos de leer.
        where: {
          empresaId,
          id,
          abiertoPorId: esAdmin ? undefined : usuarioId,
          estado: 'ABIERTA',
          totalEfectivo: caja.totalEfectivo,
          cantidadVentas: caja.cantidadVentas,
        },
        data: {
          estado: 'CERRADA',
          cerradoPorId: usuarioId,
          cerradoEn: new Date(),
          efectivoCierre,
          efectivoEsperado,
          diferencia,
          notas,
        },
      });
      if (actualizada.count !== 1)
        throw new ConflictException(
          'La caja cambio durante el cierre. Vuelve a consultarla.',
        );
      return tx.sesionCaja.findUniqueOrThrow({
        where: { empresaId_id: { empresaId, id } },
      });
    });
  }

  private calcularEsperado(inicial: Prisma.Decimal, cobrado: Prisma.Decimal) {
    const esperado = inicial.plus(cobrado);
    if (
      !esperado.isFinite() ||
      esperado.isNegative() ||
      esperado.greaterThan('999999999999.99')
    ) {
      throw new BadRequestException(
        'El efectivo esperado excede el rango monetario permitido.',
      );
    }
    return esperado;
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
              'La operacion de caja no se pudo completar por un cambio simultaneo. Vuelve a intentarlo.',
            );
          }
          if (error.code === 'P2003')
            throw new ConflictException(
              'El usuario o su empresa ya no estan disponibles.',
            );
          if (error.code === 'P2025')
            throw new NotFoundException('Caja no encontrada.');
        }
        throw error;
      }
    }
    throw new ConflictException('No se pudo completar la operacion de caja.');
  }
}
