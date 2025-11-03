const app = require('./app');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { handleLocationUpdate, handleRequestAcceptance } = require('./eventHandlers/requestHandlers');
const config = require('./config/config');
const axios = require('axios');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
	cors: {
		origin: '*',
		methods: ['GET', 'POST']
	}
});

// make io available to routes via app
app.set('io', io);

// Socket authentication middleware
io.use((socket, next) => {
  const auth = socket.handshake.auth;
  let token = auth?.token;
  const userId = auth?.userId;
  const role = auth?.role;

  // Remove 'Bearer ' prefix if present
  try {
    // If token is an object (accidentally stored), attempt to extract string
    if (token && typeof token === 'object') {
      if (token.token) token = token.token;
      else token = String(token);
    }
    if (typeof token === 'string') {
      token = token.trim();
      // Strip surrounding quotes if present
      if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
        token = token.slice(1, -1).trim();
      }
      // If token contains spaces (e.g., 'Bearer <token>' or accidental duplicates), take last segment
      if (token.includes(' ')) {
        token = token.split(/\s+/).pop();
      }
    }
  } catch (e) {
    console.warn('Error normalizing token from handshake.auth:', e, 'rawAuth:', auth);
  }

  if (!token || !userId || !role) {
    console.error('Authentication error:', {
      hasToken: !!token,
      hasUserId: !!userId,
      hasRole: !!role,
      auth: auth
    });
    return next(new Error('Authentication error'));
  }

  try {
    if (!token) {
      console.error('Socket auth missing token. handshake.auth:', socket.handshake.auth, 'headers:', socket.handshake.headers);
      return next(new Error('Authentication error: missing token'));
    }
    // Debug: mask token to avoid leaking full token in logs
    const masked = token.length > 20 ? token.slice(0, 6) + '...' + token.slice(-6) : token;
    console.log('Verifying socket token (masked):', masked, 'userId:', userId, 'role:', role);
    const decoded = jwt.verify(token, config.jwtSecret);

    // Check if token is close to expiring and refresh if needed
    const exp = decoded.exp;
    const now = Math.floor(Date.now() / 1000);
    if (exp - now < 3600) { // Less than 1 hour remaining
      const newToken = jwt.sign(
        { user: decoded.user },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
      );
      // Emit the new token (raw JWT string) to the client for storage/refresh
      socket.emit('token:refresh', { token: newToken });
    }

    socket.user = {
      id: userId,
      role: role
    };

    if (decoded.user) {
      socket.user = {
        ...socket.user,
        ...decoded.user
      };
    }

    console.log('Socket authenticated:', {
      userId: socket.user.id,
      role: socket.user.role
    });

    next();
  } catch (err) {
    console.error('Token verification error:', err);
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  
  // Store user role from headers
  const userRole = socket.handshake.headers['x-user-role'];
  socket.userRole = userRole;
  
  console.log(`Socket ${socket.id} connected with role: ${userRole}`);

  // Join user to their role-specific room
  socket.on('joinRoom', ({ userId, role }) => {
    if (!userId || !role) {
      console.error('Invalid joinRoom data:', { userId, role });
      return;
    }

    // Clean up any existing rooms
    socket.rooms.forEach(room => {
      if (room !== socket.id) {
        socket.leave(room);
      }
    });

    // Join both the user-specific room and the role-specific room
    const userRoom = `${role}_${userId}`;
    socket.join(userRoom);
    socket.join(role);
    
    // Register provider in in-memory socket manager for proximity searches
    try {
      const socketManager = require('./socketManager');
      // If the socket provided coordinates during join, use them; otherwise leave undefined
      const coordsHeader = socket.handshake.query?.coords;
      let coords = undefined;
      if (coordsHeader) {
        const parts = coordsHeader.split(',').map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          // store as [lng, lat]
          coords = [parts[1], parts[0]];
        }
      }
      socketManager.registerProvider(userId, socket.id, role, coords);
    } catch (e) {
      console.warn('Failed to register provider in socketManager', e);
    }
    console.log(`User ${userId} joined rooms:`, {
      userRoom,
      roleRoom: role,
      socketRooms: Array.from(socket.rooms)
    });
  });

  // Handle location updates
  socket.on('locationUpdate', (data) => {
    try {
      console.log('Received location update:', data);
      handleLocationUpdate(socket, data);
    } catch (error) {
      console.error('Error handling location update:', error);
    }
  });

  // Allow client to explicitly register provider metadata (coords) after connect
  socket.on('providerRegister', ({ providerId, role, coords }) => {
    try {
      const socketManager = require('./socketManager');
      let coordinates = undefined;
      if (coords && Array.isArray(coords) && coords.length === 2) {
        // coords expected as [lat, lng]
        coordinates = [coords[1], coords[0]]; // store as [lng, lat]
      }
      socketManager.registerProvider(providerId || socket.user?.id, socket.id, role || socket.user?.role, coordinates);
      console.log('Provider registered via providerRegister', { providerId, role, coords, socketId: socket.id });
    } catch (e) {
      console.warn('Failed providerRegister handling', e);
    }
  });

  // Handle new service requests
  socket.on('newServiceRequest', async (requestData) => {
    try {
      console.log('Processing new service request:', {
        id: requestData._id,
        type: requestData.serviceType,
        status: requestData.status,
        location: requestData.location,
        mechanicalType: requestData.mechanicalType
      });
      
      // Validate request data
      if (!requestData || !requestData.serviceType) {
        throw new Error('Invalid request data');
      }

      // Send acknowledgment back to the sender
      socket.emit('serviceRequestReceived', { 
        status: 'received',
        requestId: requestData._id
      });

      // Prepare broadcast data
      const broadcastData = {
        _id: requestData._id,
        serviceType: requestData.serviceType,
        location: requestData.location,
        // Preserve fuel details when emitting so provider UIs can show fuel type/quantity
        fuelDetails: requestData.fuelDetails || null,
        description: requestData.description || '',
        status: requestData.status || 'pending',
        mechanicalType: requestData.mechanicalType,
        user: requestData.user,
        createdAt: requestData.createdAt
      };

      // Broadcast based on service type with validation
      if (requestData.serviceType === 'mechanical') {
        const mechanicRoom = io.sockets.adapter.rooms.get('mechanic');
        if (mechanicRoom && mechanicRoom.size > 0) {
          console.log('Broadcasting mechanical request to mechanics:', broadcastData._id);
          try {
            const members = Array.from(mechanicRoom);
            console.log('Mechanic room members:', members);
          } catch (e) {
            console.log('Mechanic room members: none');
          }
          io.to('mechanic').emit('newRequest', broadcastData);
        } else {
          console.log('No mechanics available in room');
        }
      } else if (requestData.serviceType === 'fuel') {
        const deliveryRoom = io.sockets.adapter.rooms.get('delivery');
        if (deliveryRoom && deliveryRoom.size > 0) {
          console.log('Broadcasting fuel request to delivery:', broadcastData._id);
          try {
            const members = Array.from(deliveryRoom);
            console.log('Delivery room members:', members);
          } catch (e) {
            console.log('Delivery room members: none');
          }
          io.to('delivery').emit('newRequest', broadcastData);
        } else {
          console.log('No delivery providers available in room');
        }
      }
    } catch (error) {
      console.error('Error broadcasting service request:', error);
      socket.emit('serviceRequestError', { error: error.message });
    }
  });

  // Handle location updates from providers
  socket.on('updateLocation', (location) => {
    handleLocationUpdate(socket, location);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Socket disconnected', socket.id);
    try {
      const socketManager = require('./socketManager');
      socketManager.unregisterSocket(socket.id);
    } catch (e) {
      console.warn('Error unregistering socket:', e);
    }
    if (socket.user) {
      socket.leave(`${socket.user.role}_${socket.user.id}`);
    }
  });

  // Handle service request acceptance
  // Handle service status updates from provider (mechanic)
  socket.on('updateStatus', async ({ requestId, status, distanceMeters, paymentAmount }) => {
    try {
      if (!requestId || !status) {
        socket.emit('statusUpdateError', { message: 'Missing requestId or status' });
        return;
      }
      const ServiceRequest = require('./models/ServiceRequest');
      const request = await ServiceRequest.findById(requestId);
      if (!request) {
        socket.emit('statusUpdateError', { message: 'Service request not found' });
        return;
      }
      // If completed, compute fare using Pricing and optional distanceMeters provided by client
      if (status === 'completed') {
        // Prefer explicit distanceMeters if provided by client (accept strings too)
        if (distanceMeters !== undefined && distanceMeters !== null) {
          const parsedMeters = parseFloat(distanceMeters);
          if (!isNaN(parsedMeters) && parsedMeters >= 0) {
            request.distanceMeters = parsedMeters;
          }
        }

        // Compute server-side distance from locationHistory if available
        let computedMeters = request.distanceMeters || 0;
        if ((!computedMeters || computedMeters === 0) && request.locationHistory && request.locationHistory.length > 1) {
          const pts = request.locationHistory;
          const haversine = (lat1, lon1, lat2, lon2) => {
            const R = 6371000; // metres
            const toRad = v => v * Math.PI / 180;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
          };
          let sum = 0;
          for (let i = 1; i < pts.length; i++) {
            const a = pts[i-1];
            const b = pts[i];
            sum += haversine(a.lat, a.lng, b.lat, b.lng);
          }
          computedMeters = Math.round(sum);
          request.distanceMeters = computedMeters;
        }

        const Pricing = require('./models/Pricing');
        let pricing = await Pricing.findOne().sort({ updatedAt: -1 }).exec();
        if (!pricing) {
          pricing = await Pricing.create({ pricePerKm: 7 });
        }

        // Dynamic Pricing Optimization
        // Example: Increase price during peak hours (6-9am, 6-9pm) by 20%
        const now = new Date();
        const hour = now.getHours();
        let dynamicMultiplier = 1;
        if ((hour >= 6 && hour <= 9) || (hour >= 18 && hour <= 21)) {
          dynamicMultiplier = 1.2;
        }
        // Example: Increase price by 10% if more than 5 active requests in the last hour (simple demand check)
        const ServiceRequest = require('./models/ServiceRequest');
        const recentRequests = await ServiceRequest.countDocuments({
          status: { $in: ['pending', 'accepted', 'on-way', 'in-progress'] },
          date: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
        });
        if (recentRequests > 5) dynamicMultiplier *= 1.1;

        // Example: Location-based adjustment (increase by 10% if in city center)
        if (request.location && request.location.coordinates) {
          const [lng, lat] = request.location.coordinates;
          if (lat > 18.5 && lat < 19.0 && lng > 73.7 && lng < 74.0) {
            dynamicMultiplier *= 1.1;
          }
        }

        // Fetch current live petrol/diesel price for fuel delivery requests
        let liveFuelPrice = pricing.fuelPricePerLitre;
        if (request.serviceType === 'fuel') {
          try {
            // Example API: https://api.api-ninjas.com/v1/fuelprice?city=Mumbai
            // You need to register and get an API key for a real service
            // For demo, we'll use a static value or mock fetch
            // const response = await fetch('https://api.api-ninjas.com/v1/fuelprice?city=Mumbai', { headers: { 'X-Api-Key': process.env.FUEL_API_KEY } });
            // const data = await response.json();
            // liveFuelPrice = data.petrol || pricing.fuelPricePerLitre;
            // For now, simulate with a random price between 95 and 110
            liveFuelPrice = Math.round((95 + Math.random() * 15) * 100) / 100;
          } catch (e) {
            console.warn('Failed to fetch live fuel price, using default:', e);
          }
        }

        // Compute amount from distance/pricing by default, with dynamic multiplier
        const distanceKm = (computedMeters || 0) / 1000;
        let amountFromCalc = Math.round((distanceKm * pricing.pricePerKm * dynamicMultiplier) * 100) / 100;
        // For fuel delivery, add fuel cost
        if (request.serviceType === 'fuel' && request.fuelDetails && request.fuelDetails.quantity) {
          amountFromCalc += Math.round((liveFuelPrice * request.fuelDetails.quantity) * 100) / 100;
        }

        // Rule-based fraud detection: flag if entered amount < 50% of calculated amount
        let finalAmount = amountFromCalc;
        let isSuspicious = false;
        if (paymentAmount !== undefined && paymentAmount !== null) {
          const parsedAmount = parseFloat(paymentAmount);
          if (!isNaN(parsedAmount) && parsedAmount > 0) {
            finalAmount = Math.round(parsedAmount * 100) / 100;
            request.payment = request.payment || {};
            request.payment.providerSetAmount = true;
            if (finalAmount < 0.5 * amountFromCalc) {
              isSuspicious = true;
              request.payment.suspicious = true;
              // Optionally, notify admin or log for review
              console.warn(`Suspicious payment detected: Entered amount (${finalAmount}) < 50% of expected (${amountFromCalc}) for request ${request._id}`);
            }
          }
        }

  request.payment = request.payment || {};
  request.payment.amount = finalAmount;
  request.payment.currency = pricing.currency || 'INR';
  request.payment.status = request.payment.status || 'pending';
  request.status = 'completed';
  request.completedAt = request.completedAt || new Date();
  await request.save();
  
  // Record earnings for the provider
  if (request.assignedTo && request.assignedToModel) {
    try {
      const Earnings = require('./models/Earnings');
      await Earnings.create({
        provider: request.assignedTo,
        providerModel: request.assignedToModel,
        serviceRequest: request._id,
        amount: finalAmount,
        date: request.completedAt
      });
      console.log(`Earnings recorded for ${request.assignedToModel} ${request.assignedTo}`);
    } catch (earningsError) {
      console.error('Error recording earnings:', earningsError);
    }
  }

        // Emit updates
        const userRoom = `user_${request.user}`;
        // Determine provider room name based on assignedToModel
        let roleRoomPrefix = 'mechanic';
        try {
          const model = (request.assignedToModel || '').toString().toLowerCase();
          if (model.includes('deliver')) roleRoomPrefix = 'delivery';
        } catch (e) {
          // fallback to mechanic
        }
        const providerRoom = `${roleRoomPrefix}_${request.assignedTo}`;
          // Include live fuel price in payload for fuel requests
          const paymentPayload = { amount: request.payment.amount, currency: request.payment.currency };
          const statusPayload = {
            requestId,
            status: 'completed',
            payment: paymentPayload,
            completedAt: request.completedAt,
            ...(request.serviceType === 'fuel' ? { liveFuelPrice } : {})
          };
        io.to(userRoom).emit(`statusUpdate:${requestId}`, statusPayload);
        io.to(providerRoom).emit(`statusUpdate:${requestId}`, statusPayload);
        io.emit('status_update', { requestId, status: 'completed' });
        socket.emit('statusUpdateConfirmation', { requestId, status: 'completed', payment: paymentPayload });
      } else {
        request.status = status;
        await request.save();

        // Emit to both user and mechanic rooms for real-time update
        const userRoom = `user_${request.user}`;
        const mechanicRoom = `mechanic_${request.assignedTo}`;
  io.to(userRoom).emit(`statusUpdate:${requestId}`, { requestId, status });
  io.to(mechanicRoom).emit(`statusUpdate:${requestId}`, { requestId, status });
        // Also emit a general status_update for legacy listeners
        io.emit('status_update', { requestId, status });

        socket.emit('statusUpdateConfirmation', { requestId, status });
      }
    } catch (error) {
      console.error('Error updating service status:', error);
      socket.emit('statusUpdateError', { message: 'Error updating status' });
    }
  });
  socket.on('acceptRequest', async (data) => {
    try {
      const request = await handleRequestAcceptance(socket, data.requestId);
      if (request) {
        // Notify other providers that this request has been locked/accepted
        const roleRoom = request.assignedToModel === 'Mechanic' ? 'mechanic' : 'delivery';
        try {
          io.to(roleRoom).emit('requestLocked', { requestId: request._id });
          console.log(`Emitted requestLocked to ${roleRoom} for request ${request._id}`);
        } catch (e) {
          console.error('Error emitting requestLocked:', e);
        }
      }
    } catch (err) {
      console.error('Error in acceptRequest handler:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected', socket.id);
  });
});

