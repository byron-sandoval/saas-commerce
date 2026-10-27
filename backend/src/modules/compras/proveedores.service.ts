import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateProveedorDto } from './dto/create-proveedor.dto.js';
import type { UpdateProveedorDto } from './dto/update-proveedor.dto.js';
import type { ListarProveedoresDto } from './dto/listar-proveedores.dto.js';

@Injectable()
export class ProveedoresService {
  constructor(private readonly prisma: PrismaService) {}

  create(empresaId: string, dto: CreateProveedorDto) {
    return this.prisma.proveedor.create({
      data: { ...this.datosProveedor(dto), empresaId, nombre: dto.nombre },
    });
  }

  async findAll(empresaId: string, { pagina, limite }: ListarProveedoresDto) {
    const datos = await this.prisma.proveedor.findMany({
      where: { empresaId, activo: true },
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      skip: (pagina - 1) * limite,
      take: limite,
    });
    return { datos, pagina, limite };
  }

  async findOne(empresaId: string, id: string) {
    const proveedor = await this.prisma.proveedor.findUnique({
      where: { empresaId_id: { empresaId, id }, activo: true },
    });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado.');
    return proveedor;
  }

  async update(empresaId: string, id: string, dto: UpdateProveedorDto) {
    try {
      return await this.prisma.proveedor.update({
        where: { empresaId_id: { empresaId, id }, activo: true },
        data: this.datosProveedor(dto),
      });
    } catch (error) {
      this.convertirError(error);
    }
  }

  async remove(empresaId: string, id: string): Promise<void> {
    try {
      // Conserva las relaciones con compras, movimientos y devoluciones.
      await this.prisma.proveedor.update({
        where: { empresaId_id: { empresaId, id }, activo: true },
        data: { activo: false },
      });
    } catch (error) {
      this.convertirError(error);
    }
  }

  private datosProveedor(dto: Partial<CreateProveedorDto>) {
    return {
      nombre: dto.nombre,
      telefono: dto.telefono,
      email: dto.email,
      direccion: dto.direccion,
      identificacionFiscal: dto.identificacionFiscal,
      notas: dto.notas,
    };
  }

  private convertirError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException('Proveedor no encontrado.');
    }
    throw error;
  }
}
