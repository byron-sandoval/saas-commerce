import { Module } from '@nestjs/common';
import { ComprasService } from './compras.service.js';
import { ComprasController } from './compras.controller.js';
import { ProveedoresController } from './proveedores.controller.js';
import { ProveedoresService } from './proveedores.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

import { RolesModule } from '../roles/roles.module.js';

@Module({
  imports: [RolesModule, PrismaModule],
  // Registra /compras/proveedores antes de la ruta generica /compras/:id.
  controllers: [ProveedoresController, ComprasController],
  providers: [ComprasService, ProveedoresService],
})
export class ComprasModule {}
