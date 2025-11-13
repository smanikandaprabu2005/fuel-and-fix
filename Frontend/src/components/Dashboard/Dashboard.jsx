import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getNearbyMechanics, getNearbyDeliveryPersons, getUserServiceRequests } from '../../services/authService';
import AdminDashboard from './Admin/AdminDashboard';
import MechanicDashboard from './Mechanic/MechanicDashboard';
import DeliveryDashboard from './Delivery/DeliveryDashboard';
import ProvidersMap from './Map';
import ServiceRequest from './ServiceRequest';
import { socket, connectSocket } from '../../services/socket';
import './Dashboard.css';
import './liveFuelPrice.css';

// User Dashboard Component
import BookingHistory from './User/BookingHistory';
import DashboardHeader from './common/DashboardHeader';
import UserAnimatedBackground from '../common/UserAnimatedBackground';

import { useLocation } from 'react-router-dom';

const UserDashboardContent = ({ currentUser }) => {
  // Live fuel prices state
  const [petrolPrice, setPetrolPrice] = useState(null);
  const [dieselPrice, setDieselPrice] = useState(null);

  const [userLocation, setUserLocation] = useState(null);
  useEffect(() => {
    if (!userLocation) return;
    let interval;
    const fetchFuelPrices = async () => {
      try {
        let lat = userLocation.lat;
        let lng = userLocation.lng;
        let state = 'maharashtra';
        let city = 'mumbai';
        if (lat && lng) {
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const geoData = await geoRes.json();
          if (geoData && geoData.address) {
            state = geoData.address.state?.toLowerCase() || state;
            city = geoData.address.city?.toLowerCase() || geoData.address.town?.toLowerCase() || geoData.address.village?.toLowerCase() || city;
          }
        }
        console.log('Requesting fuel prices for', state, city);
        const res = await fetch(`/api/fuel-prices?state=${encodeURIComponent(state)}&city=${encodeURIComponent(city)}`);
        const data = await res.json();
        setPetrolPrice(data.petrol);
        setDieselPrice(data.diesel);
      } catch (e) {
        setPetrolPrice(null);
        setDieselPrice(null);
      }
    };
    fetchFuelPrices();
    interval = setInterval(fetchFuelPrices, 60000);
    return () => clearInterval(interval);
  }, [userLocation]);
  const [mechanics, setMechanics] = useState([]);
  const [deliveryPersons, setDeliveryPersons] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState('');
  const location = useLocation();
  // read optional initial service type from query param (e.g. ?service=fuel)
  const params = new URLSearchParams(location.search);
  const initialService = params.get('service') || null;

  const fetchNearbyProviders = React.useCallback(async (location) => {
    try {
      const [mechanicsRes, deliveryRes] = await Promise.all([
        getNearbyMechanics(location.lat, location.lng),
        getNearbyDeliveryPersons(location.lat, location.lng)
      ]);
      
      setMechanics(mechanicsRes.data);
      setDeliveryPersons(deliveryRes.data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching nearby providers", err);
      setLoading(false);
    }
  }, []);

  const attemptGeolocation = React.useCallback(async () => {
    setLoading(true);
    setLocationError('');

    if (!window.isSecureContext) {
      setLocationError('Location requires a secure connection (HTTPS). Using default location.');
      // Mumbai fallback
      const fallbackLocation = { lat: 19.076, lng: 72.8777 };
      setUserLocation(fallbackLocation);
      await fetchNearbyProviders(fallbackLocation);
      setLoading(false);
      return;
    }

    let gotLocation = false;
    try {
      const permissionResult = await navigator.permissions.query({ name: 'geolocation' });
      if (permissionResult.state === 'denied') {
        setLocationError('Location access denied. Using default location.');
        const fallbackLocation = { lat: 19.076, lng: 72.8777 };
        setUserLocation(fallbackLocation);
        await fetchNearbyProviders(fallbackLocation);
        setLoading(false);
        return;
      }
    } catch (permError) {
      console.warn('Could not check location permissions:', permError);
    }

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser. Using default location.');
      const fallbackLocation = { lat: 19.076, lng: 72.8777 };
      setUserLocation(fallbackLocation);
      await fetchNearbyProviders(fallbackLocation);
      setLoading(false);
      return;
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            gotLocation = true;
            resolve(pos);
          },
          (error) => {
            gotLocation = false;
            resolve(null);
          }
        );
      });
      if (position && gotLocation) {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(location);
        await fetchNearbyProviders(location);
        setLocationError('');
      } else {
        setLocationError('Unable to get your location. Using default location.');
        const fallbackLocation = { lat: 19.076, lng: 72.8777 };
        setUserLocation(fallbackLocation);
        await fetchNearbyProviders(fallbackLocation);
      }
      setLoading(false);
    } catch (error) {
      setLocationError('Unable to get your location. Using default location.');
      const fallbackLocation = { lat: 19.076, lng: 72.8777 };
      setUserLocation(fallbackLocation);
      await fetchNearbyProviders(fallbackLocation);
      setLoading(false);
    }
  }, [fetchNearbyProviders]);

  useEffect(() => {
    if (currentUser) {
      attemptGeolocation();
      connectSocket(currentUser._id, 'user'); // Add the role parameter
    }

    socket.on('locationUpdate', (data) => {
      // Update provider location in real-time
      if (data.type === 'mechanic') {
        setMechanics(prev => prev.map(m => 
          m._id === data.providerId ? { ...m, location: data.location } : m
        ));
      } else if (data.type === 'delivery') {
        setDeliveryPersons(prev => prev.map(d => 
          d._id === data.providerId ? { ...d, location: data.location } : d
        ));
      }
    });

    socket.on('serviceRequestUpdate', async () => {
      // Refresh service requests when updates occur
      try {
        const response = await getUserServiceRequests();
        setServiceRequests(response.data);
      } catch (error) {
        console.error('Error fetching service requests:', error);
      }
    });

    return () => {
      socket.off('locationUpdate');
      socket.off('serviceRequestUpdate');
    };
  }, [currentUser, attemptGeolocation]);

  return (
    <div className="dashboard user-dashboard">
      <UserAnimatedBackground />
      <DashboardHeader title="User Dashboard" role={currentUser.role} />
      {/* Floating live fuel price box */}
      <div className="live-fuel-price-box">
        <div className="live-fuel-icon">
          <span role="img" aria-label="fuel" style={{ fontSize: 28 }}>⛽</span>
        </div>
        <div className="live-fuel-details">
          <span style={{ color: '#4285F4', fontWeight: 600 }}>Live Fuel Prices</span><br />
          <span>Petrol: {petrolPrice ? `₹${petrolPrice}/L` : 'Loading...'}</span><br />
          <span>Diesel: {dieselPrice ? `₹${dieselPrice}/L` : 'Loading...'}</span>
        </div>
      </div>
      <div className="user-dashboard-layout">
        <div className="service-request-wrapper">
          <ServiceRequest
            userLocation={userLocation}
            selectedProvider={selectedProvider}
            serviceRequests={serviceRequests}
            userId={currentUser._id}
            initialServiceType={initialService}
            onServiceCreated={(newRequest) => {
              setServiceRequests(prev => [newRequest, ...prev]);
            }}
          />
        </div>
        <div className="booking-history-wrapper">
          <BookingHistory />
        </div>
      </div>
    </div>
  );
}

// Main Dashboard Component
const Dashboard = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  if (!currentUser) {
    return null;
  }

  // Render appropriate dashboard based on user role
  switch (currentUser.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'mechanic':
      return <MechanicDashboard providerId={currentUser._id} />;
    case 'delivery':
      return <DeliveryDashboard providerId={currentUser._id} />;
    case 'user':
      return <UserDashboardContent currentUser={currentUser} />;
    default:
      return null;
  }
};

export default Dashboard;