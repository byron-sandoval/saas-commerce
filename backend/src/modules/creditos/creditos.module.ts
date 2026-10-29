import { Module } from '@nestjs/common';
import { CreditosService } from './creditos.service.js';
import { CreditosController } from './creditos.controller.js';

import { RolesModule } from '../roles/roles.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [RolesModule, PrismaModule],
  controllers: [CreditosController],
  providers: [CreditosService],
  exports: [CreditosService],
})
export class CreditosModule {}
