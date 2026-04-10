import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';

const JWT_STORAGE_KEY = 'kanban_jwt';

interface RetryableConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(JWT_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 with silent re-auth
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableConfig | undefined;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        // Dynamic import to avoid circular dependency
        const { useAuthStore } = await import('@/stores/auth');
        const authStore = useAuthStore();
        await authStore.refreshToken();

        const newToken = localStorage.getItem(JWT_STORAGE_KEY);
        if (newToken && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }

        return apiClient(originalRequest);
      } catch {
        // Refresh failed — redirect to login
        const { useAuthStore } = await import('@/stores/auth');
        const authStore = useAuthStore();
        authStore.logout();

        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export { apiClient, JWT_STORAGE_KEY };
