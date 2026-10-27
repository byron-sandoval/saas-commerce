import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateCategoriaDto } from './dto/create-categoria.dto.js';
import type { UpdateCategoriaDto } from './dto/update-categoria.dto.js';
import type { ListarCategoriasDto } from './dto/listar-categorias.dto.js';

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  create(empresaId: string, dto: CreateCategoriaDto) {
    return this.prisma.categoria.create({
      data: { empresaId, nombre: dto.nombre, descripcion: dto.descripcion },
    });
  }

  async findAll(empresaId: string, { pagina, limite }: ListarCategoriasDto) {
    const datos = await this.prisma.categoria.findMany({
      where: { empresaId, activo: true },
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      skip: (pagina - 1) * limite,
      take: limite,
    });
    return { datos, pagina, limite };
  }

  async findOne(empresaId: string, id: string) {
    const categoria = await this.prisma.categoria.findUnique({
      where: { empresaId_id: { empresaId, id }, activo: true },
    });
    if (!categoria) throw new NotFoundException('Categoria no encontrada.');
    return categoria;
  }

  async update(empresaId: string, id: string, dto: UpdateCategoriaDto) {
    try {
      return await this.prisma.categoria.update({
        where: { empresaId_id: { empresaId, id }, activo: true },
        data: { nombre: dto.nombre, descripcion: dto.descripcion },
      });
    } catch (error) {
      this.convertirError(error);
    }
  }

  async remove(empresaId: string, id: string): Promise<void> {
    try {
      // Conserva las relaciones y el historial de los productos existentes.
      await this.prisma.categoria.update({
        where: { empresaId_id: { empresaId, id }, activo: true },
        data: { activo: false },
      });
    } catch (error) {
      this.convertirError(error);
    }
  }

  private convertirError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException('Categoria no encontrada.');
    }
    throw error;
  }
}
