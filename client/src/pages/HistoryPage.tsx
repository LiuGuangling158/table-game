import { useEffect, useState } from 'react';
import api from '../services/api';
import { GAME_TYPE_LABELS } from 'shared';

export default function HistoryPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 20;

  useEffect(() => { fetchHistory(1); }, []);

  const fetchHistory = async (pageNum: number) => {
    setLoading(true);
    try {
      const { data } = await api.get('/history', { params: { page: pageNum, pageSize } });
      if (data.success) {
        const newItems = data.data.items || [];
        setTotal(data.data.total || 0);
        setHasMore(pageNum * pageSize < data.data.total);
        if (pageNum === 1) { setRecords(newItems); }
        else { setRecords(prev => [...prev, ...newItems]); }
        setPage(pageNum);
      }
    } catch (err) {
      console.error('获取历史记录失败:', err);
    } finally { setLoading(false); }
  };

  const getResultLabel = (record: any) => {
    if (!record.winnerId) return { text: '平局', color: '#888' };
    const winner = record.players?.find((p: any) => p.userId === record.winnerId);
    return { text: `${winner?.nickname || '?'} 获胜`, color: 'var(--success-color)' };
  };

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      CHECKMATE: '将死', RESIGN: '认输', DRAW: '和棋', TIMEOUT: '超时',
      DISCONNECT: '断线', STALEMATE: '逼和', FIVE_IN_ROW: '五连', LAST_CARD: '最后一张',
    };
    return labels[reason] || reason;
  };

  const titleStyle: React.CSSProperties = { fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '18px' };

  return (
    <div className="page-container-md" style={{ animation: 'pixel-fade-in 0.4s steps(4) both' }}>
      <h2 style={{ ...titleStyle, marginBottom: '20px' }}>📊 历史战绩</h2>

      {loading && records.length === 0 ? (
        <div className="nes-container is-centered" style={{ padding: '48px' }}>
          <i className="nes-pokeball" style={{ display: 'block', margin: '0 auto 12px' }} />
          <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '15px', color: '#888' }}>
            加载中...
          </p>
        </div>
      ) : records.length === 0 ? (
        <div className="nes-container is-centered" style={{ padding: '48px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>📊</div>
          <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '15px', color: '#888' }}>
            暂无游戏记录
          </p>
          <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '14px', color: '#aaa', marginTop: '4px' }}>
            开始对弈后战绩将在这里显示
          </p>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {records.map((record: any) => {
              const result = getResultLabel(record);
              return (
                <div key={record.id} className="nes-container" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '13px' }}>
                        {GAME_TYPE_LABELS[record.gameType] || record.gameType}
                      </span>
                      <span style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '13px', color: '#888', marginLeft: '8px' }}>
                        {getReasonLabel(record.reason)}
                      </span>
                    </div>
                    <span style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '14px', fontWeight: 'bold', color: result.color }}>
                      {result.text}
                    </span>
                  </div>
                  <div style={{ marginTop: '8px', fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '14px', color: '#555' }}>
                    {record.players?.map((p: any, idx: number) => (
                      <span key={p.userId}>
                        {idx > 0 && ' vs '}
                        <span style={{ fontWeight: p.userId === record.winnerId ? 'bold' : 'normal' }}>
                          {p.nickname}
                        </span>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '13px', color: '#aaa' }}>
                    <span>{record.duration ? `${Math.floor(record.duration / 60)}分${record.duration % 60}秒` : '-'}</span>
                    <span>{new Date(record.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button onClick={() => fetchHistory(page + 1)} disabled={loading}
                className={`nes-btn is-primary ${loading ? 'is-disabled' : ''}`}
                style={{ fontSize: '13px' }}>
                {loading ? '加载中...' : `加载更多 (${records.length}/${total})`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
