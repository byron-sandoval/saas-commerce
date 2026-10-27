import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateUnidadMedidaDto } from './dto/create-unidad-medida.dto.js';
import type { UpdateUnidadMedidaDto } from './dto/update-unidad-medida.dto.js';
import type { ListarUnidadesMedidaDto } from './dto/listar-unidades-medida.dto.js';

@Injectable()
export class UnidadesMedidaService {
  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: string, dto: CreateUnidadMedidaDto) {
    try {
      return await this.prisma.unidadMedida.create({
        data: { empresaId, nombre: dto.nombre, simbolo: dto.simbolo },
      });
    } catch (error) {
      this.convertirError(error);
    }
  }

  async findAll(
    empresaId: string,
    { pagina, limite }: ListarUnidadesMedidaDto,
  ) {
    const datos = await this.prisma.unidadMedida.findMany({
      where: { empresaId, activo: true },
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      skip: (pagina - 1) * limite,
      take: limite,
    });
    return { datos, pagina, limite };
  }

  async findOne(empresaId: string, id: string) {
    const unidad = await this.prisma.unidadMedida.findUnique({
      where: { empresaId_id: { empresaId, id }, activo: true },
    });
    if (!unidad) throw new NotFoundException('Unidad de medida no encontrada.');
    return unidad;
  }

  async update(empresaId: string, id: string, dto: UpdateUnidadMedidaDto) {
    try {
      return await this.prisma.unidadMedida.update({
        where: { empresaId_id: { empresaId, id }, activo: true },
        data: { nombre: dto.nombre, simbolo: dto.simbolo },
      });
    } catch (error) {
      this.convertirError(error);
    }
  }

  async remove(empresaId: string, id: string): Promise<void> {
    try {
      // Baja logica para conservar los productos y su historial.
      await this.prisma.unidadMedida.update({
        where: { empresaId_id: { empresaId, id }, activo: true },
        data: { activo: false },
      });
    } catch (error) {
      this.convertirError(error);
    }
  }

  private convertirError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Unidad de medida no encontrada.');
      }
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Ya existe una unidad de medida con ese nombre en la empresa.',
        );
      }
    }
    throw error;
  }
}
