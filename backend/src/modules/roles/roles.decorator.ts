import { SetMetadata } from '@nestjs/common';
import type { NombreRolInicial } from './roles.constants.js';

export const ROLES_PERMITIDOS = 'rolesPermitidos';

export const Roles = (...roles: NombreRolInicial[]) =>
  SetMetadata(ROLES_PERMITIDOS, roles);
