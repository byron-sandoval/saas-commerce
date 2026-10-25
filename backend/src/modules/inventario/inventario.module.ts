import { Module } from '@nestjs/common';
import { InventarioService } from './inventario.service.js';
import { InventarioController } from './inventario.controller.js';

@Module({
  controllers: [InventarioController],
  providers: [InventarioService],
})
export class InventarioModule {}
