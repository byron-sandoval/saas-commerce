import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { EstadoVenta } from '../../../generated/prisma/enums.js';

export class ListarVentasDto {
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
  @IsEnum(EstadoVenta)
  estado?: EstadoVenta;
}
