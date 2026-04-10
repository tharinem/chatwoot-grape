import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  stageSchema,
  createStageSchema,
  updateStageSchema,
  reorderStagesSchema,
  stageParamsSchema,
} from '../../schemas/stage.js';
import { problemResponse } from '../../lib/errors.js';
import prisma from '../../lib/prisma.js';
import type { JwtPayload } from '../../middleware/tenant.js';

function requireAdmin(role: string) {
  return role === 'administrator';
}

export default async function stageRoutes(fastify: FastifyInstance) {
  // GET /stages — all authenticated roles
  fastify.get('/stages', {
    onRequest: [fastify.authenticate],
    schema: {
      response: { 200: z.array(stageSchema.extend({ _count: z.object({ cards: z.number() }).optional() })) },
    },
  }, async (request) => {
    const { account_id } = request.user as JwtPayload;
    const stages = await prisma.stage.findMany({
      where: { accountId: account_id },
      orderBy: { position: 'asc' },
      include: { _count: { select: { cards: { where: { deletedAt: null } } } } },
    });
    return stages;
  });

  // POST /stages — admin only
  fastify.post('/stages', {
    onRequest: [fastify.authenticate],
    schema: {
      body: createStageSchema,
      response: { 201: stageSchema },
    },
  }, async (request, reply) => {
    const { account_id, role } = request.user as JwtPayload;
    if (!requireAdmin(role)) {
      return problemResponse(reply, 403, 'Forbidden', 'Admin access required');
    }

    const body = request.body as z.infer<typeof createStageSchema>;
    const maxPos = await prisma.stage.aggregate({
      where: { accountId: account_id },
      _max: { position: true },
    });
    const nextPos = (maxPos._max.position ?? 0) + 1;

    const stage = await prisma.stage.create({
      data: {
        accountId: account_id,
        name: body.name,
        position: nextPos,
        color: body.color ?? null,
      },
    });

    return reply.code(201).send(stage);
  });

  // PATCH /stages/reorder — admin only (MUST be before /:id)
  fastify.patch('/stages/reorder', {
    onRequest: [fastify.authenticate],
    schema: {
      body: reorderStagesSchema,
      response: { 200: z.array(stageSchema) },
    },
  }, async (request, reply) => {
    const { account_id, role } = request.user as JwtPayload;
    if (!requireAdmin(role)) {
      return problemResponse(reply, 403, 'Forbidden', 'Admin access required');
    }

    const { stages } = request.body as z.infer<typeof reorderStagesSchema>;

    await prisma.$transaction(
      stages.map((s) =>
        prisma.stage.update({
          where: { id: s.id, accountId: account_id },
          data: { position: s.position },
        })
      )
    );

    const updated = await prisma.stage.findMany({
      where: { accountId: account_id },
      orderBy: { position: 'asc' },
    });

    return updated;
  });

  // PATCH /stages/:id — admin only
  fastify.patch('/stages/:id', {
    onRequest: [fastify.authenticate],
    schema: {
      params: stageParamsSchema,
      body: updateStageSchema,
      response: { 200: stageSchema },
    },
  }, async (request, reply) => {
    const { account_id, role } = request.user as JwtPayload;
    if (!requireAdmin(role)) {
      return problemResponse(reply, 403, 'Forbidden', 'Admin access required');
    }

    const { id } = request.params as z.infer<typeof stageParamsSchema>;
    const body = request.body as z.infer<typeof updateStageSchema>;

    try {
      const stage = await prisma.stage.update({
        where: { id, accountId: account_id },
        data: { ...body },
      });
      return stage;
    } catch (err: unknown) {
      if (
        typeof err === 'object' && err !== null &&
        'code' in err && (err as { code: string }).code === 'P2025'
      ) {
        return problemResponse(reply, 404, 'Not Found', 'Stage not found');
      }
      throw err;
    }
  });

  // DELETE /stages/:id — admin only
  fastify.delete('/stages/:id', {
    onRequest: [fastify.authenticate],
    schema: {
      params: stageParamsSchema,
    },
  }, async (request, reply) => {
    const { account_id, role } = request.user as JwtPayload;
    if (!requireAdmin(role)) {
      return problemResponse(reply, 403, 'Forbidden', 'Admin access required');
    }

    const { id } = request.params as z.infer<typeof stageParamsSchema>;

    const cardCount = await prisma.card.count({
      where: { stageId: id, accountId: account_id, deletedAt: null },
    });

    if (cardCount > 0) {
      return problemResponse(reply, 409, 'Conflict', 'Stage has active cards. Move or delete them first.');
    }

    try {
      await prisma.stage.delete({
        where: { id, accountId: account_id },
      });
    } catch (err: unknown) {
      if (
        typeof err === 'object' && err !== null &&
        'code' in err && (err as { code: string }).code === 'P2025'
      ) {
        return problemResponse(reply, 404, 'Not Found', 'Stage not found');
      }
      throw err;
    }

    return reply.code(204).send();
  });
}
