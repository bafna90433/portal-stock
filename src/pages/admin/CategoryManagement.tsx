import React, { useState, useEffect } from 'react';
import { Tags, Plus, Search, Edit2, Trash2, Check, X, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

interface Category {
  _id: string;
  name: string;
  description: string;
  isActive: boolean;
  productCount?: number;
}

const CategoryManagement: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState('');
  const [form, setForm] = useState({ name: '', description: '', isActive: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories/all');
      setCategories(res.data);
    } catch (err) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setForm({ name: '', description: '', isActive: true });
    setShowModal(true);
  };

  const openEditModal = (cat: Category) => {
    setIsEditing(true);
    setCurrentId(cat._id);
    setForm({ name: cat.name, description: cat.description || '', isActive: cat.isActive });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Category name is required');
    
    setSaving(true);
    try {
      if (isEditing) {
        await api.put(`/categories/${currentId}`, form);
        toast.success('Category updated successfully');
      } else {
        await api.post('/categories', form);
        toast.success('Category created successfully');
      }
      setShowModal(false);
      fetchCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this category? Products using this category will still exist.')) return;
    try {
      await api.delete(`/categories/${id}`);
      toast.success('Category deleted');
      fetchCategories();
    } catch (err) {
      toast.error('Failed to delete category');
    }
  };

  const handleToggleActive = async (cat: Category) => {
    const newStatus = !cat.isActive;
    const confirmMsg = newStatus 
      ? `Are you sure you want to enable the "${cat.name}" category? All products under this category will also be enabled.`
      : `Are you sure you want to disable the "${cat.name}" category? All products under this category will also be disabled.`;
    
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.put(`/categories/${cat._id}`, { isActive: newStatus });
      toast.success(`Category "${cat.name}" ${newStatus ? 'enabled' : 'disabled'} successfully`);
      fetchCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update category status');
    }
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Category Management</h1>
          <p className="page-subtitle">Manage product categories and classifications</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={16} /> Add Category
        </button>
      </div>

      <div className="card">
        <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <div className="search-bar" style={{ maxWidth: 300 }}>
            <Search className="search-icon" size={18} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search categories..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-page"><div className="spinner"></div><p>Loading categories...</p></div>
        ) : filteredCategories.length === 0 ? (
          <div className="empty-state">
            <Tags className="empty-icon" />
            <h3 className="empty-title">No categories found</h3>
            <p className="empty-text">Try adjusting your search or add a new category.</p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ marginTop: '1.5rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Category Name</th>
                  <th>Products</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map(cat => (
                  <tr key={cat._id} style={{ opacity: cat.isActive ? 1 : 0.6 }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(108,92,231,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                          <Tags size={16} />
                        </div>
                        <span style={{ fontWeight: 600 }}>{cat.name}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ 
                        fontWeight: 700, 
                        color: 'var(--text-muted)', 
                        background: 'var(--bg3)', 
                        padding: '4px 10px', 
                        borderRadius: 6,
                        fontSize: '0.85rem',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        {cat.productCount || 0}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {cat.isActive ? (
                          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Check size={12} /> Active</span>
                        ) : (
                          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><X size={12} /> Inactive</span>
                        )}
                        <div 
                          onClick={() => handleToggleActive(cat)}
                          title={cat.isActive ? `Disable "${cat.name}" & its products` : `Enable "${cat.name}" & its products`}
                          style={{
                            width: 36,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: cat.isActive ? 'var(--success)' : 'rgba(239, 68, 68, 0.3)',
                            position: 'relative',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s',
                            display: 'inline-block',
                          }}
                        >
                          <div 
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              backgroundColor: '#fff',
                              position: 'absolute',
                              top: 3,
                              left: cat.isActive ? 19 : 3,
                              transition: 'left 0.2s',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-icon" onClick={() => openEditModal(cat)} style={{ color: 'var(--primary-light)', marginRight: 8 }}>
                        <Edit2 size={16} />
                      </button>
                      <button className="btn btn-icon" onClick={() => handleDelete(cat._id)} style={{ color: 'var(--danger)' }}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{isEditing ? 'Edit Category' : 'New Category'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Category Name *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  required 
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Action Figures"
                />
              </div>
              {isEditing && (
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                  <input 
                    type="checkbox" 
                    id="isActive" 
                    checked={form.isActive}
                    onChange={e => setForm({ ...form, isActive: e.target.checked })}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label htmlFor="isActive" style={{ cursor: 'pointer', fontWeight: 600 }}>Active Category</label>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={16} />}
                  {isEditing ? 'Update Category' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default CategoryManagement;
