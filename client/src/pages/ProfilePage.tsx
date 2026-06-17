import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState([
    { label: '总对局', value: '--' },
    { label: '胜场', value: '--' },
    { label: '胜率', value: '--' },
  ]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/users/me/stats');
        if (data.success) {
          setStats([
            { label: '总对局', value: String(data.data.totalGames) },
            { label: '胜场', value: String(data.data.wins) },
            { label: '胜率', value: `${data.data.winRate}%` },
          ]);
        }
      } catch {}
    };
    fetchStats();
  }, []);

  const handleSave = async () => {
    if (!nickname.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.put('/users/me', { nickname });
      if (data.success) { updateUser(data.data); setEditing(false); }
    } catch (err: any) {
      alert(err.response?.data?.message || '保存失败');
    } finally { setSaving(false); }
  };

  const titleStyle: React.CSSProperties = { fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '18px' };
  const chineseStyle: React.CSSProperties = { fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif" };

  return (
    <div className="page-container-sm" style={{ animation: 'pixel-fade-in 0.4s steps(4) both' }}>
      <h2 style={{ ...titleStyle, marginBottom: '20px' }}>👤 我的</h2>

      {/* 用户信息 */}
      <div className="nes-container is-centered" style={{ marginBottom: '16px', padding: '24px' }}>
        <div style={{
          width: '80px', height: '80px', border: '4px solid #000', display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center', fontSize: '40px', background: '#fafafa', marginBottom: '16px',
        }}>
          {user?.avatar || '👤'}
        </div>

        {editing ? (
          <div>
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
              className="nes-input" placeholder="输入新昵称"
              style={{ ...chineseStyle, fontSize: '14px', textAlign: 'center', marginBottom: '12px' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button onClick={handleSave} disabled={saving}
                className={`nes-btn is-primary ${saving ? 'is-disabled' : ''}`} style={{ fontSize: '13px' }}>
                {saving ? '保存中...' : '保存'}
              </button>
              <button onClick={() => setEditing(false)}
                className="nes-btn" style={{ fontSize: '13px' }}>取消</button>
            </div>
          </div>
        ) : (
          <>
            <h3 style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '18px', marginBottom: '6px' }}>
              {user?.nickname}
            </h3>
            <p style={{ ...chineseStyle, fontSize: '14px', color: '#888' }}>
              通过{user?.oauthPlatform === 'wechat' ? '微信' : user?.oauthPlatform === 'qq' ? 'QQ' : '开发模式'}登录
            </p>
            <button onClick={() => { setNickname(user?.nickname || ''); setEditing(true); }}
              className="nes-btn" style={{ marginTop: '12px', fontSize: '12px' }}>
              编辑资料
            </button>
          </>
        )}
      </div>

      {/* 统计 */}
      <div className="nes-container with-title" style={{ marginBottom: '16px' }}>
        <p className="title" style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '12px' }}>战绩概览</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
          {stats.map((stat) => (
            <div key={stat.label}>
              <p style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '20px', color: 'var(--primary-color)', marginBottom: '4px' }}>
                {stat.value}
              </p>
              <p style={{ ...chineseStyle, fontSize: '13px', color: '#888' }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 版本信息 */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '12px', color: '#aaa' }}>
          Table Games v1.0.0
        </p>
        <p style={{ ...chineseStyle, fontSize: '13px', color: '#aaa', marginTop: '4px' }}>
          在线桌游平台 — 与好友一起享受对弈乐趣
        </p>
      </div>
    </div>
  );
}
