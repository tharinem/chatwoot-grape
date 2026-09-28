import { z } from 'zod';

// Response schema for a single stage
export const stageSchema = z.object({
  id: z.string(),
  accountId: z.number(),
  name: z.string(),
  position: z.number(),
  color: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// POST /api/v1/stages body
export const createStageSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// PATCH /api/v1/stages/:id body
export const updateStageSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
});

// PATCH /api/v1/stages/reorder body
export const reorderStagesSchema = z.object({
  stages: z.array(z.object({
    id: z.string(),
    position: z.number().int().positive(),
  })).min(1),
});

// Param schema for :id
export const stageParamsSchema = z.object({
  id: z.string(),
});

export type CreateStageInput = z.infer<typeof createStageSchema>;
export type UpdateStageInput = z.infer<typeof updateStageSchema>;
export type ReorderStagesInput = z.infer<typeof reorderStagesSchema>;
