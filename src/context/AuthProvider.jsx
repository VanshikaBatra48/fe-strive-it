import { useState, useEffect, useCallback } from 'react';
import AuthContext from './AuthContext';
import authApi from '../api/authApi';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  // Synchronize authentication profile on initial mount
  useEffect(() => {
    let isMounted = true;

    async function verifyAuth() {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const res = await authApi.getCurrentUser();
        if (isMounted && res?.success && res?.user) {
          setUser((prev) => {
            const merged = { ...prev, ...res.user };
            localStorage.setItem('user', JSON.stringify(merged));
            return merged;
          });
          if (res.user.firstLogin) {
            setMustChangePassword(true);
          }
        }
      } catch (err) {
        if (isMounted) {
          if (
            err.response?.status === 403 &&
            err.response?.data?.code === 'FIRST_LOGIN_PASSWORD_CHANGE_REQUIRED'
          ) {
            setMustChangePassword(true);
          } else if (err.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    verifyAuth();

    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
      setMustChangePassword(false);
    };

    const handleFirstLoginRequired = () => {
      setMustChangePassword(true);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    window.addEventListener('auth:first-login-required', handleFirstLoginRequired);

    return () => {
      isMounted = false;
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      window.removeEventListener('auth:first-login-required', handleFirstLoginRequired);
    };
  }, []);

  const login = useCallback(async (email, password) => {
    setAuthError(null);
    try {
      const data = await authApi.login(email, password);
      if (data?.token && data?.user) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);

        if (data.user.firstLogin || data.redirectTo === '/changePassword' || data.redirectTo === '/change-password' || data.redirectTo === '/forget-password') {
          setMustChangePassword(true);
        } else {
          setMustChangePassword(false);
        }

        return { success: true, user: data.user, redirectTo: data.redirectTo };
      }
      throw new Error(data?.message || 'Login failed');
    } catch (err) {
      const errorMsg =
        err.response?.data?.message || err.message || 'Failed to authenticate';
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setAuthError(null);
    setMustChangePassword(false);
  }, []);

  const changePassword = useCallback(async (newPassword) => {
    setAuthError(null);
    try {
      const data = await authApi.changePassword(newPassword);
      if (data?.success) {
        if (data.token) {
          localStorage.setItem('token', data.token);
          setToken(data.token);
        }
        setMustChangePassword(false);
        setUser((prev) => {
          const updated = {
            ...(prev || {}),
            ...(data.user || {}),
            firstLogin: false,
          };
          localStorage.setItem('user', JSON.stringify(updated));
          return updated;
        });
        return { success: true, message: data.message };
      }
      throw new Error(data?.message || 'Failed to update password');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error changing password';
      return { success: false, error: msg };
    }
  }, []);

  const completeFirstLogin = useCallback(async () => {
    try {
      const data = await authApi.completeFirstLogin(user?.id);
      if (data?.success) {
        setMustChangePassword(false);
        setUser((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, firstLogin: false };
          localStorage.setItem('user', JSON.stringify(updated));
          return updated;
        });
        return { success: true };
      }
      throw new Error(data?.message || 'Failed to complete first login');
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { success: false, error: msg };
    }
  }, [user]);

  const value = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    role: user?.role?.toLowerCase() || null,
    loading,
    authError,
    setAuthError,
    mustChangePassword,
    setMustChangePassword,
    login,
    logout,
    changePassword,
    completeFirstLogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
