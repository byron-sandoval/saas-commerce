import 'reflect-metadata';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthService } from '../auth/auth.service.js';
import { CatalogoController } from '../catalogo/catalogo.controller.js';
import { Roles } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

describe('Permisos de catalogo', () => {
  const usuarioActivo = () => ({
    id: 'usuario-1',
    empresaId: 'empresa-1',
    rolId: 'rol-1',
    activo: true,
    debeCambiarPassword: false,
    empresa: { estado: 'ACTIVA' },
    rol: { nombre: 'ADMIN', activo: true, empresaId: 'empresa-1' },
  });

  function preparar(accion: keyof CatalogoController = 'findAll') {
    const getSession = vi.fn().mockResolvedValue({ user: { id: 'usuario-1' } });
    const findUnique = vi.fn().mockResolvedValue(usuarioActivo());
    const solicitud = { headers: { 'x-role': 'ADMIN' }, usuario: undefined };
    const context = {
      getHandler: () => CatalogoController.prototype[accion],
      getClass: () => CatalogoController,
      switchToHttp: () => ({ getRequest: () => solicitud }),
    } as unknown as ExecutionContext;
    const guard = new RolesGuard(
      new Reflector(),
      { auth: { api: { getSession } } } as unknown as AuthService,
      { usuario: { findUnique } } as unknown as PrismaService,
    );
    return { guard, context, getSession, findUnique, solicitud };
  }

  it('rechaza peticiones sin sesion antes de consultar el rol', async () => {
    const prueba = preparar();
    prueba.getSession.mockResolvedValue(null);
    await expect(
      prueba.guard.canActivate(prueba.context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prueba.findUnique).not.toHaveBeenCalled();
  });

  it.each(['ADMIN', 'BODEGUERO', 'CAJERO'])(
    'permite a %s y obtiene la empresa desde el usuario autenticado',
    async (nombre) => {
      const prueba = preparar();
      const usuario = usuarioActivo();
      usuario.rol.nombre = nombre;
      prueba.findUnique.mockResolvedValue(usuario);
      await expect(prueba.guard.canActivate(prueba.context)).resolves.toBe(
        true,
      );
      expect(prueba.solicitud.usuario).toEqual({
        id: 'usuario-1',
        empresaId: 'empresa-1',
        rolId: 'rol-1',
      });
    },
  );

  it('rechaza al cajero aunque envie ADMIN en una cabecera', async () => {
    const prueba = preparar('create');
    const usuario = usuarioActivo();
    usuario.rol.nombre = 'CAJERO';
    prueba.findUnique.mockResolvedValue(usuario);
    await expect(
      prueba.guard.canActivate(prueba.context),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(['ADMIN', 'BODEGUERO', 'CAJERO'])(
    'eliminar: solo ADMIN tiene acceso, se verifica %s',
    async (nombre) => {
      const prueba = preparar('remove');
      const usuario = usuarioActivo();
      usuario.rol.nombre = nombre;
      prueba.findUnique.mockResolvedValue(usuario);
      if (nombre === 'ADMIN') {
        await expect(prueba.guard.canActivate(prueba.context)).resolves.toBe(
          true,
        );
      } else {
        await expect(
          prueba.guard.canActivate(prueba.context),
        ).rejects.toBeInstanceOf(ForbiddenException);
      }
    },
  );

  it.each(['ADMIN', 'BODEGUERO', 'CAJERO'])(
    'editar: solo ADMIN tiene acceso, se verifica %s',
    async (nombre) => {
      const prueba = preparar('update');
      const usuario = usuarioActivo();
      usuario.rol.nombre = nombre;
      prueba.findUnique.mockResolvedValue(usuario);
      if (nombre === 'ADMIN') {
        await expect(prueba.guard.canActivate(prueba.context)).resolves.toBe(
          true,
        );
      } else {
        await expect(
          prueba.guard.canActivate(prueba.context),
        ).rejects.toBeInstanceOf(ForbiddenException);
      }
    },
  );

  it.each([
    { activo: false },
    { debeCambiarPassword: true },
    { empresa: { estado: 'SUSPENDIDA' } },
    { empresaId: null },
    { rol: null },
    { rol: { nombre: 'ADMIN', activo: false, empresaId: 'empresa-1' } },
    { rol: { nombre: 'ADMIN', activo: true, empresaId: 'otra-empresa' } },
  ])('rechaza usuarios o asignaciones no habilitados: %j', async (cambios) => {
    const prueba = preparar();
    prueba.findUnique.mockResolvedValue({ ...usuarioActivo(), ...cambios });
    await expect(
      prueba.guard.canActivate(prueba.context),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite definir una lista diferente en cada endpoint', async () => {
    class EjemploController {
      consultar() {}
    }
    Roles('CAJERO')(
      EjemploController.prototype,
      'consultar',
      Object.getOwnPropertyDescriptor(
        EjemploController.prototype,
        'consultar',
      )!,
    );
    const prueba = preparar();
    const usuario = usuarioActivo();
    usuario.rol.nombre = 'CAJERO';
    prueba.findUnique.mockResolvedValue(usuario);
    const context = {
      getHandler: () => EjemploController.prototype.consultar,
      getClass: () => CatalogoController,
      switchToHttp: () => ({ getRequest: () => prueba.solicitud }),
    } as unknown as ExecutionContext;
    await expect(prueba.guard.canActivate(context)).resolves.toBe(true);
  });
});
