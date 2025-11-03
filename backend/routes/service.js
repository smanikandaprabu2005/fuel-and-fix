const express = require('express');
const router = express.Router();
const ServiceRequest = require('../models/ServiceRequest');
const Mechanic = require('../models/mechanic');
const DeliveryPerson = require('../models/DeliveryPerson');
const Earnings = require('../models/Earnings');
const socketManager = require('../socketManager');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const mongoose = require('mongoose');

// Get provider earnings overview
router.get('/earnings/:providerId', authenticate, async (req, res) => {
  try {
    const { providerId } = req.params;
    const { role } = req.user;
    console.log("🔍 Provider ID:", providerId);
    console.log("🔍 Role:", role);

    
    // Determine provider model based on role
    const providerModel = role === 'mechanic' ? 'Mechanic' : 'DeliveryPerson';
    console.log("🔍 Provider Model:", providerModel);
    // Get today's earnings
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEarnings = await Earnings.aggregate([
      {
        $match: {
          provider:new mongoose.Types.ObjectId(providerId),
          providerModel,
          date: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);
    console.log(todayEarnings);
    // Get weekly earnings
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyEarnings = await Earnings.aggregate([
      {
        $match: {
          provider:new mongoose.Types.ObjectId(providerId),
          providerModel,
          date: { $gte: weekAgo }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);
    console.log(weeklyEarnings);
    // Get recent services
    const recentServices = await ServiceRequest.find({
      assignedTo: providerId,
      assignedToModel: providerModel,
      status: 'completed'
    })
    .sort({ completedAt: -1 })
    .limit(10);
    console.log(recentServices);
    // Count services this week
    const servicesThisWeek = await ServiceRequest.countDocuments({
      assignedTo: providerId,
      assignedToModel: providerModel,
      status: 'completed',
      completedAt: { $gte: weekAgo }
    });
    console.log(servicesThisWeek);
    res.json({
      todayEarnings: todayEarnings.length > 0 ? todayEarnings[0].total : 0,
      weeklyEarnings: weeklyEarnings.length > 0 ? weeklyEarnings[0].total : 0,
      servicesThisWeek,
      recentServices
    });
  } catch (err) {
    console.error('Error fetching earnings:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// helper to get io from app
function getIO(req) {
  return req.app.get('io');
}

// @route   POST api/service/request
// @desc    Create a new service request
router.post('/request', async (req, res) => {
  try {
    let serviceData;
    
    // Handle multipart form data (for requests with images)
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      const jsonData = JSON.parse(req.body.data);
      serviceData = {
        ...jsonData,
        images: req.files?.map(file => file.path) || []
      };
    } else {
      // Handle JSON data
      serviceData = req.body;
    }

    // Validate required fields
    const missingFields = [];
    if (!serviceData.user) missingFields.push('user');
    if (!serviceData.serviceType) missingFields.push('serviceType');
    if (!serviceData.location) missingFields.push('location');
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        msg: 'Missing required fields',
        missingFields,
        receivedData: {
          user: serviceData.user,
          serviceType: serviceData.serviceType,
          hasLocation: !!serviceData.location
        }
      });
    }

    // Create a pending request and broadcast to nearby providers
    const newRequest = new ServiceRequest(serviceData);

    const serviceRequest = await newRequest.save();

    // Broadcast to nearby providers via Socket.IO
    const io = getIO(req);
    const centerCoords = serviceData.location.coordinates;
    const radiusMeters = 10000; // 10 km

    const role = serviceData.serviceType === 'fuel' ? 'delivery' : 'mechanic';

    // Find providers using in-memory socket manager
    const nearby = socketManager.findProvidersWithin(radiusMeters, centerCoords, role);

    // Broadcast to all providers of the appropriate type
    try {
      // Add distance to payload for each nearby provider
      const requestWithMeta = {
        ...serviceRequest.toObject(),
        nearbyProviders: nearby.map(p => ({
          id: p.id,
          distance: p.distance
        }))
      };

  console.log(`Broadcasting ${serviceData.serviceType} request to ${role} providers (nearby: ${nearby.length})`);
      // Format location data for broadcasting
      const location = serviceRequest.location;
      const broadcastData = {
        _id: serviceRequest._id,
        serviceType: serviceRequest.serviceType,
        mechanicalType: serviceRequest.mechanicalType,
        location: {
          lat: location.coordinates[1], // Convert from MongoDB [lng, lat] to {lat, lng}
          lng: location.coordinates[0],
          address: location.address || ''
        },
        description: serviceRequest.description,
        status: serviceRequest.status,
        // Include fuel details if present so providers see fuel type/quantity
        fuelDetails: serviceRequest.fuelDetails || null,
        user: serviceRequest.user,
        createdAt: serviceRequest.createdAt,
        nearbyProviders: nearby.map(p => ({
          id: p.id,
          distance: p.distance
        }))
      };
      if (nearby && nearby.length > 0) {
        // Emit to each nearby provider socket individually with distance meta
        nearby.forEach(p => {
          try {
            const perProvider = { ...broadcastData, distanceToProvider: p.distance };
            io.to(p.socketId).emit('newRequest', perProvider);
          } catch (e) {
            console.warn('Failed to emit to provider socket', p.socketId, e);
          }
        });
      } else {
        // Fallback: broadcast to role room if no nearby providers were determined
        io.to(role).emit('newRequest', broadcastData);
      }
    } catch (e) {
      console.error('Failed to broadcast service request:', e);
    }

    res.json({ serviceRequest, broadcastCount: nearby.length });
  } catch (err) {
    console.error('Service request creation error:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        msg: 'Invalid request data', 
        errors: Object.values(err.errors).map(e => e.message)
      });
    }
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
});

// @route POST api/service/accept
// @desc  Provider accepts a pending request (first-come lock)
router.post('/accept', async (req, res) => {
  const { requestId, providerId, providerModel } = req.body;

  try {
    const request = await ServiceRequest.findById(requestId);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    // If already assigned, reject
    if (request.status !== 'pending') {
      return res.status(400).json({ msg: 'Request already accepted' });
    }

    // Assign provider atomically
    request.assignedTo = providerId;
    request.assignedToModel = providerModel;
    request.status = 'assigned';
    request.acceptanceLog.push({ providerId, providerModel });

    // Mark provider unavailable
    if (providerModel === 'Mechanic') {
      await Mechanic.findByIdAndUpdate(providerId, { available: false });
    } else if (providerModel === 'DeliveryPerson') {
      await DeliveryPerson.findByIdAndUpdate(providerId, { available: false });
    }

    await request.save();

    // Notify user via socket if connected
    const io = getIO(req);
    io.emit('request_accepted', { requestId: request._id, providerId, providerModel });
    // Also notify other providers of the same role that this request has been locked/accepted
    try {
      const roleRoom = providerModel === 'Mechanic' ? 'mechanic' : 'delivery';
      io.to(roleRoom).emit('requestLocked', { requestId: request._id });
      console.log(`HTTP accept: Emitted requestLocked to ${roleRoom} for request ${request._id}`);
    } catch (e) {
      console.error('Error emitting requestLocked from HTTP accept route:', e);
    }

    res.json({ request });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route POST api/service/status
// @desc  Update status of a service (by provider)
router.post('/status', async (req, res) => {
  const { requestId, status } = req.body;
  try {
    const request = await ServiceRequest.findById(requestId);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

      // If completing the request, compute fare using Pricing and optional distance provided
      if (status === 'completed') {
        // Accept optional distanceMeters from client (meters). If not provided, use stored distanceMeters
        const distanceMetersFromClient = req.body.distanceMeters;
        if (typeof distanceMetersFromClient === 'number' && !isNaN(distanceMetersFromClient)) {
          request.distanceMeters = distanceMetersFromClient;
        }

        // Load pricing settings (fallback to default 7 INR/km)
        const Pricing = require('../models/Pricing');
        let pricing = await Pricing.findOne().sort({ updatedAt: -1 }).exec();
        if (!pricing) {
          pricing = await Pricing.create({ pricePerKm: 7 });
        }

              // If locationHistory exists, compute server-side distance as sum of segments
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

              const distanceKm = (computedMeters || 0) / 1000;
              const amount = Math.round((distanceKm * pricing.pricePerKm) * 100) / 100; // 2 decimals

        request.payment = request.payment || {};
        request.payment.amount = amount;
        request.payment.status = request.payment.status || 'pending';
                request.status = 'completed';
                request.completedAt = request.completedAt || new Date();
        await request.save();

        const io = getIO(req);
        io.emit('status_update', { requestId, status: 'completed' });

        return res.json({ request, fare: { amount, currency: pricing.currency } });
      } else {
        request.status = status;
        await request.save();
        const io = getIO(req);
        io.emit('status_update', { requestId, status });
        return res.json({ request });
      }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route POST api/service/payment
// @desc  Mark payment as completed (payment provider integration would go here)
router.post('/payment', async (req, res) => {
  const { requestId, paymentInfo } = req.body;
  try {
    const request = await ServiceRequest.findById(requestId);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    // In production, integrate Stripe/Razorpay here. For now, accept paymentInfo and mark paid
    request.payment = { status: 'paid', provider: paymentInfo?.provider || 'sandbox' };
    await request.save();

    res.json({ request });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/service/requests/:userId
// @desc    Get all service requests for a user
router.get('/requests/:userId', async (req, res) => {
  const userId = req.params.userId;
  if (!userId || userId === 'undefined') {
    return res.status(400).json({ msg: 'Invalid or missing userId parameter' });
  }

  try {
    // Validate that userId is a valid ObjectId
    if (!require('mongoose').Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: 'Invalid userId format' });
    }

    let requests = await ServiceRequest.find({ user: userId })
      .populate('assignedTo')
      .populate('user')
      .sort({ date: -1 });

  // For completed requests with missing amount, compute server-side using locationHistory, Pricing, or fuel details
  const Pricing = require('../models/Pricing');
  const pricing = await Pricing.findOne().sort({ updatedAt: -1 }).exec() || null;
  const pricePerKm = pricing ? pricing.pricePerKm : 7;
  const fuelPricePerLitre = pricing ? (pricing.fuelPricePerLitre || 100) : 100;

    const haversine = (lat1, lon1, lat2, lon2) => {
      const R = 6371000; // metres
      const toRad = v => v * Math.PI / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    // Compute and persist amounts for any completed requests missing a non-zero amount
    await Promise.all(requests.map(async (r) => {
      try {
        if (r.status === 'completed') {
          // Coerce stored payment amounts to number (handle string values saved earlier)
          const currentAmount = r.payment && r.payment.amount != null ? parseFloat(r.payment.amount) : 0;
          // Ensure payment.amount is numeric for consistent downstream handling
          if (r.payment) {
            r.payment.amount = !isNaN(currentAmount) ? Math.round(currentAmount * 100) / 100 : 0;
          }
          if (!currentAmount || currentAmount === 0) {
            // If this is a fuel delivery, prefer computing from fuel quantity * price per litre
            if (r.serviceType === 'fuel' && r.fuelDetails && typeof r.fuelDetails.quantity === 'number') {
              const amount = Math.round((r.fuelDetails.quantity * fuelPricePerLitre) * 100) / 100;
              r.payment = r.payment || {};
              r.payment.amount = amount;
              r.payment.status = r.payment.status || 'pending';
              await r.save();
            } else {
              // Otherwise compute from locationHistory / distanceMeters
              let computedMeters = r.distanceMeters || 0;
              if ((!computedMeters || computedMeters === 0) && r.locationHistory && r.locationHistory.length > 1) {
                const pts = r.locationHistory;
                let sum = 0;
                for (let i = 1; i < pts.length; i++) {
                  const a = pts[i-1];
                  const b = pts[i];
                  sum += haversine(a.lat, a.lng, b.lat, b.lng);
                }
                computedMeters = Math.round(sum);
                r.distanceMeters = computedMeters;
              }
              const distanceKm = (computedMeters || 0) / 1000;
              const amount = Math.round((distanceKm * pricePerKm) * 100) / 100; // 2 decimals
              r.payment = r.payment || {};
              r.payment.amount = amount;
              r.payment.status = r.payment.status || 'pending';
              await r.save();
            }
          }
        }
      } catch (e) {
        console.error('Error computing amount for request', r._id, e);
      }
    }));

    // Re-fetch to include any persisted changes and populated assignedTo & user
    requests = await ServiceRequest.find({ user: userId })
      .populate('assignedTo')
      .populate('user')
      .sort({ date: -1 });

    // Normalize payment.amount to numeric values before returning
    requests = requests.map(r => {
      if (r.payment && r.payment.amount != null) {
        const num = parseFloat(r.payment.amount);
        r.payment.amount = !isNaN(num) ? Math.round(num * 100) / 100 : 0;
      }
      return r;
    });

    res.json(requests || []);
  } catch (err) {
    console.error('Error fetching service requests for user', userId, err);
    res.status(500).json({ msg: 'Server error fetching requests' });
  }
});

module.exports = router;

// Create Razorpay order for a completed ServiceRequest (amount derived from DB)
router.post('/payment/create-order', authenticate, async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ msg: 'requestId required' });

    const request = await ServiceRequest.findById(requestId);
    if (!request) return res.status(404).json({ msg: 'ServiceRequest not found' });

    // Ensure the caller is the owner of the request (compare as strings)
    if (String(req.user._id) !== String(request.user)) {
      return res.status(403).json({ msg: 'Not authorized for this request' });
    }

    const amount = Math.round((request.payment?.amount || 0) * 100); // in paise
    if (amount <= 0) return res.status(400).json({ msg: 'Invalid amount' });

    const instance = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const options = {
      amount,
      currency: 'INR',
      receipt: String(request._id),
      payment_capture: 1,
      // Add the requestId to order notes so webhooks include it and mapping is robust
      notes: { requestId: String(request._id) }
    };

    const order = await instance.orders.create(options);
    // Persist order id to the ServiceRequest so webhooks can map payments
    request.payment = request.payment || {};
    request.payment.razorpay = request.payment.razorpay || {};
    request.payment.razorpay.order_id = order.id;
    await request.save();

    return res.json({ order, key: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error('Error creating razorpay order', err);
    return res.status(500).json({ msg: 'Server error creating order' });
  }
});

// Verify Razorpay payment (frontend posts order_id, payment_id, signature)
router.post('/payment/verify', authenticate, async (req, res) => {
  try {
    const { order_id, payment_id, signature, requestId } = req.body;
    if (!order_id || !payment_id || !signature || !requestId) {
      return res.status(400).json({ msg: 'Missing required fields' });
    }

    // Verify signature
    const generated_signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(order_id + '|' + payment_id)
      .digest('hex');

    if (generated_signature !== signature) {
      console.warn('Razorpay signature mismatch', { generated_signature, signature });
      return res.status(400).json({ msg: 'Invalid signature' });
    }

    const request = await ServiceRequest.findById(requestId);
    if (!request) return res.status(404).json({ msg: 'ServiceRequest not found' });

    // Mark payment as paid
    request.payment = request.payment || {};
    request.payment.status = 'paid';
    request.payment.provider = 'razorpay';
    request.payment.razorpay = { order_id, payment_id, signature };
    await request.save();

    // Emit update to user and provider
    const io = req.app.get('io');
    io.to(`user_${request.user}`).emit(`statusUpdate:${request._id}`, { requestId: request._id, status: request.status });

    return res.json({ msg: 'Payment verified', request });
  } catch (err) {
    console.error('Error verifying razorpay payment', err);
    return res.status(500).json({ msg: 'Server error verifying payment' });
  }
});

// Webhook endpoint for Razorpay (use raw body verification)
router.post('/payment/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const payload = req.body; // raw Buffer
    const signature = req.headers['x-razorpay-signature'];
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(payload).digest('hex');
    if (signature !== expected) {
      console.warn('Invalid webhook signature');
      return res.status(400).send('invalid signature');
    }

    const event = JSON.parse(payload.toString());
    // For payment.captured events, mark corresponding ServiceRequest as paid
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      // Prefer mapping by notes.requestId if available (we include notes on order creation)
      let r = null;
      try {
        if (payment.notes && payment.notes.requestId) {
          r = await ServiceRequest.findById(payment.notes.requestId);
        }
      } catch (e) {
        // ignore invalid id formats
        r = null;
      }

      // Fallback: find request by matching stored razorpay order id
      if (!r) {
        r = await ServiceRequest.findOne({ 'payment.razorpay.order_id': payment.order_id }) || null;
      }

      if (r) {
        r.payment = r.payment || {};
        r.payment.status = 'paid';
        r.payment.provider = 'razorpay';
        await r.save();
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Webhook error', err);
    res.status(500).send('server error');
  }
});
