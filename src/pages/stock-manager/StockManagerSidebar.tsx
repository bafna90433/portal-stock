import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Package, TrendingUp, Tags, LayoutDashboard, LogOut, Plus, ArrowLeft, Download, Image as ImageIcon } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { getPortalConfig } from '../../utils/portalConfig';

interface StockManagerSidebarProps {
  open?: boolean;
  onClose?: () => void;
}



const StockManagerSidebar: React.FC<StockManagerSidebarProps> = ({ open, onClose }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [alertCount, setAlertCount] = React.useState(0);
  const portal = getPortalConfig();
  const accentGradient = `linear-gradient(135deg, ${portal.gradientFrom}, ${portal.gradientTo})`;

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/dashboard/stats');
        setAlertCount(data.stats.pendingAlerts || 0);
      } catch {}
    };
    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const menuItems = [
    { to: '/stock-manager/dashboard', icon: <LayoutDashboard size={17} />, label: 'Dashboard' },
    { 
      to: '/stock-manager/stock', 
      icon: <TrendingUp size={17} />, 
      label: 'Stock Management',
      badge: alertCount > 0 ? alertCount : null
    },
    { to: '/stock-manager/inward', icon: <Download size={17} />, label: 'Stock Inward' },
    { to: '/stock-manager/categories', icon: <Tags size={17} />, label: 'Categories' },
    { to: '/stock-manager/history', icon: <Package size={17} />, label: 'Stock History' },
    { to: '/stock-manager/add-product', icon: <Plus size={17} />, label: 'Add Product' },
  ];

  return (
    <>
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 199 }}
          onClick={onClose}
        />
      )}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        {/* Portal accent top bar */}
        <div style={{ height: 3, background: accentGradient, flexShrink: 0 }} />
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon" style={{ overflow: 'hidden', background: 'white', boxShadow: `0 8px 24px -6px ${portal.accentColor}60` }}>
            <img
              src="https://ik.imagekit.io/rishii/bafnatoys/Copy%20of%20Super_Car___05_vrkphh.webp?updatedAt=1775309336739"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              alt="Logo"
            />
          </div>
          <div>
            <div className="sidebar-logo-text">Stock<span>Pro</span></div>
            <div style={{ fontSize: '0.62rem', color: portal.accentColor, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '1px', opacity: 0.9 }}>
              Inventory Portal
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-title">Inventory Control</div>
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={onClose}
            >
              <span className="nav-icon">{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span className="sidebar-badge blinking">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-card">
            <div className="user-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{user?.role === 'admin' ? 'Administrator' : 'Stock Manager'}</div>
            </div>
          </div>
          {user?.role === 'admin' && (
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center', gap: '0.5rem', fontSize: '0.82rem', marginBottom: '0.5rem', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#A5B4FC' }}
            >
              <ArrowLeft size={15} /> Back to Admin
            </button>
          )}
          <button
            onClick={handleLogout}
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center', gap: '0.5rem', fontSize: '0.82rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--sidebar-text)' }}
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </aside>

      <style>{`
        .sidebar-badge {
          background: #ef4444;
          color: white;
          font-size: 0.65rem;
          font-weight: 800;
          padding: 0.15rem 0.45rem;
          border-radius: 20px;
          min-width: 18px;
          text-align: center;
        }
        .blinking {
          animation: blink-animation 1s steps(5, start) infinite;
          -webkit-animation: blink-animation 1s steps(5, start) infinite;
        }
        @keyframes blink-animation {
          to { opacity: 0.5; }
        }
      `}</style>
    </>
  );
};

export default StockManagerSidebar;
