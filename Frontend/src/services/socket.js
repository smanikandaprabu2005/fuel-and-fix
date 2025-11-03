import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

const socket = io(SOCKET_URL, { 
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10,
  auth: {
    token: localStorage.getItem('token')
  }
});

// Handle token refresh events
socket.on('token:refresh', ({ token }) => {
  if (token) {
    localStorage.setItem('token', token);
    socket.auth.token = token;
    // Update the socket connection with new token
    socket.disconnect().connect();
  }
});

export { socket };
export default socket;

let currentUserId = null;
let currentRole = null;
let isConnecting = false;

export function connectSocket(userId, role) {
  return new Promise((resolve, reject) => {
    try {
      // Validate parameters
      if (!userId) {
        reject(new Error('UserId is required'));
        return;
      }
      
      if (!role || !['user', 'mechanic', 'delivery', 'admin'].includes(role)) {
        reject(new Error('Valid role is required (user, mechanic, delivery, or admin)'));
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        reject(new Error('No authentication token found'));
        return;
      }

      // If already connecting or connected with same credentials, return existing connection
      if (isConnecting || (socket.connected && userId === currentUserId && role === currentRole)) {
        resolve(socket);
        return;
      }

      // Clean up existing connection if user/role changed
      if (socket.connected && (userId !== currentUserId || role !== currentRole)) {
        console.log('Cleaning up existing socket connection');
        socket.removeAllListeners();
        socket.disconnect();
      }

      currentUserId = userId;
      currentRole = role;
      isConnecting = true;

      // Set auth data (send raw JWT token; server will accept this)
      socket.auth = {
        token: token,
        userId,
        role
      };

      // Try to include approximate coordinates in the handshake query so server can register provider location
      try {
        if (typeof navigator !== 'undefined' && navigator.geolocation && socket.io) {
          navigator.geolocation.getCurrentPosition((pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            // socket.io client stores handshake query in io.opts.query
            socket.io.opts.query = socket.io.opts.query || {};
            socket.io.opts.query.coords = `${lat},${lng}`;
            console.debug('Set socket handshake coords for provider registration:', socket.io.opts.query.coords);
          }, (err) => {
            console.warn('Could not get initial geolocation for socket handshake:', err && err.message);
          }, { maximumAge: 30000, timeout: 5000 });
        }
      } catch (e) {
        console.warn('Error setting handshake coords:', e);
      }

      // Handle connection events
      const handleConnect = () => {
        console.log(`Socket connected successfully for ${role} ${userId}`);
        // Join role-specific room
        socket.emit('joinRoom', { userId, role });
        // If this is a provider, try to register coordinates explicitly for proximity searches
        try {
          if (role === 'mechanic' || role === 'delivery') {
            if (navigator && navigator.geolocation) {
              navigator.geolocation.getCurrentPosition((pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                socket.emit('providerRegister', { providerId: userId, role, coords: [lat, lng] });
                console.debug('Emitted providerRegister with coords', lat, lng);
              }, (e) => {
                console.warn('Could not get geolocation for providerRegister:', e && e.message);
              }, { maximumAge: 30000, timeout: 5000 });
            }
          }
        } catch (e) {
          console.warn('Error emitting providerRegister:', e);
        }
        console.log(`Joining room for ${role} ${userId}`);

        // Debug: capture any incoming events to help trace missing broadcasts
        try {
          if (socket.offAny) socket.offAny();
          if (socket.onAny) {
            socket.onAny((event, ...args) => {
              console.log('[socket.onAny] Received event:', event, 'args:', args);
            });
          }
        } catch (e) {
          console.warn('onAny/offAny not supported in this socket instance', e);
        }
        // Debug: how many listeners are registered for newRequest at connect
        try {
          const listeners = socket.listeners ? socket.listeners('newRequest') : null;
          console.log('Listener count for newRequest at connect:', listeners ? listeners.length : 'n/a');
        } catch (err) {
          console.warn('Could not read listeners count at connect:', err);
        }

        resolve(socket);
      };

      const handleConnectError = (error) => {
        console.error('Socket connection error:', error);
        reject(error);
      };

      // Remove any existing listeners before setting up new ones
      socket.removeAllListeners('connect');
      socket.removeAllListeners('connect_error');
      socket.removeAllListeners('disconnect');

      socket.once('connect', handleConnect);
      socket.once('connect_error', handleConnectError);

      // Handle disconnection with exponential backoff
      let reconnectAttempt = 0;
      const maxReconnectAttempts = 5;
      
      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        
        // Don't reconnect if client explicitly closed the connection
        if (reason === 'io client disconnect') return;
        
        // Implement exponential backoff for reconnection
        if (reconnectAttempt < maxReconnectAttempts) {
          const backoffTime = Math.min(1000 * Math.pow(2, reconnectAttempt), 10000);
          console.log(`Attempting to reconnect in ${backoffTime}ms...`);
          
          setTimeout(() => {
            if (socket.disconnected) {
              console.log('Attempting reconnection...');
              socket.connect();
              reconnectAttempt++;
            }
          }, backoffTime);
        } else {
          console.error('Max reconnection attempts reached');
        }
      });

      // Initiate connection
      console.log(`Initiating socket connection for ${role} ${userId}`);
      socket.connect();

    } catch (error) {
      console.error('Error in connectSocket:', error);
      reject(error);
    }
  });
}

