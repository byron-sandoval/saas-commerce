import { PartialType } from '@nestjs/mapped-types';
import { CreateCompraDto } from './create-compra.dto.js';

export class UpdateCompraDto extends PartialType(CreateCompraDto) {}
