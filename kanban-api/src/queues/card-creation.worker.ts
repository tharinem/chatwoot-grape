import { Worker, type Job } from 'bullmq';
import { redisConnection } from '../lib/redis.js';
import prisma from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import type { CardCreationJobData } from './card-creation.queue.js';

export function startCardCreationWorker() {
  const worker = new Worker<CardCreationJobData>(
    'card-creation',
    async (job: Job<CardCreationJobData>) => {
      const { accountId, contactName, conversationId, channelType, assigneeId, customFields } = job.data;

      const firstStage = await prisma.stage.findFirst({
        where: { accountId },
        orderBy: { position: 'asc' },
      });

      if (!firstStage) {
        throw new Error(`No stages found for account ${accountId}`);
      }

      const agg = await prisma.card.aggregate({
        where: { accountId, stageId: firstStage.id, deletedAt: null },
        _max: { position: true },
      });
      const nextPos = (agg._max.position ?? 0) + 1;

      await prisma.card.upsert({
        where: {
          accountId_conversationId: { accountId, conversationId },
        },
        create: {
          accountId,
          stageId: firstStage.id,
          contactName,
          conversationId,
          channelType: channelType ?? null,
          assigneeId: assigneeId ?? null,
          customFields: customFields ? JSON.stringify(customFields) : null,
          position: nextPos,
        },
        update: {},
      });
    },
    { connection: redisConnection, concurrency: 5 },
  );

  worker.on('error', () => {
    // Silently ignore Redis connection errors — CRUD works without the worker
  });

  return worker;
}
