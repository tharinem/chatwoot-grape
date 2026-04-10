import { apiClient } from './client';
import type { Card, PaginatedCards, CreateCardInput, UpdateCardInput } from '@/types/card';

export const cardsApi = {
  async listByStage(
    stageId: string,
    cursor?: string,
    limit?: number,
  ): Promise<PaginatedCards> {
    const params: Record<string, string | number> = {};
    if (cursor) params.cursor = cursor;
    if (limit) params.limit = limit;

    const { data } = await apiClient.get<PaginatedCards>(
      `/stages/${stageId}/cards`,
      { params },
    );
    return data;
  },

  async create(stageId: string, input: CreateCardInput): Promise<Card> {
    const { data } = await apiClient.post<Card>(
      `/stages/${stageId}/cards`,
      input,
    );
    return data;
  },

  async update(id: string, input: UpdateCardInput): Promise<Card> {
    const { data } = await apiClient.patch<Card>(`/cards/${id}`, input);
    return data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/cards/${id}`);
  },
};
