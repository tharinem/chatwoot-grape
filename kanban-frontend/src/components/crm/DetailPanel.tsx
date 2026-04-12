import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Calendar, DollarSign } from 'lucide-react';
import { CRMCard, Stage, Priority } from '@/types/crm';
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
  card: CRMCard | null;
  stages: Stage[];
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<CRMCard>) => void;
  onMoveCard: (id: string, stageId: string) => void;
  onAddNote?: (cardId: string, content: string) => void;
}

export function DetailPanel({ card, stages, onClose, onUpdate, onMoveCard, onAddNote }: Props) {
  const [activeTab, setActiveTab] = useState<'info' | 'notas' | 'historico'>('info');
  const [noteText, setNoteText] = useState('');

  if (!card) return null;

  const currentStage = stages.find(s => s.id === card.stageId);

  const addNote = () => {
    if (!noteText.trim()) return;
    if (onAddNote) {
      onAddNote(card.id, noteText.trim());
      setNoteText('');
    }
  };

  return (
    <AnimatePresence>
      {card && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-foreground/20 z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[420px] z-50 glass-panel border-l border-border overflow-y-auto scrollbar-thin"
          >
            {/* Header */}
            <div className="sticky top-0 glass-panel border-b border-border px-5 py-4 z-10">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-semibold text-foreground">{card.contactName}</h2>
                <button onClick={onClose} className="p-1 rounded hover:bg-secondary" aria-label="Fechar painel">
                  <X size={18} className="text-muted-foreground" />
                </button>
              </div>
              {currentStage && (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
                  style={{ backgroundColor: currentStage.color + '18', color: currentStage.color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentStage.color }} />
                  {currentStage.name}
                </span>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-5">
              {(['info', 'notas', 'historico'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'info' ? 'Informações' : tab === 'notas' ? 'Notas' : 'Histórico'}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-5">
              {activeTab === 'info' && (
                <>
                  {/* Info section */}
                  <Section title="Contato">
                    <Row label="Canal"><ChannelIcon channel={card.channel} /><span className="text-sm capitalize">{card.channel === 'none' ? 'Sem canal' : card.channel}</span></Row>
                    {card.agentName && <Row label="Agente"><span className="text-sm">{card.agentName}</span></Row>}
                    {card.conversationId && (
                      <Row label="Chatwoot">
                        <a href="#" className="text-sm text-primary flex items-center gap-1 hover:underline">
                          #{card.conversationId} <ExternalLink size={12} />
                        </a>
                      </Row>
                    )}
                    <Row label="Criado"><span className="text-sm text-muted-foreground">{timeAgo(card.createdAt)}</span></Row>
                  </Section>

                  <Section title="Negócio">
                    <Row label="Valor">
                      <div className="flex items-center gap-1">
                        <DollarSign size={14} className="text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {card.dealValue ? `R$ ${card.dealValue.toLocaleString('pt-BR')}` : '—'}
                        </span>
                      </div>
                    </Row>
                    <Row label="Prioridade">
                      {card.priority ? <PriorityBadge priority={card.priority} /> : <span className="text-sm text-muted-foreground">—</span>}
                    </Row>
                    <Row label="Follow-up">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} className="text-muted-foreground" />
                        <span className="text-sm">
                          {card.nextFollowUp ? new Date(card.nextFollowUp).toLocaleDateString('pt-BR') : '—'}
                        </span>
                      </div>
                    </Row>
                  </Section>

                  <Section title="Mover para">
                    <div className="flex flex-wrap gap-1.5">
                      {stages.filter(s => s.id !== card.stageId).map(s => (
                        <button
                          key={s.id}
                          onClick={() => onMoveCard(card.id, s.id)}
                          className="text-xs px-2.5 py-1 rounded-btn border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors"
                        >
                          <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </Section>
                </>
              )}

              {activeTab === 'notas' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Escreva uma nota..."
                      rows={2}
                      className="flex-1 text-sm bg-secondary/50 border border-border rounded-btn px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <button
                    onClick={addNote}
                    disabled={!noteText.trim()}
                    className="text-xs font-medium px-3 py-1.5 bg-primary text-primary-foreground rounded-btn hover:bg-primary-dark disabled:opacity-40 transition-colors"
                  >
                    Adicionar nota
                  </button>
                  <div className="space-y-2 mt-3">
                    {card.notes.map(note => (
                      <div key={note.id} className="bg-secondary/50 rounded-btn p-3">
                        <p className="text-sm text-foreground">{note.content}</p>
                        <span className="text-[10px] text-muted-foreground mt-1 block">{timeAgo(note.createdAt)}</span>
                      </div>
                    ))}
                    {card.notes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma nota ainda.</p>}
                  </div>
                </div>
              )}

              {activeTab === 'historico' && (
                <div className="space-y-3">
                  {card.activityLog.map(log => (
                    <div key={log.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                        <div className="w-px flex-1 bg-border" />
                      </div>
                      <div className="pb-3">
                        <p className="text-sm text-foreground">{log.action}</p>
                        {log.agent && <span className="text-[10px] text-muted-foreground">por {log.agent}</span>}
                        <span className="text-[10px] text-muted-foreground block">{timeAgo(log.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                  {card.activityLog.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}
