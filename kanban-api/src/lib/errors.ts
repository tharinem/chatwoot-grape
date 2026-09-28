import type { FastifyReply } from 'fastify';

export function problemResponse(
  reply: FastifyReply,
  status: number,
  title: string,
  detail?: string
) {
  return reply.code(status).send({
    type: `https://kanban.api/errors/${title.toLowerCase().replace(/\s+/g, '-')}`,
    title,
    status,
    detail,
  });
}
