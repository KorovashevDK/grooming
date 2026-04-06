import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router';
import { setUnauthorizedHandler } from '../api/client';
import { authApi } from '../api/endpoints';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const routeNavigator = useRouteNavigator();

  const logout = React.useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    localStorage.removeItem('roles');
    localStorage.removeItem('activeRole');
    setUser(null);
    routeNavigator.replace('/login');
  }, [routeNavigator]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [logout]);

  // Restore user from localStorage on mount, but only after token validation.
  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUserData = localStorage.getItem('userData');

      if (storedToken && storedUserData) {
        try {
          const userData = JSON.parse(storedUserData);

          await authApi.me();
          if (storedToken) {
            setUser(userData);
            console.log('User restored from localStorage, role:', userData.role);
          }
        } catch (error) {
          console.error('Error restoring user from localStorage:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('userData');
        }
      }

      setLoading(false);
    };

    restoreSession();
  }, []);

  const login = React.useCallback(async (vkUserData) => {
    try {
      console.log('Attempting login with user data:', vkUserData);
      const data = await authApi.login(vkUserData);
      console.log('Auth response:', data);

      if (data?.needsRegistration) {
        return { success: false, needsRegistration: true, data };
      }

      if (data?.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('userData', JSON.stringify(data));
        setUser(data);
        console.log('Login successful, user set, role:', data.role);
        
        // Don't redirect here - let App.js handle the redirect to avoid conflicts
        return { success: true, data };
      } else {
        console.error('Authentication failed:', data.error || 'Unknown error');
        return { success: false, error: data.error || 'Authentication failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message || 'Network error' };
    }
  }, []);

  const switchRole = React.useCallback(async (role) => {
    try {
      const data = await authApi.switchRole(role);
      if (data?.token) {
        localStorage.setItem('token', data.token);
        const nextUser = { ...(user || {}), role: data.role || role };
        localStorage.setItem('userData', JSON.stringify(nextUser));
        setUser(nextUser);
        return { success: true, data };
      }
      return { success: false, error: data?.error || 'Role switch failed' };
    } catch (error) {
      return { success: false, error: error.message || 'Network error' };
    }
  }, [user]);

  const checkRole = React.useCallback((allowedRoles) => {
    if (!user) return false;
    return allowedRoles.includes(user.role);
  }, [user]);

  // Memoize value to prevent unnecessary re-renders
  const value = React.useMemo(() => ({
    user,
    loading,
    login,
    switchRole,
    logout,
    checkRole,
    isAuthenticated: !!user
  }), [user, loading, login, switchRole, logout, checkRole]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
