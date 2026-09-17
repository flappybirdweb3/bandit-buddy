import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BotService } from './modules/bot/bot.service';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Shared app-level setup — the SAME function runs in the e2e tests, so they exercise
  // the real global prefix, ValidationPipe and CORS rules instead of an unconfigured app.
  configureApp(app);

  const port = process.env.PORT || 3003;
  await app.listen(port);

  console.log(`Barn Buddy Backend running on port ${port}`);

  // Register Telegram bot webhook (no-op if BOT_TOKEN not set)
  const appUrl = (process.env.APP_URL || 'https://dapp.banditbuddy.xyz').split('?')[0].replace(/\/$/, '');
  const botService = app.get(BotService);
  botService.registerWebhook(`${appUrl}/api/bot/webhook`).catch(() => {});
}

bootstrap();
