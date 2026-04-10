import axios from 'axios';
import type { TokenExchangeRequest, TokenExchangeResponse } from '@/types/auth';

// Auth API uses a plain axios instance (no JWT interceptor — it issues the JWT)
const authClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const authApi = {
  async exchangeToken(input: TokenExchangeRequest): Promise<TokenExchangeResponse> {
    const { data } = await authClient.post<TokenExchangeResponse>(
      '/auth/chatwoot-token',
      input,
    );
    return data;
  },
};
