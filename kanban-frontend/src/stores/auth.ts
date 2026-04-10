import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api/auth';
import { JWT_STORAGE_KEY } from '@/api/client';
import type { JwtPayload } from '@/types/auth';

const CHATWOOT_TOKEN_KEY = 'kanban_chatwoot_token';
const ACCOUNT_ID_KEY = 'kanban_account_id';

function decodeJwtPayload(token: string): JwtPayload {
  const base64Url = token.split('.')[1];
  if (!base64Url) throw new Error('Invalid JWT');
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join(''),
  );
  return JSON.parse(jsonPayload) as JwtPayload;
}

function isTokenExpired(payload: JwtPayload): boolean {
  return payload.exp * 1000 < Date.now();
}

export const useAuthStore = defineStore('auth', () => {
  const jwt = ref<string | null>(null);
  const chatwootToken = ref<string | null>(null);
  const accountId = ref<number | null>(null);
  const userId = ref<number | null>(null);
  const role = ref<string | null>(null);

  const isAuthenticated = computed(() => jwt.value !== null);

  function setFromJwt(token: string) {
    const payload = decodeJwtPayload(token);
    jwt.value = token;
    userId.value = payload.user_id;
    accountId.value = payload.account_id;
    role.value = payload.role;
    localStorage.setItem(JWT_STORAGE_KEY, token);
  }

  async function login(cwToken: string, acctId: number) {
    const response = await authApi.exchangeToken({
      chatwoot_token: cwToken,
      account_id: acctId,
    });

    chatwootToken.value = cwToken;
    accountId.value = acctId;
    localStorage.setItem(CHATWOOT_TOKEN_KEY, cwToken);
    localStorage.setItem(ACCOUNT_ID_KEY, String(acctId));

    setFromJwt(response.token);
  }

  async function refreshToken() {
    const storedCwToken = chatwootToken.value || localStorage.getItem(CHATWOOT_TOKEN_KEY);
    const storedAcctId = accountId.value || Number(localStorage.getItem(ACCOUNT_ID_KEY));

    if (!storedCwToken || !storedAcctId) {
      throw new Error('No credentials for refresh');
    }

    const response = await authApi.exchangeToken({
      chatwoot_token: storedCwToken,
      account_id: storedAcctId,
    });

    setFromJwt(response.token);
  }

  function logout() {
    jwt.value = null;
    chatwootToken.value = null;
    accountId.value = null;
    userId.value = null;
    role.value = null;
    localStorage.removeItem(JWT_STORAGE_KEY);
    localStorage.removeItem(CHATWOOT_TOKEN_KEY);
    localStorage.removeItem(ACCOUNT_ID_KEY);
  }

  function initFromStorage() {
    const storedJwt = localStorage.getItem(JWT_STORAGE_KEY);
    const storedCwToken = localStorage.getItem(CHATWOOT_TOKEN_KEY);
    const storedAcctId = localStorage.getItem(ACCOUNT_ID_KEY);

    if (storedCwToken) chatwootToken.value = storedCwToken;
    if (storedAcctId) accountId.value = Number(storedAcctId);

    if (storedJwt) {
      try {
        const payload = decodeJwtPayload(storedJwt);
        if (!isTokenExpired(payload)) {
          setFromJwt(storedJwt);
        } else {
          localStorage.removeItem(JWT_STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(JWT_STORAGE_KEY);
      }
    }
  }

  return {
    jwt,
    chatwootToken,
    accountId,
    userId,
    role,
    isAuthenticated,
    login,
    refreshToken,
    logout,
    initFromStorage,
  };
});
