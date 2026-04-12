import type { FastifyInstance } from 'fastify';
import { webhookPayloadSchema, webhookResponseSchema, type WebhookPayload } from '../../schemas/webhook.js';
import { cardCreationQueue } from '../../queues/card-creation.queue.js';

export default async function webhookRoutes(fastify: FastifyInstance) {
  fastify.post('/webhooks/chatwoot', {
    onRequest: [fastify.authenticateApiKey],
    schema: {
      body: webhookPayloadSchema,
    },
  }, async (request, reply) => {
    const { account_id } = request.apiKeyAccount!;
    const { contact_name, conversation_id, channel_type, assignee_id, phone, email, conversation_url } = request.body as WebhookPayload;

    const customFields: Record<string, unknown> = {
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
      ...(conversation_url ? { conversation_url } : {}),
    };

    /*
    const job = await cardCreationQueue.add('create-card', {
      accountId: account_id,
      contactName: contact_name,
      conversation_id,
      channel_type,
      assignee_id,
      customFields,
    });
    */

    return reply.code(202).send({ status: 'accepted', job_id: 'mock-job-id' });
  });
}
