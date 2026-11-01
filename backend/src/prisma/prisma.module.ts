import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { AuthPrismaService } from './auth-prisma.service.js';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ContextoRlsInterceptor } from './contexto-rls.interceptor.js';

@Module({
  providers: [
    PrismaService,
    AuthPrismaService,
    { provide: APP_INTERCEPTOR, useClass: ContextoRlsInterceptor },
  ],
  exports: [PrismaService, AuthPrismaService],
})
export class PrismaModule {}
