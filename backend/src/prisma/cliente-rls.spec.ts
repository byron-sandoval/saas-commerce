import { clienteConRls } from './cliente-rls.js';
import { contextoRls } from './contexto-rls.js';

function preparar() {
  const conexiones: Array<{ empresa?: string; usuario?: string }> = [];
  const raw = vi.fn();
  const cliente = {
    $transaction: vi.fn(
      async (trabajo: (tx: any) => unknown, _opciones?: unknown) => {
        const conexion: { empresa?: string; usuario?: string } = {};
        conexiones.push(conexion);
        const tx = {
          $queryRaw: async (
            _sql: TemplateStringsArray,
            empresa: string,
            usuario: string,
          ) => {
            conexion.empresa = empresa;
            conexion.usuario = usuario;
            return [];
          },
          $executeRawUnsafe: raw,
          producto: {
            findMany: async () => {
              await Promise.resolve();
              return [{ empresaId: conexion.empresa }];
            },
          },
        };
        return trabajo(tx);
      },
    ),
  };
  return {
    protegido: clienteConRls(cliente) as typeof cliente & {
      producto: { findMany: () => Promise<unknown> };
      $queryRawUnsafe: () => void;
    },
    cliente,
    conexiones,
    raw,
  };
}

describe('Contexto RLS del cliente', () => {
  it('falla cerrado sin empresa o usuario y no inicia consultas', () => {
    const { protegido, cliente } = preparar();
    expect(() => protegido.producto.findMany()).toThrow('contexto');
    contextoRls.run({ usuarioId: 'u', empresaId: null }, () =>
      expect(() => protegido.producto.findMany()).toThrow('contexto'),
    );
    expect(cliente.$transaction).not.toHaveBeenCalled();
  });
  it('fija ambos parametros locales antes de ejecutar la consulta en esa conexion', async () => {
    const { protegido, conexiones } = preparar();
    const resultado = await contextoRls.run(
      { empresaId: 'A', usuarioId: 'u-A' },
      () => protegido.producto.findMany(),
    );
    expect(resultado).toEqual([{ empresaId: 'A' }]);
    expect(conexiones).toEqual([{ empresa: 'A', usuario: 'u-A' }]);
    expect(contextoRls.getStore()).toBeUndefined();
  });
  it('mantiene solicitudes concurrentes y transacciones independientes', async () => {
    const { protegido } = preparar();
    const resultados = await Promise.all(
      ['A', 'B'].map((empresaId) =>
        contextoRls.run({ empresaId, usuarioId: 'u-' + empresaId }, () =>
          protegido.producto.findMany(),
        ),
      ),
    );
    expect(resultados).toEqual([[{ empresaId: 'A' }], [{ empresaId: 'B' }]]);
  });
  it('conserva aislamiento/reintentos del callback y bloquea Unsafe tambien dentro de transacciones', async () => {
    const { protegido, cliente, raw } = preparar();
    const opciones = { isolationLevel: 'Serializable' };
    await contextoRls.run({ empresaId: 'A', usuarioId: 'u' }, () =>
      protegido.$transaction(
        async (tx: any) => tx.producto.findMany(),
        opciones,
      ),
    );
    expect(cliente.$transaction.mock.calls[0][1]).toBe(opciones);
    expect(() => protegido.$queryRawUnsafe()).toThrow('no disponible');
    await expect(
      contextoRls.run({ empresaId: 'A', usuarioId: 'u' }, () =>
        protegido.$transaction(async (tx: any) => tx.$executeRawUnsafe('SQL')),
      ),
    ).rejects.toThrow('no disponible');
    expect(raw).not.toHaveBeenCalled();
  });
  it('rechaza arrays para impedir consultas preparadas fuera de contexto', () => {
    const { protegido } = preparar();
    expect(() => (protegido.$transaction as any)([])).toThrow('callback');
  });
});
