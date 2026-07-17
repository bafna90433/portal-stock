import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, Search, Edit, Loader, X, Save,
  ArrowUp, TrendingDown, Tag, Plus, RefreshCw,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { debounce } from '../../utils/debounce';
import { useAuthStore } from '../../store/authStore';

const StockManagement: React.FC = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isStockMgr = user?.role === 'stock_manager';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [submitting, setSubmitting] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any[] | null>(null);
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [total, setTotal] = useState(0);
  const limit = 50;
  const [stockModal, setStockModal] = useState<any>(null);
  const [qty, setQty] = useState('');


  useEffect(() => {
    api.get('/categories').then(res => setCategories(res.data)).catch(console.error);
  }, []);

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^["']|["']$/g, ''));
      const row: any = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      rows.push(row);
    }
    return rows;
  };

  const handleExportTemplate = async () => {
    try {
      toast.loading('Generating template...');
      const { data } = await api.get('/products?limit=5000');
      toast.dismiss();
      const csvRows = [
        ['Product ID', 'SKU', 'Name', 'Selling Price', 'MRP', 'Cartons', 'Inners', 'Loose Pcs', 'Pcs Per Inner', 'Pcs Per Carton']
      ];
      data.products.forEach((p: any) => {
        csvRows.push([
          p._id,
          p.sku || '',
          p.name || '',
          p.wholesalerPrice ? String(p.wholesalerPrice) : '0',
          p.wholesalerMrp ? String(p.wholesalerMrp) : '0',
          p.stock?.stockCartons ? String(p.stock.stockCartons) : '0',
          p.stock?.stockInners ? String(p.stock.stockInners) : '0',
          p.stock?.stockLoose ? String(p.stock.stockLoose) : '0',
          p.pcsPerInner ? String(p.pcsPerInner) : '0',
          p.innerPerCarton ? String(p.innerPerCarton) : '0'
        ]);
      });

      const csvContent = "data:text/csv;charset=utf-8," 
        + csvRows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `stock_update_template_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Template exported!');
    } catch (err) {
      toast.dismiss();
      toast.error('Failed to export template');
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      try {
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          toast.error('CSV is empty or invalid');
          return;
        }

        toast.loading('Comparing data...');
        const { data } = await api.get('/products?limit=5000');
        toast.dismiss();
        const currentProducts = data.products;
        
        const diffList: any[] = [];
        parsed.forEach((row: any) => {
          const productId = row['Product ID'] || row['product id'] || row['ID'] || row['id'];
          const sku = row['SKU'] || row['sku'];
          const name = row['Name'] || row['name'];
          const sellingPrice = Number(row['Selling Price'] || row['selling price'] || 0);
          const mrp = Number(row['MRP'] || row['mrp'] || 0);
          const cartons = Number(row['Cartons'] || row['cartons'] || 0);
          const inners = Number(row['Inners'] || row['inners'] || 0);
          const loose = Number(row['Loose Pcs'] || row['Loose'] || row['loose pcs'] || row['loose'] || 0);
          const pcsPerInner = Number(row['Pcs Per Inner'] || row['pcs per inner'] || 0);
          const innerPerCarton = Number(row['Pcs Per Carton'] || row['pcs per carton'] || 0);

          if (!productId) return;

          const current = currentProducts.find((p: any) => String(p._id) === String(productId));
          if (!current) {
            diffList.push({
              productId,
              sku,
              name: name || 'Unknown Product',
              isNew: false,
              notFound: true
            });
            return;
          }

          const currentSellingPrice = current.wholesalerPrice || 0;
          const currentMrp = current.wholesalerMrp || 0;
          const currentCartons = current.stock?.stockCartons || 0;
          const currentInners = current.stock?.stockInners || 0;
          const currentLoose = current.stock?.stockLoose || 0;
          const currentPpi = current.pcsPerInner || 0;
          const currentPpc = current.innerPerCarton || 0;

          const priceChanged = currentSellingPrice !== sellingPrice || currentMrp !== mrp;
          const stockChanged = currentCartons !== cartons || currentInners !== inners || currentLoose !== loose;
          const hierarchyChanged = currentPpi !== pcsPerInner || currentPpc !== innerPerCarton;

          if (priceChanged || stockChanged || hierarchyChanged) {
            diffList.push({
              productId,
              sku: current.sku,
              name: current.name,
              oldPrices: { sellingPrice: currentSellingPrice, mrp: currentMrp },
              newPrices: { sellingPrice, mrp },
              oldStock: { cartons: currentCartons, inners: currentInners, loose: currentLoose },
              newStock: { cartons, inners, loose },
              oldHierarchy: { ppi: currentPpi, ppc: currentPpc },
              newHierarchy: { ppi: pcsPerInner, ppc: innerPerCarton },
              priceChanged,
              stockChanged,
              hierarchyChanged
            });
          }
        });

        if (diffList.length === 0) {
          toast.success('No changes found. Everything is up to date.');
          return;
        }

        setCsvPreview(diffList);
      } catch (err) {
        toast.dismiss();
        toast.error('Error parsing CSV file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmBulkUpdate = async () => {
    if (!csvPreview) return;
    setSubmitting(true);
    try {
      const updates = csvPreview
        .filter(item => !item.notFound)
        .map(item => ({
          productId: item.productId,
          wholesalerPrice: item.newPrices.sellingPrice,
          wholesalerMrp: item.newPrices.mrp,
          cartons: item.newStock.cartons,
          inners: item.newStock.inners,
          loose: item.newStock.loose,
          pcsPerInner: item.newHierarchy.ppi,
          innerPerCarton: item.newHierarchy.ppc
        }));

      await api.post('/products/bulk-update', { updates });
      toast.success(`Successfully updated ${updates.length} products!`);
      setCsvPreview(null);
      fetchProducts(search, page);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Bulk update failed');
    } finally {
      setSubmitting(false);
    }
  };

  const activeRequestRef = React.useRef(0);
  const isFirstLoadRef = React.useRef(true);

  const fetchProducts = useCallback(
    debounce(async (q: string, p: number) => {
      if (isFirstLoadRef.current) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      const reqId = ++activeRequestRef.current;
      try {
        const { data } = await api.get(`/products?search=${encodeURIComponent(q)}&page=${p}&limit=${limit}`);
        if (reqId === activeRequestRef.current) {
          setProducts(data.products);
          setTotal(data.total);
          isFirstLoadRef.current = false;
        }
      } catch {}
      finally {
        if (reqId === activeRequestRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }, 100),
    []
  );

  useEffect(() => {
    fetchProducts(search, page);
  }, [search, page]);

  const handlePageChange = (p: number) => {
    setPage(p);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('page', String(p));
      return next;
    });
  };


  const handleStockAdd = async () => {
    if (!qty || Number(qty) <= 0) return toast.error('Enter valid quantity');
    setSubmitting(true);
    try {
      await api.patch(`/products/${stockModal.product._id}/stock`, {
        qty: Number(qty),
        operation: 'add',
      });
      toast.success('Stock added successfully');
      setStockModal(null);
      setQty('');
      fetchProducts(search, page);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Stock update failed');
    } finally { setSubmitting(false); }
  };

  // STOCK IS PURE PCS: availableQty is the single number shown everywhere
  // (same logic as Admin portal). Muted breakdown is display-only, derived from pcs.
  const stockBreakdown = (product: any) => {
    const totalPcs = Number(product.stock?.availableQty) || 0;
    const ppi = Number(product.pcsPerInner) || 0;
    if (ppi > 1 && totalPcs > 0) {
      const inners = Math.floor(totalPcs / ppi);
      const loose = totalPcs % ppi;
      if (inners > 0) return `= ${inners} inr${loose > 0 ? ` + ${loose} pcs` : ''}`;
    }
    return '';
  };

  const lowStock = products.filter(p => (p.stock?.availableQty || 0) > 0 && (p.stock?.availableQty || 0) < 5).length;
  const outOfStock = products.filter(p => (p.stock?.availableQty || 0) === 0).length;
  const noPriceCount = products.filter(p => !p.wholesalerPrice && !p.retailerPrice).length;

  const addProductLink = isStockMgr ? '/stock-manager/add-product' : '/admin/add-product';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Management</h1>
          <p className="page-subtitle">
            {isAdmin
              ? 'Manage stock levels and set wholesaler / retailer pricing'
              : 'View stock levels — pricing is set by Admin'}
          </p>
        </div>
        {(isAdmin || isStockMgr) && (
          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={handleExportTemplate}>
              Export Template
            </button>
            <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
              Import CSV
              <input type="file" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} />
            </label>
            <a href={addProductLink} className="btn btn-primary">
              <Package size={16} /> Add Product
            </a>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card" style={{ ['--gradient' as any]: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
          <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--primary)' }}>
            <Package size={22} />
          </div>
          <div className="stat-value">{products.length}</div>
          <div className="stat-label">Total Products</div>
        </div>
        <div className="stat-card" style={{ ['--gradient' as any]: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
          <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--warning)' }}>
            <TrendingDown size={22} />
          </div>
          <div className="stat-value">{lowStock}</div>
          <div className="stat-label">Low Stock (&lt;5)</div>
        </div>
        <div className="stat-card" style={{ ['--gradient' as any]: 'linear-gradient(135deg, #EF4444, #DC2626)' }}>
          <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--danger)' }}>
            <TrendingDown size={22} />
          </div>
          <div className="stat-value">{outOfStock}</div>
          <div className="stat-label">Out of Stock</div>
        </div>
        <div className="stat-card" style={{ ['--gradient' as any]: 'linear-gradient(135deg, #06B6D4, #0E7490)' }}>
          <div className="stat-icon" style={{ background: 'rgba(6,182,212,0.12)', color: 'var(--secondary)' }}>
            <Tag size={22} />
          </div>
          <div className="stat-value">{noPriceCount}</div>
          <div className="stat-label">Pricing Pending</div>
        </div>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div className="search-bar" style={{ maxWidth: '100%' }}>
          {loading || refreshing ? (
            <RefreshCw size={16} className="spin" style={{ position: 'absolute', left: 12, top: 13, color: 'var(--primary)' }} />
          ) : (
            <Search size={16} className="search-icon" />
          )}
          <input
            className="form-control"
            placeholder="Search products by name or SKU..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
              setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                if (e.target.value) next.set('search', e.target.value);
                else next.delete('search');
                next.set('page', '1');
                return next;
              });
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes skeleton-pulse {
          0% { background-color: var(--bg3, #f1f5f9); opacity: 0.6; }
          50% { background-color: var(--border, #e2e8f0); opacity: 1; }
          100% { background-color: var(--bg3, #f1f5f9); opacity: 0.6; }
        }
        .skeleton-block {
          animation: skeleton-pulse 1.5s infinite ease-in-out;
          border-radius: 6px;
          display: inline-block;
        }
      `}</style>

      {/* Products Table */}
      {loading && products.length === 0 ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Price / MRP</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx}>
                    <td>
                      <div className="skeleton-block" style={{ width: 40, height: 40, borderRadius: 8 }} />
                    </td>
                    <td>
                      <div className="skeleton-block" style={{ width: '80%', height: 16 }} />
                    </td>
                    <td>
                      <div className="skeleton-block" style={{ width: 60, height: 14 }} />
                    </td>
                    <td>
                      <div className="skeleton-block" style={{ width: 80, height: 14 }} />
                    </td>
                    <td>
                      <div className="skeleton-block" style={{ width: 50, height: 16 }} />
                    </td>
                    <td>
                      <div className="skeleton-block" style={{ width: 75, height: 16 }} />
                    </td>
                    <td>
                      <div className="skeleton-block" style={{ width: 65, height: 20, borderRadius: 12 }} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div className="skeleton-block" style={{ width: 60, height: 32, borderRadius: 8 }} />
                        <div className="skeleton-block" style={{ width: 32, height: 32, borderRadius: 8 }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <div className="empty-title">No products found</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', opacity: loading || refreshing ? 0.6 : 1, transition: 'opacity 0.15s ease' }}>
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Price / MRP</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const wp = Number(p.wholesalerPrice) || 0;
                  const rp = Number(p.retailerPrice) || 0;
                  const noPrice = wp === 0 && rp === 0;
                  return (
                    <tr key={p._id}>
                      <td>
                        {p.imageUrl ? (
                          <img src={p.imageUrl} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} alt={p.name} />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📦</div>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.sku}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{p.category || '—'}</td>
                      <td style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: 600 }}>{p.unit}</div>
                        {(p.pcsPerInner > 1 || p.innerPerCarton > 1) && (
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: 4, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {p.innerPerCarton > 1 && <span style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4 }}>📦 1 Carton = {p.innerPerCarton} Pcs</span>}
                            {p.pcsPerInner > 1 && <span style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4 }}>📦 1 Inner = {p.pcsPerInner} Pcs</span>}
                          </div>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                        {wp > 0 ? (
                          <div>
                            <div style={{ fontWeight: 800, color: 'var(--primary)' }}>₹{wp.toFixed(2)}</div>
                            {Number(p.wholesalerMrp) > 0 && (
                              <div style={{ fontSize: '0.68rem', color: '#D97706', fontWeight: 600 }}>MRP ₹{Number(p.wholesalerMrp).toFixed(2)}</div>
                            )}
                            {(p.bulkPricingTiers?.length > 0) && (
                              <div style={{ fontSize: '0.65rem', color: '#D97706', fontWeight: 700, background: 'rgba(245,158,11,0.1)', borderRadius: 4, padding: '2px 6px', marginTop: 4, display: 'inline-block' }}>
                                🏷️ Bulk: Min {p.bulkPricingTiers.map((t: any) => `${t.minQty} ${t.unit || 'pcs'}`).join(' / ')}
                              </div>
                            )}
                          </div>
                        ) : <span style={{ color: 'var(--text-dim)', fontWeight: 500, fontSize: '0.78rem' }}>Not set</span>}
                      </td>
                      {/* Retailer column removed */}
                      <td>
                        {(() => {
                          const totalPcs = Number(p.stock?.availableQty) || 0;
                          const stockColor = totalPcs <= 0 ? 'var(--danger)' : totalPcs < 5 ? 'var(--warning)' : 'var(--success)';
                          const breakdown = stockBreakdown(p);
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: stockColor, fontFamily: 'var(--font-mono)' }}>
                                  {totalPcs}
                                </span>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                                  Pcs
                                </span>
                              </div>
                              {breakdown && (
                                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                  {breakdown}
                                </span>
                              )}
                              {totalPcs <= 0 && <span className="badge status-pending" style={{ fontSize: '0.58rem', marginTop: 1, width: 'fit-content' }}>Out</span>}
                              {totalPcs > 0 && totalPcs < 5 && <span className="badge status-partial" style={{ fontSize: '0.58rem', marginTop: 1, width: 'fit-content' }}>Low</span>}
                            </div>
                          );
                        })()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <button
                            className="btn btn-sm"
                            title="Edit Product"
                            onClick={() => navigate(isStockMgr ? `/stock-manager/edit-product/${p._id}` : `/admin/edit-product/${p._id}`)}
                            style={{
                              background: noPrice
                                ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                                : 'var(--primary-50)',
                              color: noPrice ? 'white' : 'var(--primary)',
                              padding: '0.4rem 0.75rem',
                              fontWeight: 700,
                              gap: '0.3rem',
                              boxShadow: noPrice ? '0 4px 12px -4px rgba(245,158,11,0.5)' : 'none',
                            }}
                          >
                            <Edit size={13} />
                            {noPrice ? 'Set Price' : 'Edit'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {(() => {
        const totalPages = Math.ceil(total / limit);
        if (totalPages <= 1) return null;

        const pages: (number | string)[] = [];
        const range = 1;

        for (let i = 1; i <= totalPages; i++) {
          if (
            i === 1 ||
            i === totalPages ||
            (i >= page - range && i <= page + range)
          ) {
            pages.push(i);
          } else if (pages[pages.length - 1] !== '...') {
            pages.push('...');
          }
        }

        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem', marginBottom: '1rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              style={{ padding: '0.4rem 0.75rem', fontWeight: 600 }}
            >
              Prev
            </button>
            
            {pages.map((p, i) => {
              if (p === '...') {
                return <span key={i} style={{ color: 'var(--text-dim)', padding: '0 0.25rem' }}>...</span>;
              }
              const isCurrent = p === page;
              return (
                <button
                  key={i}
                  className={isCurrent ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                  onClick={() => handlePageChange(p as number)}
                  style={{
                    minWidth: 32,
                    height: 32,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    borderRadius: 8,
                    background: isCurrent ? 'var(--primary)' : 'var(--bg3)',
                    border: isCurrent ? 'none' : '1px solid var(--border)',
                    color: isCurrent ? 'white' : 'var(--text)',
                  }}
                >
                  {p}
                </button>
              );
            })}

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
              style={{ padding: '0.4rem 0.75rem', fontWeight: 600 }}
            >
              Next
            </button>
          </div>
        );
      })()}

      {/* Add Stock Modal */}
      {stockModal && (
        <div className="modal-overlay" onClick={() => setStockModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                <ArrowUp size={18} color="var(--success)" /> Add Stock
              </h3>
              <button className="modal-close" onClick={() => setStockModal(null)}><X size={16} /></button>
            </div>
            <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg3)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {stockModal.product.imageUrl && (
                  <img src={stockModal.product.imageUrl} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} alt="" />
                )}
                <div>
                  <div style={{ fontWeight: 700 }}>{stockModal.product.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{stockModal.product.sku}</div>
                  <div style={{ fontSize: '0.8rem', marginTop: 2 }}>
                    Current Stock: <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{stockModal.product.stock?.availableQty || 0} {stockModal.product.unit}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity to Add</label>
              <input
                className="form-control"
                type="number" min="0"
                value={qty}
                onChange={e => setQty(e.target.value)}
                placeholder="0"
                style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '1rem' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setStockModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={handleStockAdd} disabled={submitting}>
                {submitting
                  ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
                  : <><Save size={16} /> Add Stock</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Bulk Update Preview Modal */}
      {csvPreview && (
        <div className="modal-overlay" onClick={() => setCsvPreview(null)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title"><TrendingDown size={18} color="var(--primary)" /> Bulk Update Preview</h3>
              <button className="modal-close" onClick={() => setCsvPreview(null)}><X size={16} /></button>
            </div>
            
            <div style={{ marginBottom: '1rem', maxHeight: 380, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ background: 'var(--bg3)', position: 'sticky', top: 0, zIndex: 1 } as any}>
                  <tr>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Product</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Price Changes</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Stock Changes</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Packing (Pcs)</th>
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.map((item, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        <div style={{ fontWeight: 700 }}>{item.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.sku}</div>
                        {item.notFound && <span className="badge status-pending" style={{ fontSize: '0.6rem', marginTop: 4 }}>Not Found</span>}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        {item.notFound ? '—' : item.priceChanged ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.78rem' }}>
                            <div>Sell: <span style={{ textDecoration: 'line-through', color: 'var(--text-dim)' }}>₹{item.oldPrices.sellingPrice}</span> → <span style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{item.newPrices.sellingPrice}</span></div>
                            <div>MRP: <span style={{ textDecoration: 'line-through', color: 'var(--text-dim)' }}>₹{item.oldPrices.mrp}</span> → <span style={{ fontWeight: 700, color: 'var(--warning)' }}>₹{item.newPrices.mrp}</span></div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>No change</span>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        {item.notFound ? '—' : item.stockChanged ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.78rem' }}>
                            <div>Ctn: <span style={{ textDecoration: 'line-through', color: 'var(--text-dim)' }}>{item.oldStock.cartons}</span> → <span style={{ fontWeight: 700, color: '#10B981' }}>{item.newStock.cartons}</span></div>
                            <div>Inr: <span style={{ textDecoration: 'line-through', color: 'var(--text-dim)' }}>{item.oldStock.inners}</span> → <span style={{ fontWeight: 700, color: '#06B6D4' }}>{item.newStock.inners}</span></div>
                            <div>Loose: <span style={{ textDecoration: 'line-through', color: 'var(--text-dim)' }}>{item.oldStock.loose}</span> → <span style={{ fontWeight: 700, color: 'var(--text)' }}>{item.newStock.loose}</span></div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>No change</span>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        {item.notFound ? '—' : item.hierarchyChanged ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.78rem' }}>
                            <div>Inr: <span style={{ textDecoration: 'line-through', color: 'var(--text-dim)' }}>{item.oldHierarchy.ppi}</span> → <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{item.newHierarchy.ppi}</span></div>
                            <div>Ctn: <span style={{ textDecoration: 'line-through', color: 'var(--text-dim)' }}>{item.oldHierarchy.ppc}</span> → <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{item.newHierarchy.ppc}</span></div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>No change</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem', padding: '0.5rem 0.75rem', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)', borderRadius: 8 }}>
              💡 Verify the changes listed above. Products not found or SKU mismatches will be ignored.
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setCsvPreview(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmBulkUpdate} disabled={submitting}>
                {submitting ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Applying...</> : <><Save size={16} /> Confirm & Apply</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};


export default StockManagement;
