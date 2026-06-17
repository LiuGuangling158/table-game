import { useEffect } from 'react';
import { connectSocket, getSocket } from '../services/socket';
import { useAuthStore } from '../stores/authStore';
import { useFriendStore } from '../stores/friendStore';

/**
 * 初始化 Socket 连接，并将 socket 实例挂到 window 上供游戏组件使用。
 * 在用户登录后自动连接，退出时断开。
 */
export function useSocket() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (isAuthenticated && token) {
      const socket = connectSocket();
      (window as any).__socket = socket;
    }

    return () => {
      // 组件卸载时不主动断开
    };
  }, [isAuthenticated, token]);
}

// 监听好友状态变化的 hook
export function useFriendStatus() {
  const updateFriendStatus = useFriendStore((s) => s.updateFriendStatus);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleOnline = (data: { userId: string }) => {
      updateFriendStatus(data.userId, 'ONLINE');
    };

    const handleOffline = (data: { userId: string }) => {
      updateFriendStatus(data.userId, 'OFFLINE');
    };

    socket.on('user:online', handleOnline);
    socket.on('user:offline', handleOffline);

    return () => {
      socket.off('user:online', handleOnline);
      socket.off('user:offline', handleOffline);
    };
  }, [updateFriendStatus]);
}
