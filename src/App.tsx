import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import PortalThemeInjector from './components/PortalThemeInjector';

// Base Pages
import Login from './pages/Login';
import { useAuthStore } from './store/authStore';

// Stock Manager Portal
import StockManagerLayout from './pages/stock-manager/StockManagerLayout';
import StockManagerDashboard from './pages/stock-manager/StockManagerDashboard';
import CategoryManagement from './pages/admin/CategoryManagement';
import StockManagement from './pages/admin/StockManagement';
import AddProduct from './pages/stock-manager/AddProduct';
import StockHistory from './pages/stock-manager/StockHistory';
import StockInward from './pages/stock-manager/StockInward';
import InwardHistory from './pages/stock-manager/InwardHistory';

const RoleRedirect: React.FC = () => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'stock_manager' || user.role === 'admin') {
    return <Navigate to="/stock-manager/dashboard" replace />;
  }
  return <Navigate to="/unauthorized" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <PortalThemeInjector />
      <Toaster position="top-right" toastOptions={{
        style: { background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)' },
        success: { iconTheme: { primary: 'var(--success)', secondary: 'white' } },
        error: { iconTheme: { primary: 'var(--danger)', secondary: 'white' } },
      }} />
      <Routes>
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={
          <div className="empty-state" style={{ minHeight: '100vh' }}>
            <div className="empty-icon">🚫</div>
            <div className="empty-title">Access Denied</div>
            <div className="empty-text">You don't have permission to view this portal</div>
            <button onClick={() => window.location.href = '/'} className="btn btn-primary" style={{ marginTop: '1rem' }}>Return to Portal</button>
          </div>
        } />

        {/* Stock Manager Portal */}
        <Route path="/stock-manager" element={<StockManagerLayout />}>
          <Route path="" element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<StockManagerDashboard />} />
          <Route path="categories" element={<CategoryManagement />} />
          <Route path="stock" element={<StockManagement />} />
          <Route path="add-product" element={<AddProduct />} />
          <Route path="edit-product/:id" element={<AddProduct />} />
          <Route path="history" element={<StockHistory />} />
          <Route path="inward" element={<StockInward />} />
          <Route path="inward-history" element={<InwardHistory />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
