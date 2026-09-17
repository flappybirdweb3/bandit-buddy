import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  // Track rate limits by authenticated userId rather than IP.
  // Without this, all requests from the same NAT/proxy (e.g. a Telegram data center
  // or a load-test runner on localhost) share a single bucket and collectively hit
  // the limit after 100 requests — every user behind the same IP gets throttled.
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.id;
    return userId ? `uid:${userId}` : (req.ip ?? 'unknown');
  }
}
