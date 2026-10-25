import { Module } from '@nestjs/common';
import { EmpresasService } from './empresas.service.js';
import { EmpresasController } from './empresas.controller.js';

@Module({
  controllers: [EmpresasController],
  providers: [EmpresasService],
})
export class EmpresasModule {}