app.get("/api/fuel-prices", async (req, res) => {
  try {
    let { state, city } = req.query;
    if (!state || !city) {
      return res.status(400).json({ error: "State and city are required" });
    }

    const url = `https://daily-petrol-diesel-lpg-cng-fuel-prices-in-india.p.rapidapi.com/v1/fuel-prices/history/india/${state}/${city}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-host": process.env.RAPIDAPI_HOST,
        "x-rapidapi-key": process.env.RAPIDAPI_KEY
      }
    });

    // If city not found, fallback to Mumbai
    if (!response.ok) {
      console.warn(`No data for ${city}. Falling back to Mumbai.`);
      const fallbackUrl = `https://daily-petrol-diesel-lpg-cng-fuel-prices-in-india.p.rapidapi.com/v1/fuel-prices/history/india/maharashtra/mumbai`;
      const fallbackRes = await fetch(fallbackUrl, {
        method: "GET",
        headers: {
          "x-rapidapi-host": process.env.RAPIDAPI_HOST,
          "x-rapidapi-key": process.env.RAPIDAPI_KEY
        }
      });
      const fallbackData = await fallbackRes.json();
      const last = fallbackData.history.at(-1);
      return res.json({
        city: "mumbai",
        petrol: last?.fuel?.petrol?.retailPrice,
        diesel: last?.fuel?.diesel?.retailPrice
      });
    }

    const data = await response.json();
    const latest = data.history.at(-1);

    res.json({
      city,
      petrol: latest?.fuel?.petrol?.retailPrice,
      diesel: latest?.fuel?.diesel?.retailPrice
    });
  } catch (error) {
    console.error("Fuel API error:", error);
    res.status(500).json({ error: "Failed to fetch fuel prices" });
  }
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));