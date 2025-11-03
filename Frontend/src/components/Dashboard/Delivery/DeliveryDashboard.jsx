import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { 
  listenForRequests, 
  listenForRequestLock, 
  stopListeningForRequests,
  acceptServiceRequest,
  updateServiceStatus,
  updateProviderLocation,
  connectSocket,
  socket
} from '../../../services/socket';
import { getUserId, getProviderEarnings } from '../../../services/authService';
import Map from '../Map';
import ServiceNotification from '../common/ServiceNotification';
import ServiceTracking from '../ServiceTracking';
import DashboardHeader from '../common/DashboardHeader';
import './DeliveryDashboard.css';
import useBlockUnloadOnActiveRequest from '../../../hooks/useBlockUnloadOnActiveRequest';

const DeliveryDashboard = () => {
  const { currentUser } = useAuth();
  const [isAvailable, setIsAvailable] = useState(true);
  const [activeRequests, setActiveRequests] = useState([]);
  const [currentRequest, setCurrentRequest] = useState(null);
  const [requestHistory, setRequestHistory] = useState([]);
  const [earningsData, setEarningsData] = useState(null);

useEffect(() => {
  const fetchEarningsData = async () => {
    if (!currentUser?.providerId) {
      console.error('Provider ID is missing');
      return;
    }

    try {
      const data = await getProviderEarnings(currentUser.providerId);
      setEarningsData(data);
    } catch (error) {
      console.error('Failed to fetch earnings data:', error);
    }
  };

  fetchEarningsData();
}, [currentUser?.providerId]);

useEffect(() => {
  const fetchRecentServices = async () => {
    if (!currentUser?.providerId) {
      console.error('Provider ID is missing for fetching recent services');
      return;
    }

    try {
      const data = await getProviderEarnings(currentUser.providerId); // Assuming same API returns recent services
      setEarningsData(data);
    } catch (error) {
      console.error('Failed to fetch recent services:', error);
    }
  };

  fetchRecentServices();
}, [currentUser?.providerId]);

useEffect(() => {
  const fetchEarnings = async () => {
    if (!currentUser?.providerId) {
      console.error('Provider ID is missing');
      return;
    }
    try {
      const data = await getProviderEarnings(currentUser.providerId);
      setEarningsData(data);
    } catch (error) {
      console.error('Failed to fetch earnings data:', error);
    }
  };

  fetchEarnings();
}, [currentUser?.providerId]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const currentRequestRef = React.useRef(null);
  const [distanceToUser, setDistanceToUser] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [otpPopupOpen, setOtpPopupOpen] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [serviceOtp, setServiceOtp] = useState('');
  
  // Prevent accidental refresh/close while a delivery request is active
  useBlockUnloadOnActiveRequest(currentRequest, { role: 'delivery' });
  
  const handleNewRequest = useCallback((request) => {
    // Only show fuel delivery requests within range when available
    console.log('handleNewRequest called with:', request, 'isAvailable:', isAvailable);
    // Only show fuel delivery requests within range when available
    if (request && request.serviceType === 'fuel' && isAvailable) {
      setActiveRequests(prev => {
        // Deduplicate by _id to avoid duplicate cards when the same event arrives twice
        const exists = prev.some(r => r._id && request._id && r._id.toString() === request._id.toString());
        if (exists) {
          console.log('Ignoring duplicate request with id:', request._id);
          return prev;
        }
        const next = [...prev, request];
        console.log('Updated activeRequests count:', next.length);
        return next;
      });
    }
  }, [isAvailable]);

  const handleRequestLock = useCallback((requestId) => {
    setActiveRequests(prev => prev.filter(req => req._id !== requestId));
  }, []);

  // Start tracking location
  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported');
      return;
    }
    console.log('Starting location tracking (startLocationTracking)');
    const id = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setCurrentLocation(location);

        // Use ref to get the latest currentRequest (setState is async)
        const activeReq = currentRequestRef.current || currentRequest;
        const requestIdToUse = activeReq && activeReq._id ? activeReq._id : null;
        if (requestIdToUse) {
          console.log('watchPosition: emitting provider location for request:', requestIdToUse, location);
          updateProviderLocation(requestIdToUse, location);
        } else {
          console.log('watchPosition: no active request yet, skipping emit');
        }
      },
      (error) => {
        console.error('Error getting location:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );
    setWatchId(id);
  }, [currentRequest]);

  // Stop tracking location
  const stopLocationTracking = useCallback(() => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  }, [watchId]);

  const handleAcceptRequest = async (request) => {
    try {
      await acceptServiceRequest(request._id, currentUser._id, 'delivery');
      // Normalize request fields so the delivery UI has lat/lng and fuelDetails
      const normalizedLocation = request.location ? ({
        lat: request.location.lat ?? request.location.coordinates?.[1],
        lng: request.location.lng ?? request.location.coordinates?.[0],
        address: request.location.address ?? request.location.name ?? ''
      }) : null;

      const normalizedFuel = request.fuelDetails ? (typeof request.fuelDetails === 'string' ? (() => {
        try { return JSON.parse(request.fuelDetails); } catch (e) { return { fuelType: request.fuelDetails }; }
      })() : request.fuelDetails) : null;

      const normalizedRequest = { ...request, location: normalizedLocation, fuelDetails: normalizedFuel };

  // Optimistically mark as accepted so the action buttons become enabled immediately
  normalizedRequest.status = 'accepted';

      setCurrentRequest(normalizedRequest);
      setActiveRequests(prev => prev.filter(req => req._id !== request._id));
      // Update ref immediately so watchPosition callback can read it
      currentRequestRef.current = normalizedRequest;
      startLocationTracking(); // Start tracking when request is accepted
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  };

  const handleStatusUpdate = async (status) => {
    if (!currentRequest) return;
    setStatusLoading(true);
    try {
      // Provide distanceMeters when completing so backend can compute fare
      if (status === 'completed' && distanceToUser != null) {
        const meters = Math.round(distanceToUser);
        await updateServiceStatus(currentRequest._id, status, meters);
      } else {
        await updateServiceStatus(currentRequest._id, status);
      }
      // Do not optimistically push to history here; rely on server-emitted statusUpdate
      if (status !== 'completed') {
        setCurrentRequest(prev => ({ ...prev, status }));
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setStatusLoading(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLocationTracking();
    };
  }, [stopLocationTracking]);

  // Keep ref in sync when currentRequest changes from other flows
  useEffect(() => {
    currentRequestRef.current = currentRequest;
  }, [currentRequest]);

  // Compute distance between provider (currentLocation) and user (currentRequest.location)
  useEffect(() => {
    const computeDistanceMeters = (lat1, lon1, lat2, lon2) => {
      if ([lat1, lon1, lat2, lon2].some(v => v === undefined || v === null)) return null;
      const toRad = v => v * Math.PI / 180;
      const R = 6371000; // metres
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    if (!currentRequest || !currentRequest.location || !currentLocation) {
      setDistanceToUser(null);
      return;
    }

    const userLat = currentRequest.location.lat ?? currentRequest.location.coordinates?.[1];
    const userLng = currentRequest.location.lng ?? currentRequest.location.coordinates?.[0];
    const provLat = currentLocation.lat;
    const provLng = currentLocation.lng;

    const meters = computeDistanceMeters(provLat, provLng, userLat, userLng);
    setDistanceToUser(meters);
  }, [currentLocation, currentRequest]);

  useEffect(() => {
    let isSubscribed = true;

    const initSocketListeners = async () => {
      if (!currentUser || !isAvailable) return;

      try {
        // Ensure socket is connected and joined to 'delivery' room
        await connectSocket(currentUser._id, 'delivery');
        if (!isSubscribed) return;

        listenForRequests(handleNewRequest);
        listenForRequestLock(handleRequestLock);
      } catch (err) {
        console.error('Failed to connect socket for delivery dashboard:', err);
      }
    };

    initSocketListeners();

    return () => {
      isSubscribed = false;
      stopListeningForRequests();
    };
  }, [isAvailable, handleNewRequest, handleRequestLock]);

  // Real-time status update listener (update currentRequest when status changes)
  useEffect(() => {
    if (!currentRequest) return;
    const handler = (data) => {
      if (data && data.requestId === currentRequest._id && data.status) {
        // Merge server-sent payment and completedAt into the record we store in history
        const completed = data.status === 'completed';
        const merged = {
          ...currentRequest,
          status: data.status,
          payment: data.payment || currentRequest.payment || { amount: 0 },
          completedAt: data.completedAt || new Date().toISOString()
        };
        setCurrentRequest(prev => prev ? { ...prev, status: data.status } : prev);
        if (completed) {
          setRequestHistory(prev => [merged, ...prev]);
          setCurrentRequest(null);
          stopLocationTracking();
          // Give UI a moment then return to provider dashboard
          setTimeout(() => { window.location.href = '/dashboard'; }, 1000);
        }
        setStatusLoading(false);
      }
    };
    socket.on(`statusUpdate:${currentRequest._id}`, handler);
    return () => {
      socket.off(`statusUpdate:${currentRequest._id}`, handler);
    };
    // eslint-disable-next-line
  }, [currentRequest]);

  // Listen for OTP from backend (for Arrived & Delivering flow)
  useEffect(() => {
    if (!currentRequest) return;
    const otpHandler = (data) => {
      if (data && data.serviceRequestId === currentRequest._id && data.otp) {
        setServiceOtp(data.otp);
      }
    };
    socket.on('serviceOtp', otpHandler);
    return () => {
      socket.off('serviceOtp', otpHandler);
    };
  }, [currentRequest]);

  const verifyOtp = async (otp) => {
    if (otp === serviceOtp) {
      setOtpPopupOpen(false);
      setOtpError('');
      setStatusLoading(true);
      try {
        await handleStatusUpdate('in-progress');
      } catch (e) {
        console.error(e);
      } finally {
        setStatusLoading(false);
      }
    } else {
      setOtpError('Invalid OTP. Please try again.');
    }
  };

  return (
    <div className="dashboard delivery-dashboard">
      <DashboardHeader title={currentUser?.name || 'Fuel Delivery'} role="delivery" />
      <div className="dashboard-content">
        <div className="status-section">
          <h3>Your Status</h3>
          <div className="status-toggle">
            <label className="switch">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={() => setIsAvailable(!isAvailable)}
              />
              <span className="slider round"></span>
            </label>
            <span className="status-text">
              {isAvailable ? 'Available for Delivery' : 'Not Available'}
            </span>
          </div>
        </div>

        {currentRequest ? (
          <div className="current-request">
            <h3>Current Delivery</h3>
            <div className="request-details">
              <div className="request-info">
                <h4>Customer Details</h4>
                <p>Location: {currentRequest.location?.address || '—'}</p>
                <p>Fuel Type: {currentRequest.fuelDetails?.fuelType || 'N/A'}</p>
                <p>Quantity: {currentRequest.fuelDetails && (currentRequest.fuelDetails.quantity !== undefined && currentRequest.fuelDetails.quantity !== null) ? `${currentRequest.fuelDetails.quantity}L` : '—'}</p>
                <p>Status: {currentRequest.status}</p>
              </div>
              <div className="status-actions">
                <button 
                  className="btn btn-primary"
                  onClick={() => handleStatusUpdate('on-way')}
                  disabled={currentRequest.status !== 'accepted' || statusLoading}
                >
                  Start Delivery
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => setOtpPopupOpen(true)}
                  disabled={currentRequest.status !== 'on-way' || statusLoading}
                >
                  Arrived & Delivering
                </button>
                <button 
                  className="btn btn-success"
                  onClick={async () => {
                    setStatusLoading(true);
                    try {
                      await handleStatusUpdate('completed');
                      // After completing delivery, return provider to their dashboard (providers should not be sent to user payment page)
                      setTimeout(() => { window.location.href = '/dashboard'; }, 1000);
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setStatusLoading(false);
                    }
                  }}
                  disabled={currentRequest.status !== 'in-progress' || statusLoading}
                >
                  Complete Delivery
                </button>
              </div>
              <div className="delivery-map">
                {/* Map (ServiceTracking) sits directly below the action buttons */}
                <ServiceTracking
                  serviceRequest={currentRequest}
                  userLocation={currentRequest.location ? ({
                    lat: currentRequest.location.lat ?? currentRequest.location.coordinates?.[1],
                    lng: currentRequest.location.lng ?? currentRequest.location.coordinates?.[0],
                    address: currentRequest.location.address
                  }) : null}
                  providerLocation={currentLocation}
                  role="delivery"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="delivery-requests">
            <h3>Available Requests</h3>
            <div className="request-list">
              {activeRequests.length > 0 ? (
                activeRequests.map(request => (
                  <div key={request._id} className="request-card">
                    <div className="request-info">
                        <p>Distance: {request.distance ? `${request.distance.toFixed(1)} km` : '—'}</p>
                        <p>Fuel Type: {request.fuelDetails && request.fuelDetails.fuelType ? request.fuelDetails.fuelType : 'N/A'}</p>
                        <p>Quantity: {request.fuelDetails && (request.fuelDetails.quantity !== undefined && request.fuelDetails.quantity !== null) ? `${request.fuelDetails.quantity}L` : '—'}</p>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleAcceptRequest(request)}
                    >
                      Accept Request
                    </button>
                  </div>
                ))
              ) : (
                <p>No active delivery requests</p>
              )}
            </div>
          </div>
        )}

        <div className="delivery-history">
          <h3>Recent Deliveries</h3>
          <div className="history-list">
            {earningsData?.recentServices?.length > 0 ? (
              earningsData.recentServices.map(request => (
                <div key={request._id} className="history-card">
                  <p>Date: {new Date(request.completedAt || request.date).toLocaleDateString()}</p>
                  <p>Fuel: {request.fuelDetails?.fuelType || 'N/A'} ({request.fuelDetails?.quantity ?? '—'}L)</p>
                  <p>Location: {request.location?.address || '—'}</p>
                  <p>Earnings: ₹{Number(request.payment?.amount || 0)}</p>
                </div>
              ))
            ) : (
              <p>No recent deliveries</p>
            )}
          </div>
        </div>

        <div className="earnings-section">
          <h3>Earnings Overview</h3>
          <div className="earnings-stats">
            <div className="stat-card">
              <h4>Today's Earnings</h4>
              <p>₹{earningsData?.todayEarnings || 0}</p>
            </div>
            <div className="stat-card">
              <h4>Weekly Earnings</h4>
              <p>₹{earningsData?.weeklyEarnings || 0}</p>
            </div>
            <div className="stat-card">
              <h4>Services This Week</h4>
              <p>{earningsData?.servicesThisWeek || 0}</p>
            </div>
          </div>
        </div>
      </div>
      {/* OTP Popup for Arrived & Delivering */}
      {otpPopupOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, minWidth: 320, boxShadow: '0 2px 8px #0003', color: '#000' }}>
            <h2>Enter OTP from Customer</h2>
            <input
              type="text"
              value={otpInput}
              onChange={e => setOtpInput(e.target.value)}
              placeholder="Enter OTP"
              style={{ width: '100%', padding: 8, marginBottom: 8 }}
            />
            {otpError && <p style={{ color: 'red', margin: 0 }}>{otpError}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary" onClick={() => verifyOtp(otpInput)}>Verify OTP</button>
              <button className="btn" onClick={() => setOtpPopupOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryDashboard;