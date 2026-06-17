import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFriendStore } from '../stores/friendStore';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { FriendRequestInfo } from 'shared';

export default function FriendsPage() {
  const navigate = useNavigate();
  const { friends, setFriends, requests, setRequests, removeRequest, updateFriendStatus } = useFriendStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [tab, setTab] = useState<'friends' | 'requests'>('friends');
  const [loading, setLoading] = useState(false);

  const socket = getSocket();

  useEffect(() => {
    fetchFriends();
    fetchRequests();
    if (socket) {
      const onUserOnline = (data: { userId: string }) => updateFriendStatus(data.userId, 'ONLINE');
      const onUserOffline = (data: { userId: string }) => updateFriendStatus(data.userId, 'OFFLINE');
      socket.on('user:online', onUserOnline);
      socket.on('user:offline', onUserOffline);
      return () => { socket.off('user:online', onUserOnline); socket.off('user:offline', onUserOffline); };
    }
  }, [socket]);

  const fetchFriends = async () => {
    try { const { data } = await api.get('/friends'); if (data.success) setFriends(data.data); } catch {}
  };
  const fetchRequests = async () => {
    try { const { data } = await api.get('/friends/requests'); if (data.success) setRequests(data.data); } catch {}
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return; setLoading(true);
    try { const { data } = await api.get(`/users/search?q=${searchQuery}`); if (data.success) setSearchResults(data.data); } catch {}
    finally { setLoading(false); }
  };

  const handleSendRequest = async (receiverId: string) => {
    try { await api.post('/friends/request', { receiverId }); alert('好友请求已发送'); }
    catch (err: any) { alert(err.response?.data?.message || '发送失败'); }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try { await api.post(`/friends/requests/${requestId}/accept`); removeRequest(requestId); fetchFriends(); }
    catch (err: any) { alert(err.response?.data?.message || '操作失败'); }
  };

  const handleRejectRequest = async (requestId: string) => {
    try { await api.post(`/friends/requests/${requestId}/reject`); removeRequest(requestId); }
    catch (err: any) { alert(err.response?.data?.message || '操作失败'); }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!confirm('确定删除该好友？')) return;
    try { await api.delete(`/friends/${friendId}`); fetchFriends(); }
    catch (err: any) { alert(err.response?.data?.message || '删除失败'); }
  };

  const statusLabels: Record<string, string> = { ONLINE: '在线', IN_GAME: '游戏中', OFFLINE: '离线' };

  const titleStyle: React.CSSProperties = { fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '18px' };

  return (
    <div className="page-container-md" style={{ animation: 'pixel-fade-in 0.4s steps(4) both' }}>
      <h2 style={{ ...titleStyle, marginBottom: '20px' }}>👥 好友</h2>

      {/* 搜索 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input type="text" value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="搜索用户昵称..."
          className="nes-input"
          style={{ flex: 1, fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '15px' }} />
        <button onClick={handleSearch} disabled={loading}
          className={`nes-btn is-primary ${loading ? 'is-disabled' : ''}`}
          style={{ fontSize: '13px', padding: '4px 16px' }}>
          搜索
        </button>
      </div>

      {/* 搜索结果 */}
      {searchResults.length > 0 && (
        <div className="nes-container with-title" style={{ marginBottom: '16px' }}>
          <p className="title" style={{ fontSize: '12px', fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace" }}>搜索结果</p>
          {searchResults.map((user: any) => (
            <div key={user.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="pixel-avatar">{user.avatar || '👤'}</div>
                <div>
                  <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '15px', fontWeight: 'bold' }}>
                    {user.nickname}
                  </p>
                  <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '13px', color: '#888' }}>
                    {statusLabels[user.status] || '未知'}
                  </p>
                </div>
              </div>
              <button onClick={() => handleSendRequest(user.id)}
                className="nes-btn is-primary" style={{ fontSize: '12px', padding: '4px 12px' }}>
                添加好友
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderBottom: '4px solid #000' }}>
        <button onClick={() => setTab('friends')}
          style={{
            padding: '8px 20px', fontSize: '14px', border: 'none', cursor: 'pointer',
            fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", background: tab === 'friends' ? 'var(--primary-color)' : 'transparent',
            color: tab === 'friends' ? '#fff' : 'var(--text-color)',
          }}>
          好友列表 ({friends.length})
        </button>
        <button onClick={() => setTab('requests')}
          style={{
            padding: '8px 20px', fontSize: '14px', border: 'none', cursor: 'pointer',
            fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", background: tab === 'requests' ? 'var(--primary-color)' : 'transparent',
            color: tab === 'requests' ? '#fff' : 'var(--text-color)',
          }}>
          好友请求 ({requests.length})
        </button>
      </div>

      {/* 好友列表 */}
      {tab === 'friends' && (
        <div className="nes-container">
          {friends.length === 0 ? (
            <div className="nes-container is-centered" style={{ padding: '32px' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>👥</div>
              <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '14px', color: '#888' }}>
                还没有好友，搜索添加吧！
              </p>
            </div>
          ) : (
            friends.map((friend) => (
              <div key={friend.userId}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '2px dashed #ccc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ position: 'relative' }}>
                    <div className="pixel-avatar">{friend.avatar || '👤'}</div>
                    <span className={`pixel-dot ${friend.status === 'ONLINE' ? 'pixel-dot-online' : friend.status === 'IN_GAME' ? 'pixel-dot-online' : 'pixel-dot-offline'}`}
                      style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '10px', height: '10px' }} />
                  </div>
                  <div>
                    <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '15px', fontWeight: 'bold' }}>
                      {friend.nickname}
                    </p>
                    <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '13px', color: '#888' }}>
                      {statusLabels[friend.status]}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button onClick={() => handleRemoveFriend(friend.userId)}
                    className="nes-btn is-error" style={{ fontSize: '12px', padding: '2px 8px' }}>
                    删除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 好友请求 */}
      {tab === 'requests' && (
        <div className="nes-container">
          {requests.length === 0 ? (
            <div className="nes-container is-centered" style={{ padding: '32px' }}>
              <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '14px', color: '#888' }}>
                暂无好友请求
              </p>
            </div>
          ) : (
            requests.map((req: FriendRequestInfo) => (
              <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '2px dashed #ccc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="pixel-avatar">{req.senderAvatar || '👤'}</div>
                  <div>
                    <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '15px', fontWeight: 'bold' }}>
                      {req.senderNickname}
                    </p>
                    {req.message && <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '13px', color: '#888' }}>{req.message}</p>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleAcceptRequest(req.id)}
                    className="nes-btn is-success" style={{ fontSize: '12px', padding: '4px 12px' }}>接受</button>
                  <button onClick={() => handleRejectRequest(req.id)}
                    className="nes-btn is-error" style={{ fontSize: '12px', padding: '4px 12px' }}>拒绝</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
