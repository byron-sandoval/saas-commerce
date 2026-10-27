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
import { ProveedoresService } from './proveedores.service.js';
import { CreateProveedorDto } from './dto/create-proveedor.dto.js';
import { UpdateProveedorDto } from './dto/update-proveedor.dto.js';
import { ListarProveedoresDto } from './dto/listar-proveedores.dto.js';

@Controller('compras/proveedores')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Post()
  create(@Req() request: SolicitudConUsuario, @Body() dto: CreateProveedorDto) {
    return this.proveedoresService.create(request.usuario!.empresaId, dto);
  }

  @Get()
  @Roles('ADMIN', 'BODEGUERO')
  findAll(
    @Req() request: SolicitudConUsuario,
    @Query() consulta: ListarProveedoresDto,
  ) {
    return this.proveedoresService.findAll(
      request.usuario!.empresaId,
      consulta,
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'BODEGUERO')
  findOne(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.proveedoresService.findOne(request.usuario!.empresaId, id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateProveedorDto,
  ) {
    return this.proveedoresService.update(request.usuario!.empresaId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(204)
  remove(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.proveedoresService.remove(request.usuario!.empresaId, id);
  }
}
