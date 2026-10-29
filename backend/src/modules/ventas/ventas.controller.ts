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
} from '@nestjs/common';
import { VentasService } from './ventas.service.js';
import { CreateVentaDto } from './dto/create-venta.dto.js';
import { ListarVentasDto } from './dto/listar-ventas.dto.js';

import { Roles } from '../roles/roles.decorator.js';
import { RolesGuard } from '../roles/roles.guard.js';
import type { SolicitudConUsuario } from '../roles/roles.guard.js';

@Controller('ventas')
@UseGuards(RolesGuard)
@Roles('ADMIN', 'CAJERO')
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Post()
  create(@Req() request: SolicitudConUsuario, @Body() dto: CreateVentaDto) {
    return this.ventasService.create(
      request.usuario!.empresaId,
      request.usuario!.id,
      dto,
    );
  }

  @Get()
  findAll(
    @Req() request: SolicitudConUsuario,
    @Query() consulta: ListarVentasDto,
  ) {
    const usuario = request.usuario!;
    return this.ventasService.findAll(
      usuario.empresaId,
      usuario.id,
      usuario.rol === 'ADMIN',
      consulta,
    );
  }

  @Get(':id')
  findOne(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const usuario = request.usuario!;
    return this.ventasService.findOne(
      usuario.empresaId,
      usuario.id,
      usuario.rol === 'ADMIN',
      id,
    );
  }
}
