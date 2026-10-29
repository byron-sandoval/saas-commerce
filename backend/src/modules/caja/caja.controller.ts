import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import { CajaService } from './caja.service.js';
import { CreateCajaDto } from './dto/create-caja.dto.js';
import { ListarCajasDto } from './dto/listar-cajas.dto.js';
import { CerrarCajaDto } from './dto/cerrar-caja.dto.js';

import { Roles } from '../roles/roles.decorator.js';
import { RolesGuard } from '../roles/roles.guard.js';
import type { SolicitudConUsuario } from '../roles/roles.guard.js';

@Controller('caja')
@UseGuards(RolesGuard)
@Roles('ADMIN', 'CAJERO')
export class CajaController {
  constructor(private readonly cajaService: CajaService) {}

  @Post()
  create(@Req() request: SolicitudConUsuario, @Body() dto: CreateCajaDto) {
    return this.cajaService.create(
      request.usuario!.empresaId,
      request.usuario!.id,
      dto,
    );
  }

  @Get()
  findAll(
    @Req() request: SolicitudConUsuario,
    @Query() consulta: ListarCajasDto,
  ) {
    const usuario = request.usuario!;
    return this.cajaService.findAll(
      usuario.empresaId,
      usuario.id,
      usuario.rol === 'ADMIN',
      consulta,
    );
  }

  @Get('actual')
  findActual(@Req() request: SolicitudConUsuario) {
    return this.cajaService.findActual(
      request.usuario!.empresaId,
      request.usuario!.id,
    );
  }

  @Get(':id')
  findOne(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const usuario = request.usuario!;
    return this.cajaService.findOne(
      usuario.empresaId,
      usuario.id,
      usuario.rol === 'ADMIN',
      id,
    );
  }

  @Get(':id/arqueo')
  arqueo(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const usuario = request.usuario!;
    return this.cajaService.arqueo(
      usuario.empresaId,
      usuario.id,
      usuario.rol === 'ADMIN',
      id,
    );
  }

  @Post(':id/cerrar')
  @HttpCode(200)
  cerrar(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CerrarCajaDto,
  ) {
    const usuario = request.usuario!;
    return this.cajaService.cerrar(
      usuario.empresaId,
      usuario.id,
      usuario.rol === 'ADMIN',
      id,
      dto,
    );
  }
}
