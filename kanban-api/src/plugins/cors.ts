import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';

export default fp(async function corsPlugin(fastify) {
  await fastify.register(fastifyCors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
});
