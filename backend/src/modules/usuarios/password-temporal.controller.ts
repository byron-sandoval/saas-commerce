import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PasswordTemporalGuard } from './password-temporal.guard.js';
import type { SolicitudPasswordTemporal } from './password-temporal.guard.js';
import { CambiarPasswordTemporalDto } from './dto/cambiar-password-temporal.dto.js';
import { UsuariosService } from './usuarios.service.js';

@Controller('usuarios')
@UseGuards(PasswordTemporalGuard)
export class PasswordTemporalController {
  constructor(private readonly usuarios: UsuariosService) {}
  @Post('cambiar-password-temporal')
  @HttpCode(200)
  cambiar(
    @Req() request: SolicitudPasswordTemporal,
    @Body() dto: CambiarPasswordTemporalDto,
  ) {
    return this.usuarios.cambiarPasswordTemporal(request.empleadoId, dto);
  }
}
