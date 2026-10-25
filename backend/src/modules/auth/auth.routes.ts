import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import type { Express } from 'express';
import { AuthService } from './auth.service.js';

export function configureAuthRoutes(app: NestExpressApplication): void {
  const { auth } = app.get(AuthService);
  const expressApp: Express = app.getHttpAdapter().getInstance();
  // Better Auth necesita recibir el cuerpo antes de que Nest lo procese.
  expressApp.all('/api/auth/*path', toNodeHandler(auth));
  app.useBodyParser('json');
  app.useBodyParser('urlencoded', { extended: true });
}
