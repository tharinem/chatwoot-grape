import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import swaggerPlugin from './plugins/swagger.js';
import corsPlugin from './plugins/cors.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import authPlugin from './plugins/auth.js';
import apiKeyAuthPlugin from './plugins/api-key-auth.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/v1/auth.js';
import stageRoutes from './routes/v1/stages.js';
import cardRoutes from './routes/v1/cards.js';
import webhookRoutes from './routes/v1/webhooks.js';
import apiKeyRoutes from './routes/v1/api-keys.js';
import { startCardCreationWorker } from './queues/card-creation.worker.js';

export async function buildApp() {
  const app = Fastify({ logger: true });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(swaggerPlugin);
  await app.register(corsPlugin);
  await app.register(rateLimitPlugin);
  await app.register(authPlugin);
  await app.register(apiKeyAuthPlugin);

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(stageRoutes, { prefix: '/api/v1' });
  await app.register(cardRoutes, { prefix: '/api/v1' });
  await app.register(webhookRoutes, { prefix: '/api/v1' });
  await app.register(apiKeyRoutes, { prefix: '/api/v1' });

  startCardCreationWorker();

  return app.withTypeProvider<ZodTypeProvider>();
}
