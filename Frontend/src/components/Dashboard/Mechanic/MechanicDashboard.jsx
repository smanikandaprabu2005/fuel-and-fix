import React, { useState, useEffect, useCallback, Component, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getUserId, getProviderEarnings } from '../../../services/authService';

// Create an audio context only when needed
let audioContext = null;

// Error Boundary Component
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('MechanicDashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong.</h2>
          <p>Please refresh the page or contact support if the issue persists.</p>
          <button onClick={() => window.location.reload()}>Refresh Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

import { 
  listenForRequests, 
  listenForRequestLock, 
  stopListeningForRequests,
  acceptServiceRequest,
  updateServiceStatus,
  updateProviderLocation,
  connectSocket,
  socket // Add socket import
} from '../../../services/socket';
import Map from '../Map';
import DashboardHeader from '../common/DashboardHeader';
import ServiceNotification from '../common/ServiceNotification';
import ServiceTracking from '../ServiceTracking';
import './MechanicDashboard.css';
import useBlockUnloadOnActiveRequest from '../../../hooks/useBlockUnloadOnActiveRequest';
import api from "../../../services/api"; // adjust path if needed

// Haversine formula to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

const ServiceTypeIcons = {
  'engine': '🔧',
  'battery': '🔋',
  'tires': '🛞',
  'towing': '🚛',
  'general': '⚙️'
};

const MechanicDashboard = ({ providerId }) => {
  const { currentUser } = useAuth();
  const [isAvailable, setIsAvailable] = useState(true);
  const [activeRequests, setActiveRequests] = useState([]);
  const [currentRequest, setCurrentRequest] = useState(null);
  const [requestHistory, setRequestHistory] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [mapKey, setMapKey] = useState(0); // Add this to force map re-render when needed
  const [serviceTypes, setServiceTypes] = useState([
    'engine',
    'battery',
    'tires',
    'towing',
    'general'
  ]);
  const [selectedServices, setSelectedServices] = useState(serviceTypes);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  // Track status update loading state
  const [statusLoading, setStatusLoading] = useState(false);
  const [otpPopupOpen, setOtpPopupOpen] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [serviceOtp, setServiceOtp] = useState('');
  const [amountPopupOpen, setAmountPopupOpen] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [amountError, setAmountError] = useState('');
  const [addressMap, setAddressMap] = useState({});
const getAddressFromCoords = async (lat, lng) => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
    );
    const data = await res.json();
    console.log("📍 Reverse geocode result:", data);
    return data.display_name || "Unknown location";
  } catch (err) {
    console.error("Reverse geocoding error:", err);
    return "Unknown location";
  }
};

  // Fetch earnings data
  const [earningsData, setEarningsData] = useState(null);

