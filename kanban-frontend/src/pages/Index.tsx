import { useState, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import Login from './Login';
import Dashboard from './Dashboard';

export default function Index() {
  const [isAuth, setIsAuth] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    // Check for credentials in URL (SaaS Integration)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const urlAccountId = params.get('accountId');

    if (urlToken && urlAccountId) {
      localStorage.setItem('grape_token', urlToken);
      localStorage.setItem('grape_account_id', urlAccountId);
      // Clean up URL to keep it pretty
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsAuth(true);
      return;
    }

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
