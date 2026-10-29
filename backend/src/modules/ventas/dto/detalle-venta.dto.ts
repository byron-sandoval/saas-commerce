import { IsString, IsUUID, Matches } from 'class-validator';

export class DetalleVentaDto {
  @IsUUID('4')
  productoId: string;

  @IsString()
  @Matches(/^(?!0+(?:\.0+)?$)\d{1,11}(?:\.\d{1,3})?(?![\s\S])/, {
    message:
      'cantidad debe ser una cadena decimal positiva con hasta 3 decimales.',
  })
  cantidad: string;
}
