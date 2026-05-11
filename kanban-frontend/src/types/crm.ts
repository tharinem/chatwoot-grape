export type Channel = 'whatsapp' | 'instagram' | 'email' | 'none';
export type Priority = 'baixa' | 'media' | 'alta' | 'urgente';

export interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
  probability: number;
}

export interface Note {
  id: string;
  content: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  fromStage?: string;
  toStage?: string;
  agent?: string;
  createdAt: string;
}

export interface CRMCard {
  id: string;
  stageId: string;
  contactName: string;
  channel: Channel;
  dealValue?: number;
  priority?: Priority;
  agentName?: string;
  agentAvatar?: string;
  conversationId?: string;
  contactId?: string;
  nextFollowUp?: string;
  notes: Note[];
  activityLog: ActivityLog[];
  customFields: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  lastMovedAt: string;
}
