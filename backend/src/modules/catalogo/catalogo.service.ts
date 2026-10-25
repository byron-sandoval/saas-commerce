import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateCatalogoDto } from './dto/create-catalogo.dto.js';
import type { UpdateCatalogoDto } from './dto/update-catalogo.dto.js';
import type { ListarProductosDto } from './dto/listar-productos.dto.js';

@Injectable()
export class CatalogoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: string, dto: CreateCatalogoDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.validarReferencias(tx, empresaId, dto);
        return tx.producto.create({
          data: {
            ...this.datosProducto(dto),
            empresaId,
            sku: dto.sku,
            nombre: dto.nombre,
            precioBase: new Prisma.Decimal(dto.precioBase),
          },
        });
      });
    } catch (error) {
      this.convertirError(error);
    }
  }

  async findAll(empresaId: string, consulta: ListarProductosDto) {
    const { pagina, limite } = consulta;
    const datos = await this.prisma.producto.findMany({
      where: { empresaId, activo: true },
      orderBy: [{ creadoEn: 'desc' }, { id: 'asc' }],
      skip: (pagina - 1) * limite,
      take: limite,
    });
    return { datos, pagina, limite };
  }

  async findOne(empresaId: string, id: string) {
    const producto = await this.prisma.producto.findUnique({
      where: { empresaId_id: { empresaId, id }, activo: true },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado.');
    return producto;
  }

  async update(empresaId: string, id: string, dto: UpdateCatalogoDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.validarReferencias(tx, empresaId, dto);
        return tx.producto.update({
          where: { empresaId_id: { empresaId, id } },
          data: { ...this.datosProducto(dto), activo: dto.activo },
        });
      });
    } catch (error) {
      this.convertirError(error);
    }
  }

  async remove(empresaId: string, id: string): Promise<void> {
    try {
      // Baja logica para conservar las referencias del historial de ventas.
      await this.prisma.producto.update({
        where: { empresaId_id: { empresaId, id } },
        data: { activo: false },
      });
    } catch (error) {
      this.convertirError(error);
    }
  }

  private datosProducto(dto: Partial<CreateCatalogoDto>) {
    return {
      sku: dto.sku,
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      codigoBarras: dto.codigoBarras,
      categoriaId: dto.categoriaId,
      unidadMedidaId: dto.unidadMedidaId,
      precioBase:
        dto.precioBase === undefined
          ? undefined
          : new Prisma.Decimal(dto.precioBase),
      precioCosto:
        dto.precioCosto === undefined
          ? undefined
          : new Prisma.Decimal(dto.precioCosto),
    };
  }

  private async validarReferencias(
    db: Prisma.TransactionClient,
    empresaId: string,
    dto: Partial<CreateCatalogoDto>,
  ) {
    if (dto.categoriaId) {
      const categoria = await db.categoria.findUnique({
        where: {
          empresaId_id: { empresaId, id: dto.categoriaId },
          activo: true,
        },
        select: { id: true },
      });
      if (!categoria)
        throw new BadRequestException(
          'La categoria no existe o no esta disponible en tu empresa.',
        );
    }
    if (dto.unidadMedidaId) {
      const unidad = await db.unidadMedida.findUnique({
        where: {
          empresaId_id: { empresaId, id: dto.unidadMedidaId },
          activo: true,
        },
        select: { id: true },
      });
      if (!unidad)
        throw new BadRequestException(
          'La unidad de medida no existe o no esta disponible en tu empresa.',
        );
    }
  }

  private convertirError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        throw new ConflictException(
          'El SKU o codigo de barras ya existe en tu empresa.',
        );
      if (error.code === 'P2025')
        throw new NotFoundException('Producto no encontrado.');
      if (error.code === 'P2003')
        throw new BadRequestException(
          'Una de las referencias del producto ya no esta disponible.',
        );
    }
    throw error;
  }
}
