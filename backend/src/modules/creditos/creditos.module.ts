import { Module } from '@nestjs/common';
import { CreditosService } from './creditos.service.js';
import { CreditosController } from './creditos.controller.js';

@Module({
  controllers: [CreditosController],
  providers: [CreditosService],
})
export class CreditosModule {}
