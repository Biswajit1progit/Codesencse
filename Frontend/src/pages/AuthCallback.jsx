import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient, { setAccessToken } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');

        if (!token) {
          navigate('/?error=no_token');
          return;
        }

        setAccessToken(token);
        window.history.replaceState({}, document.title, '/auth/callback');

        const { data } = await apiClient.get('/auth/profile');
        setUser(data.user);
        navigate('/dashboard');

      } catch {
        navigate('/?error=auth_failed');
      }
    };

    fetchSession();
  }, []);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: '#0f172a',
      color: '#94a3b8',
      fontFamily: 'sans-serif'
    }}>
      <p>Authenticating...</p>
    </div>
  );
};

export default AuthCallback;