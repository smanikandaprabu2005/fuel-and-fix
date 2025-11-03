import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getUserServiceRequests } from '../../../services/authService';
import Map from '../Map';
import './BookingHistory.css';

const BookingHistory = () => {
  const { currentUser } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser && currentUser.id) {
      fetchBookings();
    }
  }, [currentUser]);

  const fetchBookings = async () => {
    if (!currentUser || !currentUser.id) {
      setLoading(false);
      return;
    }

    try {
      const response = await getUserServiceRequests(currentUser.id);
      setBookings(response.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setBookings([]);
      setLoading(false);
    }
  };

  const filterBookings = () => {
    if (activeTab === 'all') return bookings;
    if (activeTab === 'active') {
      return bookings.filter(booking => 
        ['pending', 'assigned', 'in-progress'].includes(booking.status)
      );
    }
    return bookings.filter(booking => booking.status === 'completed');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusClass = (status) => {
    return `request-status status-${status.toLowerCase()}`;
  };

  return (
    <div className="booking-history">
      <h3>Your Bookings</h3>
      
      <div className="booking-tabs">
        <button 
          className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Bookings
        </button>
        <button 
          className={`tab-button ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active
        </button>
        <button 
          className={`tab-button ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed
        </button>
      </div>

      {loading ? (
        <p>Loading bookings...</p>
      ) : filterBookings().length === 0 ? (
        <p>No bookings found</p>
      ) : (
        filterBookings().map(booking => (
          <div key={booking._id} className="request-card">
            <div className="request-header">
              <span className={`request-type ${booking.serviceType}`}>
                {booking.serviceType.charAt(0).toUpperCase() + booking.serviceType.slice(1)}
                {booking.serviceType === 'mechanical' && booking.mechanicalType && 
                  ` - ${booking.mechanicalType.charAt(0).toUpperCase() + booking.mechanicalType.slice(1)}`}
              </span>
              <span className="request-date">{formatDate(booking.date)}</span>
            </div>

            <div className="request-details">
              <p>{booking.description}</p>
              <span className={getStatusClass(booking.status)}>
                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
              </span>
            </div>

            {booking.assignedTo && (
              <div className="provider-info">
                <h4>Service Provider</h4>
                <p>{booking.assignedTo.name}</p>
                <p>Phone: {booking.assignedTo.phone}</p>
              </div>
            )}

            {['assigned', 'in-progress'].includes(booking.status) && booking.assignedTo && (
              <div className="tracking-info">
                <div className="tracking-map">
                  <Map
                    userLocation={booking.location}
                    providerLocation={booking.assignedTo.location}
                    showRoute={true}
                  />
                </div>
                <div className="eta">
                  Estimated arrival: {booking.eta || 'Calculating...'}
                </div>
              </div>
            )}

            {booking.status === 'completed' && booking.payment && (
              <div className="payment-info">
                <span className="amount">Amount Paid: ₹{booking.payment.amount}</span>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default BookingHistory;