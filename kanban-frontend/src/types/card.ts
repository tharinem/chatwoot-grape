export interface Card {
  id: string;
  accountId: number;
  stageId: string;
  contactName: string;
  conversationId: number | null;
  channelType: string | null;
  assigneeId: number | null;
  position: number;
  customFields: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedCards {
  data: Card[];
  nextCursor: string | null;
  hasMore: boolean;
}

// Request types use snake_case (API convention from Phase 2)
export interface CreateCardInput {
  contact_name: string;
  conversation_id?: number;
  channel_type?: string;
  assignee_id?: number;
  custom_fields?: Record<string, unknown>;
}

export interface UpdateCardInput {
  contact_name?: string;
  stage_id?: string;
  conversation_id?: number | null;
  channel_type?: string | null;
  assignee_id?: number | null;
  position?: number;
  custom_fields?: Record<string, unknown> | null;
}
