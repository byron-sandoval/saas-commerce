import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import type { CreateUsuarioDto } from './dto/create-usuario.dto.js';
import type { UpdateUsuarioDto } from './dto/update-usuario.dto.js';
import type { ListarUsuariosDto } from './dto/listar-usuarios.dto.js';
import type { CambiarPasswordTemporalDto } from './dto/cambiar-password-temporal.dto.js';

const publico = {
  id: true,
  nombre: true,
  email: true,
  username: true,
  empresaId: true,
  rolId: true,
  activo: true,
  debeCambiarPassword: true,
  passwordTemporalExpiraEn: true,
  creadoEn: true,
  rol: { select: { nombre: true } },
} satisfies Prisma.UsuarioSelect;

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async create(empresaId: string, dto: CreateUsuarioDto) {
    const passwordTemporal = randomBytes(18).toString('base64url');
    const usuario = await this.transaccion(async (tx) => {
      await this.bloquearEmpresa(empresaId, tx);
      await this.validarLimite(empresaId, tx);
      const rol = await this.rolEmpleado(empresaId, dto.rol, tx);
      const id = await this.auth.crearEmpleado(
        tx,
        {
          ...dto,
          empresaId,
          rolId: rol.id,
          passwordTemporalExpiraEn: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        passwordTemporal,
      );
      return tx.usuario.findUniqueOrThrow({
        where: { empresaId_id: { empresaId, id } },
        select: publico,
      });
    });
    return { ...usuario, passwordTemporal };
  }

  async findAll(
    empresaId: string,
    { pagina, limite, activo }: ListarUsuariosDto,
  ) {
    const datos = await this.prisma.usuario.findMany({
      where: {
        empresaId,
        activo: activo === undefined ? undefined : activo === 'true',
      },
      select: publico,
      orderBy: [{ creadoEn: 'desc' }, { id: 'asc' }],
      skip: (pagina - 1) * limite,
      take: limite,
    });
    return { datos, pagina, limite };
  }

  async findOne(empresaId: string, id: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { empresaId_id: { empresaId, id } },
      select: publico,
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');
    return usuario;
  }

  update(empresaId: string, id: string, dto: UpdateUsuarioDto) {
    if (!Object.keys(dto).length)
      throw new BadRequestException(
        'Debes indicar al menos un dato para actualizar.',
      );
    return this.transaccion(async (tx) => {
      await this.bloquearEmpresa(empresaId, tx);
      const usuario = await this.empleado(empresaId, id, tx);
      const rol = dto.rol
        ? await this.rolEmpleado(empresaId, dto.rol, tx)
        : null;
      if (rol && rol.id !== usuario.rolId)
        await this.sinCajaAbierta(empresaId, id, tx);
      await this.auth.actualizarEmpleado(tx, id, {
        ...(dto.nombre !== undefined ? { name: dto.nombre } : {}),
        ...(dto.email !== undefined
          ? { email: dto.email, emailVerified: false }
          : {}),
        ...(dto.username !== undefined
          ? { username: dto.username, displayUsername: dto.username }
          : {}),
        ...(rol ? { rolId: rol.id } : {}),
      });
      await this.auth.revocarSesiones(tx, id);
      return tx.usuario.findUniqueOrThrow({
        where: { empresaId_id: { empresaId, id } },
        select: publico,
      });
    });
  }

  remove(empresaId: string, id: string) {
    return this.transaccion(async (tx) => {
      await this.bloquearEmpresa(empresaId, tx);
      const usuario = await this.empleado(empresaId, id, tx);
      if (!usuario.activo)
        throw new ConflictException('El empleado ya esta inactivo.');
      await this.sinCajaAbierta(empresaId, id, tx);
      await tx.usuario.updateMany({
        where: { empresaId, id },
        data: { activo: false },
      });
      await this.auth.revocarSesiones(tx, id);
      return tx.usuario.findUniqueOrThrow({
        where: { empresaId_id: { empresaId, id } },
        select: publico,
      });
    });
  }

  reactivar(empresaId: string, id: string) {
    return this.transaccion(async (tx) => {
      await this.bloquearEmpresa(empresaId, tx);
      const usuario = await this.empleado(empresaId, id, tx);
      if (usuario.activo)
        throw new ConflictException('El empleado ya esta activo.');
      await this.rolEmpleado(empresaId, usuario.rol!.nombre, tx);
      await this.validarLimite(empresaId, tx);
      await tx.usuario.updateMany({
        where: { empresaId, id },
        data: { activo: true },
      });
      await this.auth.revocarSesiones(tx, id);
      return tx.usuario.findUniqueOrThrow({
        where: { empresaId_id: { empresaId, id } },
        select: publico,
      });
    });
  }

  async restablecerPassword(empresaId: string, id: string) {
    const passwordTemporal = randomBytes(18).toString('base64url');
    const usuario = await this.transaccion(async (tx) => {
      await this.bloquearEmpresa(empresaId, tx);
      await this.empleado(empresaId, id, tx);
      await this.auth.guardarPassword(tx, id, passwordTemporal);
      await tx.usuario.updateMany({
        where: { empresaId, id },
        data: {
          debeCambiarPassword: true,
          passwordTemporalExpiraEn: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      await this.auth.revocarSesiones(tx, id);
      return tx.usuario.findUniqueOrThrow({
        where: { empresaId_id: { empresaId, id } },
        select: publico,
      });
    });
    return { ...usuario, passwordTemporal };
  }

  cambiarPasswordTemporal(id: string, dto: CambiarPasswordTemporalDto) {
    return this.transaccion(async (tx) => {
      const usuario = await tx.usuario.findUnique({
        where: { id },
        include: { empresa: true, rol: true },
      });
      if (
        !usuario?.activo ||
        !usuario.debeCambiarPassword ||
        !usuario.passwordTemporalExpiraEn ||
        usuario.passwordTemporalExpiraEn.getTime() <= Date.now() ||
        usuario.empresa?.estado !== 'ACTIVA' ||
        !usuario.rol?.activo ||
        usuario.rol.empresaId !== usuario.empresaId
      )
        throw new ForbiddenException(
          'La password temporal vencio o la cuenta no esta habilitada. Solicita una nueva al ADMIN.',
        );
      // Escritura condicional: dos cambios o un restablecimiento no pueden confirmarse juntos.
      const vigente = await tx.usuario.updateMany({
        where: {
          id,
          activo: true,
          debeCambiarPassword: true,
          passwordTemporalExpiraEn: usuario.passwordTemporalExpiraEn,
        },
        data: { debeCambiarPassword: false, passwordTemporalExpiraEn: null },
      });
      if (vigente.count !== 1)
        throw new ConflictException('El estado de la password cambio.');
      await this.auth.guardarPassword(
        tx,
        id,
        dto.passwordNueva,
        dto.passwordActual,
      );
      await this.auth.revocarSesiones(tx, id);
      return {
        ok: true,
        mensaje: 'Password actualizada. Inicia sesion con la nueva password.',
      };
    });
  }

  private async empleado(
    empresaId: string,
    id: string,
    tx: Prisma.TransactionClient,
  ) {
    const usuario = await tx.usuario.findUnique({
      where: { empresaId_id: { empresaId, id } },
      select: { ...publico, superAdmin: { select: { id: true } } },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');
    if (
      usuario.superAdmin ||
      !usuario.rol ||
      !['CAJERO', 'BODEGUERO'].includes(usuario.rol.nombre)
    )
      throw new ForbiddenException(
        'Solo se pueden administrar empleados CAJERO o BODEGUERO.',
      );
    return usuario;
  }

  private async rolEmpleado(
    empresaId: string,
    nombre: string,
    tx: Prisma.TransactionClient,
  ) {
    if (!['CAJERO', 'BODEGUERO'].includes(nombre))
      throw new BadRequestException('Rol de empleado invalido.');
    const rol = await tx.rol.findUnique({
      where: { empresaId_nombre: { empresaId, nombre } },
    });
    if (!rol?.activo)
      throw new ConflictException('El rol no esta disponible en esta empresa.');
    return rol;
  }

  private async sinCajaAbierta(
    empresaId: string,
    id: string,
    tx: Prisma.TransactionClient,
  ) {
    if (
      await tx.sesionCaja.findFirst({
        where: { empresaId, abiertoPorId: id, estado: 'ABIERTA' },
      })
    )
      throw new ConflictException('Primero cierra la caja del empleado.');
  }

  private async bloquearEmpresa(
    empresaId: string,
    tx: Prisma.TransactionClient,
  ) {
    const actualizada = await tx.empresa.updateMany({
      where: { id: empresaId, estado: 'ACTIVA' },
      data: { estado: 'ACTIVA' },
    });
    if (actualizada.count !== 1)
      throw new ForbiddenException('La empresa no esta activa.');
  }

  private async validarLimite(empresaId: string, tx: Prisma.TransactionClient) {
    const suscripciones = await tx.suscripcion.findMany({
      where: { empresaId },
      include: { plan: true },
    });
    // Mientras se implementan suscripciones, una empresa sin plan no tiene limite provisional.
    if (suscripciones.length === 0) return;
    const ahora = Date.now();
    const vigentes = suscripciones.filter(
      (s) =>
        ['PRUEBA', 'ACTIVA'].includes(s.estado) &&
        s.fechaInicio.getTime() <= ahora &&
        (!s.fechaFin || s.fechaFin.getTime() > ahora),
    );
    if (vigentes.length !== 1 || !vigentes[0].plan.activo)
      throw new ConflictException(
        'La empresa necesita una unica suscripcion vigente con un plan activo.',
      );
    const limite = vigentes[0].plan.limiteUsuarios;
    if (
      limite !== null &&
      (await tx.usuario.count({ where: { empresaId, activo: true } })) >= limite
    )
      throw new ConflictException(
        'Se alcanzo el limite de usuarios activos del plan, incluido el ADMIN.',
      );
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
          if (error.code === 'P2002')
            throw new ConflictException(
              'El email o username ya esta registrado.',
            );
          if (['P2034', 'P2003', 'P2025'].includes(error.code))
            throw new ConflictException(
              'No se pudo completar la operacion por un cambio simultaneo. Vuelve a consultar.',
            );
        }
        throw error;
      }
    }
    throw new ConflictException('No se pudo completar la operacion.');
  }
}
