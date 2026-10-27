import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ItemCompraDto } from './item-compra.dto.js';

export class CreateCompraDto {
  @IsUUID('4')
  proveedorId: string;

  @IsOptional()
  @IsDateString({ strict: true })
  fechaEntregaEst?: string | null;

  @IsOptional()
  @IsString()
  nota?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((item: ItemCompraDto) => item?.productoId)
  @ValidateNested({ each: true })
  @Type(() => ItemCompraDto)
  items: ItemCompraDto[];
}
