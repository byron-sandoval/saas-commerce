import { Injectable } from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { CONTEXTO_RLS, contextoRls } from './contexto-rls.js';
import type { ContextoRls } from './contexto-rls.js';

@Injectable()
export class ContextoRlsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context
      .switchToHttp()
      .getRequest<{ [CONTEXTO_RLS]?: ContextoRls }>();
    return new Observable((subscriber) =>
      contextoRls.run(request[CONTEXTO_RLS]!, () =>
        next.handle().subscribe(subscriber),
      ),
    );
  }
}
