import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get<string>('redis.host') ?? 'localhost';
    const port = this.config.get<number>('redis.port') ?? 6379;
    this.client = new Redis({ host, port, lazyConnect: true });
    this.client.on('error', (err) => this.logger.warn(`Redis error: ${err.message}`));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  // Increment a counter with TTL (seconds). Returns new count.
  async incr(key: string, ttlSec: number): Promise<number> {
    const count = await this.client.incr(key);
    if (count === 1) await this.client.expire(key, ttlSec);
    return count;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSec?: number): Promise<void> {
    if (ttlSec) await this.client.set(key, value, 'EX', ttlSec);
    else await this.client.set(key, value);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  // Increment float counter with optional TTL (seconds). Returns new total float.
  async incrByFloat(key: string, amount: number, ttlSec?: number): Promise<number> {
    const res = await this.client.incrbyfloat(key, amount);
    const count = Number(res);
    if (ttlSec) {
      const currentTtl = await this.client.ttl(key);
      if (currentTtl === -1) {
        await this.client.expire(key, ttlSec);
      }
    }
    return count;
  }

  // Decrement float counter (safely floors at 0).
  async decrByFloat(key: string, amount: number): Promise<number> {
    const res = await this.client.incrbyfloat(key, -amount);
    let count = Number(res);
    if (count < 0) {
      await this.client.set(key, '0');
      count = 0;
    }
    return count;
  }
}
