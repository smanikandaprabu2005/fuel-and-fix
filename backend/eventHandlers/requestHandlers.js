const Mechanic = require('../models/mechanic');
const DeliveryPerson = require('../models/DeliveryPerson');
const ServiceRequest = require('../models/ServiceRequest');

// Handle location updates from providers
async function handleLocationUpdate(socket, data) {
  try {
    const userId = socket.user.id;
    const role = socket.user.role;
    const { serviceRequestId, location } = data;

    if (!location || (!location.lat && !location.lng)) {
      console.error('Invalid location data:', data);
      return;
    }

    const { lat, lng } = location;
    console.log('Processing location update:', { userId, role, serviceRequestId, location });

    // Update provider location in database
    const locationUpdate = {
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      }
    };

    if (role === 'mechanic') {
      await Mechanic.findOneAndUpdate({ user: userId }, locationUpdate);
    } else if (role === 'delivery') {
      await DeliveryPerson.findOneAndUpdate({ user: userId }, locationUpdate);
    }

    // Find the specific service request
    const activeRequest = serviceRequestId 
      ? await ServiceRequest.findById(serviceRequestId)
      : await ServiceRequest.findOne({
          assignedTo: userId,
          status: { $in: ['assigned', 'in-progress'] }
        });

    if (activeRequest) {
      console.log('Emitting location update to user:', activeRequest.user);
      try {
        // Append to service request location history for server-side distance calculation
        await ServiceRequest.findByIdAndUpdate(activeRequest._id, {
          $push: { locationHistory: { lat, lng, timestamp: Date.now() } }
        });
      } catch (e) {
        console.warn('Failed to append location history for request', activeRequest._id, e);
      }
      // Emit location update to user
      socket.to(`user_${activeRequest.user}`).emit('providerLocationUpdate', {
        serviceRequestId: activeRequest._id,
        location: {
          ...location,
          timestamp: Date.now()
        }
      });
      console.log('Location update emitted to user:', {
        userId: activeRequest.user,
        serviceRequestId: activeRequest._id,
        location: {
          lat: location.lat,
          lng: location.lng,
          timestamp: Date.now()
        }
      });
    }
  } catch (error) {
    console.error('Error handling location update:', error);
  }
}

// Handle service request acceptance
async function handleRequestAcceptance(socket, serviceRequestId) {
  try {
    const userId = socket.user.id;
    const request = await ServiceRequest.findById(serviceRequestId);
    
    if (!request) {
      socket.emit('requestError', { message: 'Service request not found' });
      return;
    }

    if (request.status !== 'pending') {
      socket.emit('requestError', { message: 'Request is no longer available' });
      return;
    }

    // Generate a 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    request.status = 'accepted';
    request.assignedTo = userId;
    request.assignedToModel = socket.user.role === 'mechanic' ? 'Mechanic' : 'DeliveryPerson';
    request.otp = otp;
    await request.save();
    console.log('[DEBUG] ServiceRequest after accept:', {
      _id: request._id,
      status: request.status,
      assignedTo: request.assignedTo,
      assignedToModel: request.assignedToModel,
      otp
    });
    // Emit OTP to user (for demo, also emit to mechanic for UI testing)
    socket.to(`user_${request.user}`).emit('serviceOtp', { serviceRequestId: request._id, otp });
    socket.emit('serviceOtp', { serviceRequestId: request._id, otp });

    // Notify user
    socket.to(`user_${request.user}`).emit('requestAccepted', {
      serviceRequestId: request._id,
      providerId: userId
    });

    socket.emit('requestAcceptedConfirmation', { serviceRequestId: request._id });
    // Return the updated request so callers can react (e.g., notify other providers)
    return request;
  } catch (error) {
    console.error('Error handling request acceptance:', error);
    socket.emit('requestError', { message: 'Error accepting request' });
    return null;
  }
}

module.exports = {
  handleLocationUpdate,
  handleRequestAcceptance
};