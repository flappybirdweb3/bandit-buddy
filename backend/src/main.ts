import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { BotService } from './modules/bot/bot.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api');

  // Validation
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
  // "can't reach server at all" from "auth/header issue"
  app.getHttpAdapter().get('/api/ping', (_req: any, res: any) => {
    res.json({ ok: true });
  });

  const port = process.env.PORT || 3003;
  await app.listen(port);

  console.log(`Barn Buddy Backend running on port ${port}`);

  // Register Telegram bot webhook (no-op if BOT_TOKEN not set)
  const appUrl = process.env.APP_URL || 'https://flappyx.com';
  const botService = app.get(BotService);
  botService.registerWebhook(`${appUrl}/api/bot/webhook`).catch(() => {});
}

bootstrap();
