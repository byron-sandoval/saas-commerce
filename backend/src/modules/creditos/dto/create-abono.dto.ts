import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { MetodoPago } from '../../../generated/prisma/enums.js';

export class CreateAbonoDto {
  @IsString()
  @Matches(/^\d{1,12}(?:\.\d{1,2})?(?![\s\S])/, {
    message: 'monto debe ser una cadena decimal con hasta 2 decimales.',
  })
  monto: string;

  @IsEnum(MetodoPago)
  metodoPago: MetodoPago = MetodoPago.EFECTIVO;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  referenciaPago?: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(400)
  descripcion?: string;
}