useEffect(() => {
  const fetchEarningsData = async () => {
    const id = providerId || currentUser?._id;
    if (!id) {
      console.error("Provider ID is missing (no currentUser._id either)");
      return;
    }

    try {
      const res = await getProviderEarnings(id);
      console.log("📊 Earnings API Response:", res);
      setEarningsData(res);
    } catch (err) {
      console.error("Error fetching earnings", err);
    }
  };

  if (currentUser?._id) {
    fetchEarningsData();
  }
}, [currentUser]);

  // Prevent accidental refresh/close while a mechanic request is active
  useBlockUnloadOnActiveRequest(currentRequest, { role: 'mechanic' });


  // Handle user interaction
  useEffect(() => {
    const handleInteraction = () => {
      if (!userHasInteracted) {
        setUserHasInteracted(true);
        document.documentElement.setAttribute('data-user-interacted', 'true');
        // Initialize audio context on first interaction
        if (!audioContext) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
      }
    };

    // Add listeners for common user interactions
    const events = ['click', 'touchstart', 'keydown', 'scroll'];
    events.forEach(event => document.addEventListener(event, handleInteraction));

    return () => {
      events.forEach(event => document.removeEventListener(event, handleInteraction));
    };
  }, [userHasInteracted]);

  const handleNewRequest = useCallback((request) => {
    console.log('New request received in mechanic dashboard:', request);
    
    // Basic request validation
    if (!request || typeof request !== 'object') {
      console.error('Invalid request received:', request);
      return;
    }

    // For updates, we don't need _id and user
    const isUpdate = request.status && request.status !== 'pending';
    if (!isUpdate && (!request._id || !request.user)) {
      console.error('Missing ID or user for new request:', request);
      return;
    }

    // Validate required fields
    if (!request.serviceType) {
      console.error('Missing serviceType in request:', request);
      return;
    }

    // Log the full request for debugging
    console.log('Processing request with data:', request);

    // Validate location data
    if (!request.location || (!request.location.lat && !request.location.coordinates)) {
      console.error('Invalid location data in request:', request);
      return;
    }

    // Handle both MongoDB Point format and direct lat/lng format
    let lat, lng;
    if (request.location.type === 'Point' && Array.isArray(request.location.coordinates)) {
      // MongoDB Point format
      lng = parseFloat(request.location.coordinates[0]);
      lat = parseFloat(request.location.coordinates[1]);
    } else if (request.location.lat && request.location.lng) {
      // Direct lat/lng format
      lat = parseFloat(request.location.lat);
      lng = parseFloat(request.location.lng);
    } else {
      console.error('Invalid location format in request:', request.location);
      return;
    }

    // Validate coordinates
    if (isNaN(lat) || isNaN(lng) || 
        lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      console.error('Invalid coordinate values:', { lat, lng });
      return;
    }

    // Update request with properly formatted location
    request.location = {
      lat: lat,
      lng: lng,
      address: request.location.address || ''
    };

    // Calculate distance if mechanic location is available
    if (currentLocation) {
      const distance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        lat,
        lng
      );
      request.distance = distance;
    } else {
      request.distance = 0;
    }

    // Check if mechanic is available and request matches their services
    if (isAvailable && 
        request.serviceType === 'mechanical' && 
        request.status === 'pending' &&
        selectedServices.includes(request.mechanicalType || 'general')) {
      
      console.log('Request matches mechanic criteria, adding to active requests');
      
      setActiveRequests(prev => {
        // Check if request already exists
        if (!prev.some(r => r._id === request._id)) {
          try {
            // Use Web Audio API for more reliable sound playback
            if (audioContext && userHasInteracted) {
              const oscillator = audioContext.createOscillator();
              const gainNode = audioContext.createGain();
              
              oscillator.type = 'sine';
              oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
              gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
              
              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);
              
              oscillator.start(audioContext.currentTime);
              oscillator.stop(audioContext.currentTime + 0.2);
            }
          } catch (err) {
            console.warn('Failed to play notification sound:', err);
          }
          
          return [...prev, request];
        }
        return prev;
      });
    } else {
      console.log(
        'Request filtered out:',
        `isAvailable: ${isAvailable}`,
        `serviceType: ${request.serviceType}`,
        `status: ${request.status}`,
        `mechanicalType: ${request.mechanicalType}`,
        `selectedServices: ${selectedServices.join(', ')}`
      );
    }
  }, [isAvailable, selectedServices]);

  // Request lock handler is defined later (to avoid duplicate declaration).
  // The later implementation also clears the currentRequest and stops location tracking.
  // Start tracking location
  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported');
      return;
    }

    // Create a Web Audio context for notification sound
    let audioContext;
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (err) {
      console.warn('Web Audio API not supported');
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          coordinates: [position.coords.longitude, position.coords.latitude],
          accuracy: position.coords.accuracy,
          timestamp: Date.now()
        };
        console.log('Updated mechanic location:', location);
        
        // Update local state
        setCurrentLocation(prevLocation => {
          // Only update if position has changed significantly (more than 10 meters)
          if (!prevLocation || calculateDistance(
            prevLocation.lat,
            prevLocation.lng,
            location.lat,
            location.lng
          ) > 0.01) {
            // Always emit location updates if mechanic has an active request
            if (currentUser?._id && currentRequest?._id) {
              const timestamp = Date.now();
              const locationData = {
                lat: location.lat,
                lng: location.lng,
                providerId: currentUser._id,
                providerType: 'mechanic',
                timestamp: timestamp
              };
              
              // Send update through the socket service
              updateProviderLocation(currentRequest._id, locationData);
              
              console.log('Location update sent for request:', {
                requestId: currentRequest._id,
                location: locationData
              });
            }
            return location;
          }
          return prevLocation;
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            console.error('Location access denied. Please enable location services.');
            break;
          case error.POSITION_UNAVAILABLE:
            console.error('Location information unavailable. Please check GPS signal.');
            break;
          case error.TIMEOUT:
            console.error('Location request timed out. Retrying...');
            // Clean up old watch
            if (watchId) {
              navigator.geolocation.clearWatch(watchId);
            }
            // Retry after timeout
            setTimeout(startLocationTracking, 5000);
            break;
          default:
            console.error('Error getting location:', error);
        }
      },
      {
        enableHighAccuracy: false, // Set to false for better performance
        timeout: 30000, // Increase timeout
        maximumAge: 30000 // Allow using slightly older positions
      }
    );
    setWatchId(id);
  }, [currentRequest, currentUser, isAvailable]);

  // Stop tracking location
  const stopLocationTracking = useCallback(() => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  }, [watchId]);

  // Create stable event handler references
  const handleRequestSocket = useCallback((request) => {
    console.log('Received new request in mechanic dashboard:', request);
    if (request && isAvailable) {
      handleNewRequest(request);
    }
  }, [handleNewRequest, isAvailable]);

  const handleRequestLockEvent = useCallback((requestId) => {
    console.log('Request locked:', requestId);
    setActiveRequests(prev => prev.filter(r => r._id !== requestId));
    if (currentRequest?._id === requestId) {
      setCurrentRequest(null);
      stopLocationTracking();
    }
  }, [currentRequest, stopLocationTracking]);

  const handleReconnect = useCallback(() => {
    console.log('Socket reconnected');
    if (currentUser?._id) {
      socket.emit('joinRoom', { userId: currentUser._id, role: 'mechanic' });
    }
  }, [currentUser]);

  // Initialize socket listeners
  useEffect(() => {
    if (!currentUser) return;

    let isSubscribed = true;
    let socketInitialized = false;
    
    const initializeDashboard = async () => {
      if (!isSubscribed) return;
      console.log('Initializing mechanic dashboard for user:', currentUser._id);

      try {
        // Connect socket and join mechanic room
        await connectSocket(currentUser._id, 'mechanic');

        if (!isSubscribed) return;

        // Clean up any existing listeners before setting up new ones
        stopListeningForRequests();

        // Set up new listeners
        listenForRequests(handleRequestSocket);
        listenForRequestLock(handleRequestLockEvent);

        // Handle reconnection
        const handleReconnect = () => {
          if (!isSubscribed) return;
          console.log('Socket reconnected');
          socket.emit('joinRoom', { userId: currentUser._id, role: 'mechanic' });
        };

        socket.on('connect', handleReconnect);

        // Get initial location
        if (navigator.geolocation) {
          try {
            const position = await new Promise((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject);
            });

            if (!isSubscribed) return;

            const location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              coordinates: [position.coords.longitude, position.coords.latitude],
              accuracy: position.coords.accuracy,
              timestamp: Date.now()
            };
            console.log('Initial mechanic location:', location);
            setCurrentLocation(location);

            // Start location tracking if there's an active request
            if (currentRequest?._id) {
              startLocationTracking();
            }
          } catch (error) {
            console.error('Error getting initial location:', error);
          }
        }

      } catch (error) {
        console.error('Failed to initialize dashboard:', error);
      }
    };

    // Initialize dashboard
    initializeDashboard();

    return () => {
      console.log('Cleaning up mechanic dashboard');
      isSubscribed = false;
      
      // Stop location tracking
      stopLocationTracking();
      
      // Clean up socket
      stopListeningForRequests();
      if (socket) {
        socket.removeAllListeners('connect');
      }
    };
  }, [currentUser, currentRequest, handleNewRequest, handleRequestLockEvent, stopLocationTracking, stopListeningForRequests]);

  const handleAcceptRequest = async (request) => {
    try {
      console.log('Accepting request:', request._id);
      await acceptServiceRequest(request._id, currentUser._id, 'mechanical');
      setCurrentRequest(request);
      setActiveRequests(prev => prev.filter(req => req._id !== request._id));
      console.log('Starting location tracking for request:', request._id);
      // Start location tracking immediately
      if (navigator.geolocation) {
        startLocationTracking();
        // Also send initial location update
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          coordinates: [position.coords.longitude, position.coords.latitude],
          accuracy: position.coords.accuracy,
          timestamp: Date.now()
        };
        updateProviderLocation(request._id, {
          ...location,
          providerId: currentUser._id,
          providerType: 'mechanic',
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  };
useEffect(() => {
  const loadPastRequests = async () => {
    try {
      const res = await api.get(`/mechanic/${currentUser?._id}/requests`);
      setRequestHistory(res.data);
      console.log("📦 Loaded past request history:", res.data);
    } catch (err) {
      console.error("❌ Failed to load past requests", err);
    }
  };

  if (currentUser?._id) loadPastRequests();
}, [currentUser?._id]);

  // Real-time status update listener
  useEffect(() => {
    if (!currentRequest) return;
    const handler = (data) => {
      if (data && data.requestId === currentRequest._id && data.status) {
        // Merge status into current request
             setCurrentRequest(prev =>
        prev ? { ...prev, status: data.status, payment: data.payment || prev.payment } : prev
      );        if (data.status === 'completed') {
          // Ensure payment data from server is attached to history item
          const completedReq = {
            ...currentRequest,
            status: 'completed',
            payment: data.payment || currentRequest.payment,
            completedAt: new Date().toISOString()
          };
          setRequestHistory(prev => [completedReq, ...prev]);
          console.log("✅ Added completed request:", completedReq);

          setCurrentRequest(null);
          stopLocationTracking();
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
useEffect(() => {
  const fetchAddresses = async () => {
    console.log("🧾 requestHistory:", requestHistory);
    const newAddressMap = {};
    for (const req of requestHistory) {
      if (req.location?.coordinates) {
        const [lng, lat] = req.location.coordinates;
        const addr = await getAddressFromCoords(lat, lng);
        newAddressMap[req._id] = addr;
      }
    }
    setAddressMap(newAddressMap);
  };
console.log("🧾 requestHistory:", requestHistory);
  if (requestHistory.length > 0) {
    fetchAddresses();
  }
}, [requestHistory]);
  const handleStatusUpdate = async (status) => {
    if (!currentRequest) return;
    setStatusLoading(true);
    try {
      // If completing, provide distanceMeters so backend can compute fare
      if (status === 'completed') {
        // For completion, open amount popup so mechanic can enter final amount
        // If distance available, still compute meters to include for server fallback
        let meters = undefined;
        if (currentLocation && currentRequest.location) {
          const userLat = currentRequest.location.lat ?? currentRequest.location.coordinates?.[1];
          const userLng = currentRequest.location.lng ?? currentRequest.location.coordinates?.[0];
          const provLat = currentLocation.lat;
          const provLng = currentLocation.lng;
          const km = calculateDistance(provLat, provLng, userLat, userLng);
          meters = Math.round(km * 1000);
        }
        // Show amount modal — mechanic will confirm amount which triggers actual status update
        setAmountInput('');
        setAmountError('');
        setAmountPopupOpen(true);
        setStatusLoading(false); // pause loading until mechanic confirms
        return;
      } else {
        await updateServiceStatus(currentRequest._id, status);
      }
      // UI will update via real-time listener
    } catch (error) {
      setStatusLoading(false);
      console.error('Error updating status:', error);
    }
  };

  const confirmCompletionWithAmount = async () => {
    // Validate amountInput
    const parsed = parseFloat(amountInput);
    if (isNaN(parsed) || parsed <= 0) {
      setAmountError('Please enter a valid amount greater than 0');
      return;
    }
    setAmountError('');
    setAmountPopupOpen(false);
    setStatusLoading(true);
    try {
      // compute meters if available for fallback
      let meters = undefined;
      if (currentLocation && currentRequest?.location) {
        const userLat = currentRequest.location.lat ?? currentRequest.location.coordinates?.[1];
        const userLng = currentRequest.location.lng ?? currentRequest.location.coordinates?.[0];
        const provLat = currentLocation.lat;
        const provLng = currentLocation.lng;
        const km = calculateDistance(provLat, provLng, userLat, userLng);
        meters = Math.round(km * 1000);
      }
      await updateServiceStatus(currentRequest._id, 'completed', meters, parsed);
      // UI will update via socket listener; optionally navigate after short delay
      setTimeout(() => {
        setStatusLoading(false);
      }, 800);
    } catch (err) {
      console.error('Error completing with amount:', err);
      setStatusLoading(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLocationTracking();
    };
  }, [stopLocationTracking]);

  // Removed duplicate effect as it's now handled in the main initialization effect

  const toggleServiceType = (type) => {
    setSelectedServices(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  // Listen for OTP from backend
  useEffect(() => {
    if (!currentRequest) return;
    const handler = (data) => {
      if (data && data.serviceRequestId === currentRequest._id && data.otp) {
        setServiceOtp(data.otp);
      }
    };
    socket.on('serviceOtp', handler);
    return () => {
      socket.off('serviceOtp', handler);
    };
  }, [currentRequest]);

  // OTP verification
  const verifyOtp = async (otp) => {
    if (otp === serviceOtp) {
      setOtpPopupOpen(false);
      setOtpError('');
      handleStatusUpdate('in-progress');
    } else {
      setOtpError('Invalid OTP. Please try again.');
    }
  };

  return (
    <div className="dashboard mechanic-dashboard">
      <DashboardHeader title="Mechanic Dashboard" role="mechanic" />
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
              {isAvailable ? 'Available for Service' : 'Not Available'}
            </span>
          </div>
          <div className="service-types">
            <h4>Service Types</h4>
            <div className="service-type-toggles">
              {serviceTypes.map(type => (
                <button
                  key={type}
                  className={`service-type-btn ${selectedServices.includes(type) ? 'active' : ''}`}
                  onClick={() => toggleServiceType(type)}
                >
                  <span className="service-icon">{ServiceTypeIcons[type]}</span>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
          
          {/* Remove initial map before accepting a request */}
        </div>

        {currentRequest ? (
          <div className="current-request">
            <h3>Current Service</h3>
            <div className="request-details">
              <div className="request-info">
                <h4>Service Details</h4>
                <p>Type: {currentRequest.mechanicalType}</p>
                <p>Location: {currentRequest.location.address}</p>
                <p>Description: {currentRequest.description}</p>
                <p>Status: {currentRequest.status}</p>
              </div>
              {currentRequest.images?.length > 0 && (
                <div className="request-images">
                  <h4>Issue Images</h4>
                  <div className="image-grid">
                    {currentRequest.images.map((image, index) => (
                      <img 
                        key={index}
                        src={image.url}
                        alt={`Issue ${index + 1}`}
                        onClick={() => window.open(image.url, '_blank')}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="status-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => handleStatusUpdate('on-way')}
                  disabled={statusLoading}
                >
                  Start Journey
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setOtpPopupOpen(true)}
                  disabled={statusLoading}
                >
                  Start Service
                </button>
                <button
                  className="btn btn-success"
                  onClick={() => {
                    // Open amount modal flow handled by handleStatusUpdate
                    handleStatusUpdate('completed');
                  }}
                  disabled={statusLoading || currentRequest.status !== 'in-progress'}
                >
                  Complete Service
                </button>
              </div>
              <div className="service-map">
                <ServiceTracking
                  serviceRequest={currentRequest}
                  userLocation={currentRequest.location}
                  providerLocation={currentLocation}
                  role="mechanic"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="service-requests">
            <h3>Available Requests</h3>
            <div className="request-list">
              {activeRequests.length > 0 ? (
                activeRequests.map(request => (
                  <div key={request._id} className="request-card">
                    <div className="request-info">
                      <div className="service-type">
                        <span className="service-icon">
                          {ServiceTypeIcons[request.mechanicalType || 'general']}
                        </span>
                        {(request.mechanicalType || 'general').charAt(0).toUpperCase() + (request.mechanicalType || 'general').slice(1)}
                      </div>
                      <p>Distance: {typeof request.distance === 'number' ? `${request.distance.toFixed(1)} km` : 'Calculating...'}</p>
                      <p className="description">{request.description}</p>
                      {request.images?.length > 0 && (
                        <p>Images: {request.images.length} attached</p>
                      )}
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
                <p>No active service requests</p>
              )}
            </div>
          </div>
        )}

<div className="service-history">
  <h3>Recent Services</h3>
  <div className="history-list">
    {earningsData?.recentServices?.length > 0 ? (
      earningsData.recentServices.map((service) => (
        <div key={service._id} className="history-card">
          <div className="history-header">
            <span className="service-icon">
              {ServiceTypeIcons[service.mechanicalType] || "🔧"}
            </span>
            <span className="service-date">
              {new Date(service.date).toLocaleDateString()}
            </span>
          </div>
          <p className="service-type">
            {service.mechanicalType
              ? service.mechanicalType.charAt(0).toUpperCase() +
                service.mechanicalType.slice(1)
              : "Service"}
          </p>
          <p>Location: {addressMap[service._id] || "unknown"}</p>


          <p>Earnings: ₹{service.payment?.amount ?? 0}</p>
        </div>
      ))
    ) : (
      <p>No recent services</p>
    )}
  </div>
</div>

        <div className="earnings-section">
          <h3>Earnings Overview</h3>
          <div className="earnings-stats">
            <div className="stat-card">
              <h4>Today's Earnings</h4>
              <p>₹{earningsData?.todayEarnings ?? 0}</p>
            </div>
            <div className="stat-card">
              <h4>Weekly Earnings</h4>
              <p>₹{earningsData?.weeklyEarnings ?? 0}</p>
            </div>
            <div className="stat-card">
              <h4>Services This Week</h4>
              <p>{earningsData?.recentServices?.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* OTP Popup for Start Service */}
      {otpPopupOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, minWidth: 320, boxShadow: '0 2px 8px #0003', color: '#000' }}>
            <h2>Enter OTP from User</h2>
            {/* No demo OTP shown here! Mechanic must get OTP from user */}
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

      {/* Amount entry popup for completing service */}
      {amountPopupOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, minWidth: 320, boxShadow: '0 2px 8px #0003' }}>
            <h2>Enter final amount for this service</h2>
            <input
              type="number"
              value={amountInput}
              onChange={e => setAmountInput(e.target.value)}
              placeholder="Amount (e.g., 250)"
              style={{ width: '100%', padding: 8, marginBottom: 8 }}
            />
            {amountError && <p style={{ color: 'red', margin: 0 }}>{amountError}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary" onClick={confirmCompletionWithAmount}>Confirm & Complete</button>
              <button className="btn" onClick={() => setAmountPopupOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Wrap the component with ErrorBoundary
const MechanicDashboardWithErrorBoundary = () => (
  <ErrorBoundary>
    <MechanicDashboard />
  </ErrorBoundary>
);

export default MechanicDashboardWithErrorBoundary;