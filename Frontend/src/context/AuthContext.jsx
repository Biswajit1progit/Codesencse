import { createContext, useContext, useState, useEffect } from 'react';
import apiClient, { setAccessToken, clearAccessToken } from '../api/apiClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  if (window.location.pathname === '/auth/callback') {
    setLoading(false);
    return;
  }

  const restoreSession = async () => {
    try {
      // Timeout after 15 seconds — don't block UI forever
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const { data: refreshData } = await apiClient.post('/auth/refresh', {}, {
        signal: controller.signal
      });
      clearTimeout(timeout);

      setAccessToken(refreshData.accessToken);
      const { data: profileData } = await apiClient.get('/auth/profile');
      setUser(profileData.user);
    } catch {
      clearAccessToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  restoreSession();
}, []);

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // clear regardless
    } finally {
      clearAccessToken();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);