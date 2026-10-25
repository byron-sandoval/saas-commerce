import { PartialType } from '@nestjs/mapped-types';
import { CreateCatalogoDto } from './create-catalogo.dto.js';
import { IsBoolean, ValidateIf } from 'class-validator';

export class UpdateCatalogoDto extends PartialType(CreateCatalogoDto, {
  skipNullProperties: false,
}) {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsBoolean()
  activo?: boolean;
}
