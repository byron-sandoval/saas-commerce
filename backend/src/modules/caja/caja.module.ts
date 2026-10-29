import { Module } from '@nestjs/common';
import { CajaService } from './caja.service.js';
import { CajaController } from './caja.controller.js';

import { RolesModule } from '../roles/roles.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [RolesModule, PrismaModule],
  controllers: [CajaController],
  providers: [CajaService],
})
export class CajaModule {}
