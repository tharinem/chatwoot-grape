import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyApiKey } from '../lib/api-key.js';
import prisma from '../lib/prisma.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticateApiKey: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    apiKeyAccount?: { account_id: number };
  }
}

export default fp(async function apiKeyAuthPlugin(fastify: FastifyInstance) {
  fastify.decorate('authenticateApiKey', async function (request: FastifyRequest, reply: FastifyReply) {
    const apiKey = request.headers['x-api-key'] as string | undefined;

    if (!apiKey) {
      return reply.code(401).send({
        type: 'https://kanban.api/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Missing x-api-key header',
      });
    }

    const record = await verifyApiKey(prisma, apiKey);

    if (!record) {
      return reply.code(401).send({
        type: 'https://kanban.api/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or revoked API key',
      });
    }

    request.apiKeyAccount = { account_id: record.accountId };
  });
});
