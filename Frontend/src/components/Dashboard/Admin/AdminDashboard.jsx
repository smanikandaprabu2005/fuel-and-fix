import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import DashboardHeader from '../common/DashboardHeader';
import AdminAnalytics from '../../Admin/AdminAnalytics';
import PricingEditor from '../../Admin/PricingEditor';
import './AdminDashboard.css';
import AdminAnimatedBackground from '../../common/AdminAnimatedBackground';

const AdminDashboard = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    users: 0,
    mechanics: 0,
    deliveryPersons: 0,
    activeRequests: 0,
    completedRequests: 0,
    totalEarnings: 0
  });

  const [users, setUsers] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [delivery, setDelivery] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeList, setActiveList] = useState('users');
  const [newProvider, setNewProvider] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'mechanic',
    specialties: ['general'],  // Initialize with at least one specialty
    vehicleType: 'motorcycle',
    password: Math.random().toString(36).slice(-8)  // Generate a default password
  });

  const fetchStats = async () => {
    try {
      const response = await api.get('/api/admin/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get(`/api/admin/users?page=${page}`);
      setUsers(response.data.users);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchMechanics = async () => {
    try {
      const response = await api.get(`/api/admin/mechanics?page=${page}`);
      setMechanics(response.data.mechanics);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error('Error fetching mechanics:', error);
    }
  };

  const fetchDelivery = async () => {
    try {
      const response = await api.get(`/api/admin/delivery?page=${page}`);
      setDelivery(response.data.delivery);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error('Error fetching delivery personnel:', error);
    }
  };

  // Check for admin access
  useEffect(() => {
    if (!currentUser || !currentUser.isAdmin()) {
      navigate('/dashboard');
      return;
    }
    fetchStats();
  }, [currentUser, navigate]);

  useEffect(() => {
    setPage(1); // Reset page when changing lists
  }, [activeList]);

  // Handle data fetching
  useEffect(() => {
    if (!currentUser?.isAdmin()) return;
    
    setLoading(true);
    setError('');
    
    const fetchData = async () => {
      try {
        switch (activeList) {
          case 'users':
            await fetchUsers();
            break;
          case 'mechanics':
            await fetchMechanics();
            break;
          case 'delivery':
            await fetchDelivery();
            break;
        }
      } catch (err) {
        setError('Failed to fetch data. Please try again.');
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeList, page, currentUser]);

  const handleCreateProvider = async (e) => {
    e.preventDefault();
    try {
      // Validate required fields
      if (!newProvider.name || !newProvider.email || !newProvider.phone) {
        alert('Please fill in all required fields (name, email, phone)');
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newProvider.email)) {
        alert('Please enter a valid email address');
        return;
      }

      // Use the unified provider creation endpoint
      const endpoint = '/api/admin/provider';
      
      // Prepare the payload with all required fields
      const payload = {
        name: newProvider.name,
        email: newProvider.email,
        phone: newProvider.phone,
        password: newProvider.password, // Include the password
        role: newProvider.role,
        location: {
          type: 'Point',
          coordinates: [0, 0]  // Default coordinates
        },
        ...(newProvider.role === 'mechanic' ? 
          { specialties: newProvider.specialties.length > 0 ? newProvider.specialties : ['general'] } : 
          { vehicleType: newProvider.vehicleType })
      };

      const response = await api.post(endpoint, payload);
      
      // Show the temporary password to admin
      alert(`Provider created successfully!\nTemporary password: ${response.data.tempPassword}\nPlease communicate this password to the provider securely.`);
      
      // Reset form and refresh stats
      setNewProvider({
        name: '',
        email: '',
        phone: '',
        role: 'mechanic',
        specialties: [],
        vehicleType: 'motorcycle'
      });
      fetchStats();
    } catch (error) {
      console.error('Error creating provider:', error);
      alert('Failed to create provider. ' + (error.response?.data?.msg || 'Please try again.'));
    }
  };

  const handleUserStatusUpdate = async (userId, active) => {
    try {
      await api.patch(`/api/admin/users/${userId}`, { active });
      fetchUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const handleDelete = async (id, type) => {
    const userType = type === 'mechanic' ? 'mechanic' : type === 'delivery' ? 'delivery person' : 'user';
    if (window.confirm(`Are you sure you want to delete this ${userType}?`)) {
      try {
        // Get the user ID from the provider document if necessary
        let userId = id;
        if (type === 'mechanic' || type === 'delivery') {
          const providers = type === 'mechanic' ? mechanics : delivery;
          const provider = providers.find(p => p._id === id);
          if (provider && provider.user) {
            userId = provider.user;
          }
        }

        const endpoint = `/api/admin/users/${userId}`;
        await api.delete(endpoint);

        // Show success message
        alert(`${userType.charAt(0).toUpperCase() + userType.slice(1)} deleted successfully`);
        
        // Refresh the appropriate list and stats
        switch(type) {
          case 'mechanic':
            await fetchMechanics();
            break;
          case 'delivery':
            await fetchDelivery();
            break;
          default:
            await fetchUsers();
        }
        await fetchStats();
      } catch (error) {
        console.error(`Error deleting ${userType}:`, error);
        alert(`Failed to delete ${userType}. ${error.response?.data?.msg || 'Please try again.'}`);
      }
    }
  };

  return (
    <div className="dashboard admin-dashboard">
      <AdminAnimatedBackground />
      <DashboardHeader title="Admin Dashboard" role="admin" />

      <div className="admin-main-layout">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button 
            className={`tab ${activeTab === 'providers' ? 'active' : ''}`}
            onClick={() => setActiveTab('providers')}
          >
            Add Provider
          </button>
          <button 
            className={`tab ${activeTab === 'pricing' ? 'active' : ''}`}
            onClick={() => setActiveTab('pricing')}
          >
            Edit Price
          </button>
        </div>

        <div className="admin-content-area">
          {activeTab === 'dashboard' && (
            <div className="dashboard-content">
              <div className="stats-row">
                <div className="stat-card">
                  <h4>Total Users</h4>
                  <p>{stats.users}</p>
                </div>
                <div className="stat-card">
                  <h4>Total Mechanics</h4>
                  <p>{stats.mechanics}</p>
                </div>
                <div className="stat-card">
                  <h4>Total Delivery Personnel</h4>
                  <p>{stats.deliveryPersons}</p>
                </div>
                <div className="stat-card">
                  <h4>Active Service Requests</h4>
                  <p>{stats.activeRequests}</p>
                </div>
                <div className="stat-card">
                  <h4>Completed Services</h4>
                  <p>{stats.completedRequests}</p>
                </div>
                <div className="stat-card">
                  <h4>Total Earnings</h4>
                  <p>₹{stats.totalEarnings?.total || 0}</p>
                </div>
              </div>

              {/* Show analytics chart below the stat cards on the dashboard page */}
              <div style={{ width: '100%', marginTop: 18 }}>
                <AdminAnalytics />
              </div>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="pricing-section">
              <h3>Edit Pricing</h3>
              <PricingEditor />
            </div>
          )}

          {activeTab === 'users' && (
            <div className="users-section">
              <div className="user-tabs">
                <button 
                  className={`tab ${activeList === 'users' ? 'active' : ''}`}
                  onClick={() => setActiveList('users')}
                >
                  Regular Users
                </button>
                <button 
                  className={`tab ${activeList === 'mechanics' ? 'active' : ''}`}
                  onClick={() => setActiveList('mechanics')}
                >
                  Mechanics
                </button>
                <button 
                  className={`tab ${activeList === 'delivery' ? 'active' : ''}`}
                  onClick={() => setActiveList('delivery')}
                >
                  Delivery Personnel
                </button>
              </div>

              {activeList === 'users' && (
                <>
                  <h3>User Management</h3>
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => (
                        <tr key={user._id}>
                          <td>{user.name}</td>
                          <td>{user.email}</td>
                          <td>{user.phone}</td>
                          <td>
                            <div className="btn-group">
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDelete(user._id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {activeList === 'mechanics' && (
                <>
                  <h3>Mechanics Management</h3>
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Specialties</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mechanics.map(mechanic => (
                        <tr key={mechanic.user}>
                          <td>{mechanic.name}</td>
                          <td>{mechanic.email}</td>
                          <td>{mechanic.phone}</td>
                          <td>{mechanic.specialties?.join(', ') || 'None'}</td>
                          <td>{mechanic.available ? 'Available' : 'Busy'}</td>
                          <td>
                            <div className="btn-group">
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => {
                                  console.log('Deleting mechanic:', mechanic);
                                  // Use the associated user ID for deletion
                                  handleDelete(mechanic.user, 'mechanic');
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {activeList === 'delivery' && (
                <>
                  <h3>Delivery Personnel Management</h3>
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Vehicle Type</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {delivery.map(person => (
                        <tr key={person._id}>
                          <td>{person.name}</td>
                          <td>{person.email}</td>
                          <td>{person.phone}</td>
                          <td>{person.vehicleType}</td>
                          <td>{person.available ? 'Available' : 'Busy'}</td>
                          <td>
                            <div className="btn-group">
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDelete(person._id, 'delivery')}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              <div className="pagination">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    className={page === i + 1 ? 'active' : ''}
                    onClick={() => setPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'providers' && (
            <div className="provider-section">
              <h3>Add New Service Provider</h3>
              <form className="provider-form" onSubmit={handleCreateProvider}>
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={newProvider.name}
                    onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={newProvider.email}
                    onChange={(e) => setNewProvider({ ...newProvider, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={newProvider.phone}
                    onChange={(e) => setNewProvider({ ...newProvider, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select
                    value={newProvider.role}
                    onChange={(e) => setNewProvider({ ...newProvider, role: e.target.value })}
                  >
                    <option value="mechanic">Mechanic</option>
                    <option value="delivery">Delivery Person</option>
                  </select>
                </div>
                {newProvider.role === 'delivery' && (
                  <div className="form-group">
                    <label>Vehicle Type</label>
                    <select
                      value={newProvider.vehicleType}
                      onChange={(e) => setNewProvider({ ...newProvider, vehicleType: e.target.value })}
                    >
                      <option value="motorcycle">Motorcycle</option>
                      <option value="car">Car</option>
                      <option value="truck">Truck</option>
                    </select>
                  </div>
                )}
                <button type="submit" className="btn btn-primary">
                  Create Provider
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;