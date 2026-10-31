import { IsBoolean } from 'class-validator';

export class ConfiguracionEmpresaDto {
  @IsBoolean()
  devolucionesHabilitadas: boolean;
}
