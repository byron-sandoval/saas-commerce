import { Injectable } from '@nestjs/common';
import type { Auth, BetterAuthOptions } from 'better-auth';
import { betterAuth } from 'better-auth/minimal';
import { PrismaService } from '../../prisma/prisma.service.js';
import { createAuthOptions } from './auth.config.js';

@Injectable()
export class AuthService {
  readonly auth: Auth<BetterAuthOptions>;

  constructor(prisma: PrismaService) {
    this.auth = betterAuth(createAuthOptions(prisma));
  }
}
