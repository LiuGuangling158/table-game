import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useFriendStore } from '../../stores/friendStore';
import { useGameStore } from '../../stores/gameStore';
import { useSocket, useFriendStatus } from '../../hooks/useSocket';
import { getSocket, disconnectSocket } from '../../services/socket';

interface Notification {
  id: number;
  type: 'error' | 'info' | 'success';
  message: string;
  action?: { label: string; onClick: () => void };
}

let notifId = 0;

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useSocket();
  useFriendStatus();

  // 全局通知监听
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const addNotif = (type: Notification['type'], message: string, action?: Notification['action']) => {
      const id = ++notifId;
      setNotifications(prev => [...prev, { id, type, message, action }]);
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 6000);
    };

    const onError = (data: { code: string; message: string }) => addNotif('error', data.message);
    const onInfo = (data: { message: string }) => addNotif('info', data.message);
    const onGameInvite = (data: any) => {
      addNotif(
        'info',
        `${data.fromUser.nickname} 邀请你进行一局${data.gameType === 'XIANGQI' ? '中国象棋' : data.gameType === 'CHESS' ? '国际象棋' : '五子棋'}！`,
        {
          label: '加入',
          onClick: () => {
            navigate(`/room/${data.roomId}`);
          },
        }
      );
    };

    const onFriendRequest = (data: any) => {
      addNotif('info', `${data.fromUser.nickname} 请求添加你为好友`);
    };
    const onFriendAccepted = (data: any) => {
      addNotif('success', `${data.byUser.nickname} 已接受你的好友请求`);
    };

    socket.on('notify:error', onError);
    socket.on('notify:info', onInfo);
    socket.on('notify:game_invite', onGameInvite);
    socket.on('notify:friend_request', onFriendRequest);
    socket.on('notify:friend_accepted', onFriendAccepted);

    return () => {
      socket.off('notify:error', onError);
      socket.off('notify:info', onInfo);
      socket.off('notify:game_invite', onGameInvite);
      socket.off('notify:friend_request', onFriendRequest);
      socket.off('notify:friend_accepted', onFriendAccepted);
    };
  }, []);

  const handleLogout = () => {
    disconnectSocket();
    logout();
    useFriendStore.getState().reset();
    useGameStore.getState().resetGame();
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: '游戏大厅', icon: '🎮' },
    { path: '/friends', label: '好友', icon: '👥' },
    { path: '/history', label: '战绩', icon: '📊' },
    { path: '/profile', label: '我的', icon: '👤' },
  ];

  const notifColors: Record<string, string> = {
    error: 'is-error',
    info: '',
    success: 'is-success',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)' }}>
      {/* ===== Header ===== */}
      <header style={{
        background: '#fff',
        borderBottom: '4px solid #000',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 16px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'inherit' }}>
            <span style={{ fontSize: '28px' }}>🎯</span>
            <span style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '18px', color: 'var(--text-color)' }}>
              Table Games
            </span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '15px', color: '#555' }}>
              {user?.nickname || '用户'}
            </span>
            <button
              onClick={handleLogout}
              className="nes-btn is-error"
              style={{ padding: '4px 12px', fontSize: '13px' }}
            >
              退出
            </button>
          </div>
        </div>
      </header>

      {/* ===== Main Content ===== */}
      <main style={{
        flex: 1,
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        padding: '24px 16px',
        paddingBottom: '80px',  /* room for mobile nav */
        ...(typeof window !== 'undefined' && window.innerWidth >= 768 ? { paddingLeft: '80px' } : {}),
      }}>
        <Outlet />
      </main>

      {/* ===== Notification Toast ===== */}
      <div style={{
        position: 'fixed',
        top: '64px',
        right: '12px',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '320px',
      }}>
        {notifications.map(n => (
          <div key={n.id} className="animate-pixel-slide-in">
            <section className={`nes-balloon from-right ${notifColors[n.type] || ''}`}
              style={{ fontSize: '14px', margin: 0 }}>
              <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif" }}>
                {n.message}
              </p>
              {n.action && (
                <button
                  onClick={n.action.onClick}
                  className="nes-btn is-primary"
                  style={{ marginTop: '8px', fontSize: '12px', padding: '2px 12px' }}
                >
                  {n.action.label}
                </button>
              )}
            </section>
          </div>
        ))}
      </div>

      {/* ===== Mobile Bottom Nav ===== */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#fff',
        borderTop: '4px solid #000',
        zIndex: 50,
        display: 'flex',
      }}
      className="md-hidden">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '6px 0',
                textDecoration: 'none',
                background: isActive ? 'var(--primary-color)' : 'transparent',
                color: isActive ? '#fff' : '#555',
                borderRight: '2px solid #000',
              }}
            >
              <span style={{ fontSize: '20px' }}>{item.icon}</span>
              <span style={{ fontSize: '11px', fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", marginTop: '2px' }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* ===== Desktop Sidebar Nav ===== */}
      <div style={{
        position: 'fixed',
        left: 0,
        top: '56px',
        bottom: 0,
        width: '64px',
        background: '#fff',
        borderRight: '4px solid #000',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '16px',
        gap: '8px',
      }}
      className="md-flex-hidden">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={item.label}
              style={{
                width: '48px',
                height: '48px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                background: isActive ? 'var(--primary-color)' : 'transparent',
                color: isActive ? '#fff' : '#555',
                border: isActive ? '2px solid #000' : '2px solid transparent',
                imageRendering: 'pixelated',
              }}
            >
              <span style={{ fontSize: '22px' }}>{item.icon}</span>
            </Link>
          );
        })}
      </div>

      {/* Responsive helper styles */}
      <style>{`
        .md-hidden { display: flex; }
        .md-flex-hidden { display: none; }
        @media (min-width: 768px) {
          .md-hidden { display: none !important; }
          .md-flex-hidden { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
