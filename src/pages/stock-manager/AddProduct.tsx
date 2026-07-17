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
  const [freeStock, setFreeStock] = useState(0);

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
      // Stock Management list and Edit Product must show the same authoritative
      // free/current quantity. Reservations belong to orders and must not be
      // added back into the editable Current Stock figure.
      const targetStock = p.stock;
      const freeQty = p.stock?.availableQty || 0;
      setFreeStock(freeQty);

      if (targetStock?.availableQty !== undefined) {
        const qty = targetStock.availableQty;
        setCurrentStock(qty);
        const c = targetStock.stockCartons ?? 0;
        const inn = targetStock.stockInners ?? 0;
        const l = targetStock.stockLoose ?? 0;
        if (qty > 0 && c === 0 && inn === 0 && l === 0) {
          // old record — compute greedy breakdown
          const ppc = Number(p.innerPerCarton ?? 0);
          const ppi = Number(p.pcsPerInner ?? 0);
          const pcsPerCarton = ppi > 0 ? (ppc * ppi) : ppc;
          const cartons = pcsPerCarton > 0 ? Math.floor(qty / pcsPerCarton) : 0;
          const rem = pcsPerCarton > 0 ? qty % pcsPerCarton : qty;
          const inners = ppi > 0 ? Math.floor(rem / ppi) : 0;
          const loose = ppi > 0 ? rem % ppi : rem;
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
  const [inwardQty, setInwardQty] = useState('');
  const [stockOp, setStockOp] = useState<'add' | 'remove'>('add');

  useEffect(() => {
    const ppc = Number(form.innerPerCarton) || 0;
    const ppi = Number(form.pcsPerInner) || 0;
    const pcsPerCarton = ppi > 0 ? (ppc * ppi) : ppc;
    const total = (stockCartons * pcsPerCarton) + (stockInners * ppi) + stockLoose;
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
      // New products default to 5% GST; on edit, omit so the stored rate is preserved
      if (!isEdit) fd.append('gstRate', '5');
      fd.append('wholesalerPrice', form.wholesalerPrice || '0');
      fd.append('wholesalerMrp', form.wholesalerMrp || '0');
      const validTiers = bulkTiers.filter(t => t.minQty && t.price).map(t => ({ minQty: Number(t.minQty), unit: t.unit, price: Number(t.price) }));
      fd.append('bulkPricingTiers', JSON.stringify(validTiers));
      fd.append('retailerPrice', form.wholesalerPrice || '0');
      fd.append('retailerMrp', form.wholesalerMrp || '0');
      fd.append('pricePerUnit', form.wholesalerPrice || '0');
      if (file) fd.append('image', file);

      if (isEdit) {
        const totalPcsAdded = Number(inwardQty) || 0;
        if (totalPcsAdded > 0 && stockOp === 'remove' && totalPcsAdded > freeStock) {
          toast.error(`Only ${freeStock} free Pcs can be removed. Reserved stock must be released from its order first.`);
          setLoading(false);
          return;
        }

        await api.put(`/products/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (totalPcsAdded > 0) {
          const newLoose = stockOp === 'add'
            ? (Number(currentStock) || 0) + totalPcsAdded
            : Math.max(0, (Number(currentStock) || 0) - totalPcsAdded);

          await api.patch(`/products/${id}/stock`, {
            qty: totalPcsAdded,
            operation: stockOp,
            cartons: 0,
            inners: 0,
            loose: newLoose,
          });
          setCurrentStock(newLoose);
          setFreeStock(stockOp === 'add' ? freeStock + totalPcsAdded : freeStock - totalPcsAdded);
        }
        toast.success('Product updated successfully!');
        setSuccess(true);
        setTimeout(() => navigate('/admin/stock'), 1500);
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
        <button className="btn btn-secondary" onClick={() => navigate('/admin/stock')}>
          <ArrowLeft size={16} /> Back to Products
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          {/* Left Column: Product Info & Pricing & Image */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Product Details */}
            <div className="card">
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
            </div>

            {/* Pricing Card */}
            <div className="card">
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
              <div style={{ padding: '0.75rem 0.85rem', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10 }}>
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
            </div>

            {/* Product Image */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <ImageIcon size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                  Product Image <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-dim)', marginLeft: 4 }}>(Optional)</span>
                </h3>
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

          {/* Right Column: Stock Details & Save Button */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '1rem' }}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Stock & Inventory Details</h3>
              </div>

              {/* Packaging Hierarchy */}
              <div style={{ padding: '0.85rem 1rem', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem' }}>
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

              {/* Stock Quantity */}
              {(() => {
                const total = Number(currentStock) || 0;

                const changePcs = Number(inwardQty) || 0;
                const newTotal = stockOp === 'add' ? total + changePcs : Math.max(0, total - changePcs);

                const boxInput: React.CSSProperties = { width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.85rem', fontSize: '1rem', fontWeight: 700, color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-mono)', textAlign: 'center', boxSizing: 'border-box' };
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                      <label className="form-label">{isEdit ? 'Stock Adjustment Operation' : 'Initial Stock Qty (in Pcs)'}</label>
                      {isEdit && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <button
                            type="button"
                            onClick={() => setStockOp('add')}
                            style={{
                              flex: 1,
                              padding: '0.5rem',
                              borderRadius: 8,
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              border: stockOp === 'add' ? '2px solid var(--success)' : '1px solid var(--border)',
                              background: stockOp === 'add' ? 'rgba(16,185,129,0.1)' : 'var(--bg3)',
                              color: stockOp === 'add' ? '#059669' : 'var(--text-muted)',
                              cursor: 'pointer'
                            }}
                          >
                            ➕ Add Stock (Inward)
                          </button>
                          <button
                            type="button"
                            onClick={() => setStockOp('remove')}
                            style={{
                              flex: 1,
                              padding: '0.5rem',
                              borderRadius: 8,
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              border: stockOp === 'remove' ? '2px solid var(--danger)' : '1px solid var(--border)',
                              background: stockOp === 'remove' ? 'rgba(239,68,68,0.1)' : 'var(--bg3)',
                              color: stockOp === 'remove' ? 'var(--danger)' : 'var(--text-muted)',
                              cursor: 'pointer'
                            }}
                          >
                            ➖ Remove Stock (Outward)
                          </button>
                        </div>
                      )}
                      
                      <div style={{ background: stockOp === 'add' ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)', border: stockOp === 'add' ? '1px solid rgba(16,185,129,0.18)' : '1px solid rgba(239,68,68,0.18)', borderRadius: 12, padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: stockOp === 'add' ? '#10B981' : 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                          {isEdit ? (stockOp === 'add' ? '🔩 Quantity to Add (Pcs)' : '🔩 Quantity to Remove (Pcs)') : '🔩 Total Pieces (Pcs)'}
                        </div>
                        {isEdit ? (
                          <input type="number" min="0" style={boxInput} placeholder={stockOp === 'add' ? "Enter quantity to add..." : "Enter quantity to remove..."}
                            value={inwardQty}
                            onChange={e => setInwardQty(e.target.value)}
                          />
                        ) : (
                          <input type="number" min="0" style={boxInput} placeholder="0"
                            value={stockLoose || ''}
                            onChange={e => setStockLoose(Math.max(0, Number(e.target.value) || 0))}
                          />
                        )}
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '0.3rem', textAlign: 'center' }}>
                          {isEdit ? (stockOp === 'add' ? 'Enter quantity to ADD to current stock' : 'Enter quantity to REMOVE from current stock') : 'Individual pieces'}
                        </div>
                      </div>
                    </div>

                    {isEdit && (
                      <div style={{ padding: '0.75rem 1rem', background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(6,182,212,0.06))', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text)', fontWeight: 700 }}>Current Stock:</span>
                          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: total > 0 ? 'var(--primary)' : 'var(--danger)', fontFamily: 'var(--font-mono)' }}>{total.toLocaleString()} Pcs</span>
                        </div>
                        {changePcs > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-soft)', paddingTop: 6, marginTop: 2 }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text)', fontWeight: 700 }}>
                              {stockOp === 'add' ? 'New Current Stock:' : 'New Current Stock (after removal):'}
                            </span>
                            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: newTotal > 0 ? 'var(--primary)' : 'var(--danger)', fontFamily: 'var(--font-mono)' }}>{newTotal.toLocaleString()} Pcs</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Save Button */}
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? <><Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> {isEdit ? 'Saving...' : 'Uploading...'}</> : <><Save size={18} /> {isEdit ? 'Save Changes' : 'Save Product'}</>}
            </button>
          </div>
        </div>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AddProduct;
