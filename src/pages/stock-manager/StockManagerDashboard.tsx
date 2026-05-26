import React, { useEffect, useState, useCallback } from 'react';
import UrgentNotifBanner from '../../components/UrgentNotifBanner';
import {
  Package, TrendingUp, AlertTriangle, Tags, Plus,
  BarChart3, RefreshCw, CheckCircle, ArrowUpRight,
} from 'lucide-react';
import DashboardHero from '../../components/DashboardHero';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import { Link } from 'react-router-dom';

const StockManagerDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>({});
  const [recentProducts, setRecentProducts] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [dashRes, productsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/products?limit=50&sort=stock_asc'),
      ]);
      setStats(dashRes.data.stats || {});
      const products: any[] = productsRes.data.products || [];
      setRecentProducts([...products].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10));
      setLowStockProducts(products.filter((p: any) => (p.stock?.availableQty ?? 0) <= (p.lowStockThreshold ?? 10)).slice(0, 10));
    } catch (e) {
      /* silent */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const statCards = [
    { label: 'Total Products', value: stats.totalProducts ?? 0, icon: <Package size={20} />, color: '#6366F1', bg: 'rgba(99,102,241,0.1)', gradient: 'linear-gradient(135deg,#6366F1,#8B5CF6)', to: '/stock-manager/products' },
    { label: 'Low Stock Items', value: stats.lowStock ?? 0, icon: <TrendingUp size={20} />, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', gradient: 'linear-gradient(135deg,#F59E0B,#EF4444)', to: '/stock-manager/stock' },
    { label: 'Out of Stock', value: stats.outOfStock ?? 0, icon: <AlertTriangle size={20} />, color: '#EF4444', bg: 'rgba(239,68,68,0.1)', gradient: 'linear-gradient(135deg,#EF4444,#DC2626)', to: '/stock-manager/stock' },
    { label: 'Categories', value: stats.totalCategories ?? '—', icon: <Tags size={20} />, color: '#10B981', bg: 'rgba(16,185,129,0.1)', gradient: 'linear-gradient(135deg,#10B981,#06B6D4)', to: '/stock-manager/categories' },
  ];

  const quickActions = [
    { label: 'Add New Product', icon: <Plus size={16} />, to: '/stock-manager/add-product', color: '#6366F1' },
    { label: 'Manage Stock', icon: <BarChart3 size={16} />, to: '/stock-manager/stock', color: '#10B981' },
    { label: 'Categories', icon: <Tags size={16} />, to: '/stock-manager/categories', color: '#F59E0B' },
    { label: 'Products List', icon: <Package size={16} />, to: '/stock-manager/products', color: '#06B6D4' },
  ];

  return (
    <div style={{ padding: '1.75rem 2rem', width: '100%', boxSizing: 'border-box' }}>
      <UrgentNotifBanner />

      <DashboardHero
        title="Inventory Dashboard"
        subtitle="Monitor stock levels, manage products, and track low stock alerts."
        onRefresh={() => fetchData(true)}
        refreshing={refreshing}
        stats={[
          { label: 'Products', value: loading ? '—' : stats.totalProducts ?? 0, color: '#10B981' },
          { label: 'Low Stock', value: loading ? '—' : stats.lowStock ?? 0, color: '#F59E0B' },
          { label: 'Out of Stock', value: loading ? '—' : stats.outOfStock ?? 0, color: '#EF4444' },
          { label: 'Categories', value: loading ? '—' : stats.totalCategories ?? 0, color: '#3B82F6' },
        ]}
        actions={[
          { label: 'Manage Stock', icon: <BarChart3 size={15} />, to: '/stock-manager/stock', variant: 'secondary' },
          { label: 'Add Product', icon: <Plus size={15} />, to: '/stock-manager/add-product', variant: 'primary' },
        ]}
      />

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
        {statCards.map((s) => (
          <Link key={s.label} to={s.to} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-xs)',
              transition: 'all 0.18s',
              cursor: 'pointer',
              borderLeft: `4px solid ${s.color}`,
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-xs)'; }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 10, background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {s.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: s.color, lineHeight: 1.2, fontFamily: 'Outfit, sans-serif' }}>
                  {loading ? '—' : s.value}
                </div>
              </div>
              <ArrowUpRight size={14} style={{ color: s.color, opacity: 0.5, flexShrink: 0 }} />
            </div>
          </Link>
        ))}
      </div>

      {/* ── Quick Actions Row ── */}
      <div style={{
        display: 'flex', gap: '0.75rem', marginBottom: '1.25rem',
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '0.85rem 1.25rem',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '0.5rem', whiteSpace: 'nowrap' }}>Quick Actions</span>
        <div style={{ width: 1, height: 24, background: 'var(--border)', marginRight: '0.5rem' }} />
        {quickActions.map((a) => (
          <Link key={a.label} to={a.to} style={{
            display: 'flex', alignItems: 'center', gap: '0.45rem',
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg3)',
            border: `1px solid var(--border)`,
            textDecoration: 'none',
            color: a.color,
            fontSize: '0.8rem',
            fontWeight: 700,
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = a.color; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'; (e.currentTarget as HTMLElement).style.color = a.color; }}
          >
            {a.icon} {a.label}
          </Link>
        ))}
      </div>

      {/* ── Low Stock Alerts — Full Width Table ── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: '1.25rem', overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem' }}>
            <AlertTriangle size={16} style={{ color: 'var(--warning)' }} /> Low Stock Alerts
            {!loading && lowStockProducts.length > 0 && (
              <span style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontSize: '0.7rem', fontWeight: 700, padding: '1px 8px', borderRadius: 99 }}>{lowStockProducts.length}</span>
            )}
          </div>
          <Link to="/stock-manager/stock" style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Manage all →</Link>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
        ) : lowStockProducts.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2.5rem', gap: '0.5rem' }}>
            <CheckCircle size={28} style={{ color: 'var(--success)', opacity: 0.6 }} />
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>All stock levels are healthy</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                {['Product', 'SKU', 'Category', 'Available Qty', 'Threshold', 'Status'].map(h => (
                  <th key={h} style={{ padding: '0.45rem 1.25rem', textAlign: 'left', fontSize: '0.67rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lowStockProducts.map((p: any, i: number) => {
                const qty = p.stock?.availableQty ?? 0;
                const isOut = qty === 0;
                return (
                  <tr key={p._id} style={{ borderBottom: i < lowStockProducts.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.12s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
                  >
                    <td style={{ padding: '0.45rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                        {p.imageUrl ? (
                          <img src={p.imageUrl} style={{ width: 26, height: 26, borderRadius: 5, objectFit: 'cover', flexShrink: 0 }} alt="" />
                        ) : (
                          <div style={{ width: 26, height: 26, borderRadius: 5, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.85rem', border: '1px solid var(--border)' }}>📦</div>
                        )}
                        <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{p.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.45rem 1.25rem', fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.sku}</td>
                    <td style={{ padding: '0.45rem 1.25rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>{p.category || '—'}</td>
                    <td style={{ padding: '0.45rem 1.25rem', fontWeight: 700, fontSize: '0.83rem', color: isOut ? 'var(--danger)' : 'var(--warning)' }}>{qty}</td>
                    <td style={{ padding: '0.45rem 1.25rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>{p.lowStockThreshold ?? 10}</td>
                    <td style={{ padding: '0.45rem 1.25rem' }}>
                      <span style={{
                        fontSize: '0.67rem', fontWeight: 700, padding: '2px 9px', borderRadius: 99,
                        background: isOut ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                        color: isOut ? 'var(--danger)' : 'var(--warning)',
                      }}>
                        {isOut ? 'Out of Stock' : 'Low Stock'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Recently Added — Full Width Table ── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem' }}>
            <RefreshCw size={15} style={{ color: 'var(--primary)' }} /> Recently Added Products
          </div>
          <Link to="/stock-manager/products" style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>View all →</Link>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
        ) : recentProducts.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2.5rem', gap: '0.5rem' }}>
            <span style={{ fontSize: '2rem', opacity: 0.2 }}>📦</span>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>No products yet</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                {['Product', 'SKU', 'Category', 'Stock (Qty)', 'Added On'].map(h => (
                  <th key={h} style={{ padding: '0.45rem 1.25rem', textAlign: 'left', fontSize: '0.67rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentProducts.map((p: any, i: number) => {
                const qty = p.stock?.availableQty ?? 0;
                const stockColor = qty === 0 ? 'var(--danger)' : qty <= 10 ? 'var(--warning)' : 'var(--success)';
                const ppc = Number(p.innerPerCarton) || 0;
                const ppi = Number(p.pcsPerInner) || 0;
                const hasCarton = ppc > 1;
                const hasInner = ppi > 1;
                const savedC = p.stock?.stockCartons ?? 0;
                const savedI = p.stock?.stockInners ?? 0;
                const savedL = p.stock?.stockLoose ?? 0;
                const useSaved = qty > 0 && (savedC > 0 || savedI > 0 || savedL > 0);
                let ctns: number, inners: number, loose: number;
                if (useSaved) {
                  ctns = savedC; inners = savedI; loose = savedL;
                } else {
                  let rem = qty;
                  ctns = hasCarton ? Math.floor(rem / ppc) : 0;
                  rem = hasCarton ? rem % ppc : rem;
                  inners = hasInner ? Math.floor(rem / ppi) : 0;
                  loose = hasInner ? rem % ppi : rem;
                }
                const parts = [
                  hasCarton && ctns > 0 && { val: ctns, label: 'ctn' },
                  hasInner && inners > 0 && { val: inners, label: 'inr' },
                  loose > 0 && { val: loose, label: 'pcs' },
                ].filter(Boolean) as { val: number; label: string }[];
                const displayParts = parts.length > 0 ? parts : [{ val: 0, label: 'pcs' }];
                return (
                  <tr key={p._id} style={{ borderBottom: i < recentProducts.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.12s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
                  >
                    <td style={{ padding: '0.45rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                        {p.imageUrl ? (
                          <img src={p.imageUrl} style={{ width: 26, height: 26, borderRadius: 5, objectFit: 'cover', flexShrink: 0 }} alt="" />
                        ) : (
                          <div style={{ width: 26, height: 26, borderRadius: 5, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.85rem', border: '1px solid var(--border)' }}>📦</div>
                        )}
                        <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{p.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.45rem 1.25rem', fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.sku}</td>
                    <td style={{ padding: '0.45rem 1.25rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>{p.category || 'Uncategorized'}</td>
                    <td style={{ padding: '0.45rem 1.25rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {displayParts.map((part, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                            <span style={{ fontWeight: 800, fontSize: '0.88rem', color: stockColor, fontFamily: 'var(--font-mono)' }}>{part.val}</span>
                            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>{part.label}</span>
                          </div>
                        ))}
                        {qty === 0 && <span className="badge status-pending" style={{ fontSize: '0.55rem', marginTop: 1 }}>Out</span>}
                      </div>
                    </td>
                    <td style={{ padding: '0.45rem 1.25rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {new Date(p.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
};

export default StockManagerDashboard;
