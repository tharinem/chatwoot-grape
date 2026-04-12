import { Stage, CRMCard } from '@/types/crm';

export const defaultStages: Stage[] = [
  { id: 's1', name: 'Prospecção', color: '#3B82F6', position: 0, probability: 10 },
  { id: 's2', name: 'Qualificado', color: '#8B5CF6', position: 1, probability: 25 },
  { id: 's3', name: 'Proposta', color: '#F59E0B', position: 2, probability: 40 },
  { id: 's4', name: 'Negociação', color: '#EF4444', position: 3, probability: 60 },
  { id: 's5', name: 'Fechado Ganho', color: '#10B981', position: 4, probability: 100 },
  { id: 's6', name: 'Perdido', color: '#6B7280', position: 5, probability: 0 },
];

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString();
};

const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString();
};

export const mockCards: CRMCard[] = [
  {
    id: 'c1', stageId: 's1', contactName: 'Maria Silva', channel: 'whatsapp',
    dealValue: 15000, priority: 'alta', agentName: 'João', nextFollowUp: tomorrow(),
    notes: [{ id: 'n1', content: 'Interessada no plano enterprise', createdAt: daysAgo(1) }],
    activityLog: [{ id: 'a1', action: 'Criado em Prospecção', createdAt: daysAgo(3) }],
    customFields: {}, createdAt: daysAgo(3), updatedAt: daysAgo(0), lastMovedAt: daysAgo(0),
    conversationId: '142',
  },
  {
    id: 'c2', stageId: 's1', contactName: 'Carlos Mendes', channel: 'instagram',
    dealValue: 8000, priority: 'media', agentName: 'Ana',
    notes: [], activityLog: [], customFields: {},
    createdAt: daysAgo(7), updatedAt: daysAgo(6), lastMovedAt: daysAgo(6),
  },
  {
    id: 'c3', stageId: 's2', contactName: 'Fernanda Costa', channel: 'email',
    dealValue: 25000, priority: 'alta', agentName: 'João', nextFollowUp: yesterday(),
    notes: [{ id: 'n2', content: 'Aguardando retorno sobre proposta', createdAt: daysAgo(2) }],
    activityLog: [
      { id: 'a2', action: 'Criado em Prospecção', createdAt: daysAgo(5) },
      { id: 'a3', action: 'Movido de Prospecção → Qualificado', agent: 'João', createdAt: daysAgo(2), fromStage: 'Prospecção', toStage: 'Qualificado' },
    ],
    customFields: {}, createdAt: daysAgo(5), updatedAt: daysAgo(1), lastMovedAt: daysAgo(2),
  },
  {
    id: 'c4', stageId: 's2', contactName: 'Roberto Almeida', channel: 'whatsapp',
    dealValue: 12000, priority: 'baixa',
    notes: [], activityLog: [], customFields: {},
    createdAt: daysAgo(12), updatedAt: daysAgo(11), lastMovedAt: daysAgo(11),
  },
  {
    id: 'c5', stageId: 's3', contactName: 'Juliana Rocha', channel: 'whatsapp',
    dealValue: 45000, priority: 'urgente', agentName: 'Ana', nextFollowUp: tomorrow(),
    conversationId: '287',
    notes: [], activityLog: [], customFields: {},
    createdAt: daysAgo(4), updatedAt: daysAgo(1), lastMovedAt: daysAgo(1),
  },
  {
    id: 'c6', stageId: 's4', contactName: 'Pedro Santos', channel: 'email',
    dealValue: 32000, priority: 'alta', agentName: 'João',
    notes: [], activityLog: [], customFields: {},
    createdAt: daysAgo(8), updatedAt: daysAgo(2), lastMovedAt: daysAgo(2),
  },
  {
    id: 'c7', stageId: 's5', contactName: 'Luciana Oliveira', channel: 'whatsapp',
    dealValue: 20000, priority: 'media', agentName: 'Ana',
    conversationId: '301',
    notes: [], activityLog: [], customFields: {},
    createdAt: daysAgo(15), updatedAt: daysAgo(1), lastMovedAt: daysAgo(1),
  },
  {
    id: 'c8', stageId: 's5', contactName: 'Marcos Lima', channel: 'instagram',
    dealValue: 18000, priority: 'baixa', agentName: 'João',
    notes: [], activityLog: [], customFields: {},
    createdAt: daysAgo(10), updatedAt: daysAgo(3), lastMovedAt: daysAgo(3),
  },
  {
    id: 'c9', stageId: 's6', contactName: 'Beatriz Nunes', channel: 'email',
    dealValue: 5000, priority: 'baixa',
    notes: [{ id: 'n3', content: 'Optou pelo concorrente', createdAt: daysAgo(1) }],
    activityLog: [], customFields: {},
    createdAt: daysAgo(20), updatedAt: daysAgo(1), lastMovedAt: daysAgo(1),
  },
];
