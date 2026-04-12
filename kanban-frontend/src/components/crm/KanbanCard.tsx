import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreVertical, Flame, ExternalLink } from 'lucide-react';
import { CRMCard } from '@/types/crm';
import { ChannelIcon } from './ChannelIcon';
import { PriorityBadge } from './PriorityBadge';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'hoje';
  if (days === 1) return 'há 1 dia';
  return `há ${days} dias`;
}

function getRottingDays(lastMovedAt: string): number {
  return Math.floor((Date.now() - new Date(lastMovedAt).getTime()) / 86400000);
}

interface Props {
  card: CRMCard;
  isLost?: boolean;
  onSelect: (id: string) => void;
  onUpdateName?: (id: string, name: string) => void;
}

export function KanbanCard({ card, isLost, onSelect, onUpdateName }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(card.contactName);
  const inputRef = useRef<HTMLInputElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const rottingDays = getRottingDays(card.lastMovedAt);
  const rottingClass = rottingDays >= 10 ? 'card-rotting-danger' : rottingDays >= 5 ? 'card-rotting-warning' : '';

  const isOverdue = card.nextFollowUp && new Date(card.nextFollowUp) < new Date();

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  };

  const handleSaveName = () => {
    setEditing(false);
    if (name.trim() && name !== card.contactName) {
      onUpdateName?.(card.id, name.trim());
    } else {
      setName(card.contactName);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(card.id)}
      className={`
        group bg-card border border-border rounded-card p-3 cursor-grab
        shadow-grape-sm hover:shadow-grape-md hover:border-[#D4D4D8]
        transition-all duration-150 select-none
        ${isDragging ? 'shadow-grape-lg rotate-1 opacity-95 cursor-grabbing z-50' : ''}
        ${isLost ? 'opacity-75' : ''}
        ${rottingClass}
      `}
    >
      {/* Row 1: Channel + Name + Menu */}
      <div className="flex items-center gap-2 mb-1.5">
        <ChannelIcon channel={card.channel} />
        {editing ? (
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setName(card.contactName); setEditing(false); } }}
            onClick={e => e.stopPropagation()}
            className="flex-1 text-sm font-semibold bg-transparent border-b border-primary outline-none text-foreground"
          />
        ) : (
          <span
            onDoubleClick={handleDoubleClick}
            className="flex-1 text-sm font-semibold text-foreground truncate"
          >
            {card.contactName}
          </span>
        )}
        <button
          onClick={e => { e.stopPropagation(); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-secondary"
          aria-label="Menu do card"
        >
          <MoreVertical size={14} className="text-muted-foreground" />
        </button>
      </div>

      {/* Row 2: Deal Value */}
      {card.dealValue != null && card.dealValue > 0 && (
        <div className="mb-1.5">
          <span className="text-xs font-medium text-primary bg-primary/5 px-1.5 py-0.5 rounded">
            R$ {card.dealValue.toLocaleString('pt-BR')}
          </span>
        </div>
      )}

      {/* Row 3: Agent, Priority, Follow-up */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {card.agentName && (
          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-medium flex items-center justify-center">
            {card.agentName[0]}
          </span>
        )}
        {card.priority && <PriorityBadge priority={card.priority} />}
        {isOverdue && (
          <span className="text-[10px] font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
            Atrasado
          </span>
        )}
        {rottingDays >= 10 && <Flame size={12} className="text-destructive" />}
      </div>

      {/* Row 4: Footer */}
      <div className="flex items-center justify-between pt-1.5 border-t border-border">
        <div className="flex items-center gap-1">
          {card.conversationId && (
            <ExternalLink size={12} className="text-primary" />
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {timeAgo(card.updatedAt)}
        </span>
      </div>
    </div>
  );
}
