import { Injectable } from '@nestjs/common';
import { CreateCreditoDto } from './dto/create-credito.dto.js';
import { UpdateCreditoDto } from './dto/update-credito.dto.js';

@Injectable()
export class CreditosService {
  create(createCreditoDto: CreateCreditoDto) {
    return 'This action adds a new credito';
  }

  findAll() {
    return `This action returns all creditos`;
  }

  findOne(id: number) {
    return `This action returns a #${id} credito`;
  }

  update(id: number, updateCreditoDto: UpdateCreditoDto) {
    return `This action updates a #${id} credito`;
  }

  remove(id: number) {
    return `This action removes a #${id} credito`;
  }
}
