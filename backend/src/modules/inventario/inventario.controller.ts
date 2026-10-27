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
} from '@nestjs/common';
import { InventarioService } from './inventario.service.js';
import { CreateInventarioDto } from './dto/create-inventario.dto.js';
import { UpdateInventarioDto } from './dto/update-inventario.dto.js';

import { Roles } from '../roles/roles.decorator.js';
import { RolesGuard } from '../roles/roles.guard.js';
import type { SolicitudConUsuario } from '../roles/roles.guard.js';
import { ListarInventarioDto } from './dto/listar-inventario.dto.js';

@Controller('inventario')
@UseGuards(RolesGuard)
@Roles('ADMIN', 'BODEGUERO')
export class InventarioController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Post()
  create(@Body() createInventarioDto: CreateInventarioDto) {
    return this.inventarioService.create(createInventarioDto);
  }

  @Get()
  findAll(
    @Req() request: SolicitudConUsuario,
    @Query() consulta: ListarInventarioDto,
  ) {
    return this.inventarioService.findAll(request.usuario!.empresaId, consulta);
  }

  @Get(':id')
  findOne(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.inventarioService.findOne(request.usuario!.empresaId, id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() updateInventarioDto: UpdateInventarioDto,
  ) {
    return this.inventarioService.update(+id, updateInventarioDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.inventarioService.remove(+id);
  }
}
