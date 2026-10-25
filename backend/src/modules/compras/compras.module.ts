import { Module } from '@nestjs/common';
import { ComprasService } from './compras.service.js';
import { ComprasController } from './compras.controller.js';

@Module({
  controllers: [ComprasController],
  providers: [ComprasService],
})
export class ComprasModule {}
