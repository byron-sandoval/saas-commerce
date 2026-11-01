import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ConfiguracionEmpresaDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @Transform(recortar)
  @IsString()
  @Length(1, 100)
  nombre?: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @Transform(recortar)
  @IsString()
  @Length(1, 255)
  direccion?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @Length(1, 20)
  ruc?: string | null;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @Length(1, 20)
  telefono?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @Length(1, 100)
  correo?: string | null;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/^(?:100(?:\.0{1,2})?|\d{1,2}(?:\.\d{1,2})?)(?![\s\S])/, {
    message:
      'porcentajeIva debe ser una cadena decimal entre 0 y 100, con hasta 2 decimales.',
  })
  porcentajeIva?: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsBoolean()
  devolucionesHabilitadas?: boolean;
}
