import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import StockManagerSidebar from './StockManagerSidebar';

const StockManagerLayout: React.FC = () => {
  const { user, token } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user || !token) return <Navigate to="/login" replace />;
  if (user.role !== 'stock_manager' && user.role !== 'admin') return <Navigate to="/unauthorized" replace />;

  return (
    <div className="app-layout">
      <StockManagerSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content no-header">
        <Outlet />
      </main>
    </div>
  );
};

export default StockManagerLayout;
