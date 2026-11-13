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
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

let refreshPromise = null;

function clearAuthAndRedirect() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');

  // Dispatch custom event for auth context to react
  window.dispatchEvent(new CustomEvent('auth:unauthorized'));

  // If not already on login page, redirect to login
  if (window.location.pathname !== '/') {
    window.location.href = '/';
  }
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${getApiBaseUrl()}/users/refresh`,
        {},
        {
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      )
      .then((res) => {
        const newToken = res.data?.accessToken || res.data?.token;
        if (!newToken) {
          throw new Error('Refresh response did not include an access token.');
        }

        localStorage.setItem('token', newToken);
        if (res.data?.user) {
          localStorage.setItem('user', JSON.stringify(res.data.user));
        }

        window.dispatchEvent(
          new CustomEvent('auth:token-refreshed', {
            detail: {
              token: newToken,
              user: res.data?.user || null,
            },
          })
        );

        return newToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

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

// Response interceptor: handle errors, silent token refresh, & first-login checks
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response ? error.response.status : null;
    const responseData = error.response ? error.response.data : null;
    const originalRequest = error.config;

    // Handle 401 Unauthorized (attempt silent refresh once before logging out)
    if (status === 401 && originalRequest) {
      const requestUrl = originalRequest.url || '';
      const isAuthEndpoint =
        requestUrl.includes('/login') ||
        requestUrl.includes('/users/refresh') ||
        requestUrl.includes('/users/logout');

      const isHardAccountRejection =
        responseData?.code === 'ACCOUNT_DEACTIVATED' ||
        responseData?.code === 'USER_NOT_FOUND';

      if (!isAuthEndpoint && !isHardAccountRejection && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const newToken = await refreshAccessToken();
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        } catch (refreshError) {
          clearAuthAndRedirect();
          return Promise.reject(refreshError);
        }
      }

      if (!isAuthEndpoint) {
        clearAuthAndRedirect();
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