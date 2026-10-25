import { PartialType } from '@nestjs/mapped-types';
import { CreateCatalogoDto } from './create-catalogo.dto.js';

export class UpdateCatalogoDto extends PartialType(CreateCatalogoDto) {}
