import { ForbiddenException } from '@nestjs/common';
import { contextoRls } from './contexto-rls.js';
import { Prisma } from '../generated/prisma/client.js';

type Cliente = { $transaction: (...args: any[]) => any };
type Tx = Record<string, any>;

// Un contexto LOCAL vive en la misma conexion/transaccion que la consulta.
// No se usa SET de sesion: el pool no conserva la empresa para la siguiente peticion.
export function clienteConRls<T extends Cliente>(cliente: T): T {
  const transaction = cliente.$transaction.bind(cliente);
  const modelos = new Set(
    Object.values(Prisma.ModelName).map((m) => m[0].toLowerCase() + m.slice(1)),
  );
  const delegates = new Map<PropertyKey, object>();
  const ejecutar = (operacion: (tx: Tx) => unknown, opciones?: unknown) => {
    const contexto = contextoRls.getStore();
    if (!contexto?.usuarioId || !contexto.empresaId)
      throw new ForbiddenException(
        'Falta el contexto de empresa validado para consultar datos.',
      );
    return transaction(async (tx: Tx) => {
      await tx.$queryRaw`SELECT set_config('app.empresa_id', ${contexto.empresaId}, true), set_config('app.usuario_id', ${contexto.usuarioId}, true)`;
      const protegido = new Proxy(tx, {
        get(target, propiedad) {
          if (
            ['$queryRawUnsafe', '$executeRawUnsafe', '$extends'].includes(
              String(propiedad),
            )
          )
            return () => {
              throw new Error(
                'Operacion no disponible en la transaccion protegida por RLS.',
              );
            };
          const valor = Reflect.get(target, propiedad, target);
          return typeof valor === 'function' ? valor.bind(target) : valor;
        },
      });
      return operacion(protegido);
    }, opciones);
  };
  return new Proxy(cliente, {
    get(target, propiedad) {
      if (propiedad === '$transaction')
        return (operacion: unknown, opciones?: unknown) => {
          if (typeof operacion !== 'function')
            throw new Error(
              'RLS requiere transacciones con callback, no arrays de consultas.',
            );
          return ejecutar(operacion as (tx: Tx) => unknown, opciones);
        };
      if (
        ['$queryRawUnsafe', '$executeRawUnsafe', '$extends'].includes(
          String(propiedad),
        )
      )
        return () => {
          throw new Error(
            'Operacion no disponible en el cliente protegido por RLS.',
          );
        };
      if (propiedad === '$queryRaw' || propiedad === '$executeRaw')
        return (...args: unknown[]) => ejecutar((tx) => tx[propiedad](...args));
      if (modelos.has(String(propiedad))) {
        if (!delegates.has(propiedad))
          delegates.set(
            propiedad,
            new Proxy(
              {},
              {
                get:
                  (_, metodo) =>
                  (...args: unknown[]) =>
                    ejecutar((tx) => tx[propiedad as string][metodo](...args)),
              },
            ),
          );
        return delegates.get(propiedad);
      }
      const valor = Reflect.get(target, propiedad, target);
      return typeof valor === 'function' ? valor.bind(target) : valor;
    },
  });
}
