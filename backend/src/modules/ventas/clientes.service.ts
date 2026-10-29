import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateClienteDto } from './dto/create-cliente.dto.js';
import type { UpdateClienteDto } from './dto/update-cliente.dto.js';
import type { ListarClientesDto } from './dto/listar-clientes.dto.js';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: string, dto: CreateClienteDto) {
    this.validarDocumento(dto.tipoDocumento, dto.numeroDocumento);
    try {
      return await this.prisma.cliente.create({
        data: { ...this.datosCliente(dto), empresaId, nombre: dto.nombre },
      });
    } catch (error) {
      this.convertirError(error);
    }
  }

  async findAll(empresaId: string, { pagina, limite }: ListarClientesDto) {
    const datos = await this.prisma.cliente.findMany({
      where: { empresaId, activo: true },
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      skip: (pagina - 1) * limite,
      take: limite,
    });
    return { datos, pagina, limite };
  }

  async findOne(empresaId: string, id: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { empresaId_id: { empresaId, id }, activo: true },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado.');
    return cliente;
  }

  async update(empresaId: string, id: string, dto: UpdateClienteDto) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const cliente = await tx.cliente.findUnique({
            where: { empresaId_id: { empresaId, id }, activo: true },
          });
          if (!cliente) throw new NotFoundException('Cliente no encontrado.');
          const tipoDocumento =
            dto.tipoDocumento === undefined
              ? cliente.tipoDocumento
              : dto.tipoDocumento;
          const numeroDocumento =
            dto.numeroDocumento === undefined
              ? cliente.numeroDocumento
              : dto.numeroDocumento;
          this.validarDocumento(tipoDocumento, numeroDocumento);
          return tx.cliente.update({
            where: { empresaId_id: { empresaId, id }, activo: true },
            data: { ...this.datosCliente(dto), tipoDocumento, numeroDocumento },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.convertirError(error);
    }
  }

  async remove(empresaId: string, id: string): Promise<void> {
    try {
      // Conserva las ventas y creditos que hacen referencia al cliente.
      await this.prisma.cliente.update({
        where: { empresaId_id: { empresaId, id }, activo: true },
        data: { activo: false },
      });
    } catch (error) {
      this.convertirError(error);
    }
  }

  private validarDocumento(
    tipo: string | null | undefined,
    numero: string | null | undefined,
  ) {
    if ((tipo == null) !== (numero == null)) {
      throw new BadRequestException(
        'Debes indicar tipoDocumento y numeroDocumento juntos, o dejar ambos sin definir.',
      );
    }
  }

  private datosCliente(dto: Partial<CreateClienteDto>) {
    return {
      nombre: dto.nombre,
      tipoDocumento: dto.tipoDocumento,
      numeroDocumento: dto.numeroDocumento,
      direccion: dto.direccion,
      telefono: dto.telefono,
    };
  }

  private convertirError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        throw new ConflictException(
          'Ya existe un cliente con ese documento en tu empresa.',
        );
      if (error.code === 'P2025')
        throw new NotFoundException('Cliente no encontrado.');
      if (error.code === 'P2034')
        throw new ConflictException(
          'El cliente cambio durante la operacion. Vuelve a intentarlo.',
        );
    }
    throw error;
  }
}
