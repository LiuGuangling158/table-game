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
      } catch {
        // 获取失败时保持 '--'
      }
    };
    fetchStats();
  }, []);

  const handleSave = async () => {
    if (!nickname.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.put('/users/me', { nickname });
      if (data.success) {
        updateUser(data.data);
        setEditing(false);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-800">我的</h2>

      {/* 用户信息 */}
      <div className="bg-white rounded-xl shadow-sm border p-6 text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">
          {user?.avatar || '👤'}
        </div>

        {editing ? (
          <div className="space-y-3">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-4 py-2 border rounded-xl text-center focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="输入新昵称"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 bg-blue-500 text-white rounded-xl text-sm hover:bg-blue-600 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-xl font-bold text-gray-800">{user?.nickname}</h3>
            <p className="text-sm text-gray-500 mt-1">
              通过{user?.oauthPlatform === 'wechat' ? '微信' : user?.oauthPlatform === 'qq' ? 'QQ' : '开发模式'}登录
            </p>
            <button
              onClick={() => { setNickname(user?.nickname || ''); setEditing(true); }}
              className="mt-3 text-sm text-blue-500 hover:text-blue-600"
            >
              编辑资料
            </button>
          </>
        )}
      </div>

      {/* 统计 */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="font-medium text-gray-700 mb-4">战绩概览</h3>
        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 版本信息 */}
      <div className="text-center text-xs text-gray-400">
        <p>Table Games v1.0.0</p>
        <p>在线桌游平台 — 与好友一起享受对弈乐趣</p>
      </div>
    </div>
  );
}
