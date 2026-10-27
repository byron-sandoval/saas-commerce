import { IsString, IsUUID, Matches, IsOptional } from 'class-validator';

export class ItemCompraDto {
  @IsUUID('4')
  productoId: string;

  @IsString()
  @Matches(/^(?!0+(?:\.0+)?$)\d{1,11}(?:\.\d{1,3})?$/, {
    message:
      'cantidadSolicitada debe ser una cadena decimal positiva con hasta 3 decimales.',
  })
  cantidadSolicitada: string;

  @IsString()
  @Matches(/^\d{1,10}(?:\.\d{1,2})?$/, {
    message:
      'costoUnitario debe ser una cadena decimal no negativa con hasta 2 decimales.',
  })
  costoUnitario: string;

  @IsOptional()
  @IsString()
  nota?: string | null;
}
