import type { FastifyInstance } from 'fastify';
import { chatwootTokenSchema, tokenResponseSchema } from '../../schemas/auth.js';
import { validateChatwootToken } from '../../services/chatwoot-auth.js';
import { seedDefaultStages } from '../../services/stage-seed.js';
import { seedApiKey } from '../../services/api-key-seed.js';
import { problemResponse } from '../../lib/errors.js';
import prisma from '../../lib/prisma.js';

function resolveBaseUrl(): string {
  return (
    process.env.CHATWOOT_URL ??
    process.env.CHATWOOT_BASE_URL ??
    'https://app.chatwoot.com'
  );
}

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/auth/chatwoot-token', {
    schema: {
      body: chatwootTokenSchema,
    },
  }, async (request, reply) => {
    const { chatwoot_token, account_id } = request.body as {
      chatwoot_token: string;
      account_id: number;
    };

    const profile = await validateChatwootToken(chatwoot_token);
    if (!profile) {
      return problemResponse(reply, 401, 'Unauthorized', 'Invalid Chatwoot token');
    }

    const accountMembership = profile.accounts.find(
      (a) => a.id === account_id
    );
    if (!accountMembership) {
      return problemResponse(reply, 403, 'Forbidden', 'Not a member of this account');
    }

    // Ensure per-tenant config row exists. First login for an account creates
    // the row with the server-wide default baseUrl; admin can change it later
    // via PATCH /accounts/me.
    await prisma.account.upsert({
      where: { id: account_id },
      update: {},
      create: {
        id: account_id,
        chatwootBaseUrl: resolveBaseUrl(),
      },
    });

    await seedDefaultStages(prisma, account_id);
    const apiKeyRaw = await seedApiKey(prisma, account_id);

    const token = fastify.jwt.sign(
      {
        user_id: profile.id,
        account_id,
        role: accountMembership.role,
      },
      { expiresIn: '1h' }
    );

    return { token, ...(apiKeyRaw ? { api_key: apiKeyRaw } : {}) };
  });
}
