import type { FastifyInstance } from 'fastify';
import prisma from '../../lib/prisma.js';
import { problemResponse } from '../../lib/errors.js';
import { encryptSecret, tryDecryptSecret } from '../../services/crypto.js';
import { pingChatwoot } from '../../services/chatwoot-client.js';
import {
  accountResponseSchema,
  updateAccountConfigSchema,
  validateTokenResponseSchema,
  type UpdateAccountConfig,
} from '../../schemas/account.js';

export default async function accountRoutes(fastify: FastifyInstance) {
  // GET current account config. Does NOT return the plaintext token.
  fastify.get('/accounts/me', {
    onRequest: [fastify.authenticate],
    schema: { response: { 200: accountResponseSchema } },
  }, async (request, reply) => {
    const { account_id } = request.user;

    const account = await prisma.account.findUnique({ where: { id: account_id } });
    if (!account) {
      return problemResponse(reply, 404, 'Not Found', 'Account not initialized yet');
    }

    return {
      id: account.id,
      chatwoot_base_url: account.chatwootBaseUrl,
      has_api_token: account.chatwootApiToken != null,
      created_at: account.createdAt.toISOString(),
      updated_at: account.updatedAt.toISOString(),
    };
  });

  // PATCH account config. Admin-only.
  fastify.patch('/accounts/me', {
    onRequest: [fastify.authenticate],
    schema: {
      body: updateAccountConfigSchema,
      response: { 200: accountResponseSchema },
    },
  }, async (request, reply) => {
    const { account_id, role } = request.user;
    if (role !== 'administrator') {
      return problemResponse(reply, 403, 'Forbidden', 'Administrator role required');
    }

    const body = request.body as UpdateAccountConfig;

    const updateData: {
      chatwootBaseUrl?: string;
      chatwootApiToken?: string | null;
    } = {};

    if (body.chatwoot_base_url !== undefined) {
      updateData.chatwootBaseUrl = body.chatwoot_base_url;
    }
    if (body.chatwoot_api_token !== undefined) {
      if (body.chatwoot_api_token === null || body.chatwoot_api_token === '') {
        updateData.chatwootApiToken = null;
      } else {
        updateData.chatwootApiToken = encryptSecret(body.chatwoot_api_token);
      }
    }

    const updated = await prisma.account.update({
      where: { id: account_id },
      data: updateData,
    });

    return {
      id: updated.id,
      chatwoot_base_url: updated.chatwootBaseUrl,
      has_api_token: updated.chatwootApiToken != null,
      created_at: updated.createdAt.toISOString(),
      updated_at: updated.updatedAt.toISOString(),
    };
  });

  // POST /accounts/me/validate-chatwoot - admin-only, pings the Chatwoot API
  // with the configured token to confirm the setup works.
  fastify.post('/accounts/me/validate-chatwoot', {
    onRequest: [fastify.authenticate],
    schema: { response: { 200: validateTokenResponseSchema } },
  }, async (request, reply) => {
    const { account_id, role } = request.user;
    if (role !== 'administrator') {
      return problemResponse(reply, 403, 'Forbidden', 'Administrator role required');
    }

    const account = await prisma.account.findUnique({ where: { id: account_id } });
    if (!account) {
      return { ok: false, detail: 'Account not initialized' };
    }
    if (!account.chatwootApiToken) {
      return { ok: false, detail: 'No token configured' };
    }

    const token = tryDecryptSecret(account.chatwootApiToken);
    if (!token) {
      return { ok: false, detail: 'Stored token could not be decrypted (JWT_SECRET may have rotated)' };
    }

    const result = await pingChatwoot({
      baseUrl: account.chatwootBaseUrl,
      accountId: account.id,
      apiToken: token,
    });
    return {
      ok: result.ok,
      detail: result.ok ? 'Connection OK' : `Chatwoot responded with status ${result.status ?? 'error'}`,
    };
  });
}
