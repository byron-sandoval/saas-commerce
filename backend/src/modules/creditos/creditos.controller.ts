import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { CreditosService } from './creditos.service.js';
import { CreateCreditoDto } from './dto/create-credito.dto.js';
import { UpdateCreditoDto } from './dto/update-credito.dto.js';

import { Roles } from '../roles/roles.decorator.js';
import { RolesGuard } from '../roles/roles.guard.js';

@Controller('creditos')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class CreditosController {
  constructor(private readonly creditosService: CreditosService) {}

  @Post()
  create(@Body() createCreditoDto: CreateCreditoDto) {
    return this.creditosService.create(createCreditoDto);
  }

  @Get()
  @Roles('ADMIN', 'CAJERO')
  findAll() {
    return this.creditosService.findAll();
  }

  @Get(':id')
  @Roles('ADMIN', 'CAJERO')
  findOne(@Param('id') id: string) {
    return this.creditosService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCreditoDto: UpdateCreditoDto) {
    return this.creditosService.update(+id, updateCreditoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.creditosService.remove(+id);
  }
}
