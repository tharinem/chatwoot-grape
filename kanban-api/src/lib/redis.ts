import type { ConnectionOptions } from 'bullmq';

export const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  db: parseInt(process.env.BULLMQ_REDIS_DB ?? '2', 10),
  maxRetriesPerRequest: null,
  password: process.env.REDIS_PASSWORD || undefined,
};
