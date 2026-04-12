const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('grape_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('grape_token');
    // Não redirecionar se estivermos tentando fazer o login para não quebrar a tela
    if (!endpoint.includes('/auth/chatwoot-token')) {
      window.location.href = '/';
    }
    throw new Error('Token inválido ou não autorizado');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
    throw new Error(error.message || 'Erro na requisição');
  }

  if (response.status === 204) return null;
  return response.json();
}
