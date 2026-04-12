import { DndContext, DragEndEvent, DragOverEvent, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import { Stage, CRMCard } from '@/types/crm';
import { KanbanColumn } from './KanbanColumn';

interface Props {
  stages: Stage[];
  cardsByStage: Record<string, CRMCard[]>;
  onSelectCard: (id: string) => void;
  onMoveCard: (cardId: string, toStageId: string) => void;
  onAddCard: (stageId: string, name: string) => void;
  onUpdateCardName: (id: string, name: string) => void;
  stageTotal: (stageId: string) => number;
}

export function KanbanBoard({ stages, cardsByStage, onSelectCard, onMoveCard, onAddCard, onUpdateCardName, stageTotal }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const cardId = active.id as string;
    const overId = over.id as string;

    // Check if dropped over a stage (column)
    const targetStage = stages.find(s => s.id === overId);
    if (targetStage) {
      onMoveCard(cardId, targetStage.id);
      return;
    }

    // Dropped over another card — find that card's stage
    const allCards = Object.values(cardsByStage).flat();
    const overCard = allCards.find(c => c.id === overId);
    if (overCard && overCard.stageId) {
      onMoveCard(cardId, overCard.stageId);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 flex gap-3">
        {stages.map(stage => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            cards={cardsByStage[stage.id] || []}
            total={stageTotal(stage.id)}
            onSelectCard={onSelectCard}
            onAddCard={onAddCard}
            onUpdateCardName={onUpdateCardName}
          />
        ))}
      </div>
    </DndContext>
  );
}
