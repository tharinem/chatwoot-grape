import { Queue } from 'bullmq';
import { redisConnection } from '../lib/redis.js';

export interface CardCreationJobData {
  accountId: number;
  contactName: string;
  conversationId: number;
  channelType?: string;
  assigneeId?: number;
  customFields?: Record<string, unknown>;
}

/*
export const cardCreationQueue = new Queue<CardCreationJobData>('card-creation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});
*/
export const cardCreationQueue: any = { add: async () => ({ id: 'mock-job-id' }) };
