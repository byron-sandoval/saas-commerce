import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DetalleVentaDto } from './detalle-venta.dto.js';

export class CreateVentaDto {
  @IsUUID('4')
  clienteId: string;

  @IsIn(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'])
  metodoPago: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' = 'EFECTIVO';

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/^\d{1,12}(?:\.\d{1,2})?(?![\s\S])/, {
    message:
      'importeRecibido debe ser una cadena decimal no negativa con hasta 2 decimales.',
  })
  importeRecibido?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @Length(1, 100)
  referenciaPago?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((detalle: DetalleVentaDto) => detalle?.productoId)
  @ValidateNested({ each: true })
  @Type(() => DetalleVentaDto)
  detalles: DetalleVentaDto[];
}
