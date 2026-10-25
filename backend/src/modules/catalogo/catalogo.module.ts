import { Module } from '@nestjs/common';
import { CatalogoService } from './catalogo.service.js';
import { CatalogoController } from './catalogo.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { RolesGuard } from '../roles/roles.guard.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [CatalogoController],
  providers: [CatalogoService, RolesGuard],
})
export class CatalogoModule {}
