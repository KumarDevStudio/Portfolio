import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authData, setAuthData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load auth data from localStorage on mount
    const stored = localStorage.getItem('authData');
    if (stored) {
      try {
        setAuthData(JSON.parse(stored));
      } catch (error) {
        localStorage.removeItem('authData');
      }
    }
    setLoading(false);
  }, []);

  const login = (data) => {
    setAuthData(data);
    localStorage.setItem('authData', JSON.stringify(data));
  };

  const logout = async () => {
    if (authData) {
      try {
        await api.logout(authData.accessToken, authData.refreshToken);
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    setAuthData(null);
    localStorage.removeItem('authData');
  };

  const refreshToken = async () => {
    if (!authData?.refreshToken) return false;

    try {
      const result = await api.refreshToken(authData.refreshToken);
      if (result.success) {
        const newAuthData = {
          ...authData,
          accessToken: result.data.accessToken,
          refreshToken: result.data.refreshToken,
        };
        setAuthData(newAuthData);
        localStorage.setItem('authData', JSON.stringify(newAuthData));
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{ authData, login, logout, refreshToken, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
