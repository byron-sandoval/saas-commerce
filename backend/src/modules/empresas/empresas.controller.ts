import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfiguracionEmpresaDto } from './dto/configuracion-empresa.dto.js';
import { EmpresasService } from './empresas.service.js';
import { CreateEmpresaDto } from './dto/create-empresa.dto.js';
import { SessionGuard } from '../auth/session.guard.js';
import type { SolicitudConSesion } from '../auth/session.guard.js';
import { Roles } from '../roles/roles.decorator.js';
import { RolesGuard } from '../roles/roles.guard.js';
import type { SolicitudConUsuario } from '../roles/roles.guard.js';

@Controller('empresas')
export class EmpresasController {
  constructor(private readonly empresasService: EmpresasService) {}

  @Patch('actual/configuracion')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  configurar(
    @Req() request: SolicitudConUsuario,
    @Body() dto: ConfiguracionEmpresaDto,
  ) {
    return this.empresasService.configurar(request.usuario!.empresaId, dto);
  }

  @Post()
  @UseGuards(SessionGuard)
  create(@Req() request: SolicitudConSesion, @Body() dto: CreateEmpresaDto) {
    return this.empresasService.create(request.usuarioAutenticado.id, dto);
  }

  @Get('actual')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CAJERO', 'BODEGUERO')
  findActual(@Req() request: SolicitudConUsuario) {
    return this.empresasService.findActual(request.usuario!.empresaId);
  }
}
