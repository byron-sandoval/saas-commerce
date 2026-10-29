import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ListarInventarioDto } from './dto/listar-inventario.dto.js';
import { CreateInventarioDto } from './dto/create-inventario.dto.js';
import { UpdateInventarioDto } from './dto/update-inventario.dto.js';

@Injectable()
export class InventarioService {
  constructor(private readonly prisma: PrismaService) {}

  create(createInventarioDto: CreateInventarioDto) {
    return 'This action adds a new inventario';
  }

  async findAll(empresaId: string, { pagina, limite }: ListarInventarioDto) {
    const productos = await this.prisma.producto.findMany({
      where: { empresaId, activo: true },
      orderBy: [{ sku: 'asc' }, { id: 'asc' }],
      skip: (pagina - 1) * limite,
      take: limite,
    });
    const datos = await this.agregarExistencias(empresaId, productos);
    return { datos, pagina, limite };
  }

  async findOne(empresaId: string, id: string) {
    const producto = await this.prisma.producto.findUnique({
      where: { empresaId_id: { empresaId, id }, activo: true },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado.');
    const [datos] = await this.agregarExistencias(empresaId, [producto]);
    return datos;
  }

  async agregarExistencias<T extends { id: string }>(
    empresaId: string,
    productos: T[],
    db: Prisma.TransactionClient = this.prisma,
  ) {
    if (productos.length === 0) return [];
    // Cantidades con signo: entradas positivas, salidas negativas.
    // Una sola consulta agrupa los movimientos de todos los productos de la pagina.
    const grupos = await db.movimientoAlmacen.groupBy({
      by: ['productoId'],
      where: {
        empresaId,
        productoId: { in: productos.map((producto) => producto.id) },
      },
      _sum: { cantidad: true },
    });
    const saldos = new Map(
      grupos.map((grupo) => [
        grupo.productoId,
        grupo._sum.cantidad ?? new Prisma.Decimal(0),
      ]),
    );
    return productos.map((producto) => ({
      ...producto,
      stockDisponible: saldos.get(producto.id) ?? new Prisma.Decimal(0),
    }));
  }

  update(id: number, updateInventarioDto: UpdateInventarioDto) {
    return `This action updates a #${id} inventario`;
  }

  remove(id: number) {
    return `This action removes a #${id} inventario`;
  }
}