export function updateProviderLocation(serviceRequestId, location) {
  if (socket && socket.connected) {
    // Emit location update event with all necessary data
    socket.emit('locationUpdate', {
      serviceRequestId,
      location: {
        ...location,
        timestamp: Date.now()
      }
    });
    console.log('Emitted location update:', {
      serviceRequestId,
      location: {
        ...location,
        timestamp: Date.now()
      }
    });
  } else {
    console.error('Socket not connected while trying to update location');
  }
}

// Listen for provider location updates
export function listenForProviderLocation(serviceRequestId, callback) {
  socket.on('providerLocationUpdate', (data) => {
    try {
      // Compare IDs as strings to avoid ObjectId vs string mismatches
      const incomingId = data && data.serviceRequestId ? String(data.serviceRequestId) : null;
      const targetId = serviceRequestId ? String(serviceRequestId) : null;
      if (incomingId && targetId && incomingId === targetId) {
        console.log('[socket] providerLocationUpdate matched for request:', incomingId, 'location:', data.location);
        callback(data.location);
      }
    } catch (e) {
      console.warn('Error comparing provider location IDs:', e, data, serviceRequestId);
    }
  });
}

// Stop listening for provider location updates
export function stopListeningForProviderLocation() {
  socket.off('providerLocationUpdate');
}

