import axios from 'axios';
import { refreshSocketToken } from './socket';

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

// 请求拦截器: 添加 JWT Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
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
          const newToken = localStorage.getItem('token');
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }

        isRefreshing = true;

        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        refreshPromise = axios.post('/api/auth/refresh', { refreshToken });
        const { data } = await refreshPromise;
        const { token, refreshToken: newRefreshToken } = data.data;

        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', newRefreshToken);
        originalRequest.headers.Authorization = `Bearer ${token}`;

        // 同步更新 Socket 的 token
        refreshSocketToken(token);

        return api(originalRequest);
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
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
