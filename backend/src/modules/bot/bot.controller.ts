import { Controller, Post, Body, Headers, Logger, HttpCode } from '@nestjs/common';
import { BotService } from './bot.service';

@Controller('bot')
export class BotController {
  private readonly logger = new Logger(BotController.name);

  constructor(private readonly botService: BotService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Body() update: any,
    @Headers('x-telegram-bot-api-secret-token') secret: string,
  ): Promise<{ ok: boolean }> {
    this.logger.debug(`Webhook update type: ${update?.message ? 'message' : update?.callback_query ? 'callback' : 'other'}`);
    await this.botService.handleUpdate(update, secret);
    return { ok: true };
  }
}
