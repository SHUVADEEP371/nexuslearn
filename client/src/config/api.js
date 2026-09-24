import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
let accessToken = null;
let refreshPromise = null;

export const setAccessToken = (token) => { accessToken = token || null; };
export const getAccessToken = () => accessToken;
export function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true })
      .then((response) => response.data.token)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use((response) => response, async (error) => {
  const original = error.config;
  const url = original?.url || '';
  const isAuthFlow = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/me'].some((path) => url.endsWith(path));
  const isAdminPage = window.location.pathname.startsWith('/admin');
  if (error.response?.status !== 401 || !original || original._retried || isAuthFlow) {
    return Promise.reject(error);
  }

  original._retried = true;
  try {
    accessToken = await refreshAccessToken();
    original.headers = original.headers || {};
    original.headers.Authorization = `Bearer ${accessToken}`;
    return api(original);
  } catch (refreshError) {
    accessToken = null;
    if (!['/login', '/register', '/admin/login'].includes(window.location.pathname)) window.location.href = isAdminPage ? '/admin/login' : '/login';
    return Promise.reject(refreshError);
  }
});

export default api;
