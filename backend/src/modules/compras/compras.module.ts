import { Module } from '@nestjs/common';
import { ComprasService } from './compras.service.js';
import { ComprasController } from './compras.controller.js';

import { RolesModule } from '../roles/roles.module.js';

@Module({
  imports: [RolesModule],
  controllers: [ComprasController],
  providers: [ComprasService],
})
export class ComprasModule {}
