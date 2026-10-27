import { Module } from '@nestjs/common';
import { CajaService } from './caja.service.js';
import { CajaController } from './caja.controller.js';

import { RolesModule } from '../roles/roles.module.js';

@Module({
  imports: [RolesModule],
  controllers: [CajaController],
  providers: [CajaService],
})
export class CajaModule {}
