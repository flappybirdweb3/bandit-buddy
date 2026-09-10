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

  // CORS for Telegram Mini App webview
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`Barn Buddy Backend running on port ${port}`);

  // Register Telegram bot webhook (no-op if BOT_TOKEN not set)
  const appUrl = process.env.APP_URL || 'https://bandit.wvnd.vn';
  const botService = app.get(BotService);
  botService.registerWebhook(`${appUrl}/api/bot/webhook`).catch(() => {});
}

bootstrap();
