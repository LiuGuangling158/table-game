import { create } from 'zustand';
import { UserInfo } from 'shared';

interface AuthState {
  user: UserInfo | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  setAuth: (user: UserInfo, token: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (user: Partial<UserInfo>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: sessionStorage.getItem('token'),
  refreshToken: sessionStorage.getItem('refreshToken'),
  isAuthenticated: !!sessionStorage.getItem('token'),

  setAuth: (user, token, refreshToken) => {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('refreshToken', refreshToken);
    set({ user, token, refreshToken, isAuthenticated: true });
  },

  logout: () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
    // 清除其他 store 的状态 (通过 window dispatch 事件)
    window.dispatchEvent(new CustomEvent('auth:logout'));
    set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
  },

  updateUser: (updates) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    }));
  },
}));
