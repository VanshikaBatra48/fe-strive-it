import axios from 'axios';

// Determine API Base URL dynamically with support for env variables and Wi-Fi hostnames
export const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:3000/api`;
    }
  }
  return 'http://localhost:3000/api';
};

// Create centralized Axios instance
const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor: attach JWT Bearer token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle errors & token expiration
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response ? error.response.status : null;
    const responseData = error.response ? error.response.data : null;

    // Handle 401 Unauthorized (e.g. token expired, invalid token)
    if (status === 401) {
      const isLoginRequest = error.config && error.config.url && error.config.url.includes('/login');
      if (!isLoginRequest) {
        // Clear local storage authentication state
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        // Dispatch custom event for auth context to react
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));

        // If not already on login page, redirect to login
        if (window.location.pathname !== '/') {
          window.location.href = '/';
        }
      }
    }

    // Handle 403 First Login Required
    if (status === 403 && responseData?.code === 'FIRST_LOGIN_PASSWORD_CHANGE_REQUIRED') {
      window.dispatchEvent(
        new CustomEvent('auth:first-login-required', { detail: responseData })
      );
    }

    return Promise.reject(error);
  }
);

export default apiClient;
