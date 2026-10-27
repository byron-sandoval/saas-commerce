import { Module } from '@nestjs/common';
import { InventarioService } from './inventario.service.js';
import { InventarioController } from './inventario.controller.js';

import { RolesModule } from '../roles/roles.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [RolesModule, PrismaModule],
  controllers: [InventarioController],
  providers: [InventarioService],
  exports: [InventarioService],
})
export class InventarioModule {}
