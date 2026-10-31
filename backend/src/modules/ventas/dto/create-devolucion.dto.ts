import { Type, Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { DetalleVentaDto } from './detalle-venta.dto.js';

export class DetalleDevolucionDto extends DetalleVentaDto {
  @IsIn(['BUENO', 'DANADO'])
  estadoProducto: 'BUENO' | 'DANADO';
}

export class CreateDevolucionDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 500)
  motivo: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((item: DetalleDevolucionDto) => item?.productoId)
  @ValidateNested({ each: true })
  @Type(() => DetalleDevolucionDto)
  detalles: DetalleDevolucionDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((item: DetalleVentaDto) => item?.productoId)
  @ValidateNested({ each: true })
  @Type(() => DetalleVentaDto)
  productosCambio: DetalleVentaDto[];
}
