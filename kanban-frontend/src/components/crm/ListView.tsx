import { CRMCard, Stage } from '@/types/crm';
import { ChannelIcon } from './ChannelIcon';
import { PriorityBadge } from './PriorityBadge';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'hoje';
  if (days === 1) return 'há 1 dia';
  return `há ${days} dias`;
}

interface Props {
  cards: CRMCard[];
  stages: Stage[];
  onSelectCard: (id: string) => void;
}

export function ListView({ cards, stages, onSelectCard }: Props) {
  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="bg-card border border-border rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nome</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Stage</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Canal</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Agente</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Valor</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Último contato</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Prioridade</th>
            </tr>
          </thead>
          <tbody>
            {cards.map(card => {
              const stage = stages.find(s => s.id === card.stageId);
              return (
                <tr
                  key={card.id}
                  onClick={() => onSelectCard(card.id)}
                  className="border-b border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground">{card.contactName}</td>
                  <td className="px-4 py-3">
                    {stage && (
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
                        {stage.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3"><ChannelIcon channel={card.channel} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{card.agentName || '—'}</td>
                  <td className="px-4 py-3 text-right">{card.dealValue ? `R$ ${card.dealValue.toLocaleString('pt-BR')}` : '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{timeAgo(card.updatedAt)}</td>
                  <td className="px-4 py-3">{card.priority ? <PriorityBadge priority={card.priority} /> : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
