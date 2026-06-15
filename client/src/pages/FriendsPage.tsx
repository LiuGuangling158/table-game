import { useEffect, useState } from 'react';
import { useFriendStore } from '../stores/friendStore';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { FriendRequestInfo } from 'shared';

export default function FriendsPage() {
  const { friends, setFriends, requests, setRequests, removeRequest } = useFriendStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [tab, setTab] = useState<'friends' | 'requests'>('friends');
  const [loading, setLoading] = useState(false);

  const socket = getSocket();

  useEffect(() => {
    fetchFriends();
    fetchRequests();
  }, []);

  const fetchFriends = async () => {
    try {
      const { data } = await api.get('/friends');
      if (data.success) {
        setFriends(data.data);
      }
    } catch (err) {
      console.error('获取好友列表失败:', err);
    }
  };

  const fetchRequests = async () => {
    try {
      const { data } = await api.get('/friends/requests');
      if (data.success) {
        setRequests(data.data);
      }
    } catch (err) {
      console.error('获取好友请求失败:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/users/search?q=${searchQuery}`);
      if (data.success) {
        setSearchResults(data.data);
      }
    } catch (err) {
      console.error('搜索失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (receiverId: string) => {
    try {
      await api.post('/friends/request', { receiverId });
      alert('好友请求已发送');
    } catch (err: any) {
      alert(err.response?.data?.message || '发送失败');
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await api.post(`/friends/requests/${requestId}/accept`);
      removeRequest(requestId);
      fetchFriends();
    } catch (err: any) {
      alert(err.response?.data?.message || '操作失败');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await api.post(`/friends/requests/${requestId}/reject`);
      removeRequest(requestId);
    } catch (err: any) {
      alert(err.response?.data?.message || '操作失败');
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!confirm('确定删除该好友？')) return;
    try {
      await api.delete(`/friends/${friendId}`);
      fetchFriends();
    } catch (err: any) {
      alert(err.response?.data?.message || '删除失败');
    }
  };

  const handleInviteToGame = async (friendId: string) => {
    // 跳转到大厅，自动弹出创建房间
    // 简化实现：直接创建房间并邀请
    try {
      const { data: roomData } = await api.post('/games/rooms', { gameType: 'GOMOKU' });
      if (roomData.success) {
        socket?.emit('room:invite', {
          targetUserId: friendId,
          roomId: roomData.data.id,
          gameType: 'GOMOKU',
        });
        window.location.href = `/room/${roomData.data.id}`;
      }
    } catch (err: any) {
      alert('创建房间失败');
    }
  };

  const statusColors: Record<string, string> = {
    ONLINE: 'bg-green-500',
    IN_GAME: 'bg-yellow-500',
    OFFLINE: 'bg-gray-400',
  };
  const statusLabels: Record<string, string> = {
    ONLINE: '在线',
    IN_GAME: '游戏中',
    OFFLINE: '离线',
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800">好友</h2>

      {/* 搜索 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="搜索用户昵称..."
          className="flex-1 px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-6 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50"
        >
          搜索
        </button>
      </div>

      {/* 搜索结果 */}
      {searchResults.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-medium text-gray-700 mb-3">搜索结果</h3>
          <div className="space-y-2">
            {searchResults.map((user: any) => (
              <div key={user.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-lg">
                    {user.avatar || '👤'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{user.nickname}</p>
                    <p className="text-xs text-gray-500">{statusLabels[user.status] || '未知'}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleSendRequest(user.id)}
                  className="px-4 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                >
                  添加好友
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 切换 */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => setTab('friends')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'friends' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
          }`}
        >
          好友列表 ({friends.length})
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'requests' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
          }`}
        >
          好友请求 ({requests.length})
        </button>
      </div>

      {/* 好友列表 */}
      {tab === 'friends' && (
        <div className="bg-white rounded-xl shadow-sm border divide-y">
          {friends.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">👥</div>
              <p>还没有好友</p>
              <p className="text-sm mt-1">搜索并添加好友一起游戏吧！</p>
            </div>
          ) : (
            friends.map((friend) => (
              <div key={friend.userId} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg">
                      {friend.avatar || '👤'}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${statusColors[friend.status]} rounded-full border-2 border-white`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{friend.nickname}</p>
                    <p className="text-xs text-gray-500">{statusLabels[friend.status]}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {friend.status !== 'OFFLINE' && (
                    <button
                      onClick={() => handleInviteToGame(friend.userId)}
                      className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
                    >
                      邀请游戏
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveFriend(friend.userId)}
                    className="px-3 py-1.5 text-red-500 text-sm rounded-lg hover:bg-red-50"
                  >
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
        <div className="bg-white rounded-xl shadow-sm border divide-y">
          {requests.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <p>暂无好友请求</p>
            </div>
          ) : (
            requests.map((req: FriendRequestInfo) => (
              <div key={req.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg">
                    {req.senderAvatar || '👤'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{req.senderNickname}</p>
                    {req.message && <p className="text-xs text-gray-500">{req.message}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAcceptRequest(req.id)}
                    className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                  >
                    接受
                  </button>
                  <button
                    onClick={() => handleRejectRequest(req.id)}
                    className="px-3 py-1.5 text-gray-500 text-sm rounded-lg hover:bg-gray-100"
                  >
                    拒绝
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
