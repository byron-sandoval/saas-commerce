import 'dotenv/config';
import { Injectable } from '@nestjs/common';
import type { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { verificarConexionRls } from './verificar-conexion-rls.js';

@Injectable()
export class AuthPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.AUTH_DATABASE_URL;
    if (!connectionString)
      throw new Error(
        'Falta AUTH_DATABASE_URL para el rol limitado de identidad.',
      );
    super({ adapter: new PrismaPg({ connectionString }) });
  }
  async onModuleInit() {
    await this.$connect();
    await verificarConexionRls(this, 'saas_identidad');
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
