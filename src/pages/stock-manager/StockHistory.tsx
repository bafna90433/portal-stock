import React, { useState, useEffect, useCallback } from 'react';
import { 
  History, Search, Filter, ArrowUpRight, ArrowDownLeft, 
  RotateCcw, User, Calendar, Package, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, RefreshCw
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const StockHistory: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const limit = 20;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/stock/history', {
        params: { search, type, page, limit }
      });
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch {
      toast.error('Failed to load stock history');
    } finally {
      setLoading(false);
    }
  }, [search, type, page]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const getLogTypeBadge = (type: string) => {
    switch (type) {
      case 'order': return { label: 'Order Deduction', icon: <ArrowDownLeft size={12} />, bg: 'rgba(239,68,68,0.1)', color: '#EF4444' };
      case 'manual': return { label: 'Manual Update', icon: <User size={12} />, bg: 'rgba(99,102,241,0.1)', color: '#6366F1' };
      case 'cancel': return { label: 'Order Cancelled', icon: <RotateCcw size={12} />, bg: 'rgba(16,185,129,0.1)', color: '#10B981' };
      case 'import': return { label: 'Initial Stock', icon: <Package size={12} />, bg: 'rgba(245,158,11,0.1)', color: '#F59E0B' };
      case 'dispatch': return { label: 'Dispatched', icon: <ArrowUpRight size={12} />, bg: 'rgba(6,182,212,0.1)', color: '#06B6D4' };
      default: return { label: type, icon: <History size={12} />, bg: 'rgba(107,114,128,0.1)', color: '#6B7280' };
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory Logs</h1>
          <p className="page-subtitle">Detailed history of every stock movement and adjustment.</p>
        </div>
        <button className="btn btn-secondary btn-icon" onClick={fetchHistory} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-dim)' }} />
            <input 
              className="form-control" 
              placeholder="Search by Product, SKU or Reason..." 
              style={{ paddingLeft: '2.5rem' }}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div style={{ width: '200px' }}>
            <select className="form-control" value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
              <option value="">All Movement Types</option>
              <option value="order">Order Deductions</option>
              <option value="cancel">Cancelled / Restored</option>
              <option value="manual">Manual Adjustments</option>
              <option value="import">Initial Stock</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-page"><div className="spinner" /></div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📜</div>
          <div className="empty-title">No history found</div>
          <div className="empty-text">Stock movements will appear here as they occur.</div>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Product</th>
                    <th>Action Type</th>
                    <th style={{ textAlign: 'center' }}>Change</th>
                    <th>Stock Snapshot</th>
                    <th>By / Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const badge = getLogTypeBadge(log.type);
                    const isPositive = log.totalChangePcs > 0;
                    
                    return (
                      <tr key={log._id}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            {new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={11} /> {new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{log.productName}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{log.sku}</div>
                        </td>
                        <td>
                          <span style={{ 
                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                            padding: '4px 10px', borderRadius: 8, 
                            background: badge.bg, color: badge.color, 
                            fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase'
                          }}>
                            {badge.icon} {badge.label}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ 
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 8px', borderRadius: 6,
                            background: isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                            color: isPositive ? '#10B981' : '#EF4444',
                            fontWeight: 800, fontSize: '0.9rem', fontFamily: 'var(--font-mono)'
                          }}>
                            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            {isPositive ? '+' : ''}{log.totalChangePcs}
                          </div>
                          <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', marginTop: 2 }}>
                            {log.changeCartons !== 0 && ` ${log.changeCartons}ctn `}
                            {log.changeInners !== 0 && ` ${log.changeInners}inr `}
                            {log.changeLoose !== 0 && ` ${log.changeLoose}pcs `}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Before</div>
                              <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{log.previousStock.total}</div>
                            </div>
                            <div style={{ color: 'var(--text-dim)', opacity: 0.5 }}>→</div>
                            <div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>After</div>
                              <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--primary)' }}>{log.newStock.total}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800 }}>
                              {log.by.charAt(0)}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{log.by}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.reason}>
                                {log.reason || '—'}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Showing <b>{(page - 1) * limit + 1}</b> to <b>{Math.min(page * limit, total)}</b> of <b>{total}</b> logs
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn btn-secondary btn-sm" 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft size={16} /> Prev
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1rem', fontSize: '0.9rem', fontWeight: 700 }}>
                  Page {page} of {totalPages}
                </div>
                <button 
                  className="btn btn-secondary btn-sm" 
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default StockHistory;
