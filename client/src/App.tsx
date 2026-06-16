import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import FriendsPage from './pages/FriendsPage';
import GameRoomPage from './pages/GameRoomPage';
import GamePlayPage from './pages/GamePlayPage';
import HistoryPage from './pages/HistoryPage';
import ProfilePage from './pages/ProfilePage';
import api from './services/api';
import axios from 'axios';

function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const updateUser = useAuthStore((s) => s.updateUser);
  const logout = useAuthStore((s) => s.logout);
  const [restoring, setRestoring] = useState(true);

  // 页面刷新后恢复用户信息
  useEffect(() => {
    if (!isAuthenticated) {
      setRestoring(false);
      return;
    }

    const restore = async () => {
      try {
        const { data } = await api.get('/auth/me');
        if (data.success) {
          updateUser(data.data);
        }
      } catch {
        // Token 可能过期，尝试静默刷新
        const rt = localStorage.getItem('refreshToken');
        if (rt) {
          try {
            const { data: refreshData } = await axios.post('/api/auth/refresh', { refreshToken: rt });
            const { token: newToken, refreshToken: newRt, user: userData } = refreshData.data;
            setAuth(userData, newToken, newRt);
          } catch {
            logout();
          }
        } else {
          logout();
        }
      } finally {
        setRestoring(false);
      }
    };
    restore();
  }, []); // 仅在首次挂载时执行

  if (restoring && isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-center">
          <div className="text-4xl mb-3 animate-pulse">🎯</div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} />
      <Route element={<MainLayout />}>
        <Route path="/" element={isAuthenticated ? <HomePage /> : <Navigate to="/login" />} />
        <Route path="/friends" element={isAuthenticated ? <FriendsPage /> : <Navigate to="/login" />} />
        <Route path="/room/:roomId" element={isAuthenticated ? <GameRoomPage /> : <Navigate to="/login" />} />
        <Route path="/play/:roomId" element={isAuthenticated ? <GamePlayPage /> : <Navigate to="/login" />} />
        <Route path="/history" element={isAuthenticated ? <HistoryPage /> : <Navigate to="/login" />} />
        <Route path="/profile" element={isAuthenticated ? <ProfilePage /> : <Navigate to="/login" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
