import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';

type LoginMode = 'login' | 'register' | 'oauth';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [mode, setMode] = useState<LoginMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 表单字段
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // OAuth / Dev 登录
  const handleDevLogin = async (platform: 'wechat' | 'qq') => {
    setLoading(true);
    setError('');

    try {
      const { data: loginData } = await api.post('/auth/dev/login', { platform });

      if (loginData.success) {
        setAuth(loginData.data.user, loginData.data.token, loginData.data.refreshToken);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  // 邮箱密码登录
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('请填写邮箱和密码');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });

      if (data.success) {
        setAuth(data.data.user, data.data.token, data.data.refreshToken);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  // 注册
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email || !nickname || !password) {
      setError('请填写所有字段');
      return;
    }
    if (password.length < 6) {
      setError('密码至少6位');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次密码不一致');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', { email, nickname, password });

      if (data.success) {
        setSuccessMsg('注册成功！正在登录...');
        // 注册成功后直接登录
        setTimeout(() => {
          setAuth(data.data.user, data.data.token, data.data.refreshToken);
          navigate('/');
        }, 500);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 px-4 py-8">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">🎯</div>
          <h1 className="text-3xl font-bold text-gray-800">Table Games</h1>
          <p className="text-gray-500 mt-1">在线桌游平台</p>
        </div>

        {/* 模式切换 */}
        <div className="flex mb-6 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === 'login' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            登录
          </button>
          <button
            onClick={() => { setMode('register'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === 'register' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            注册
          </button>
          <button
            onClick={() => { setMode('oauth'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === 'oauth' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            快速登录
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* 成功提示 */}
        {successMsg && (
          <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm">
            {successMsg}
          </div>
        )}

        {/* ==================== 邮箱登录表单 ==================== */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {loading ? '登录中...' : '登录'}
            </button>
            <p className="text-center text-xs text-gray-400">
              还没有账号？点击上方"注册"创建账号
            </p>
          </form>
        )}

        {/* ==================== 注册表单 ==================== */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">昵称</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="给自己起个名字"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少6位密码"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">确认密码</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {loading ? '注册中...' : '创建账号'}
            </button>
            <p className="text-center text-xs text-gray-400">
              已有账号？点击上方"登录"
            </p>
          </form>
        )}

        {/* ==================== OAuth 快捷登录 ==================== */}
        {mode === 'oauth' && (
          <div className="space-y-3">
            <button
              onClick={() => handleDevLogin('wechat')}
              disabled={loading}
              className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="text-xl">💬</span>
              {loading ? '登录中...' : '微信登录 (开发模式)'}
            </button>

            <button
              onClick={() => handleDevLogin('qq')}
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="text-xl">🐧</span>
              {loading ? '登录中...' : 'QQ登录 (开发模式)'}
            </button>

            <p className="text-center text-xs text-gray-400 mt-4">
              快速登录无需注册，点击即可体验
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
