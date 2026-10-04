import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { AuthenticatedRequest, AuthenticatedUser } from '../types/authenticated-request';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.header('Authorization');
    const [scheme, token] = header?.split(' ') ?? [];
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Tu sesión expiró. Ingresa nuevamente.',
      });
    }
    try {
      const payload = this.jwt.verify<{
        sub: string;
        sid: string;
        email: string;
      }>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      if (!payload.sub || !payload.sid || !payload.email) throw new Error();
      request.user = {
        userId: payload.sub,
        sessionId: payload.sid,
        email: payload.email,
      };
      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Tu sesión expiró. Ingresa nuevamente.',
      });
    }
  }
}
