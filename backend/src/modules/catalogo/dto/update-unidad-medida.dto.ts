import { PartialType } from '@nestjs/mapped-types';
import { CreateUnidadMedidaDto } from './create-unidad-medida.dto.js';

export class UpdateUnidadMedidaDto extends PartialType(CreateUnidadMedidaDto, {
  skipNullProperties: false,
}) {}
