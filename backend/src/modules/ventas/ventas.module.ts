import { Module } from '@nestjs/common';
import { VentasService } from './ventas.service.js';
import { VentasController } from './ventas.controller.js';
import { ClientesController } from './clientes.controller.js';
import { ClientesService } from './clientes.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { InventarioModule } from '../inventario/inventario.module.js';

import { RolesModule } from '../roles/roles.module.js';

@Module({
  imports: [RolesModule, PrismaModule, InventarioModule],
  // Las rutas de clientes deben preceder a /ventas/:id.
  controllers: [ClientesController, VentasController],
  providers: [VentasService, ClientesService],
})
export class VentasModule {}
