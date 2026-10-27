import { Module } from '@nestjs/common';
import { CreditosService } from './creditos.service.js';
import { CreditosController } from './creditos.controller.js';

import { RolesModule } from '../roles/roles.module.js';

@Module({
  imports: [RolesModule],
  controllers: [CreditosController],
  providers: [CreditosService],
})
export class CreditosModule {}
