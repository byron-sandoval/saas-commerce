import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../roles/roles.decorator.js';
import { RolesGuard } from '../roles/roles.guard.js';
import type { SolicitudConUsuario } from '../roles/roles.guard.js';
import { CategoriasService } from './categorias.service.js';
import { CreateCategoriaDto } from './dto/create-categoria.dto.js';
import { UpdateCategoriaDto } from './dto/update-categoria.dto.js';
import { ListarCategoriasDto } from './dto/listar-categorias.dto.js';

@Controller('catalogo/categorias')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Post()
  create(@Req() request: SolicitudConUsuario, @Body() dto: CreateCategoriaDto) {
    return this.categoriasService.create(request.usuario!.empresaId, dto);
  }

  @Get()
  @Roles('ADMIN', 'BODEGUERO', 'CAJERO')
  findAll(
    @Req() request: SolicitudConUsuario,
    @Query() consulta: ListarCategoriasDto,
  ) {
    return this.categoriasService.findAll(request.usuario!.empresaId, consulta);
  }

  @Get(':id')
  @Roles('ADMIN', 'BODEGUERO', 'CAJERO')
  findOne(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.categoriasService.findOne(request.usuario!.empresaId, id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCategoriaDto,
  ) {
    return this.categoriasService.update(request.usuario!.empresaId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(204)
  remove(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.categoriasService.remove(request.usuario!.empresaId, id);
  }
}
