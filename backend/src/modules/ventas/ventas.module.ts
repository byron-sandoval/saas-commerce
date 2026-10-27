import { Module } from '@nestjs/common';
import { VentasService } from './ventas.service.js';
import { VentasController } from './ventas.controller.js';

import { RolesModule } from '../roles/roles.module.js';

@Module({
  imports: [RolesModule],
  controllers: [VentasController],
  providers: [VentasService],
})
export class VentasModule {}
