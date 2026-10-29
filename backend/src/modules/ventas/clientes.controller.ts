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
import { ClientesService } from './clientes.service.js';
import { CreateClienteDto } from './dto/create-cliente.dto.js';
import { UpdateClienteDto } from './dto/update-cliente.dto.js';
import { ListarClientesDto } from './dto/listar-clientes.dto.js';

@Controller('ventas/clientes')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  create(@Req() request: SolicitudConUsuario, @Body() dto: CreateClienteDto) {
    return this.clientesService.create(request.usuario!.empresaId, dto);
  }

  @Get()
  @Roles('ADMIN', 'CAJERO')
  findAll(
    @Req() request: SolicitudConUsuario,
    @Query() consulta: ListarClientesDto,
  ) {
    return this.clientesService.findAll(request.usuario!.empresaId, consulta);
  }

  @Get(':id')
  @Roles('ADMIN', 'CAJERO')
  findOne(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.clientesService.findOne(request.usuario!.empresaId, id);
  }

  @Patch(':id')
  update(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateClienteDto,
  ) {
    return this.clientesService.update(request.usuario!.empresaId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.clientesService.remove(request.usuario!.empresaId, id);
  }
}
