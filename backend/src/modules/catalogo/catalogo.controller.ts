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
import { CatalogoService } from './catalogo.service.js';
import { CreateCatalogoDto } from './dto/create-catalogo.dto.js';
import { UpdateCatalogoDto } from './dto/update-catalogo.dto.js';
import { Roles } from '../roles/roles.decorator.js';
import { RolesGuard } from '../roles/roles.guard.js';
import type { SolicitudConUsuario } from '../roles/roles.guard.js';
import { ListarProductosDto } from './dto/listar-productos.dto.js';

@Controller('catalogo/productos')
@UseGuards(RolesGuard)
@Roles('ADMIN', 'BODEGUERO')
export class CatalogoController {
  constructor(private readonly catalogoService: CatalogoService) {}

  @Post()
  create(@Req() request: SolicitudConUsuario, @Body() dto: CreateCatalogoDto) {
    return this.catalogoService.create(request.usuario!.empresaId, dto);
  }

  @Get()
  @Roles('ADMIN', 'BODEGUERO', 'CAJERO')
  findAll(
    @Req() request: SolicitudConUsuario,
    @Query() consulta: ListarProductosDto,
  ) {
    return this.catalogoService.findAll(request.usuario!.empresaId, consulta);
  }

  @Get(':id')
  @Roles('ADMIN', 'BODEGUERO', 'CAJERO')
  findOne(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.catalogoService.findOne(request.usuario!.empresaId, id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateCatalogoDto: UpdateCatalogoDto,
  ) {
    return this.catalogoService.update(
      request.usuario!.empresaId,
      id,
      updateCatalogoDto,
    );
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(204)
  remove(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.catalogoService.remove(request.usuario!.empresaId, id);
  }
}
