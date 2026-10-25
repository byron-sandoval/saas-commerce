import { Module } from '@nestjs/common';
import { EmpresasService } from './empresas.service.js';
import { EmpresasController } from './empresas.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { SessionGuard } from '../auth/session.guard.js';
import { RolesModule } from '../roles/roles.module.js';
import { RolesGuard } from '../roles/roles.guard.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [AuthModule, PrismaModule, RolesModule],
  controllers: [EmpresasController],
  providers: [EmpresasService, SessionGuard, RolesGuard],
})
export class EmpresasModule {}
