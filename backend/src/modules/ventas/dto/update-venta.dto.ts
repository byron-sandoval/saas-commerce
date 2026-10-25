import { PartialType } from '@nestjs/mapped-types';
import { CreateVentaDto } from './create-venta.dto.js';

export class UpdateVentaDto extends PartialType(CreateVentaDto) {}
