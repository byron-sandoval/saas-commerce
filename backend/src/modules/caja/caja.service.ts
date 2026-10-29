import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateCajaDto } from './dto/create-caja.dto.js';
import type { ListarCajasDto } from './dto/listar-cajas.dto.js';

@Injectable()
export class CajaService {
  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: string, usuarioId: string, dto: CreateCajaDto) {
    for (let intento = 0; intento < 3; intento++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const abierta = await tx.sesionCaja.findFirst({
              where: { empresaId, abiertoPorId: usuarioId, estado: 'ABIERTA' },
            });
            if (abierta)
              throw new ConflictException('Ya tienes una caja abierta.');
            return tx.sesionCaja.create({
              data: {
                empresaId,
                abiertoPorId: usuarioId,
                estado: 'ABIERTA',
                efectivoInicial: new Prisma.Decimal(dto.efectivoInicial),
                notas: dto.notas,
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2034' && intento < 2) continue;
          if (error.code === 'P2034' || error.code === 'P2002') {
            throw new ConflictException(
              'No se pudo abrir la caja por un cambio simultaneo. Vuelve a intentarlo.',
            );
          }
          if (error.code === 'P2003')
            throw new ConflictException(
              'El usuario o su empresa ya no estan disponibles.',
            );
        }
        throw error;
      }
    }
    throw new ConflictException('No se pudo abrir la caja.');
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
}
