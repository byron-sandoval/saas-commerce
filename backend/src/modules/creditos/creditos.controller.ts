import {
  Controller,
  Get,
  Param,
  UseGuards,
  Req,
  Query,
  ParseUUIDPipe,
  Post,
  Body,
} from '@nestjs/common';
import { CreditosService } from './creditos.service.js';
import { ListarCreditosDto } from './dto/listar-creditos.dto.js';
import { CreateAbonoDto } from './dto/create-abono.dto.js';
import { ListarAbonosDto } from './dto/listar-abonos.dto.js';

import { Roles } from '../roles/roles.decorator.js';
import { RolesGuard } from '../roles/roles.guard.js';
import type { SolicitudConUsuario } from '../roles/roles.guard.js';

@Controller('creditos')
@UseGuards(RolesGuard)
@Roles('ADMIN', 'CAJERO')
export class CreditosController {
  constructor(private readonly creditosService: CreditosService) {}

  @Post(':id/abonos')
  cobrarAbono(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateAbonoDto,
  ) {
    return this.creditosService.cobrarAbono(
      request.usuario!.empresaId,
      request.usuario!.id,
      id,
      dto,
    );
  }

  @Get(':id/abonos')
  listarAbonos(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() consulta: ListarAbonosDto,
  ) {
    return this.creditosService.listarAbonos(
      request.usuario!.empresaId,
      id,
      consulta,
    );
  }

  @Get()
  findAll(
    @Req() request: SolicitudConUsuario,
    @Query() consulta: ListarCreditosDto,
  ) {
    return this.creditosService.findAll(request.usuario!.empresaId, consulta);
  }

  @Get(':id')
  findOne(
    @Req() request: SolicitudConUsuario,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.creditosService.findOne(request.usuario!.empresaId, id);
  }
}
