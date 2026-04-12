import { LayoutGrid, List, Filter, Settings, Sun, Moon } from 'lucide-react';
import grapeIcon from '@/assets/grape-icon.png';

interface Props {
  activeView: 'kanban' | 'list';
  onViewChange: (v: 'kanban' | 'list') => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const items = [
  { id: 'kanban' as const, icon: LayoutGrid, label: 'Board' },
  { id: 'list' as const, icon: List, label: 'Lista' },
  { id: 'filters' as const, icon: Filter, label: 'Filtros salvos' },
  { id: 'settings' as const, icon: Settings, label: 'Configurações' },
];

export function AppSidebar({ activeView, onViewChange, theme, onToggleTheme }: Props) {
  return (
    <aside className="w-14 h-screen bg-card border-r border-border flex flex-col items-center py-4 gap-1 shrink-0">
      {/* Logo */}
      <div className="mb-4">
        <img src={grapeIcon} alt="Grape AI" className="w-8 h-8 object-contain" />
      </div>

      {items.map(item => {
        const isActive = (item.id === 'kanban' || item.id === 'list') && item.id === activeView;
        return (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === 'kanban' || item.id === 'list') onViewChange(item.id);
            }}
            className={`group relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors
              ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}
            `}
            aria-label={item.label}
          >
            <item.icon size={18} />
            <span className="absolute left-12 bg-foreground text-background text-[10px] font-medium px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              {item.label}
            </span>
          </button>
        );
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Theme toggle */}
      <button
        onClick={onToggleTheme}
        className="group relative w-10 h-10 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        aria-label={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
      >
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        <span className="absolute left-12 bg-foreground text-background text-[10px] font-medium px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
          {theme === 'light' ? 'Modo escuro' : 'Modo claro'}
        </span>
      </button>
    </aside>
  );
}
