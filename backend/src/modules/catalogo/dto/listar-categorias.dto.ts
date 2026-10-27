import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class ListarCategoriasDto {
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
}
