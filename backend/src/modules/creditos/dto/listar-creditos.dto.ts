import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { EstadoCredito } from '../../../generated/prisma/enums.js';

export class ListarCreditosDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  pagina = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite = 20;

  @IsOptional()
  @IsEnum(EstadoCredito)
  estado?: EstadoCredito;

  @IsOptional()
  @IsUUID('4')
  clienteId?: string;
}