export function setupLocationTracking() {
  let watchId = null;

  if (!('geolocation' in navigator)) {
    console.error('Geolocation is not supported by your browser');
    return null;
  }

  const handleSuccess = (position) => {
    const location = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };
    socket.emit('updateLocation', location);
  };

  const handleError = (error) => {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        console.error('Location permission denied by user.');
        alert('This app requires location access to function properly. Please enable location services and refresh the page.');
        break;
      case error.POSITION_UNAVAILABLE:
        console.error('Location information is unavailable.');
        alert('Unable to get your location. Please check your device settings.');
        break;
      case error.TIMEOUT:
        console.error('Location request timed out.');
        alert('Location request timed out. Please check your internet connection.');
        break;
      default:
        console.error('An unknown error occurred getting location:', error);
        alert('Unable to get your location. Please try refreshing the page.');
    }
  };

  const options = {
    enableHighAccuracy: false, // Set to false for faster initial response
    timeout: 30000, // Increased timeout
    maximumAge: 30000 // Cache position for longer
  };

  let retryCount = 0;
  const maxRetries = 3;

  const getLocation = () => {
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (error) => {
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying location request (${retryCount}/${maxRetries})...`);
          setTimeout(getLocation, 2000); // Retry after 2 seconds
        } else {
          handleError(error);
        }
      },
      options
    );
  };

  // Get initial position with retries
  getLocation();

  // Then start watching for changes with less strict options
  const watchOptions = {
    ...options,
    enableHighAccuracy: true, // Enable high accuracy for continuous updates
    maximumAge: 5000 // More frequent updates while watching
  };

  watchId = navigator.geolocation.watchPosition(
    handleSuccess,
    handleError,
    watchOptions
  );

  // Return cleanup function
  return () => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    socket.off('disconnect');
  };
}

// Service request events
export async function broadcastServiceRequest(requestData) {
  try {
    if (!requestData) {
      throw new Error('Invalid request data for broadcasting');
    }

    if (!socket) {
      throw new Error('Socket not initialized');
    }

    // Ensure socket is connected before broadcasting
    if (!socket.connected) {
      console.log('Socket not connected, attempting to connect...');
      // Try to get user ID and role from request data
      const userId = requestData.user;
      if (!userId) {
        throw new Error('Cannot connect socket: missing user ID');
      }
      await connectSocket(userId, 'user');
    }

    console.log('Socket status: Connected, ID:', socket.id);
    
    // Extract data from the serviceRequest object if it exists
    const serviceData = requestData.serviceRequest || requestData;
    
    // Safely extract and format location data
    const location = serviceData.location || {};
    const formattedLocation = {
      lat: parseFloat(location.lat) || null,
      lng: parseFloat(location.lng) || null,
      address: location.address || ''
    };

    const broadcastPayload = {
      _id: serviceData._id,  // Use _id consistently
      serviceType: serviceData.serviceType || 'unknown',
      location: formattedLocation,
      description: serviceData.description || '',
      status: serviceData.status || 'pending',
      user: serviceData.user || null,  // Use user consistently
      mechanicalType: serviceData.mechanicalType || 'general'
    };

    // Add optional fields if they exist
    if (requestData.mechanicalType) {
      broadcastPayload.mechanicalType = requestData.mechanicalType;
    }
    if (requestData.fuelDetails) {
      broadcastPayload.fuelDetails = requestData.fuelDetails;
    }
    
      console.log('Broadcasting service request with payload:', {
        ...broadcastPayload,
        location: {
          lat: typeof broadcastPayload.location.lat,
          lng: typeof broadcastPayload.location.lng,
          values: broadcastPayload.location
        }
      });
      socket.emit('newServiceRequest', broadcastPayload);    // Listen for acknowledgment
    socket.once('serviceRequestReceived', (response) => {
      console.log('Service request broadcast acknowledged:', response);
    });

    // Listen for provider responses
    if (requestData._id) {
      socket.on(`requestResponse:${requestData._id}`, (providerResponse) => {
        console.log('Provider response received:', providerResponse);
      });
    }
  } catch (error) {
    console.error('Error in broadcastServiceRequest:', error);
  }
}

export function acceptServiceRequest(requestId, providerId, providerType) {
  if (socket && socket.connected) {
    socket.emit('acceptRequest', { requestId, providerId, providerType });
    console.log('Accepting service request:', { requestId, providerId, providerType });
  } else {
    console.error('Socket not connected for accepting request');
  }
}

export function updateServiceStatus(requestId, status, distanceMeters = undefined, paymentAmount = undefined) {
  if (socket && socket.connected) {
    const payload = { requestId, status };
    if (typeof distanceMeters === 'number') payload.distanceMeters = distanceMeters;
    if (typeof paymentAmount === 'number' && !isNaN(paymentAmount)) payload.paymentAmount = paymentAmount;
    socket.emit('updateStatus', payload);
    console.log('Updating service status with payload:', payload);
  } else {
    console.error('Socket not connected for status update');
  }
}

// Provider events
export function listenForRequests(callback) {
  if (!socket) {
    console.error('Socket not initialized for listening to requests');
    return;
  }
  
  console.log('Setting up request listener');
  
  // Remove any existing listeners to prevent duplicates
  socket.off('newRequest');

  // Central handler reused by both on('newRequest') and onAny fallback
  const handleIncomingRequest = (data) => {
    try {
      // Log full data for debugging
      console.log('New request received in socket listener (handleIncomingRequest):', JSON.stringify(data, null, 2));
      
      // Basic validation
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid request data format');
      }

      // Handle different data structures
      const requestData = data.serviceRequest || data;
      
      // Extract and validate fields with better error messages
      const validatedData = {
        _id: requestData._id || requestData.id || requestData.requestId,
        user: requestData.userId || requestData.user,
        serviceType: requestData.serviceType,
        status: requestData.status || 'pending',
        mechanicalType: requestData.mechanicalType || 'general',
        description: requestData.description || '',
        distance: requestData.distance
      };

      // Only validate _id and user if this is a new request (not an update)
      const isNewRequest = !requestData.status || requestData.status === 'pending';
      
      // Collect missing fields
      const missingFields = [];
      if (isNewRequest) {
        if (!validatedData._id) missingFields.push('_id/id/requestId');
        if (!validatedData.user) missingFields.push('userId/user');
      }
      if (!validatedData.serviceType) missingFields.push('serviceType');
      
      // Log validation state
      console.log('Validation state:', {
        isNewRequest,
        hasId: !!validatedData._id,
        hasUserId: !!validatedData.user,
        status: validatedData.status
      });
      
      if (missingFields.length > 0) {
        // If it's a status update, continue without user/id
        if (!isNewRequest && missingFields.every(f => f.includes('id'))) {
          console.log('Accepting request update without ID/user fields');
        } else {
          throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
      }

      // Normalize and validate location
      const location = requestData.location || {};
      
      // Parse coordinates with better error handling
      let lat, lng;
      
      if (location.coordinates && Array.isArray(location.coordinates)) {
        [lng, lat] = location.coordinates.map(Number);
      } else {
        lat = Number(location.lat);
        lng = Number(location.lng);
      }

      // Validate coordinates
      if (isNaN(lat) || isNaN(lng)) {
        console.warn('Invalid coordinates received:', location);
        throw new Error('Invalid location coordinates');
      }

      // Create normalized location object
      validatedData.location = {
        lat,
        lng,
        coordinates: [lng, lat],
        address: location.address || ''
      };

      // Preserve fuelDetails if provided by the server; parse if necessary
      if (requestData.fuelDetails) {
        try {
          validatedData.fuelDetails = typeof requestData.fuelDetails === 'string' ? JSON.parse(requestData.fuelDetails) : requestData.fuelDetails;
        } catch (e) {
          console.warn('Could not parse fuelDetails from requestData:', requestData.fuelDetails);
          validatedData.fuelDetails = { fuelType: requestData.fuelDetails };
        }
      }

      // Add additional request info
      validatedData.timestamp = requestData.timestamp || Date.now();
      validatedData.requestType = requestData.requestType || 'service';

      // Log validated data for debugging
      console.log('Validated request data:', validatedData);

      // Call the callback with validated data
      callback(validatedData);
    } catch (error) {
      console.error('Request validation failed:', error.message);
      console.warn('Invalid request data:', JSON.stringify(data, null, 2));
      return false; // Indicate validation failure
    }
  };

  // Attach normal event listener
  socket.on('newRequest', handleIncomingRequest);
  try {
    const listeners = socket.listeners ? socket.listeners('newRequest') : null;
    console.log('Listener count for newRequest after attach:', listeners ? listeners.length : 'n/a');
  } catch (err) {
    console.warn('Could not read listeners count after attach:', err);
  }

  // Fallback: some environments may deliver events before listeners attach; use onAny to call handler if no specific listeners present
  try {
    if (!socket.__hasNewRequestOnAny) {
      if (socket.onAny) {
        socket.onAny((event, ...args) => {
          if (event === 'newRequest') {
            // If there are no dedicated listeners (listener count === 0), call the handler
            const hasListeners = (socket.listeners && socket.listeners('newRequest') && socket.listeners('newRequest').length > 0);
            if (!hasListeners) {
              handleIncomingRequest(args[0]);
            }
          }
        });
        socket.__hasNewRequestOnAny = true;
      }
    }
  } catch (e) {
    console.warn('onAny fallback not available or failed:', e);
  }
}

export function listenForRequestLock(callback) {
  if (!socket) {
    console.error('Socket not initialized for listening to request locks');
    return;
  }

  console.log('Setting up request lock listener');
  socket.on('requestLocked', (data) => {
    console.log('Request lock received:', data);
    callback(data);
  });
}

export function stopListeningForRequests() {
  if (!socket) {
    console.error('Socket not initialized when trying to stop listeners');
    return;
  }

  console.log('Removing request listeners');
  socket.off('newRequest');
  socket.off('requestLocked');
  // Also remove any onAny fallback handler if it was installed
  try {
    if (socket.offAny) socket.offAny();
    // reset the internal flag so listeners can be reinstalled later
    socket.__hasNewRequestOnAny = false;
  } catch (e) {
    // offAny may not be supported in some environments
    console.warn('offAny not supported on this socket instance', e);
  }
}

// Tracking events
export function trackProvider(requestId, callback) {
  socket.on(`providerLocation:${requestId}`, callback);
}

export function stopTrackingProvider(requestId) {
  socket.off(`providerLocation:${requestId}`);
}

// Status updates
export function listenForStatusUpdates(requestId, callback) {
  socket.on(`statusUpdate:${requestId}`, callback);
}

export function stopStatusUpdates(requestId) {
  socket.off(`statusUpdate:${requestId}`);
}

