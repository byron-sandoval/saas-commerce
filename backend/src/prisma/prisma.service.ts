import 'dotenv/config';
import { Injectable } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { clienteConRls } from './cliente-rls.js';
import { verificarConexionRls } from './verificar-conexion-rls.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.APP_DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'Falta APP_DATABASE_URL para el rol limitado de negocio. DATABASE_URL se reserva para migraciones.',
      );
    }

    super({
      adapter: new PrismaPg({ connectionString }),
    });
    return clienteConRls(this);
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    await verificarConexionRls(this, 'saas_negocio');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
