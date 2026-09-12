import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Single source of truth for app-level configuration.
 *
 * WHY THIS EXISTS: this setup used to live inline in main.ts's bootstrap(), which
 * Test.createTestingModule() never executes — it only builds the DI container. The e2e
 * app therefore had NO global prefix, so every request to /api/... returned 404 while the
 * suite still "ran". Calling this from both bootstrap() and the e2e beforeAll() makes the
 * tests exercise the real routing table, the real ValidationPipe, and the real CORS rules.
 *
 * Anything added here must NOT be duplicated in main.ts — that is exactly how the two
 * environments drifted apart in the first place.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');

  // Rate limiting (ThrottlerGuard) keys on req.ip. Behind the production reverse proxy
  // every request reports the proxy's own address, so a single 100/min budget would be
  // shared by ALL players. Trust exactly ONE hop — never `true`, which lets a client spoof
  // X-Forwarded-For and bypass limits outright. Only set in production because that is
  // where the proxy exists; without a proxy, trusting a hop would make req.ip spoofable.
  if (process.env.NODE_ENV === 'production') {
    const instance = app.getHttpAdapter().getInstance();
    if (typeof instance?.set === 'function') instance.set('trust proxy', 1);
  }

  // Validation
  //
  // `transform: true` alone does NOT coerce anything: class-transformer only converts a
  // field when the DTO declares an explicit @Type(). `enableImplicitConversion` is
  // deliberately absent and MUST stay absent — with it, body values are coerced to the
  // declared TS type before validators run, which silently turns "0x10" or "1e21" into
  // numbers on money/token fields and defeats the string-based guards.
  //
  // `whitelist` + `forbidNonWhitelisted` are what enforce the mass-assignment guard:
  // a property with no class-validator metadata is stripped, and any unknown property
  // makes the whole request 400.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS for Telegram Mini App webview.
  // Use origin:true (reflect request origin) WITHOUT credentials:true so that
  // Telegram Desktop's sandboxed null-origin context is accepted — the browser
  // rejects ACAC:true + ACAO:null combinations, causing "Failed to fetch".
  // Auth is handled via x-telegram-init-data header (not cookies), so
  // credentials mode is not required.
  // origin:'*' (wildcard) is required for Telegram Web (web.telegram.org) which
  // embeds Mini Apps in a sandboxed iframe — the page origin becomes the opaque
  // value null. Chrome rejects ACAO:"null" (the reflected string) as an invalid
  // CORS value; only ACAO:"*" is accepted for null-origin requests.
  // Safe because credentials:false — auth uses x-telegram-init-data header, not cookies.
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-telegram-init-data', 'x-tg-init'],
    credentials: false,
  });

  // No-auth health endpoint — used by frontend diagnostics to distinguish
  // "can't reach server at all" from "auth/header issue".
  // Registered straight on the HTTP adapter, so it deliberately bypasses
  // setGlobalPrefix and stays reachable at exactly /api/ping.
  app.getHttpAdapter().get('/api/ping', (_req: any, res: any) => {
    res.json({ ok: true });
  });
}
