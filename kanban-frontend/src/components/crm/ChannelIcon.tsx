import { MessageCircle, Instagram, Mail, User } from 'lucide-react';
import { Channel } from '@/types/crm';

const iconMap: Record<Channel, { icon: typeof MessageCircle; className: string }> = {
  whatsapp: { icon: MessageCircle, className: 'text-[#25D366]' },
  instagram: { icon: Instagram, className: 'text-[#E1306C]' },
  email: { icon: Mail, className: 'text-muted-foreground' },
  none: { icon: User, className: 'text-muted-foreground' },
};

export function ChannelIcon({ channel, size = 14 }: { channel: Channel; size?: number }) {
  const { icon: Icon, className } = iconMap[channel];
  return <Icon size={size} className={className} aria-label={channel === 'none' ? 'Sem canal' : channel} />;
}
