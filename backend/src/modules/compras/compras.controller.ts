import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import { ComprasService } from './compras.service.js';
import { CreateCompraDto } from './dto/create-compra.dto.js';
import { UpdateCompraDto } from './dto/update-compra.dto.js';

import { Roles } from '../roles/roles.decorator.js';
import { RolesGuard } from '../roles/roles.guard.js';
import type { SolicitudConUsuario } from '../roles/roles.guard.js';
import { ListarComprasDto } from './dto/listar-compras.dto.js';

@Controller('compras')
@UseGuards(RolesGuard)
@Roles('ADMIN', 'BODEGUERO')
export class ComprasController {
  constructor(private readonly comprasService: ComprasService) {}

  @Post()
  create(@Req() request: SolicitudConUsuario, @Body() dto: CreateCompraDto) {
    return this.comprasService.create(
      request.usuario!.empresaId,
      request.usuario!.id,
      dto,
    );
  }

  @Get()
  findAll(
    @Req() request: SolicitudConUsuario,
    @Query() consulta: ListarComprasDto,
  ) {
    return this.comprasService.findAll(request.usuario!.empresaId, consulta);
  }

  @Get(':id')
  findOne(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.comprasService.findOne(request.usuario!.empresaId, id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCompraDto,
  ) {
    return this.comprasService.update(request.usuario!.empresaId, id, dto);
  }

  @Post(':id/recibir')
  @Roles('ADMIN')
  @HttpCode(200)
  recibir(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.comprasService.recibir(
      request.usuario!.empresaId,
      request.usuario!.id,
      id,
    );
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(204)
  remove(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.comprasService.remove(request.usuario!.empresaId, id);
  }
}
