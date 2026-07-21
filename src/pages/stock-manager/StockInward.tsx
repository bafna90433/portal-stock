import React, { useState, useEffect, useRef } from 'react';
import { Search, Package, Plus, Minus, History, X, ArrowRight, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const StockInward: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Mode: 'add' (Inward) or 'remove' (Deduct/Minus)
  const [operationMode, setOperationMode] = useState<'add' | 'remove'>('add');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const limit = 12;

  const [cartons, setCartons] = useState('');
  const [inners, setInners] = useState('');
  const [loose, setLoose] = useState('');
  const [enteredBy, setEnteredBy] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Recent History filter: 'all' | 'inward' | 'deduction'
  const [historyFilter, setHistoryFilter] = useState<'all' | 'inward' | 'deduction'>('all');
  const [recentHistory, setRecentHistory] = useState<any[]>([]);
  const navigate = useNavigate();

  const entryOptions = ['ADMIN', 'ACCOUNT', 'STOCK', 'DISPATCH'];

  useEffect(() => {
    fetchRecentHistory();
  }, [historyFilter]);

  const fetchRecentHistory = async () => {
    try {
      const { data } = await api.get('/stock/history', { 
        params: { 
          limit: 15,
          type: historyFilter === 'all' ? undefined : historyFilter
        } 
      });
      setRecentHistory(data.logs || []);
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setIsSearching(true);
      try {
        const { data } = await api.get('/products', { params: { search: searchQuery, limit, page } });
        if (active) {
          setSearchResults(data.products);
          setTotalPages(Math.ceil(data.total / limit) || 1);
          setTotalProducts(data.total || 0);
        }
      } catch (err) {
        if (active) toast.error('Search failed');
      } finally {
        if (active) setIsSearching(false);
      }
    };

    const delayDebounceFn = setTimeout(loadData, 100);

    return () => {
      active = false;
      clearTimeout(delayDebounceFn);
    };
  }, [searchQuery, page]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product);
    setSearchQuery('');
    setCartons('');
    setInners('');
    setLoose('');
  };

  const handleStockUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const c = Number(cartons) || 0;
    const i = Number(inners) || 0;
    const l = Number(loose) || 0;

    const ppi = selectedProduct.pcsPerInner || 0;
    const ppc = selectedProduct.innerPerCarton || 0;
    const pcsPerCarton = ppc;

    const totalPcs = (c * pcsPerCarton) + (i * ppi) + l;

    if (totalPcs <= 0) {
      toast.error('Please enter valid quantities');
      return;
    }
    
    if (!enteredBy) {
      toast.error('Please select who is updating this stock');
      return;
    }

    const currentQty = Number(selectedProduct.stock?.availableQty) || 0;
    if (operationMode === 'remove' && totalPcs > currentQty) {
      toast.error(`Cannot remove ${totalPcs} pcs. Current available stock is only ${currentQty} pcs.`);
      return;
    }

    setSubmitting(true);
    try {
      const currentStock = selectedProduct.stock || {};
      let newCartons = 0;
      let newInners = 0;
      let newLoose = 0;

      if (operationMode === 'add') {
        newCartons = (Number(currentStock.stockCartons) || 0) + c;
        newInners = (Number(currentStock.stockInners) || 0) + i;
        newLoose = (Number(currentStock.stockLoose) || 0) + l;
      } else {
        newCartons = Math.max(0, (Number(currentStock.stockCartons) || 0) - c);
        newInners = Math.max(0, (Number(currentStock.stockInners) || 0) - i);
        newLoose = Math.max(0, (Number(currentStock.stockLoose) || 0) - l);
      }

      await api.patch(`/products/${selectedProduct._id}/stock`, {
        operation: operationMode,
        qty: totalPcs,
        cartons: newCartons,
        inners: newInners,
        loose: newLoose,
        enteredBy
      });

      if (operationMode === 'add') {
        toast.success(`Added +${totalPcs} pcs to ${selectedProduct.name}`);
      } else {
        toast.success(`Deducted -${totalPcs} pcs from ${selectedProduct.name}`);
      }

      setSelectedProduct(null);
      setCartons('');
      setInners('');
      setLoose('');
      setEnteredBy('');
      fetchRecentHistory();
      
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Stock update failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Inward & Deductions</h1>
          <p className="page-subtitle">Add new inventory or record manual stock deductions</p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))' }}>
        
        {/* Left Col: Search & Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card" style={{ overflow: 'visible', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Search size={18} className="text-dim" /> Find Product
            </h2>
            <div style={{ position: 'relative' }}>
              <input
                ref={searchInputRef}
                type="text"
                className="form-control"
                placeholder="Search by SKU or Name..."
                value={searchQuery}
                onChange={handleSearchChange}
                style={{ padding: '0.85rem 1rem', fontSize: '0.95rem', borderRadius: 10 }}
              />
              {isSearching && (
                <div style={{ position: 'absolute', right: 12, top: 14, fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>Searching...</div>
              )}
            </div>

            {!selectedProduct && (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '1rem',
                  marginTop: '1.5rem'
                }}>
                  {searchResults.map(p => (
                    <div
                      key={p._id}
                      onClick={() => handleSelectProduct(p)}
                      style={{
                        padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem',
                        border: '1px solid var(--border)', borderRadius: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
                        background: 'var(--bg2)'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)' }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                    >
                      <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', background: 'var(--bg3)', flexShrink: 0 }}>
                        {p.imageUrl ? (
                          <img src={p.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
                            <Package size={24} />
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>SKU: {p.sku}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: (p.stock?.availableQty || 0) > 0 ? 'var(--primary)' : '#EF4444' }}>
                          {Number(p.stock?.availableQty) || 0} pcs
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Total <b>{totalProducts}</b> products
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                      >
                        <ChevronLeft size={16} /> Prev
                      </button>
                      
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let startPage = Math.max(1, page - 2);
                          if (startPage + 4 > totalPages) {
                            startPage = Math.max(1, totalPages - 4);
                          }
                          const pNum = startPage + i;
                          if (pNum > totalPages) return null;
                          return (
                            <button 
                              key={pNum}
                              className={`btn btn-sm ${page === pNum ? 'btn-primary' : 'btn-secondary'}`}
                              onClick={() => setPage(pNum)}
                              style={{ minWidth: '32px', padding: '0.3rem' }}
                            >
                              {pNum}
                            </button>
                          );
                        })}
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
          </div>

          {selectedProduct && (
            <div className="card fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ width: 60, height: 60, borderRadius: 8, overflow: 'hidden', background: 'var(--bg3)' }}>
                    {selectedProduct.imageUrl ? (
                      <img src={selectedProduct.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
                        <Package size={24} />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{selectedProduct.name}</h3>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>SKU: {selectedProduct.sku}</div>
                  </div>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="btn btn-secondary" style={{ padding: '0.4rem' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Action Mode Toggle (Inward vs Minus) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setOperationMode('add')}
                  style={{
                    padding: '0.75rem', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem',
                    border: operationMode === 'add' ? '2px solid #10B981' : '1px solid var(--border)',
                    background: operationMode === 'add' ? 'rgba(16,185,129,0.1)' : 'var(--bg2)',
                    color: operationMode === 'add' ? '#10B981' : 'var(--text-dim)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                  }}
                >
                  <Plus size={18} /> Inward (+ Stock)
                </button>
                <button
                  type="button"
                  onClick={() => setOperationMode('remove')}
                  style={{
                    padding: '0.75rem', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem',
                    border: operationMode === 'remove' ? '2px solid #EF4444' : '1px solid var(--border)',
                    background: operationMode === 'remove' ? 'rgba(239,68,68,0.1)' : 'var(--bg2)',
                    color: operationMode === 'remove' ? '#EF4444' : 'var(--text-dim)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                  }}
                >
                  <Minus size={18} /> Deduct (- Stock)
                </button>
              </div>

              <div style={{ background: 'var(--bg3)', padding: '1.25rem', borderRadius: 12, marginBottom: '1.5rem', display: 'flex', gap: '2.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Current Available Stock</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.2rem', color: (selectedProduct.stock?.availableQty || 0) > 0 ? 'var(--text)' : '#EF4444' }}>
                    {Number(selectedProduct.stock?.availableQty) || 0} pcs
                  </div>
                  
                  {/* Stock Breakdown */}
                  {(() => {
                    const qty = Number(selectedProduct.stock?.availableQty) || 0;
                    const c = selectedProduct.stock?.stockCartons ?? 0;
                    const inn = selectedProduct.stock?.stockInners ?? 0;
                    const l = selectedProduct.stock?.stockLoose ?? 0;
                    
                    let currCartons = c;
                    let currInners = inn;
                    let currLoose = l;

                    if (qty > 0 && c === 0 && inn === 0 && l === 0) {
                      const ppi = Number(selectedProduct.pcsPerInner) || 0;
                      const ppc = Number(selectedProduct.innerPerCarton) || 0;
                      const pcsPerCarton = ppc;

                      currCartons = pcsPerCarton > 1 ? Math.floor(qty / pcsPerCarton) : 0;
                      const rem = pcsPerCarton > 1 ? qty % pcsPerCarton : qty;
                      currInners = ppi > 1 ? Math.floor(rem / ppi) : 0;
                      currLoose = ppi > 1 ? rem % ppi : rem;
                    }

                    if (currCartons > 0 || currInners > 0 || currLoose > 0) {
                      return (
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', fontSize: '0.75rem', fontWeight: 600 }}>
                          {currCartons > 0 && <span style={{ color: 'var(--primary)', background: 'rgba(99,102,241,0.1)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>{currCartons} CTN</span>}
                          {currInners > 0 && <span style={{ color: '#06B6D4', background: 'rgba(6,182,212,0.1)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>{currInners} INR</span>}
                          {currLoose > 0 && <span style={{ color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>{currLoose} PCS</span>}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Packing Hierarchy</div>
                  <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.6rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--success)' }}>
                    {Number(selectedProduct.innerPerCarton) > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.6rem', borderRadius: 6 }}>
                        ✓ 1 Carton = {selectedProduct.innerPerCarton} Pcs
                      </span>
                    )}
                    {Number(selectedProduct.pcsPerInner) > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.6rem', borderRadius: 6 }}>
                        ✓ 1 Inner = {selectedProduct.pcsPerInner} Pcs
                      </span>
                    )}
                    {Number(selectedProduct.innerPerCarton) === 0 && Number(selectedProduct.pcsPerInner) === 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.6rem', borderRadius: 6, color: 'var(--text-dim)' }}>
                        No packing hierarchy defined
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <form onSubmit={handleStockUpdate}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">
                    {operationMode === 'add' ? 'Inward Quantity (Pieces)' : 'Stock Deduction Quantity (Pieces)'}
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{
                        background: operationMode === 'add' ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
                        border: operationMode === 'add' ? '1px solid rgba(16,185,129,0.18)' : '1px solid rgba(239,68,68,0.18)',
                        borderRadius: 12, padding: '0.75rem'
                      }}>
                        <div style={{
                          fontSize: '0.7rem', fontWeight: 700,
                          color: operationMode === 'add' ? '#10B981' : '#EF4444',
                          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem'
                        }}>
                          {operationMode === 'add' ? '🔩 Quantity to Add (Pieces)' : '🔻 Quantity to Deduct (Pieces)'}
                        </div>
                        <input type="number" min="1" placeholder={operationMode === 'add' ? "Enter pieces to inward..." : "Enter pieces to minus..."}
                          value={loose} onChange={e => setLoose(e.target.value)}
                          style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.85rem', fontSize: '1rem', fontWeight: 700, color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-mono)', boxSizing: 'border-box' }}
                          required
                        />
                      </div>
                    </div>
                  </div>
                  
                  {(() => {
                    const c = Number(cartons) || 0;
                    const i = Number(inners) || 0;
                    const l = Number(loose) || 0;
                    const ppi = selectedProduct.pcsPerInner || 0;
                    const ppc = selectedProduct.innerPerCarton || 0;
                    const pcsPerCarton = ppc;
                    const totalPcs = (c * pcsPerCarton) + (i * ppi) + l;

                    if (totalPcs > 0) {
                      return (
                        <div style={{
                          marginTop: '1rem', padding: '0.75rem 1.25rem',
                          background: operationMode === 'add'
                            ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(6,182,212,0.06))'
                            : 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(245,158,11,0.06))',
                          border: operationMode === 'add' ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)',
                          borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {operationMode === 'add' ? 'Total Inward Qty' : 'Total Deduction Qty'}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                            <span style={{
                              fontSize: '1.5rem', fontWeight: 800,
                              color: operationMode === 'add' ? '#10B981' : '#EF4444',
                              fontFamily: 'var(--font-display)', letterSpacing: '-0.03em'
                            }}>
                              {operationMode === 'add' ? `+${totalPcs.toLocaleString()}` : `-${totalPcs.toLocaleString()}`}
                            </span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Pcs</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div style={{ marginTop: '1.25rem', marginBottom: '1.5rem' }}>
                    <label className="form-label">Entered By *</label>
                    <select
                      className="form-control"
                      value={enteredBy}
                      onChange={e => setEnteredBy(e.target.value)}
                      style={{ padding: '0.75rem 1rem', fontSize: '1rem', borderRadius: 10, cursor: 'pointer' }}
                      required
                    >
                      <option value="" disabled>Select Name...</option>
                      {entryOptions.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn"
                  style={{
                    width: '100%', justifyContent: 'center', padding: '0.85rem', fontSize: '1.05rem', fontWeight: 600,
                    background: operationMode === 'add' ? 'var(--primary)' : '#EF4444',
                    color: '#FFF', border: 'none'
                  }}
                >
                  {submitting ? 'Updating...' : operationMode === 'add' ? <><Plus size={18} /> Inward Stock</> : <><Minus size={18} /> Deduct Stock</>}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Col: Stock Movement History (Both + & -) */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} className="text-dim" /> Stock Logs (+ & -)
            </h2>
            <button 
              onClick={() => navigate('/stock-manager/inward-history')}
              className="btn btn-secondary btn-sm" 
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
            >
              View Full Logs <ArrowRight size={14} />
            </button>
          </div>

          {/* Log Filter Pills */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', background: 'var(--bg3)', padding: '4px', borderRadius: 8 }}>
            <button
              onClick={() => setHistoryFilter('all')}
              style={{
                flex: 1, padding: '0.35rem 0.5rem', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer',
                background: historyFilter === 'all' ? 'var(--bg2)' : 'transparent',
                color: historyFilter === 'all' ? 'var(--primary)' : 'var(--text-dim)',
                boxShadow: historyFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              All Logs
            </button>
            <button
              onClick={() => setHistoryFilter('inward')}
              style={{
                flex: 1, padding: '0.35rem 0.5rem', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer',
                background: historyFilter === 'inward' ? 'rgba(16,185,129,0.15)' : 'transparent',
                color: historyFilter === 'inward' ? '#10B981' : 'var(--text-dim)'
              }}
            >
              + Inward
            </button>
            <button
              onClick={() => setHistoryFilter('deduction')}
              style={{
                flex: 1, padding: '0.35rem 0.5rem', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer',
                background: historyFilter === 'deduction' ? 'rgba(239,68,68,0.15)' : 'transparent',
                color: historyFilter === 'deduction' ? '#EF4444' : 'var(--text-dim)'
              }}
            >
              - Minus / Deductions
            </button>
          </div>
          
          {recentHistory.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1rem' }}>
              <div className="empty-icon"><History size={24} /></div>
              <div className="empty-text">No stock transaction logs found</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {recentHistory.map((log: any) => {
                const isPositive = log.totalChangePcs > 0;
                return (
                  <div key={log._id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.85rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border)'
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                      background: isPositive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                      color: isPositive ? '#10B981' : '#EF4444',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {isPositive ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.productName}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        SKU: {log.sku} • {new Date(log.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {log.reason && (
                        <div style={{ fontSize: '0.7rem', color: isPositive ? 'var(--text-muted)' : '#DC2626', fontWeight: 600 }}>
                          {log.reason}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ color: isPositive ? '#10B981' : '#EF4444', fontWeight: 800, fontSize: '0.95rem' }}>
                        {isPositive ? `+${log.totalChangePcs}` : `${log.totalChangePcs}`} pcs
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 600 }}>by {log.by || 'SYSTEM'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockInward;
