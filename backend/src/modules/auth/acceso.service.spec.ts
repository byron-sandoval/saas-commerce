import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AccesoService } from './acceso.service.js';
import type { AuthService } from './auth.service.js';
import type { AuthPrismaService } from '../../prisma/auth-prisma.service.js';

function escenario() {
  const usuario = {
    id: 'u1',
    nombre: 'Usuario',
    email: 'usuario@example.com',
    activo: true,
    empresaId: 'e1',
    rolId: 'r1',
    debeCambiarPassword: false,
    passwordTemporalExpiraEn: new Date(Date.now() + 60000),
    empresa: { id: 'e1', nombre: 'Ferreteria', estado: 'ACTIVA' },
    rol: { nombre: 'ADMIN', activo: true, empresaId: 'e1' },
    superAdmin: null,
  };
  const getSession = vi.fn().mockResolvedValue({ user: { id: 'u1' } });
  const findUnique = vi.fn().mockResolvedValue(usuario);
  const servicio = new AccesoService(
    { auth: { api: { getSession } } } as unknown as AuthService,
    { usuario: { findUnique } } as unknown as AuthPrismaService,
  );
  return { usuario, getSession, findUnique, servicio };
}

describe('Contexto de acceso', () => {
  it('exige sesion y obtiene la identidad de la sesion, no del cliente', async () => {
    const s = escenario();
    s.getSession.mockResolvedValue(null);
    await expect(s.servicio.consultar({})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(s.findUnique).not.toHaveBeenCalled();
  });
  it.each(['ADMIN', 'CAJERO', 'BODEGUERO'])(
    'devuelve rol %s actual sin credenciales ni tokens',
    async (rol) => {
      const s = escenario();
      s.usuario.rol.nombre = rol;
      await expect(s.servicio.consultar({})).resolves.toEqual({
        usuario: { id: 'u1', nombre: 'Usuario', email: 'usuario@example.com' },
        acceso: rol,
        empresa: { id: 'e1', nombre: 'Ferreteria' },
      });
      expect(s.findUnique.mock.calls[0][0].where).toEqual({ id: 'u1' });
    },
  );
  it.each(['inactivo', 'empresa', 'rol', 'otra-empresa', 'vencida'])(
    'rechaza estado invalido: %s',
    async (caso) => {
      const s = escenario();
      if (caso === 'inactivo') s.usuario.activo = false;
      if (caso === 'empresa') s.usuario.empresa.estado = 'SUSPENDIDA';
      if (caso === 'rol') s.usuario.rol.activo = false;
      if (caso === 'otra-empresa') s.usuario.rol.empresaId = 'e2';
      if (caso === 'vencida') {
        s.usuario.debeCambiarPassword = true;
        s.usuario.passwordTemporalExpiraEn = new Date(0);
      }
      await expect(s.servicio.consultar({})).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    },
  );
  it('dirige la temporal vigente a su cambio y al fundador sin empresa a completar su alta', async () => {
    const s = escenario();
    s.usuario.debeCambiarPassword = true;
    expect((await s.servicio.consultar({})).acceso).toBe('CAMBIAR_PASSWORD');
    s.findUnique.mockResolvedValue({
      ...s.usuario,
      empresaId: null,
      rolId: null,
      empresa: null,
      rol: null,
      debeCambiarPassword: false,
    });
    expect((await s.servicio.consultar({})).acceso).toBe('SIN_EMPRESA');
  });
  it('separa SuperAdmin del panel de ADMIN', async () => {
    const s = escenario();
    s.findUnique.mockResolvedValue({ ...s.usuario, superAdmin: { id: 's1' } });
    expect((await s.servicio.consultar({})).acceso).toBe('SUPERADMIN');
  });
});
