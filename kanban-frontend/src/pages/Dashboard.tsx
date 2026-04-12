import { useState, useCallback } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { useTheme } from '@/hooks/useTheme';
import { AppSidebar } from '@/components/crm/AppSidebar';
import { TopBar } from '@/components/crm/TopBar';
import { KanbanBoard } from '@/components/crm/KanbanBoard';
import { ListView } from '@/components/crm/ListView';
import { DetailPanel } from '@/components/crm/DetailPanel';
import { toast } from 'sonner';

export default function Dashboard() {
  const {
    stages, cards, cardsByStage,
    selectedCard, setSelectedCardId,
    moveCard, updateCard, addCard, addNote, deleteCard,
    stageTotal,
  } = useCRM();

  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const toggleFilter = useCallback((f: string) => {
    setActiveFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  }, []);

  const handleMoveCard = useCallback((cardId: string, toStageId: string) => {
    moveCard(cardId, toStageId);
    const stageName = stages.find(s => s.id === toStageId)?.name;
    toast.success(`Movido para ${stageName}`);
  }, [moveCard, stages]);

  const handleUpdateCardName = useCallback((id: string, name: string) => {
    updateCard(id, { contactName: name });
  }, [updateCard]);

  const handleNewLead = useCallback(() => {
    if (stages.length > 0) {
      addCard(stages[0].id, 'Novo Lead');
      toast.success('Lead criado!');
    }
  }, [addCard, stages]);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <AppSidebar
        activeView={view}
        onViewChange={setView}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          onAddCard={handleNewLead}
          activeFilters={activeFilters}
          onToggleFilter={toggleFilter}
        />

        {view === 'kanban' ? (
          <KanbanBoard
            stages={stages}
            cardsByStage={cardsByStage}
            onSelectCard={setSelectedCardId}
            onMoveCard={handleMoveCard}
            onAddCard={addCard}
            onUpdateCardName={handleUpdateCardName}
            stageTotal={stageTotal}
          />
        ) : (
          <ListView
            cards={cards}
            stages={stages}
            onSelectCard={setSelectedCardId}
          />
        )}
      </div>

      <DetailPanel
        card={selectedCard}
        stages={stages}
        onClose={() => setSelectedCardId(null)}
        onUpdate={updateCard}
        onMoveCard={handleMoveCard}
        onAddNote={addNote}
      />
    </div>
  );
}
