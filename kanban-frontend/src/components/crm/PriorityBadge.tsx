import { Priority } from '@/types/crm';

const config: Record<Priority, { label: string; className: string }> = {
  baixa: { label: 'Baixa', className: 'bg-secondary text-secondary-foreground' },
  media: { label: 'Média', className: 'bg-info/10 text-info' },
  alta: { label: 'Alta', className: 'bg-warning/10 text-warning' },
  urgente: { label: 'Urgente', className: 'bg-destructive/10 text-destructive' },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { label, className } = config[priority];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${className}`}>
      {label}
    </span>
  );
}
