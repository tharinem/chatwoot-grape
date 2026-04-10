export interface Stage {
  id: string;
  accountId: number;
  name: string;
  position: number;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StageWithCount extends Stage {
  _count?: { cards: number };
}

export interface CreateStageInput {
  name: string;
  color?: string;
}

export interface UpdateStageInput {
  name?: string;
  color?: string | null;
}

export interface ReorderStageItem {
  id: string;
  position: number;
}
