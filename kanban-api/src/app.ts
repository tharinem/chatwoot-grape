import Fastify from 'fastify';
import {
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { ZodType } from 'zod';

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

  // Fastify 5.8 compat: validator must be both callable AND have .run()
  app.setValidatorCompiler(({ schema }) => {
    const validate = (data: unknown) => {
      const result = (schema as ZodType).safeParse(data);
      if (!result.success) return { error: result.error, value: undefined };
      return { value: result.data };
    };
    validate.run = validate;
    return validate as typeof validate & { run: typeof validate };
  });
  app.setSerializerCompiler(({ schema }) => (data: unknown) => {
    const result = (schema as ZodType).safeParse(data);
    return JSON.stringify(result.success ? result.data : data);
  });

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

/*
  try {
    startCardCreationWorker();
  } catch {
    console.warn('⚠ Redis not available — card creation worker disabled (CRUD still works)');
  }
*/

  return app.withTypeProvider<ZodTypeProvider>();
}
