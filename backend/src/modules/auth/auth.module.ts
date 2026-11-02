import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuthService } from './auth.service.js';
import { AccesoService } from './acceso.service.js';
import { AccesoController } from './acceso.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [AccesoController],
  providers: [AuthService, AccesoService],
  exports: [AuthService],
})
export class AuthModule {}
