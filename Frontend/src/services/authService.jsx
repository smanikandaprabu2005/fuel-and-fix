import api from './api';
import { jwtDecode } from 'jwt-decode';


export const getUserId = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('Token not found in local storage');
    return null; // Return null if token is missing
  }

  try {
    const decoded = jwtDecode(token);
    return decoded.userId || null; // Return null if userId is not found
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null; // Return null if decoding fails
  }
};

export const getProviderEarnings = async (providerId) => {
  if (!providerId) {
    console.error('Provider ID not found');
    return null; // Return null if provider ID is missing
  }

  try {
    const response = await api.get(`/api/service/earnings/${providerId}`);
    console.log(response.data);
    return response.data; // Return the data from the API response
  } catch (error) {
    console.error('Error fetching provider earnings:', error);
    return null; // Return null if the API call fails
  }
};

export const register = (userData) => {
  return api.post('/api/auth/register', userData);
};

export const login = (userData) => {
  return api.post('/api/auth/login', userData);
};

export const refreshToken = async () => {
  const currentToken = localStorage.getItem('token');
  if (!currentToken) return null;

  try {
    const response = await api.post('/api/auth/refresh', null, {
      headers: { Authorization: currentToken }
    });
    
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      return response.data.token;
    }
    return null;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
};

export const createServiceRequest = async (formData) => {
  try {
    // Validate and parse location data
    const userLocation = JSON.parse(formData.get('location'));
    if (!userLocation || !userLocation.lat || !userLocation.lng) {
      throw new Error('Invalid location data');
    }

    // Validate user ID
    const userId = formData.get('user');
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Create base payload
    const payload = {
      serviceType: formData.get('serviceType'),
      description: formData.get('description'),
      user: userId, // This matches the MongoDB schema requirement
      location: {
        type: 'Point',
        coordinates: [Number(userLocation.lng), Number(userLocation.lat)]
      },
      status: 'pending' // Set initial status
    };

    // Add service-specific details
    if (formData.get('serviceType') === 'fuel') {
      const fuelDetails = JSON.parse(formData.get('fuelDetails'));
      payload.fuelDetails = {
        fuelType: fuelDetails.fuelType,
        quantity: Number(fuelDetails.quantity)
      };
    }

    // Handle mechanical service type
    if (formData.get('serviceType') === 'mechanical') {
      payload.mechanicalType = formData.get('mechanicalType');
      
      // Handle file uploads if present
      const images = formData.getAll('images');
      if (images && images.length > 0) {
        const formDataWithFiles = new FormData();
        formDataWithFiles.append('data', JSON.stringify(payload));
        
        images.forEach(image => {
          formDataWithFiles.append('images', image);
        });
        
        return api.post('/api/service/request', formDataWithFiles, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      }
    }

    // If no files to upload, send as regular JSON
    console.log('Sending service request payload:', payload);
    return api.post('/api/service/request', payload);
  } catch (error) {
    console.error('Error creating service request:', error);
    throw error;
  }
};

export const getUserServiceRequests = (userId) => {
  return api.get(`/api/service/requests/${userId}`);
};

export const getNearbyMechanics = (lat, lng, distance = 10) => {
  return api.get(`/api/mechanics/nearby?lat=${lat}&lng=${lng}&distance=${distance}`);
};

export const getNearbyDeliveryPersons = (lat, lng, distance = 10) => {
  return api.get(`/api/delivery/nearby?lat=${lat}&lng=${lng}&distance=${distance}`);
};

export const adminCreateMechanic = (data) => {
  return api.post('/api/admin/create-mechanic', data);
};

export const adminCreateDelivery = (data) => {
  return api.post('/api/admin/create-delivery', data);
};

export const acceptServiceRequest = (data) => {
  return api.post('/api/service/accept', data);
};

export const updateServiceStatus = (data) => {
  return api.post('/api/service/status', data);
};

export const payForService = (requestId, paymentInfo) => {
  return api.post('/api/service/payment', { requestId, paymentInfo });
};

export const createRazorpayOrder = (requestId) => {
  return api.post('/api/service/payment/create-order', { requestId });
};

export const verifyRazorpayPayment = (payload) => {
  return api.post('/api/service/payment/verify', payload);
};