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
import { UnidadesMedidaService } from './unidades-medida.service.js';
import { CreateUnidadMedidaDto } from './dto/create-unidad-medida.dto.js';
import { UpdateUnidadMedidaDto } from './dto/update-unidad-medida.dto.js';
import { ListarUnidadesMedidaDto } from './dto/listar-unidades-medida.dto.js';

@Controller('catalogo/unidades-medida')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class UnidadesMedidaController {
  constructor(private readonly unidadesMedidaService: UnidadesMedidaService) {}

  @Post()
  create(
    @Req() request: SolicitudConUsuario,
    @Body() dto: CreateUnidadMedidaDto,
  ) {
    return this.unidadesMedidaService.create(request.usuario!.empresaId, dto);
  }

  @Get()
  @Roles('ADMIN', 'BODEGUERO', 'CAJERO')
  findAll(
    @Req() request: SolicitudConUsuario,
    @Query() consulta: ListarUnidadesMedidaDto,
  ) {
    return this.unidadesMedidaService.findAll(
      request.usuario!.empresaId,
      consulta,
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'BODEGUERO', 'CAJERO')
  findOne(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.unidadesMedidaService.findOne(request.usuario!.empresaId, id);
  }

  @Patch(':id')
  update(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateUnidadMedidaDto,
  ) {
    return this.unidadesMedidaService.update(
      request.usuario!.empresaId,
      id,
      dto,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.unidadesMedidaService.remove(request.usuario!.empresaId, id);
  }
}
