import React, { useState, useEffect, useCallback } from 'react';
import { 
  History, Search, ArrowLeft, ChevronLeft, ChevronRight, RefreshCw,
  ArrowUpRight, ArrowDownRight
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
  
  // Type filter: 'all' | 'inward' | 'deduction'
  const [typeFilter, setTypeFilter] = useState<'all' | 'inward' | 'deduction'>('all');
  const limit = 20;
  const navigate = useNavigate();

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/stock/history', {
        params: { 
          search, 
          type: typeFilter === 'all' ? undefined : typeFilter, 
          page, 
          limit 
        }
      });
      
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch {
      toast.error('Failed to load stock movement history');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, page]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Movement & Inward Logs</h1>
          <p className="page-subtitle">Detailed history of all stock inward (+ added) and stock deductions (- minus/dispatches).</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/stock-manager/inward')}>
            <ArrowLeft size={16} /> Back to Stock Inward
          </button>
          <button className="btn btn-secondary btn-icon" onClick={fetchHistory} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Movement Type Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg3)', padding: '4px', borderRadius: 10 }}>
            <button
              onClick={() => { setTypeFilter('all'); setPage(1); }}
              style={{
                padding: '0.45rem 1rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, border: 'none', cursor: 'pointer',
                background: typeFilter === 'all' ? 'var(--bg2)' : 'transparent',
                color: typeFilter === 'all' ? 'var(--primary)' : 'var(--text-dim)',
                boxShadow: typeFilter === 'all' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              📋 All Movements
            </button>
            <button
              onClick={() => { setTypeFilter('inward'); setPage(1); }}
              style={{
                padding: '0.45rem 1rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, border: 'none', cursor: 'pointer',
                background: typeFilter === 'inward' ? 'rgba(16,185,129,0.15)' : 'transparent',
                color: typeFilter === 'inward' ? '#10B981' : 'var(--text-dim)'
              }}
            >
              🟢 + Inward (Added)
            </button>
            <button
              onClick={() => { setTypeFilter('deduction'); setPage(1); }}
              style={{
                padding: '0.45rem 1rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, border: 'none', cursor: 'pointer',
                background: typeFilter === 'deduction' ? 'rgba(239,68,68,0.15)' : 'transparent',
                color: typeFilter === 'deduction' ? '#EF4444' : 'var(--text-dim)'
              }}
            >
              🔴 - Stock Deducted (Dispatches / Minus)
            </button>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-dim)' }} />
            <input 
              className="form-control" 
              placeholder="Search by Product, SKU, or Reason..." 
              style={{ paddingLeft: '2.5rem' }}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-page"><div className="spinner" /></div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><History size={40} /></div>
          <div className="empty-title">No stock logs found</div>
          <div className="empty-text">Stock movement logs will appear here once added or dispatched.</div>
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
                    <th style={{ textAlign: 'center' }}>Qty Change</th>
                    <th>Type & Reason</th>
                    <th>Entered By</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const isPositive = log.totalChangePcs > 0;
                    return (
                      <tr key={log._id}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            {new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                            {new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{log.productName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>SKU: {log.sku}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ 
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '0.25rem 0.75rem', borderRadius: 20, 
                            background: isPositive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', 
                            color: isPositive ? '#10B981' : '#EF4444', 
                            fontWeight: 800, fontSize: '0.88rem' 
                          }}>
                            {isPositive ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                            {isPositive ? `+${log.totalChangePcs}` : `${log.totalChangePcs}`} pcs
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.82rem', color: isPositive ? 'var(--text)' : '#DC2626' }}>
                            {log.reason || (isPositive ? 'Inward Stock' : 'Stock Deduction')}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                            {log.cartonsChange !== 0 && <span>{log.cartonsChange > 0 ? `+${log.cartonsChange}` : log.cartonsChange} CTN </span>}
                            {log.innersChange !== 0 && <span>{log.innersChange > 0 ? `+${log.innersChange}` : log.innersChange} INR </span>}
                            {log.looseChange !== 0 && <span>{log.looseChange > 0 ? `+${log.looseChange}` : log.looseChange} PCS</span>}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${isPositive ? 'badge-success' : 'badge-danger'}`} style={{ fontWeight: 700 }}>
                            {log.by || 'SYSTEM'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Showing page <b>{page}</b> of <b>{totalPages}</b> ({total} records)
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
    </div>
  );
};

export default InwardHistory;
