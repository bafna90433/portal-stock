import React, { useState, useEffect, useCallback } from 'react';
import { 
  History, Search, ArrowLeft, Calendar, ChevronLeft, ChevronRight,
  TrendingUp, RefreshCw, Package
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const InwardHistory: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 20;
  const navigate = useNavigate();

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/stock/history', {
        params: { search, type: 'inward', page, limit }
      });
      
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch {
      toast.error('Failed to load inward history');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inward Entry Logs</h1>
          <p className="page-subtitle">Detailed records of all inward stock entries and who entered them.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/stock-manager/inward')}>
            <ArrowLeft size={16} /> Back to Inward
          </button>
          <button className="btn btn-secondary btn-icon" onClick={fetchHistory} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-dim)' }} />
          <input 
            className="form-control" 
            placeholder="Search by Product Name or SKU..." 
            style={{ paddingLeft: '2.5rem' }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-page"><div className="spinner" /></div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><History size={40} /></div>
          <div className="empty-title">No inward history found</div>
          <div className="empty-text">Stock inward entries will appear here.</div>
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
                    <th style={{ textAlign: 'center' }}>Added Qty</th>
                    <th>Breakdown</th>
                    <th>Entered By</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
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
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ 
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '4px 10px', borderRadius: 6,
                          background: 'rgba(16,185,129,0.1)',
                          color: '#10B981',
                          fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--font-mono)'
                        }}>
                          <TrendingUp size={14} /> +{log.totalChangePcs}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {log.changeCartons > 0 && <span style={{ color: 'var(--primary)', background: 'rgba(99,102,241,0.1)', padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600 }}>{log.changeCartons} CTN</span>}
                          {log.changeInners > 0 && <span style={{ color: '#06B6D4', background: 'rgba(6,182,212,0.1)', padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600 }}>{log.changeInners} INR</span>}
                          {log.changeLoose > 0 && <span style={{ color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600 }}>{log.changeLoose} PCS</span>}
                          {log.changeCartons === 0 && log.changeInners === 0 && log.changeLoose === 0 && <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>No breakdown recorded</span>}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.3rem' }}>
                          Old Stock: {log.previousStock?.total || 0} → New: {log.newStock?.total || 0}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>
                            {(log.by || '?').charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{log.by}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{log.reason || 'Manual Update'}</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Showing page <b>{page}</b> of <b>{totalPages}</b> (Total {total} entries)
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn btn-secondary btn-sm" 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft size={16} /> Prev
                </button>
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

export default InwardHistory;
