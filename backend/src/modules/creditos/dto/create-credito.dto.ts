import { IsDateString, IsString, MaxLength, ValidateIf } from 'class-validator';

// Condiciones del credito incluido en una venta nueva. El monto y el cliente
// los obtiene el backend de esa venta, nunca de este DTO.
export class CreateCreditoDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsDateString({ strict: true })
  fechaVencimiento?: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(400)
  descripcion?: string;
}
