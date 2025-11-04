import React from 'react';
import './styles/theme.css';
import './components/common/common.css';
import './components/Auth/Auth.css';
import './components/Admin/admin.css';
import './components/Dashboard/Dashboard.css';
import './components/Provider/provider.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Dashboard from './components/Dashboard/Dashboard';
import AdminDashboard from './components/Dashboard/Admin/AdminDashboard';
import PricingEditor from './components/Admin/PricingEditor';
import AdminAnalytics from './components/Admin/AdminAnalytics';
import Landing from './pages/Landing';
import Payment from './pages/Payment';
import Debug from './pages/Debug';
import ProviderTest from './pages/ProviderTest';
import './App.css';

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

const AdminRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!currentUser) return <Navigate to="/login" />;
  if (currentUser.role !== 'admin') return <Navigate to="/dashboard" />;
  return children;
};

const ProviderRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!currentUser) return <Navigate to="/login" />;
  if (!['mechanic','delivery'].includes(currentUser.role)) return <Navigate to="/dashboard" />;
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Landing />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/pricing"
              element={
                <AdminRoute>
                  <PricingEditor />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <AdminRoute>
                  <AdminAnalytics />
                </AdminRoute>
              }
            />
            <Route
              path="/payment"
              element={
                <ProtectedRoute>
                  <Payment />
                </ProtectedRoute>
              }
            />
            <Route path="/debug" element={<Debug />} />
            <Route path="/provider-test" element={
              <ProviderRoute>
                <ProviderTest />
              </ProviderRoute>
            } />
            
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
