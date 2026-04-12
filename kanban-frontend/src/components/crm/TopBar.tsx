import { useState } from 'react';
import { Search, Plus } from 'lucide-react';

interface Props {
  onAddCard: () => void;
  activeFilters: string[];
  onToggleFilter: (f: string) => void;
}

const quickFilters = [
  { id: 'mine', label: 'Atribuídos a mim' },
  { id: 'today', label: 'Vence hoje' },
  { id: 'overdue', label: 'Atrasados' },
  { id: 'noagent', label: 'Sem agente' },
];

export function TopBar({ onAddCard, activeFilters, onToggleFilter }: Props) {
  const [search, setSearch] = useState('');

  return (
    <header className="h-[52px] bg-card border-b border-border flex items-center px-4 gap-3 shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 mr-4">
        <span className="text-sm font-semibold text-foreground">Pipeline</span>
        <span className="text-muted-foreground text-xs">/</span>
        <span className="text-sm text-muted-foreground">Principal</span>
      </div>

      {/* Quick filters */}
      <div className="flex items-center gap-1.5 flex-1">
        {quickFilters.map(f => (
          <button
            key={f.id}
            onClick={() => onToggleFilter(f.id)}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${
              activeFilters.includes(f.id)
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'bg-secondary text-muted-foreground border-transparent hover:bg-secondary/80'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar... (⌘K)"
          className="text-xs bg-secondary border border-border rounded-btn pl-8 pr-3 py-1.5 w-48 outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
        />
      </div>

      {/* New Lead */}
      <button
        onClick={onAddCard}
        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-primary text-primary-foreground rounded-btn hover:bg-primary-dark transition-colors"
        aria-label="Novo Lead"
      >
        <Plus size={14} />
        Novo Lead
      </button>
    </header>
  );
}
