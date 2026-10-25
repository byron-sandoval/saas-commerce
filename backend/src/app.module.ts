import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { EmpresasModule } from './modules/empresas/empresas.module.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';
import { CatalogoModule } from './modules/catalogo/catalogo.module.js';
import { InventarioModule } from './modules/inventario/inventario.module.js';
import { ComprasModule } from './modules/compras/compras.module.js';
import { VentasModule } from './modules/ventas/ventas.module.js';
import { CajaModule } from './modules/caja/caja.module.js';
import { CreditosModule } from './modules/creditos/creditos.module.js';

@Module({
  imports: [PrismaModule, AuthModule, RolesModule, EmpresasModule, UsuariosModule, CatalogoModule, InventarioModule, ComprasModule, VentasModule, CajaModule, CreditosModule],
})
export class AppModule {}
