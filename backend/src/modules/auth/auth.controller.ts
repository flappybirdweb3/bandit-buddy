import { Controller, Get, Post, Body, Query, Res, UnauthorizedException } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { Response } from 'express';
import { AuthService } from './auth.service';

class SessionDto {
  @IsString()
  @IsNotEmpty()
  initData: string;
}

const COOKIE_NAME = 'bb_sess';
const COOKIE_TTL_MS = 86400 * 1000 * 7; // 7 days

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // GET variant: simplest possible request (no custom headers, no body)
  // Used by clients behind proxies that block POST or custom headers.
  //
  // The session token is returned in the response body so clients that cannot receive
  // cookies (cross-origin Mini App iframes) or cannot send custom headers (Telegram
  // proxy accounts that block x-telegram-init-data) can use it as
  // "Authorization: Bearer <token>" on subsequent requests — a standard header that
  // passes through all compliant HTTP proxies.
  @Get('session')
  async createSessionGet(
    @Query('d') d: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: boolean; token?: string }> {
    if (!d) {
      return { ok: false };
    }
    try {
      const initData = Buffer.from(d, 'base64').toString('utf8');
      if (!initData) return { ok: false };
      const { token } = await this.authService.createSession(initData);
      res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', maxAge: COOKIE_TTL_MS, path: '/' });
      return { ok: true, token };
    } catch (err: any) {
      throw new UnauthorizedException(err?.message ?? 'Auth failed');
    }
  }

  // POST variant: kept for backward compat / non-proxy environments
  @Post('session')
  async createSessionPost(
    @Body() body: SessionDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ token: string }> {
    try {
      const { token } = await this.authService.createSession(body.initData);
      res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', maxAge: COOKIE_TTL_MS, path: '/' });
      return { token };
    } catch (err: any) {
      throw new UnauthorizedException(err?.message ?? 'Auth failed');
    }
  }

  // Clear session cookie on multi-account switch or re-login
  @Get('logout')
  async logoutGet(@Res({ passthrough: true }) res: Response): Promise<{ ok: boolean }> {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  @Post('logout')
  async logoutPost(@Res({ passthrough: true }) res: Response): Promise<{ ok: boolean }> {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return { ok: true };
  }
}
