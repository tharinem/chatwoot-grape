import { z } from 'zod';

// Response schema for a single card
export const cardSchema = z.object({
  id: z.string(),
  accountId: z.number(),
  stageId: z.string(),
  contactName: z.string(),
  conversationId: z.number().nullable(),
  channelType: z.string().nullable(),
  assigneeId: z.number().nullable(),
  position: z.number(),
  customFields: z.any().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// POST /api/v1/stages/:stageId/cards body — per D-02 only contact_name is required
export const createCardSchema = z.object({
  contact_name: z.string().min(1).max(255),
  conversation_id: z.number().int().positive().optional(), // per D-03: optional, filled by n8n
  channel_type: z.string().max(50).optional(),
  assignee_id: z.number().int().positive().optional(),
  custom_fields: z.record(z.unknown()).optional(),
});

// PATCH /api/v1/cards/:id body — all fields optional, includes stage_id for moving
export const updateCardSchema = z.object({
  contact_name: z.string().min(1).max(255).optional(),
  stage_id: z.string().optional(), // move card to a different stage
  conversation_id: z.number().int().positive().nullable().optional(),
  channel_type: z.string().max(50).nullable().optional(),
  assignee_id: z.number().int().positive().nullable().optional(),
  position: z.number().int().min(0).optional(),
  custom_fields: z.record(z.unknown()).nullable().optional(),
});

// GET query params for cursor pagination — per D-10
export const cardQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Param schemas
export const stageIdParamsSchema = z.object({
  stageId: z.string(),
});

export const cardIdParamsSchema = z.object({
  id: z.string(),
});

// Paginated response
export const paginatedCardsSchema = z.object({
  data: z.array(cardSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type CardQuery = z.infer<typeof cardQuerySchema>;
