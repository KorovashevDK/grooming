import { apiRequest } from './client';

export const authApi = {
  discover: (payload) =>
    apiRequest('/auth/discover', {
      method: 'POST',
      auth: false,
      body: payload,
    }),
  login: (payload) =>
    apiRequest('/auth', {
      method: 'POST',
      auth: false,
      body: payload,
    }),
  me: () => apiRequest('/auth/me'),
  getRoles: () => apiRequest('/auth/roles'),
  switchRole: (role) =>
    apiRequest('/auth/switch-role', {
      method: 'POST',
      body: { role },
    }),
};

export const adminApi = {
  getDashboard: () => apiRequest('/admin/dashboard'),
  getDashboardStats: () => apiRequest('/admin/dashboard'),
  createSchedule: (payload) =>
    apiRequest('/admin/schedule', {
      method: 'POST',
      body: payload,
    }),
  updateSchedule: (scheduleId, payload) =>
    apiRequest(`/admin/schedule/${scheduleId}`, {
      method: 'PATCH',
      body: payload,
    }),
  deleteSchedule: (scheduleId) =>
    apiRequest(`/admin/schedule/${scheduleId}`, {
      method: 'DELETE',
    }),
};

export const employeeApi = {
  getDashboard: () => apiRequest('/employees/dashboard'),
  updateOrderStatus: (orderId, payload) =>
    apiRequest(`/employees/order/${orderId}/status`, {
      method: 'PATCH',
      body: payload,
    }),
  getSchedule: () => apiRequest('/employees/schedule'),
  createSchedule: (payload) =>
    apiRequest('/employees/schedule', {
      method: 'POST',
      body: payload,
    }),
  updateSchedule: (scheduleId, payload) =>
    apiRequest(`/employees/schedule/${scheduleId}`, {
      method: 'PATCH',
      body: payload,
    }),
  deleteSchedule: (scheduleId) =>
    apiRequest(`/employees/schedule/${scheduleId}`, {
      method: 'DELETE',
    }),
};

export const clientApi = {
  getProfile: () => apiRequest('/clients/profile'),
  getOrders: () => apiRequest('/clients/orders'),
  createOrder: (payload) =>
    apiRequest('/clients/orders', {
      method: 'POST',
      body: payload,
    }),
  getAvailability: (payload) =>
    apiRequest('/clients/availability', {
      method: 'POST',
      body: payload,
    }),
  deleteOrder: (orderId) =>
    apiRequest(`/clients/orders/${orderId}`, {
      method: 'DELETE',
    }),
};

export const petsApi = {
  getMyPets: () => apiRequest('/pets/my'),
  createPet: (payload) =>
    apiRequest('/pets', {
      method: 'POST',
      body: payload,
    }),
  updatePet: (petId, payload) =>
    apiRequest(`/pets/${petId}`, {
      method: 'PUT',
      body: payload,
    }),
  deletePet: (petId) =>
    apiRequest(`/pets/${petId}`, {
      method: 'DELETE',
    }),
};

export const servicesApi = {
  getAll: () => apiRequest('/services'),
};

export const employeesApi = {
  getAllForAssignment: () => apiRequest('/employees/list'),
};
