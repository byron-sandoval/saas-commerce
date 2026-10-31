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
  HttpCode,
  Header,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service.js';
import { CreateUsuarioDto } from './dto/create-usuario.dto.js';
import { UpdateUsuarioDto } from './dto/update-usuario.dto.js';
import { ListarUsuariosDto } from './dto/listar-usuarios.dto.js';
import type { SolicitudConUsuario } from '../roles/roles.guard.js';

import { Roles } from '../roles/roles.decorator.js';
import { RolesGuard } from '../roles/roles.guard.js';

@Controller('usuarios')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  create(
    @Req() request: SolicitudConUsuario,
    @Body() createUsuarioDto: CreateUsuarioDto,
  ) {
    return this.usuariosService.create(
      request.usuario!.empresaId,
      createUsuarioDto,
    );
  }

  @Get()
  findAll(
    @Req() request: SolicitudConUsuario,
    @Query() consulta: ListarUsuariosDto,
  ) {
    return this.usuariosService.findAll(request.usuario!.empresaId, consulta);
  }

  @Get(':id')
  findOne(@Req() request: SolicitudConUsuario, @Param('id') id: string) {
    return this.usuariosService.findOne(request.usuario!.empresaId, id);
  }

  @Patch(':id')
  update(
    @Req() request: SolicitudConUsuario,
    @Param('id') id: string,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
  ) {
    return this.usuariosService.update(
      request.usuario!.empresaId,
      id,
      updateUsuarioDto,
    );
  }

  @Delete(':id')
  remove(@Req() request: SolicitudConUsuario, @Param('id') id: string) {
    return this.usuariosService.remove(request.usuario!.empresaId, id);
  }

  @Post(':id/reactivar')
  @HttpCode(200)
  reactivar(@Req() request: SolicitudConUsuario, @Param('id') id: string) {
    return this.usuariosService.reactivar(request.usuario!.empresaId, id);
  }

  @Post(':id/password-temporal')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  restablecerPassword(
    @Req() request: SolicitudConUsuario,
    @Param('id') id: string,
  ) {
    return this.usuariosService.restablecerPassword(
      request.usuario!.empresaId,
      id,
    );
  }
}
