import React, { useState } from 'react';
import './Login.css';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AnimatedBackground from '../common/AnimatedBackground';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const { email, password } = formData;

  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear any previous errors
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    try {
      const result = await loginUser(formData);
      if (result.success) {
        // After successful login, redirect based on role (admins go to admin panel)
        const stored = localStorage.getItem('user');
        let parsed = null;
        try {
          parsed = stored ? JSON.parse(stored) : null;
        } catch (err) {
          parsed = null;
        }

        // After successful login, return to landing page
        navigate('/');
      } else {
        setError(result.message || 'Login failed. Please try again.');
      }
    } catch (err) {
      setError('An error occurred during login. Please try again.');
      console.error('Login error:', err);
    }
  };

  return (
    <div className="auth-wrapper">
      <AnimatedBackground />
      <div className="auth-container">
        <h2>Login to Your Account</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={email}
            onChange={onChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={password}
            onChange={onChange}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary">Login</button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '20px', color: '#90caf9' }}>
        Don't have an account? <Link to="/register" style={{ color: '#0b74de', textDecoration: 'none' }}>Register</Link>
      </p>
      </div>
    </div>
  );
};

export default Login;