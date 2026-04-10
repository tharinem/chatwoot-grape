import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { user_id: number; account_id: number; role: string };
    user: { user_id: number; account_id: number; role: string };
  }
}

export default fp(async function authPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET!,
  });

  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({
        type: 'https://kanban.api/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or expired token',
      });
    }
  });
});
