import { apiClient } from './client';
import type { Stage, StageWithCount, CreateStageInput, UpdateStageInput, ReorderStageItem } from '@/types/stage';

export const stagesApi = {
  async list(): Promise<StageWithCount[]> {
    const { data } = await apiClient.get<StageWithCount[]>('/stages');
    return data;
  },

  async create(input: CreateStageInput): Promise<Stage> {
    const { data } = await apiClient.post<Stage>('/stages', input);
    return data;
  },

  async update(id: string, input: UpdateStageInput): Promise<Stage> {
    const { data } = await apiClient.patch<Stage>(`/stages/${id}`, input);
    return data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/stages/${id}`);
  },

  async reorder(stages: ReorderStageItem[]): Promise<Stage[]> {
    const { data } = await apiClient.patch<Stage[]>('/stages/reorder', { stages });
    return data;
  },
};
