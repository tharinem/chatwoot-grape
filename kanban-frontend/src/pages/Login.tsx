import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { toast } from 'sonner';
import grapeLogoLight from '@/assets/grape-logo-light.png';
import grapeLogoDark from '@/assets/grape-logo-dark.png';

interface Props {
  onLogin: (token: string, accountId: string) => void;
  theme: 'light' | 'dark';
}

export default function Login({ onLogin, theme }: Props) {
  const [token, setToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || !accountId.trim()) return;

    setIsLoading(true);
    try {
      const data = await apiRequest('/auth/chatwoot-token', {
        method: 'POST',
        body: JSON.stringify({
          chatwoot_token: token.trim(),
          account_id: parseInt(accountId.trim(), 10),
        }),
      });

      toast.success('Login realizado com sucesso!');
      onLogin(data.token, accountId.trim());
    } catch (error: any) {
      toast.error(error.message || 'Falha na autenticação');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src={theme === 'dark' ? grapeLogoDark : grapeLogoLight}
            alt="Grape AI"
            className="h-10 mx-auto"
          />
          <p className="text-sm text-muted-foreground mt-3">CRM inteligente para Chatwoot</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-modal p-6 shadow-grape-md space-y-4">
          {/* Token */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Token Chatwoot</label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Cole seu token de acesso"
                className="w-full text-sm bg-background border border-border rounded-btn px-3 py-2 pr-9 outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground text-foreground"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
              >
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Account ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Account ID</label>
            <input
              type="number"
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              placeholder="Ex: 1"
              className="w-full text-sm bg-background border border-border rounded-btn px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground text-foreground"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !token.trim() || !accountId.trim()}
            className="w-full text-sm font-medium py-2.5 bg-primary text-primary-foreground rounded-btn hover:bg-primary-dark disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Autenticando...' : 'Entrar'}
          </button>

          <p className="text-center text-[10px] text-muted-foreground">
            <span className="cursor-help underline decoration-dotted" title="Acesse Configurações → Token de Acesso no seu painel Chatwoot">
              Como obter meu token?
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}
