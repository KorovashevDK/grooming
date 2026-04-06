import {
  createHashRouter,
  createPanel,
  createRoot,
  createView,
  RoutesConfig,
} from '@vkontakte/vk-mini-apps-router';

export const DEFAULT_ROOT = 'default_root';

export const DEFAULT_VIEW = 'default_view';

export const DEFAULT_VIEW_PANELS = {
  HOME: 'home',
  LOGIN: 'login',
  ROLE_MENU: 'role-menu',
};

// Role-based panels
export const ADMIN_PANELS = {
  DASHBOARD: 'admin-dashboard',
  ORDERS: 'admin-orders',
  EMPLOYEES: 'admin-employees'
};

export const EMPLOYEE_PANELS = {
  DASHBOARD: 'employee-dashboard',
  ORDERS: 'employee-orders'
};

export const CLIENT_PANELS = {
  DASHBOARD: 'client-dashboard',
  ORDERS: 'client-orders',
  PROFILE: 'client-profile'
};

export const routes = RoutesConfig.create([
  createRoot(DEFAULT_ROOT, [
    createView(DEFAULT_VIEW, [
      createPanel(DEFAULT_VIEW_PANELS.LOGIN, '/login', []),
      createPanel(DEFAULT_VIEW_PANELS.HOME, '/', []),
      createPanel(DEFAULT_VIEW_PANELS.ROLE_MENU, '/role-menu', []),
      // Admin panels
      createPanel(ADMIN_PANELS.DASHBOARD, '/admin-dashboard', []),
      createPanel(ADMIN_PANELS.ORDERS, '/admin-orders', []),
      createPanel(ADMIN_PANELS.EMPLOYEES, '/admin-employees', []),
      // Employee panels
      createPanel(EMPLOYEE_PANELS.DASHBOARD, '/employee-dashboard', []),
      createPanel(EMPLOYEE_PANELS.ORDERS, '/employee-orders', []),
      // Client panels
      createPanel(CLIENT_PANELS.DASHBOARD, '/client-dashboard', []),
      createPanel(CLIENT_PANELS.ORDERS, '/client-orders', []),
      createPanel(CLIENT_PANELS.PROFILE, '/client-profile', []),
    ]),
  ]),
]);

export const router = createHashRouter(routes.getRoutes());
