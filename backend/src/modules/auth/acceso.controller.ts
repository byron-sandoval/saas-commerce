import { Controller, Get, Header, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AccesoService } from './acceso.service.js';

@Controller('auth')
export class AccesoController {
  constructor(private readonly acceso: AccesoService) {}

  @Get('contexto')
  @Header('Cache-Control', 'private, no-store')
  consultar(@Req() request: Request) {
    return this.acceso.consultar(request.headers);
  }
}
