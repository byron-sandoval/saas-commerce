import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, ValidateIf } from 'class-validator';

export class CreateEmpresaDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 100)
  nombre: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 255)
  direccion: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Length(1, 20)
  ruc?: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Length(1, 20)
  telefono?: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsEmail()
  @Length(1, 100)
  correo?: string;
}
