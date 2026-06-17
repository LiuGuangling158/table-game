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

  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('请填写邮箱和密码'); return; }
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!email || !nickname || !password) { setError('请填写所有字段'); return; }
    if (password !== confirmPassword) { setError('两次密码不一致'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', { email, nickname, password });
      if (data.success) {
        setSuccessMsg('注册成功！正在登录...');
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif",
    fontSize: '15px',
  };

  return (
    <div className="login-page-bg flex-center" style={{ minHeight: '100vh', padding: '16px' }}>
      <div style={{ maxWidth: '420px', width: '100%' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '64px', marginBottom: '12px' }}>🎯</div>
          <h1 style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '20px', color: 'var(--text-color)', marginBottom: '4px' }}>
            Table Games
          </h1>
          <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '15px', color: '#666' }}>
            在线桌游平台
          </p>
        </div>

        <div className="nes-container with-title">
          <p className="title" style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '13px' }}>
            {mode === 'login' ? '登录' : mode === 'register' ? '注册' : '快速登录'}
          </p>

          {/* 模式切换 */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', justifyContent: 'center' }}>
            <button
              onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
              className={`nes-btn ${mode === 'login' ? 'is-primary' : ''}`}
              style={{ fontSize: '13px', padding: '6px 14px' }}
            >
              登录
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); setSuccessMsg(''); }}
              className={`nes-btn ${mode === 'register' ? 'is-success' : ''}`}
              style={{ fontSize: '13px', padding: '6px 14px' }}
            >
              注册
            </button>
            <button
              onClick={() => { setMode('oauth'); setError(''); setSuccessMsg(''); }}
              className={`nes-btn ${mode === 'oauth' ? 'is-warning' : ''}`}
              style={{ fontSize: '13px', padding: '6px 14px' }}
            >
              快速登录
            </button>
          </div>

          {/* 错误提示 */}
          {error && (
            <div style={{
              background: '#fce4e4', padding: '12px', marginBottom: '16px',
              border: '2px solid var(--error-color)',
              fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif",
              fontSize: '14px', color: 'var(--error-color)',
            }}>
              {error}
            </div>
          )}

          {/* 成功提示 */}
          {successMsg && (
            <div style={{
              background: '#e4fce4', padding: '12px', marginBottom: '16px',
              border: '2px solid var(--success-color)',
              fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif",
              fontSize: '14px', color: 'var(--success-color)',
            }}>
              {successMsg}
            </div>
          )}

          {/* ===== 邮箱登录表单 ===== */}
          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                  邮箱
                </label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="请输入邮箱" className="nes-input" style={inputStyle} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                  密码
                </label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码" className="nes-input" style={inputStyle} />
              </div>
              <button type="submit" disabled={loading}
                className={`nes-btn is-primary ${loading ? 'is-disabled' : ''}`}
                style={{ width: '100%', marginBottom: '12px' }}>
                {loading ? '登录中...' : '登录'}
              </button>
              <p style={{ textAlign: 'center', fontSize: '13px', color: '#888', fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif" }}>
                还没有账号？点击上方"注册"创建账号
              </p>
            </form>
          )}

          {/* ===== 注册表单 ===== */}
          {mode === 'register' && (
            <form onSubmit={handleRegister}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                  邮箱
                </label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="请输入邮箱" className="nes-input" style={inputStyle} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                  昵称
                </label>
                <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
                  placeholder="给自己起个名字" className="nes-input" style={inputStyle} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                  密码
                </label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码" className="nes-input" style={inputStyle} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                  确认密码
                </label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入密码" className="nes-input" style={inputStyle} />
              </div>
              <button type="submit" disabled={loading}
                className={`nes-btn is-success ${loading ? 'is-disabled' : ''}`}
                style={{ width: '100%', marginBottom: '12px' }}>
                {loading ? '注册中...' : '创建账号'}
              </button>
              <p style={{ textAlign: 'center', fontSize: '13px', color: '#888', fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif" }}>
                已有账号？点击上方"登录"
              </p>
            </form>
          )}

          {/* ===== OAuth 快捷登录 ===== */}
          {mode === 'oauth' && (
            <div>
              <button onClick={() => handleDevLogin('wechat')} disabled={loading}
                className={`nes-btn is-success ${loading ? 'is-disabled' : ''}`}
                style={{ width: '100%', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>💬</span>
                {loading ? '登录中...' : '微信登录 (开发模式)'}
              </button>
              <button onClick={() => handleDevLogin('qq')} disabled={loading}
                className={`nes-btn is-primary ${loading ? 'is-disabled' : ''}`}
                style={{ width: '100%', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🐧</span>
                {loading ? '登录中...' : 'QQ登录 (开发模式)'}
              </button>
              <p style={{ textAlign: 'center', fontSize: '13px', color: '#888', fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif" }}>
                快速登录无需注册，点击即可体验
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
