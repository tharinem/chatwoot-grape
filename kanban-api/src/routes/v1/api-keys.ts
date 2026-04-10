import type { FastifyInstance } from 'fastify';
import type { JwtPayload } from '../../middleware/tenant.js';
import { createApiKeyResponseSchema } from '../../schemas/api-key.js';
import { generateApiKey } from '../../lib/api-key.js';
import { problemResponse } from '../../lib/errors.js';
import prisma from '../../lib/prisma.js';

export default async function apiKeyRoutes(fastify: FastifyInstance) {
  // POST /api-keys — Generate new API key (admin only, revokes existing)
  fastify.post('/api-keys', {
    onRequest: [fastify.authenticate],
    schema: {
      response: { 200: createApiKeyResponseSchema },
    },
  }, async (request, reply) => {
    const { account_id, role } = request.user as JwtPayload;

    if (role !== 'administrator') {
      return problemResponse(reply, 403, 'Forbidden', 'Only administrators can manage API keys');
    }

    // Revoke all existing active keys for this account
    await prisma.apiKey.updateMany({
      where: { accountId: account_id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const { raw, prefix, hash, salt } = generateApiKey();

    const record = await prisma.apiKey.create({
      data: { accountId: account_id, keyHash: hash, salt, prefix },
    });

    return { id: record.id, raw_key: raw, prefix };
  });

  // DELETE /api-keys/:id — Revoke specific key (admin only)
  fastify.delete('/api-keys/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { account_id, role } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    if (role !== 'administrator') {
      return problemResponse(reply, 403, 'Forbidden', 'Only administrators can manage API keys');
    }

    const key = await prisma.apiKey.findFirst({
      where: { id, accountId: account_id, revokedAt: null },
    });

    if (!key) {
      return problemResponse(reply, 404, 'Not Found', 'API key not found');
    }

    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return reply.code(204).send();
  });
}
