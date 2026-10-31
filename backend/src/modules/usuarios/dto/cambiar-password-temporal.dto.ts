import { IsString, Length } from 'class-validator';

export class CambiarPasswordTemporalDto {
  @IsString()
  @Length(8, 128)
  passwordActual: string;

  @IsString()
  @Length(12, 128)
  passwordNueva: string;
}
