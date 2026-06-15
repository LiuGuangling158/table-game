import { useEffect, useState } from 'react';
import api from '../services/api';
import { GAME_TYPE_LABELS } from 'shared';

export default function HistoryPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const { data } = await api.get('/history');
      if (data.success) {
        setRecords(data.data.items || []);
      }
    } catch (err) {
      console.error('获取历史记录失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const getResultLabel = (record: any) => {
    if (!record.winnerId) return { text: '平局', color: 'text-gray-500' };
    // 简化：显示胜者
    const winner = record.players?.find((p: any) => p.userId === record.winnerId);
    return {
      text: `${winner?.nickname || '?'} 获胜`,
      color: 'text-green-600',
    };
  };

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      CHECKMATE: '将死',
      RESIGN: '认输',
      DRAW: '和棋',
      TIMEOUT: '超时',
      DISCONNECT: '断线',
    };
    return labels[reason] || reason;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-800">历史战绩</h2>

      {loading ? (
        <div className="text-center p-12 text-gray-400">加载中...</div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center text-gray-400 shadow-sm border">
          <div className="text-4xl mb-3">📊</div>
          <p>暂无游戏记录</p>
          <p className="text-sm mt-1">开始对弈后战绩将在这里显示</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record: any) => {
            const result = getResultLabel(record);
            return (
              <div key={record.id} className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-800">
                      {GAME_TYPE_LABELS[record.gameType] || record.gameType}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">
                      {getReasonLabel(record.reason)}
                    </span>
                  </div>
                  <span className={`font-medium ${result.color}`}>{result.text}</span>
                </div>
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                  {record.players?.map((p: any, idx: number) => (
                    <span key={p.userId}>
                      {idx > 0 && ' vs '}
                      <span className={p.userId === record.winnerId ? 'font-medium text-gray-800' : ''}>
                        {p.nickname}
                      </span>
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                  <span>{record.duration ? `${Math.floor(record.duration / 60)}分${record.duration % 60}秒` : '-'}</span>
                  <span>{new Date(record.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
