import { Module } from '@nestjs/common';
import { VentasService } from './ventas.service.js';
import { VentasController } from './ventas.controller.js';
import { ClientesController } from './clientes.controller.js';
import { ClientesService } from './clientes.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { InventarioModule } from '../inventario/inventario.module.js';
import { CreditosModule } from '../creditos/creditos.module.js';
import { CajaModule } from '../caja/caja.module.js';
import { DevolucionesService } from './devoluciones.service.js';

import { RolesModule } from '../roles/roles.module.js';

@Module({
  imports: [
    RolesModule,
    PrismaModule,
    InventarioModule,
    CreditosModule,
    CajaModule,
  ],
  // Las rutas de clientes deben preceder a /ventas/:id.
  controllers: [ClientesController, VentasController],
  providers: [VentasService, ClientesService, DevolucionesService],
})
export class VentasModule {}
