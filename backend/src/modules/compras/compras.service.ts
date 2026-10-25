import { Injectable } from '@nestjs/common';
import { CreateCompraDto } from './dto/create-compra.dto.js';
import { UpdateCompraDto } from './dto/update-compra.dto.js';

@Injectable()
export class ComprasService {
  create(createCompraDto: CreateCompraDto) {
    return 'This action adds a new compra';
  }

  findAll() {
    return `This action returns all compras`;
  }

  findOne(id: number) {
    return `This action returns a #${id} compra`;
  }

  update(id: number, updateCompraDto: UpdateCompraDto) {
    return `This action updates a #${id} compra`;
  }

  remove(id: number) {
    return `This action removes a #${id} compra`;
  }
}
