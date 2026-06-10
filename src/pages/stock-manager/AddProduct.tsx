import React, { useState, useRef, useEffect } from 'react';
import { Package, X, Save, Loader, ImageIcon, CheckCircle, Plus, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import { useParams, useNavigate } from 'react-router-dom';

const AddProduct: React.FC = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [success, setSuccess] = useState(false);
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [currentStock, setCurrentStock] = useState<number | null>(null);

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  useEffect(() => {
    api.get('/categories').then(res => {
      setCategories(res.data);
      if (!isEdit && res.data.length > 0) setForm(f => ({ ...f, category: res.data[0].name }));
    }).catch(console.error);
  }, []);

  // Load product data in edit mode
  useEffect(() => {
    if (!isEdit) return;
    api.get(`/products/${id}`).then(res => {
      const p = res.data;
      setForm({
        name: p.name || '',
        sku: p.sku || '',
        unit: p.unit || 'pcs',
        wholesalerPrice: p.wholesalerPrice ? String(p.wholesalerPrice) : '',
        wholesalerMrp: p.wholesalerMrp ? String(p.wholesalerMrp) : '',
        retailerPrice: '0',
        retailerMrp: '0',
        category: p.category || '',
        description: p.description || '',
        initialQty: '0',
        pcsPerInner: String(p.pcsPerInner ?? 0),
        innerPerCarton: String(p.innerPerCarton ?? 0),
      });
      if (p.bulkPricingTiers?.length) {
        setBulkTiers(p.bulkPricingTiers.map((t: any) => ({ minQty: String(t.minQty), unit: t.unit || 'inner', price: String(t.price) })));
      }
      if (p.imageUrl) setPreview(p.imageUrl);
      if (p.stock?.availableQty !== undefined) {
        const qty = p.stock.availableQty;
        setCurrentStock(qty);
        const c = p.stock.stockCartons ?? 0;
        const inn = p.stock.stockInners ?? 0;
        const l = p.stock.stockLoose ?? 0;
        if (qty > 0 && c === 0 && inn === 0 && l === 0) {
          // old record — compute greedy breakdown
          const ppc = Number(p.innerPerCarton ?? 0);
          const ppi = Number(p.pcsPerInner ?? 0);
          const cartons = ppc > 1 ? Math.floor(qty / ppc) : 0;
          const rem = ppc > 1 ? qty % ppc : qty;
          const inners = ppi > 1 ? Math.floor(rem / ppi) : 0;
          const loose = ppi > 1 ? rem % ppi : rem;
          setStockCartons(cartons);
          setStockInners(inners);
          setStockLoose(loose);
        } else {
          setStockCartons(c);
          setStockInners(inn);
          setStockLoose(l);
        }
      }
    }).catch(() => toast.error('Failed to load product'));
  }, [id]);

  const [form, setForm] = useState({
    name: '',
    sku: '',
    unit: 'pcs',
    wholesalerPrice: '',
    wholesalerMrp: '',
    retailerPrice: '0',
    retailerMrp: '0',
    category: '',
    description: '',
    initialQty: '0',
    pcsPerInner: '0',
    innerPerCarton: '0',
  });
  const [bulkTiers, setBulkTiers] = useState<{ minQty: string; unit: 'pcs' | 'inner' | 'carton'; price: string }[]>([]);
  const [stockCartons, setStockCartons] = useState(0);
  const [stockInners, setStockInners] = useState(0);
  const [stockLoose, setStockLoose] = useState(0);

  useEffect(() => {
    const ppc = Number(form.innerPerCarton) || 0;
    const ppi = Number(form.pcsPerInner) || 0;
    const total = (stockCartons * (ppc > 1 ? ppc : 0)) + (stockInners * (ppi > 1 ? ppi : 0)) + stockLoose;
    setForm(f => ({ ...f, initialQty: String(total) }));
  }, [stockCartons, stockInners, stockLoose, form.innerPerCarton, form.pcsPerInner]);

  const handleFileChange = (f: File) => {
    if (f.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileChange(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.sku) return toast.error('Product name and SKU are required');
    if (!form.wholesalerPrice || Number(form.wholesalerPrice) <= 0) return toast.error('Wholesaler Price is required');
    if (!form.wholesalerMrp || Number(form.wholesalerMrp) <= 0) return toast.error('Wholesaler MRP is required');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('sku', form.sku);
      fd.append('unit', form.unit);
      fd.append('category', form.category);
      fd.append('description', form.description);
      if (!isEdit) fd.append('initialQty', form.initialQty);
      fd.append('pcsPerInner', form.pcsPerInner || '0');
      fd.append('innerPerCarton', form.innerPerCarton || '0');
      fd.append('gstRate', '0');
      fd.append('wholesalerPrice', form.wholesalerPrice || '0');
      fd.append('wholesalerMrp', form.wholesalerMrp || '0');
      const validTiers = bulkTiers.filter(t => t.minQty && t.price).map(t => ({ minQty: Number(t.minQty), unit: t.unit, price: Number(t.price) }));
      fd.append('bulkPricingTiers', JSON.stringify(validTiers));
      fd.append('retailerPrice', form.wholesalerPrice || '0');
      fd.append('retailerMrp', form.wholesalerMrp || '0');
      fd.append('pricePerUnit', form.wholesalerPrice || '0');
      if (file) fd.append('image', file);

      if (isEdit) {
        await api.put(`/products/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        const ppc = Number(form.innerPerCarton) || 0;
        const ppi = Number(form.pcsPerInner) || 0;
        const newQty = (stockCartons * (ppc > 1 ? ppc : 0)) + (stockInners * (ppi > 1 ? ppi : 0)) + stockLoose;
        await api.patch(`/products/${id}/stock`, {
          qty: newQty,
          operation: 'set',
          cartons: stockCartons,
          inners: stockInners,
          loose: stockLoose,
        });
        setCurrentStock(newQty);
        toast.success('Product updated successfully!');
        setSuccess(true);
        setTimeout(() => navigate('/stock-manager/products'), 1500);
      } else {
        await api.post('/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setSuccess(true);
        toast.success('Product added successfully!');
        setTimeout(() => {
          setSuccess(false);
          setForm({ name: '', sku: '', unit: 'pcs', wholesalerPrice: '', wholesalerMrp: '', retailerPrice: '0', retailerMrp: '0', category: categories[0]?.name || '', description: '', initialQty: '0', pcsPerInner: '0', innerPerCarton: '0' });
          setBulkTiers([]);
          setStockCartons(0); setStockInners(0); setStockLoose(0);
          setPreview(null);
          setFile(null);
        }, 2000);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || (isEdit ? 'Failed to update product' : 'Failed to add product'));
    } finally { setLoading(false); }
  };

  if (success) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
        <div style={{ textAlign: 'center' }}>
          <CheckCircle size={80} color="var(--success)" strokeWidth={1.5} />
          <h2 style={{ color: 'var(--success)', marginBottom: '0.5rem', marginTop: '1rem' }}>
            {isEdit ? 'Product Updated!' : 'Product Added!'}
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>
            {isEdit ? 'Changes saved successfully' : 'Product saved to database successfully'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEdit ? 'Edit Product' : 'Add Product'}</h1>
          <p className="page-subtitle">
            {isEdit ? 'Update product details and pricing' : 'Add new product with stock details and pricing'}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/stock-manager/products')}>
          <ArrowLeft size={16} /> Back to Products
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem' }}>
          <div>
            {/* Product Details */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-header">
                <h3 className="card-title">Product Details</h3>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Honda Clutch Wire" required />
                </div>
                <div className="form-group">
                  <label className="form-label">SKU *</label>
                  <input
                    className="form-control"
                    value={form.sku}
                    onChange={e => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                    placeholder="e.g. HCW-001"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select className="form-control" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} required>
                  <option value="" disabled>Select Category</option>
                  {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              {/* Packaging Hierarchy */}
              <div style={{ padding: '0.85rem 1rem', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.65rem' }}>📦 Packaging Hierarchy (Carton / Inner / Pcs)</div>
                <div className="form-grid">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Pcs Per Inner <span style={{ fontWeight: 400, color: 'var(--text-dim)', fontSize: '0.72rem' }}>(0 = no inner)</span></label>
                    <input
                      className="form-control"
                      type="number" min="0"
                      value={form.pcsPerInner}
                      onChange={e => setForm({ ...form, pcsPerInner: e.target.value })}
                      placeholder="0 if no inner"
                    />
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 3 }}>1 Inner = ? Pcs</p>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Pcs Per Carton <span style={{ fontWeight: 400, color: 'var(--text-dim)', fontSize: '0.72rem' }}>(0 = no carton)</span></label>
                    <input
                      className="form-control"
                      type="number" min="0"
                      value={form.innerPerCarton}
                      onChange={e => setForm({ ...form, innerPerCarton: e.target.value })}
                      placeholder="0 if no carton"
                    />
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 3 }}>1 Carton = ? Pcs</p>
                  </div>
                </div>
                {(Number(form.pcsPerInner) > 1 || Number(form.innerPerCarton) > 1) && (
                  <div style={{ marginTop: '0.6rem', display: 'flex', gap: '1.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)' }}>
                    <span>✓ 1 Carton = {form.innerPerCarton} pcs</span>
                    <span>✓ 1 Inner = {form.pcsPerInner} pcs</span>
                  </div>
                )}
              </div>
              {(() => {
                const ppc = Number(form.innerPerCarton) || 0;
                const ppi = Number(form.pcsPerInner) || 0;
                const hasCarton = ppc > 1;
                const hasInner = ppi > 1;
                const total = (stockCartons * (hasCarton ? ppc : 0)) + (stockInners * (hasInner ? ppi : 0)) + stockLoose;
                const boxInput: React.CSSProperties = { width: '100%', background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.85rem', fontSize: '1rem', fontWeight: 700, color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-mono)', textAlign: 'center', boxSizing: 'border-box' };
                return (
                  <div>
                    <label className="form-label">{isEdit ? 'Stock Quantity' : 'Initial Stock Qty'}</label>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {hasCarton && (
                        <div style={{ flex: 1, minWidth: 90 }}>
                          <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 12, padding: '0.75rem' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>📦 Carton</div>
                            <input type="number" min="0" style={boxInput} placeholder="0"
                              value={stockCartons || ''}
                              onChange={e => setStockCartons(Math.max(0, Number(e.target.value) || 0))}
                            />
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '0.3rem', textAlign: 'center' }}>1 Carton = {ppc} Pcs</div>
                          </div>
                        </div>
                      )}
                      {hasInner && (
                        <div style={{ flex: 1, minWidth: 90 }}>
                          <div style={{ background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.18)', borderRadius: 12, padding: '0.75rem' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#06B6D4', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>🗂 Inner</div>
                            <input type="number" min="0" style={boxInput} placeholder="0"
                              value={stockInners || ''}
                              onChange={e => setStockInners(Math.max(0, Number(e.target.value) || 0))}
                            />
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '0.3rem', textAlign: 'center' }}>1 Inner = {ppi} Pcs</div>
                          </div>
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 90 }}>
                        <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: 12, padding: '0.75rem' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>🔩 Loose Pcs</div>
                          <input type="number" min="0" style={boxInput} placeholder="0"
                            value={stockLoose || ''}
                            onChange={e => setStockLoose(Math.max(0, Number(e.target.value) || 0))}
                          />
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '0.3rem', textAlign: 'center' }}>Individual pieces</div>
                        </div>
                      </div>
                    </div>
                    {total > 0 && (
                      <div style={{ marginTop: '0.6rem', padding: '0.6rem 1rem', background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(6,182,212,0.06))', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {[hasCarton && stockCartons > 0 && `${stockCartons} × ${ppc}`, hasInner && stockInners > 0 && `${stockInners} × ${ppi}`, stockLoose > 0 && `${stockLoose}`].filter(Boolean).join(' + ')}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total</span>
                          <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10B981', fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}>{total.toLocaleString()}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Pcs</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Pricing Card — open to all */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-header">
                <h3 className="card-title">Pricing</h3>
              </div>

              {/* Pricing details row */}
              <div style={{ padding: '0.75rem 0.85rem', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10, marginBottom: '0.85rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                  💰 Price Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Selling Price (₹) *</label>
                    <input
                      className="form-control"
                      type="number" min="0.01" step="0.01"
                      value={form.wholesalerPrice}
                      onChange={e => setForm({ ...form, wholesalerPrice: e.target.value })}
                      placeholder="0.00"
                      required
                      style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
                    />
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: 3 }}>Selling price</p>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">MRP (₹) *</label>
                    <input
                      className="form-control"
                      type="number" min="0.01" step="0.01"
                      value={form.wholesalerMrp}
                      onChange={e => setForm({ ...form, wholesalerMrp: e.target.value })}
                      placeholder="0.00"
                      required
                      style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
                    />
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: 3 }}>Max retail price</p>
                  </div>
                </div>
              </div>

              {/* Bulk Pricing Tiers */}
              <div style={{ padding: '0.75rem 0.85rem', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    📦 Bulk Pricing <span style={{ fontWeight: 500, textTransform: 'none', fontSize: '0.68rem', color: 'var(--text-dim)' }}>(Optional — max 3 tiers)</span>
                  </div>
                  {bulkTiers.length < 3 && (
                    <button type="button" onClick={() => setBulkTiers([...bulkTiers, { minQty: '', unit: 'inner', price: '' }])}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 700, color: '#D97706', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                      <Plus size={12} /> Add Tier
                    </button>
                  )}
                </div>
                {bulkTiers.length === 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', padding: '0.4rem 0' }}>
                    Click "Add Tier" to set bulk discount pricing
                  </div>
                )}
                {bulkTiers.map((tier, i) => {
                  const ppi = Number(form.pcsPerInner) || 1;
                  const ppc = Number(form.innerPerCarton) || 1;
                  const totalPcs = tier.minQty
                    ? tier.unit === 'inner' ? Number(tier.minQty) * ppi
                    : tier.unit === 'carton' ? Number(tier.minQty) * ppc
                    : Number(tier.minQty)
                    : 0;
                  return (
                    <div key={i} style={{ marginBottom: i < bulkTiers.length - 1 ? '0.6rem' : 0 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 1fr auto', gap: '0.6rem', alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Min Qty (Tier {i + 1})</label>
                          <input className="form-control" type="number" min="1" placeholder="e.g. 10"
                            value={tier.minQty}
                            onChange={e => { const t = [...bulkTiers]; t[i].minQty = e.target.value; setBulkTiers(t); }}
                            style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Unit</label>
                          <select className="form-control"
                            value={tier.unit}
                            onChange={e => { const t = [...bulkTiers]; t[i].unit = e.target.value as any; setBulkTiers(t); }}
                            style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                            <option value="inner">Inner</option>
                            <option value="carton">Carton</option>
                            <option value="pcs">Pcs</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Bulk Price (₹)</label>
                          <input className="form-control" type="number" min="0" step="0.01" placeholder="0.00"
                            value={tier.price}
                            onChange={e => { const t = [...bulkTiers]; t[i].price = e.target.value; setBulkTiers(t); }}
                            style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }} />
                        </div>
                        <button type="button" onClick={() => setBulkTiers(bulkTiers.filter((_, j) => j !== i))}
                          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '0.5rem 0.6rem', cursor: 'pointer', color: 'var(--danger)', height: 38, display: 'flex', alignItems: 'center' }}>
                          <X size={14} />
                        </button>
                      </div>
                      {tier.minQty && totalPcs > 0 && (
                        <div style={{ fontSize: '0.7rem', color: '#D97706', fontWeight: 600, marginTop: 4, paddingLeft: 2 }}>
                          ✓ {tier.minQty} {tier.unit}{Number(tier.minQty) > 1 ? 's' : ''} = {totalPcs.toLocaleString()} Pcs
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Retailer pricing removed */}
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: '1.5rem' }}>
              {loading ? <><Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> {isEdit ? 'Saving...' : 'Uploading...'}</> : <><Save size={18} /> {isEdit ? 'Save Changes' : 'Save Product'}</>}
            </button>
          </div>

          {/* Image Upload */}
          <div>
            <div className="card" style={{ position: 'sticky', top: '1rem' }}>
              <div className="card-header">
                <h3 className="card-title"><ImageIcon size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />Product Image <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-dim)', marginLeft: 4 }}>(Optional)</span></h3>
              </div>
              <div
                className={`image-upload-zone ${dragOver ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFileChange(e.target.files[0])} />
                {preview ? (
                  <div style={{ position: 'relative' }}>
                    <img src={preview} className="upload-preview" alt="Preview" />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setPreview(null); setFile(null); }}
                      style={{ position: 'absolute', top: 8, right: 8, background: 'var(--danger)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="upload-icon">📷</div>
                    <p style={{ fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text)' }}>Drop image here</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>or click to browse • Max 10MB</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AddProduct;
