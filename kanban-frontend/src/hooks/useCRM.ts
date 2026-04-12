import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Stage, CRMCard, Channel, Note, ActivityLog } from '@/types/crm';
import { apiRequest } from '@/lib/api';
import { toast } from 'sonner';

export function useCRM() {
  const queryClient = useQueryClient();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Fetch Stages
  const { data: stages = [] } = useQuery<Stage[]>({
    queryKey: ['stages'],
    queryFn: () => apiRequest('/stages'),
  });

  // Fetch Cards with Relations
  const { data: cards = [] } = useQuery<any[]>({
    queryKey: ['cards'],
    queryFn: () => apiRequest('/cards'),
  });

  // Map API Cards to CRMCard type for UI
  const mappedCards = useMemo(() => {
    return cards.map(c => ({
      id: c.id,
      stageId: c.stageId,
      contactName: c.contactName,
      channel: (c.channelType || 'none') as Channel,
      conversationId: c.conversationId?.toString(),
      dealValue: c.dealValue || 0,
      priority: c.priority || undefined,
      nextFollowUp: c.nextFollowUp || undefined,
      agentName: c.agentName || undefined,
      agentAvatar: c.agentAvatar || undefined,
      notes: (c.notes || []).map((n: any) => ({
        id: n.id,
        content: n.content,
        createdAt: n.createdAt
      })) as Note[],
      activityLog: (c.activities || []).map((a: any) => ({
        id: a.id,
        action: a.action,
        fromStage: a.fromStage,
        toStage: a.toStage,
        agent: a.agent,
        createdAt: a.createdAt
      })) as ActivityLog[],
      customFields: c.customFields ? JSON.parse(c.customFields) : {},
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      lastMovedAt: c.updatedAt,
    })) as CRMCard[];
  }, [cards]);

  const selectedCard = useMemo(
    () => mappedCards.find(c => c.id === selectedCardId) ?? null,
    [mappedCards, selectedCardId]
  );

  const cardsByStage = useMemo(() => {
    const map: Record<string, CRMCard[]> = {};
    stages.forEach(s => { map[s.id] = []; });
    mappedCards.forEach(c => {
      if (map[c.stageId]) {
        map[c.stageId]?.push(c);
      }
    });
    return map;
  }, [mappedCards, stages]);

  // Mutations
  const moveCardMutation = useMutation({
    mutationFn: ({ cardId, toStageId }: { cardId: string, toStageId: string }) => 
      apiRequest(`/cards/${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage_id: toStageId })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
    onError: () => toast.error('Falha ao mover o card')
  });

  const updateCardMutation = useMutation({
    mutationFn: ({ cardId, updates }: { cardId: string, updates: any }) => 
      apiRequest(`/cards/${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          contact_name: updates.contactName,
          deal_value: updates.dealValue,
          priority: updates.priority,
          next_follow_up: updates.nextFollowUp,
          agent_name: updates.agentName,
          agent_avatar: updates.agentAvatar,
          custom_fields: updates.customFields,
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      // Don't show toast for every minor update to avoid spam
    },
    onError: () => toast.error('Falha ao atualizar o card')
  });

  const addNoteMutation = useMutation({
    mutationFn: ({ cardId, content }: { cardId: string, content: string }) => 
      apiRequest(`/cards/${cardId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      toast.success('Nota adicionada');
    },
    onError: () => toast.error('Falha ao adicionar nota')
  });

  const addCardMutation = useMutation({
    mutationFn: ({ stageId, contactName }: { stageId: string, contactName: string }) => 
      apiRequest(`/stages/${stageId}/cards`, {
        method: 'POST',
        body: JSON.stringify({ contact_name: contactName })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      toast.success('Card criado com sucesso!');
    },
    onError: () => toast.error('Falha ao criar o card')
  });

  const moveCard = useCallback((cardId: string, toStageId: string) => {
    moveCardMutation.mutate({ cardId, toStageId });
  }, [moveCardMutation]);

  const addCard = useCallback((stageId: string, contactName: string) => {
    addCardMutation.mutate({ stageId, contactName });
  }, [addCardMutation]);

  const addNote = useCallback((cardId: string, content: string) => {
    addNoteMutation.mutate({ cardId, content });
  }, [addNoteMutation]);

  const updateCard = useCallback((cardId: string, updates: Partial<CRMCard>) => {
    updateCardMutation.mutate({ cardId, updates });
  }, [updateCardMutation]);

  const deleteCard = useCallback((cardId: string) => {
    apiRequest(`/cards/${cardId}`, { method: 'DELETE' })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['cards'] });
        toast.success('Card excluído');
      });
  }, [queryClient]);

  const stageTotal = useCallback((stageId: string) => {
    const stageCards = cardsByStage[stageId] || [];
    return stageCards.reduce((sum, c) => sum + (c.dealValue || 0), 0);
  }, [cardsByStage]);

  return {
    stages,
    cards: mappedCards,
    cardsByStage,
    selectedCard,
    selectedCardId,
    setSelectedCardId,
    moveCard,
    updateCard,
    addCard,
    addNote,
    deleteCard,
    stageTotal,
  };
}
