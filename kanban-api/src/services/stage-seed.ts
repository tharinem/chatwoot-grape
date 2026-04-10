import type { PrismaClient } from '@prisma/client';

const DEFAULT_STAGES = [
  { name: 'Prospecção', position: 1, color: '#3B82F6' },
  { name: 'Qualificado', position: 2, color: '#8B5CF6' },
  { name: 'Proposta', position: 3, color: '#F59E0B' },
  { name: 'Negociação', position: 4, color: '#EF4444' },
  { name: 'Fechado Ganho', position: 5, color: '#10B981' },
  { name: 'Perdido', position: 6, color: '#6B7280' },
];

export async function seedDefaultStages(
  prisma: PrismaClient,
  accountId: number
): Promise<void> {
  const existing = await prisma.stage.count({
    where: { accountId },
  });
  if (existing > 0) return;

  await prisma.stage.createMany({
    data: DEFAULT_STAGES.map((s) => ({ ...s, accountId })),
    skipDuplicates: true,
  });
}
