import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

export class CreateCatalogoDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 60)
  sku: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 150)
  nombre: string;

  // Importes como cadenas para conservar su precision decimal.
  @IsString()
  @Matches(/^\d{1,10}(?:\.\d{1,2})?$/, {
    message:
      'precioBase debe ser una cadena decimal no negativa con hasta 2 decimales.',
  })
  precioBase: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/^\d{1,10}(?:\.\d{1,2})?$/, {
    message:
      'precioCosto debe ser una cadena decimal no negativa con hasta 2 decimales.',
  })
  precioCosto?: string;

  @IsOptional()
  @IsString()
  descripcion?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  codigoBarras?: string | null;

  @IsOptional()
  @IsUUID('4')
  categoriaId?: string | null;

  @IsOptional()
  @IsUUID('4')
  unidadMedidaId?: string | null;
}
