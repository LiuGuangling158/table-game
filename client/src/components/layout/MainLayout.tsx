import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useSocket, useFriendStatus } from '../../hooks/useSocket';
import { getSocket, disconnectSocket } from '../../services/socket';

// 全局通知
interface Notification {
  id: number;
  type: 'error' | 'info' | 'success';
  message: string;
}

let notifId = 0;

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // 初始化 Socket 连接
  useSocket();
  useFriendStatus();

  // 全局通知监听
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const addNotif = (type: Notification['type'], message: string) => {
      const id = ++notifId;
      setNotifications(prev => [...prev, { id, type, message }]);
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 4000);
    };

    const onError = (data: { code: string; message: string }) => addNotif('error', data.message);
    const onInfo = (data: { message: string }) => addNotif('info', data.message);
    const onGameInvite = (data: any) => {
      addNotif('info', `${data.fromUser.nickname} 邀请你进行一局游戏！`);
    };

    socket.on('notify:error', onError);
    socket.on('notify:info', onInfo);
    socket.on('notify:game_invite', onGameInvite);

    return () => {
      socket.off('notify:error', onError);
      socket.off('notify:info', onInfo);
      socket.off('notify:game_invite', onGameInvite);
    };
  }, []);

  const handleLogout = () => {
    disconnectSocket();
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: '游戏大厅', icon: '🎮' },
    { path: '/friends', label: '好友', icon: '👥' },
    { path: '/history', label: '战绩', icon: '📊' },
    { path: '/profile', label: '我的', icon: '👤' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <span className="text-lg font-bold text-gray-800 hidden sm:block">Table Games</span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user?.nickname || '用户'}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-red-500 transition-colors"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 pb-20 md:pl-20">
        <Outlet />
      </main>

      {/* Notification Toast */}
      <div className="fixed top-16 right-4 z-[100] space-y-2">
        {notifications.map(n => (
          <div
            key={n.id}
            className={`px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-slide-in max-w-xs ${
              n.type === 'error' ? 'bg-red-500 text-white' :
              n.type === 'success' ? 'bg-green-500 text-white' :
              'bg-blue-500 text-white'
            }`}
          >
            {n.message}
          </div>
        ))}
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t md:hidden z-50">
        <div className="flex">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex-1 flex flex-col items-center py-2 text-xs gap-0.5 ${
                location.pathname === item.path
                  ? 'text-blue-600'
                  : 'text-gray-500'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Desktop Sidebar Nav */}
      <div className="hidden md:flex fixed left-0 top-14 bottom-0 w-16 bg-white border-r flex-col items-center py-4 gap-2 z-40">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`w-12 h-12 flex flex-col items-center justify-center rounded-xl transition-colors ${
              location.pathname === item.path
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
            title={item.label}
          >
            <span className="text-xl">{item.icon}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
