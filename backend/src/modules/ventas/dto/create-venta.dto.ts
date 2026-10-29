import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsObject,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DetalleVentaDto } from './detalle-venta.dto.js';
import { CreateCreditoDto } from '../../creditos/dto/create-credito.dto.js';

export class CreateVentaDto {
  @IsUUID('4')
  clienteId: string;

  @IsIn(['CONTADO', 'CREDITO'])
  tipoVenta: 'CONTADO' | 'CREDITO' = 'CONTADO';

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsIn(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'])
  metodoPago?: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => CreateCreditoDto)
  credito?: CreateCreditoDto;

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
