import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { RolesService } from './roles.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [RolesService, RolesGuard],
  exports: [RolesService, RolesGuard, AuthModule, PrismaModule],
})
export class RolesModule {}
