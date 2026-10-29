import { IsOptional, IsString, Matches } from 'class-validator';

export class CreateCajaDto {
  @IsString()
  @Matches(/^\d{1,12}(?:\.\d{1,2})?(?![\s\S])/, {
    message:
      'efectivoInicial debe ser una cadena decimal no negativa con hasta 2 decimales.',
  })
  efectivoInicial: string;

  @IsOptional()
  @IsString()
  notas?: string | null;
}
