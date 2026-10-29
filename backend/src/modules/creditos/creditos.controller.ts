import {
  Controller,
  Get,
  Param,
  UseGuards,
  Req,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CreditosService } from './creditos.service.js';
import { ListarCreditosDto } from './dto/listar-creditos.dto.js';

import { Roles } from '../roles/roles.decorator.js';
import { RolesGuard } from '../roles/roles.guard.js';
import type { SolicitudConUsuario } from '../roles/roles.guard.js';

@Controller('creditos')
@UseGuards(RolesGuard)
@Roles('ADMIN', 'CAJERO')
export class CreditosController {
  constructor(private readonly creditosService: CreditosService) {}

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
