import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CreditosService } from './creditos.service.js';
import { CreateCreditoDto } from './dto/create-credito.dto.js';
import { UpdateCreditoDto } from './dto/update-credito.dto.js';

@Controller('creditos')
export class CreditosController {
  constructor(private readonly creditosService: CreditosService) {}

  @Post()
  create(@Body() createCreditoDto: CreateCreditoDto) {
    return this.creditosService.create(createCreditoDto);
  }

  @Get()
  findAll() {
    return this.creditosService.findAll();
  }

  @Get(':id')
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
