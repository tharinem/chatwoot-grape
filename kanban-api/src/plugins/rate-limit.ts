import fp from 'fastify-plugin';
import fastifyRateLimit from '@fastify/rate-limit';

export default fp(async function rateLimitPlugin(fastify) {
  await fastify.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
});
