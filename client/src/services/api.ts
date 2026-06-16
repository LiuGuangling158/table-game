import axios from 'axios';
import { refreshSocketToken } from './socket';
import { useAuthStore } from '../stores/authStore';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token 刷新锁：防止并发刷新
let isRefreshing = false;
let refreshPromise: Promise<any> | null = null;

// 请求拦截器: 添加 JWT Token (从 authStore 读取，避免跨标签页 token 覆盖问题)
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器: 处理 401 刷新 Token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // 如果已有刷新在进行中，等待其完成
        if (isRefreshing && refreshPromise) {
          await refreshPromise;
          const newToken = useAuthStore.getState().token;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }

        isRefreshing = true;

        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        refreshPromise = axios.post('/api/auth/refresh', { refreshToken });
        const { data } = await refreshPromise;
        const { token, refreshToken: newRefreshToken } = data.data;

        // 更新 authStore (内部写入 sessionStorage)
        useAuthStore.getState().setAuth(
          useAuthStore.getState().user!,
          token,
          newRefreshToken,
        );
        originalRequest.headers.Authorization = `Bearer ${token}`;

        // 同步更新 Socket 的 token
        refreshSocketToken(token);

        return api(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
