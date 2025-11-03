import React, { createContext, useState, useContext, useEffect } from 'react';
import { login, register } from '../services/authService';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
      const parsedUser = JSON.parse(user);
      // Recreate the enhanced user object when loading from localStorage
      const enhancedUser = {
        ...parsedUser,
        isAdmin: () => parsedUser.role === 'admin',
        isMechanic: () => parsedUser.role === 'mechanic',
        isDelivery: () => parsedUser.role === 'delivery',
        isRegularUser: () => parsedUser.role === 'user',
        isAvailable: () => parsedUser.role !== 'user' ? parsedUser.available : false,
        getLocation: () => parsedUser.location || null,
        hasSpecialties: () => parsedUser.role === 'mechanic' && Array.isArray(parsedUser.specialties),
        getSpecialties: () => parsedUser.role === 'mechanic' ? parsedUser.specialties || [] : [],
        getVehicleType: () => parsedUser.role === 'delivery' ? parsedUser.vehicleType : null
      };
      setCurrentUser(enhancedUser);
    }
    
    setLoading(false);
  }, []);

  const loginUser = async (userData) => {
    try {
      // Validate input
      if (!userData.email || !userData.password) {
        return { success: false, message: 'Email and password are required' };
      }

      const response = await login(userData);
      const { token, user } = response.data;
      
      if (!token || !user) {
        throw new Error('Invalid response from server');
      }

      // Enhance the user object with role-specific helper functions
      const enhancedUser = {
        ...user,
        _id: user.id, // Ensure _id is set for consistency
        isAdmin: () => user.role === 'admin',
        isMechanic: () => user.role === 'mechanic',
        isDelivery: () => user.role === 'delivery',
        isRegularUser: () => user.role === 'user',
        isAvailable: () => user.role !== 'user' ? user.available : false,
        getLocation: () => user.location || null,
        hasSpecialties: () => user.role === 'mechanic' && Array.isArray(user.specialties),
        getSpecialties: () => user.role === 'mechanic' ? user.specialties || [] : [],
        getVehicleType: () => user.role === 'delivery' ? user.vehicleType : null
      };
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(enhancedUser)); // Store enhanced user data
      
      setCurrentUser(enhancedUser);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        message: error.response?.data?.msg || 'Invalid credentials. Please try again.'
      };
    }
  };

  const registerUser = async (userData) => {
    try {
      const response = await register(userData);
      if (response && response.data) {
        // Don't store token or user data after registration
        // User should login explicitly
        return { 
          success: true,
          message: "Registration successful! Please login with your credentials."
        };
      } else {
        return { 
          success: false, 
          message: "Registration failed. Please try again." 
        };
      }
    } catch (error) {
      console.error("Registration error:", error);
      return { 
        success: false, 
        message: error.response?.data?.msg || "Connection error. Please check if the server is running."
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
    window.location.href = '/';  // Navigate to landing page after logout
  };

  const value = {
    currentUser,
    loginUser,
    registerUser,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};