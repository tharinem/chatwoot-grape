import { useState, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import Login from './Login';
import Dashboard from './Dashboard';

export default function Index() {
  const [isAuth, setIsAuth] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    // Check for credentials in URL (SaaS Integration Auto-Login)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const urlAccountId = params.get('accountId');

    if (urlToken && urlAccountId) {
      // Clean up URL to keep it pretty before doing the background fetch
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Auto-authenticate in the background: Exchange Chatwoot token for Grape JWT
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1'}/auth/chatwoot-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatwoot_token: urlToken,
          account_id: parseInt(urlAccountId, 10),
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          localStorage.setItem('grape_token', data.token);
          localStorage.setItem('grape_account_id', urlAccountId);
          setIsAuth(true);
        }
      })
      .catch((err) => {
        console.error('Auto-login failed', err);
      });
      return;
    }

    // Normal check if already logged in previously
    const token = localStorage.getItem('grape_token');
    if (token) setIsAuth(true);
  }, []);

  const handleLogin = (token: string, accountId: string) => {
    localStorage.setItem('grape_token', token);
    localStorage.setItem('grape_account_id', accountId);
    setIsAuth(true);
  };

  if (!isAuth) return <Login onLogin={handleLogin} theme={theme} />;
  return <Dashboard />;
}
