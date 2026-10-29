import { Transform } from 'class-transformer';
import { IsString, Length, Matches, ValidateIf } from 'class-validator';

export class CerrarCajaDto {
  @IsString()
  @Matches(/^\d{1,12}(?:\.\d{1,2})?(?![\s\S])/, {
    message:
      'efectivoCierre debe ser una cadena decimal no negativa con hasta 2 decimales.',
  })
  efectivoCierre: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Length(1, 1000)
  notas?: string;
}
