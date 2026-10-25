import { PartialType } from '@nestjs/mapped-types';
import { CreateCreditoDto } from './create-credito.dto.js';

export class UpdateCreditoDto extends PartialType(CreateCreditoDto) {}
