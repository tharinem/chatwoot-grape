import { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Stage, CRMCard } from '@/types/crm';
import { KanbanCard } from './KanbanCard';

interface Props {
  stage: Stage;
  cards: CRMCard[];
  total: number;
  onSelectCard: (id: string) => void;
  onAddCard: (stageId: string, name: string) => void;
  onUpdateCardName: (id: string, name: string) => void;
}

export function KanbanColumn({ stage, cards, total, onSelectCard, onAddCard, onUpdateCardName }: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isWon = stage.color === '#10B981';
  const isLost = stage.color === '#6B7280';

  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const handleAdd = () => {
    if (newName.trim()) {
      onAddCard(stage.id, newName.trim());
      setNewName('');
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col w-[280px] min-w-[280px] shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 h-10 px-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
        <span className="text-sm font-semibold text-foreground truncate">{stage.name}</span>
        <span className="text-xs text-muted-foreground">{cards.length}</span>
        {isWon && total > 0 && (
          <span className="ml-auto text-xs font-semibold text-success">
            R$ {total.toLocaleString('pt-BR')}
          </span>
        )}
        {!isWon && (
          <button
            onClick={() => setAdding(true)}
            className="ml-auto p-1 rounded hover:bg-secondary transition-colors"
            aria-label="Adicionar card"
          >
            <Plus size={14} className="text-muted-foreground" />
          </button>
        )}
      </div>
      <div className="h-px mx-2 mb-2" style={{ backgroundColor: stage.color, opacity: 0.3 }} />

      {/* Cards area */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto scrollbar-thin px-1 space-y-2 pb-4 rounded-md transition-colors ${isOver ? 'bg-primary/5' : ''}`}
      >
        {/* Inline add */}
        {adding && (
          <div className="bg-card border border-primary/30 rounded-card p-2 shadow-grape-sm">
            <input
              ref={inputRef}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
              onBlur={() => { if (!newName.trim()) setAdding(false); }}
              placeholder="Nome do contato..."
              className="w-full text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
        )}

        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map(card => (
            <KanbanCard
              key={card.id}
              card={card}
              isLost={isLost}
              onSelect={onSelectCard}
              onUpdateName={onUpdateCardName}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
