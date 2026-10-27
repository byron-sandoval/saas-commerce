import { Module } from '@nestjs/common';
import { CatalogoService } from './catalogo.service.js';
import { CatalogoController } from './catalogo.controller.js';
import { RolesModule } from '../roles/roles.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [RolesModule, PrismaModule],
  controllers: [CatalogoController],
  providers: [CatalogoService],
})
export class CatalogoModule {}
