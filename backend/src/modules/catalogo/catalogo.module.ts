import { Module } from '@nestjs/common';
import { CatalogoService } from './catalogo.service.js';
import { CatalogoController } from './catalogo.controller.js';
import { RolesModule } from '../roles/roles.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { CategoriasController } from './categorias.controller.js';
import { CategoriasService } from './categorias.service.js';
import { UnidadesMedidaController } from './unidades-medida.controller.js';
import { UnidadesMedidaService } from './unidades-medida.service.js';

@Module({
  imports: [RolesModule, PrismaModule],
  controllers: [
    CatalogoController,
    CategoriasController,
    UnidadesMedidaController,
  ],
  providers: [CatalogoService, CategoriasService, UnidadesMedidaService],
})
export class CatalogoModule {}
