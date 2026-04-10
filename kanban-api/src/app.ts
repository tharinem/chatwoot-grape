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
import healthRoutes from './routes/health.js';
import authRoutes from './routes/v1/auth.js';
import stageRoutes from './routes/v1/stages.js';
import cardRoutes from './routes/v1/cards.js';

export async function buildApp() {
  const app = Fastify({ logger: true });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(swaggerPlugin);
  await app.register(corsPlugin);
  await app.register(rateLimitPlugin);
  await app.register(authPlugin);

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(stageRoutes, { prefix: '/api/v1' });
  await app.register(cardRoutes, { prefix: '/api/v1' });

  return app.withTypeProvider<ZodTypeProvider>();
}
