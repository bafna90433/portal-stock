export type PortalType = 'admin' | 'staff' | 'dispatch' | 'billing' | 'stock' | 'all';

export interface PortalConfig {
  type: PortalType;
  label: string;
  subtitle: string;
  role: string | null;
  defaultRedirect: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
}

const CONFIG: PortalConfig = {
  type: 'stock',
  label: 'Stock Portal',
  subtitle: 'Inventory Management',
  role: 'stock_manager',
  defaultRedirect: '/stock-manager/dashboard',
  accentColor: '#10B981',
  gradientFrom: '#10B981',
  gradientTo: '#3B82F6',
};

export function getPortalConfig(): PortalConfig {
  return CONFIG;
}

export function isRoleAllowedOnPortal(userRole: string, config: PortalConfig): boolean {
  if (userRole === 'admin') return true;
  return userRole === 'stock_manager';
}

export function getLoginRedirect(userRole: string, config: PortalConfig): string {
  return '/stock-manager/dashboard';
}
