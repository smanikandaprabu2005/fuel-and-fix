import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 5000
});

// Set auth token in headers
api.interceptors.request.use(
  (config) => {
    let token = localStorage.getItem('token');
    if (token) {
      try {
        // Normalize token: if stored with 'Bearer ' or extra segments, use the last space-separated segment
        if (typeof token === 'string' && token.includes(' ')) {
          token = token.split(/\s+/).pop();
        }
      } catch (e) {
        // fallback to raw token
      }
      config.headers['Authorization'] = `Bearer ${token}`;
      config.headers['x-auth-token'] = token; // Also send as x-auth-token for compatibility
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401/403 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Clear local storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;