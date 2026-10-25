import { PartialType } from '@nestjs/mapped-types';
import { CreateEmpresaDto } from './create-empresa.dto.js';

export class UpdateEmpresaDto extends PartialType(CreateEmpresaDto) {}
