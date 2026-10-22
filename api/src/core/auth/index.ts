import {
  CanActivate,
  ExecutionContext,
  Global,
  Inject,
  Injectable,
  Module,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import type { Request } from 'express';
import { Configuration } from '../config/index.js';
export interface AuthenticatedRequest extends Request {
  identity: { id: string; email?: string };
}
@Injectable()
export class AuthenticatedUserGuard implements CanActivate {
  private readonly client;
  constructor(@Inject(Configuration) private readonly configuration: Configuration) {
    this.client = createClient(configuration.supabaseUrl, configuration.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer ([^ ]+)$/i.exec(request.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException('Entre na sua conta para continuar.');
    const { data, error } = await this.client.auth.getClaims(match[1]);
    const claims = data?.claims;
    if (
      error ||
      !claims?.sub ||
      claims.iss !== `${this.configuration.supabaseUrl}/auth/v1` ||
      !(Array.isArray(claims.aud)
        ? claims.aud.includes('authenticated')
        : claims.aud === 'authenticated') ||
      Number(claims.exp) <= Date.now() / 1000
    )
      throw new UnauthorizedException('Sua sessão expirou. Entre novamente.');
    request.identity = {
      id: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : undefined,
    };
    return true;
  }
}
@Global()
@Module({ providers: [AuthenticatedUserGuard], exports: [AuthenticatedUserGuard] })
export class AuthModule {}
