import { Module } from '@nestjs/common';
import { UsuariosService } from './usuarios.service.js';
import { UsuariosController } from './usuarios.controller.js';

import { RolesModule } from '../roles/roles.module.js';
import { PasswordTemporalGuard } from './password-temporal.guard.js';
import { PasswordTemporalController } from './password-temporal.controller.js';

@Module({
  imports: [RolesModule],
  controllers: [PasswordTemporalController, UsuariosController],
  providers: [UsuariosService, PasswordTemporalGuard],
})
export class UsuariosModule {}
