import React, { useState, useEffect } from 'react';
import { createServiceRequest } from '../../services/authService';
import { broadcastServiceRequest, listenForProviderLocation, stopListeningForProviderLocation, connectSocket, socket } from '../../services/socket';
import ServiceTracking from './ServiceTracking';
import './ServiceRequest.css';
import './otpToast.css';
import useBlockUnloadOnActiveRequest from '../../hooks/useBlockUnloadOnActiveRequest';

const ServiceRequest = ({ userLocation, userId, onServiceCreated, initialServiceType }) => {
  const [serviceType, setServiceType] = useState(initialServiceType || 'mechanical');
  const [mechanicalType, setMechanicalType] = useState('general');
  const [description, setDescription] = useState('');
  const [fuelType, setFuelType] = useState('petrol');
  const [quantity, setQuantity] = useState(0);
  const [images, setImages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [activeRequest, setActiveRequest] = useState(null);
  const [mechanicLocation, setMechanicLocation] = useState(null);
  const [otpModal, setOtpModal] = useState({ open: false, otp: '', serviceRequestId: '' });
  // Listen for OTP sent to user via socket
  useEffect(() => {
    const handler = (data) => {
      if (data && data.otp) {
        setOtpModal({ open: true, otp: data.otp, serviceRequestId: data.serviceRequestId });
      }
    };
    socket.on('serviceOtp', handler);
    return () => {
      socket.off('serviceOtp', handler);
    };
  }, []);

  // Listen for status updates for the active request and redirect to payment on completion
  useEffect(() => {
    if (!activeRequest) return;
    const handler = (data) => {
      if (data && data.requestId === activeRequest._id && data.status === 'completed') {
        // redirect user to payment page to complete payment if needed
        window.location.href = '/payment';
      }
    };
    socket.on(`statusUpdate:${activeRequest._id}`, handler);
    return () => {
      socket.off(`statusUpdate:${activeRequest._id}`, handler);
    };
  }, [activeRequest]);

  useEffect(() => {
    if (!userId) {
      setError('Please log in to create a service request.');
    } else {
      setError('');
    }
  }, [userId]);

  // Listen for mechanic location updates when a request is active
  useEffect(() => {
    if (!activeRequest) return;
    let mounted = true;
    (async () => {
      try {
        // Always ensure this client is connected to its user socket room so it can receive provider updates.
        // connectSocket is idempotent and will no-op if already connected with the same credentials.
        await connectSocket(userId, 'user');
      } catch (err) {
        console.warn('Could not connect socket for user to listen for provider location:', err);
      }

      if (!mounted) return;
      console.log('Setting up provider location listener for request (user side):', activeRequest._id);
      listenForProviderLocation(activeRequest._id, (location) => {
        console.log('User client received provider location update:', location);
        if (!mounted) return;
        if (location && location.lat && location.lng) {
          setMechanicLocation({
            lat: parseFloat(location.lat),
            lng: parseFloat(location.lng),
            timestamp: location.timestamp
          });
        }
      });
    })();
    return () => {
      stopListeningForProviderLocation();
      mounted = false;
    };
  }, [activeRequest]);

  // Prevent accidental refresh/close while a user has an active request
  useBlockUnloadOnActiveRequest(activeRequest, { role: 'user' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!userLocation) {
      setError('Please enable location services to request service');
      return;
    }

    if (!userId) {
      setError('User ID is required. Please log in again.');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      // Try to get a fresh/current location at submit time if geolocation is available
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
          });
          // Replace userLocation lat/lng with most recent reading
          userLocation = userLocation || {};
          userLocation.lat = pos.coords.latitude;
          userLocation.lng = pos.coords.longitude;
        } catch (locErr) {
          console.warn('Could not get fresh location at submit time, using existing userLocation if present', locErr);
        }
      }
      // Create form data to handle file uploads
      const formData = new FormData();
      // Validate location data before sending
      if (!userLocation || !userLocation.lat || !userLocation.lng) {
        throw new Error('Invalid location data. Please ensure location services are enabled.');
      }

      formData.append('serviceType', serviceType);
      // Format location data for MongoDB and service providers
      const coordinates = [
        parseFloat(userLocation.lng), // MongoDB uses [longitude, latitude]
        parseFloat(userLocation.lat)
      ];

      const locationData = {
        type: 'Point',
        coordinates: coordinates,
        lat: parseFloat(userLocation.lat),
        lng: parseFloat(userLocation.lng),
        address: userLocation.address || ''
      };
      
      // Validate coordinates
      if (isNaN(locationData.lat) || isNaN(locationData.lng)) {
        throw new Error('Invalid location coordinates');
      }

      formData.append('location', JSON.stringify(locationData));
      formData.append('description', description);
      formData.append('user', userId); // Changed from userId to user to match backend schema

      if (serviceType === 'fuel') {
        formData.append('fuelDetails', JSON.stringify({ fuelType, quantity }));
      } else {
        formData.append('mechanicalType', mechanicalType);
        // Append each image file
        images.forEach((image, index) => {
          formData.append(`images`, image);
        });
      }
      
      console.log('Sending service request with payload:', {
        serviceType,
        location: {
          lat: Number(userLocation.lat),
          lng: Number(userLocation.lng)
        },
        description,
        userId,
        ...(serviceType === 'fuel' ? { fuelDetails: { fuelType, quantity } } : { mechanicalType })
      });
      
      const response = await createServiceRequest(formData);
      console.log('Service request created successfully:', response.data);
      
      if (response.data) {
          // Broadcast the service request through socket
          try {
            // Format and validate the service request data before broadcasting
            const serviceRequest = response.data.serviceRequest;
            if (!serviceRequest) {
              throw new Error('Invalid service request data structure');
            }

            // Ensure all required fields are present
            const broadcastData = {
              _id: serviceRequest._id,
              serviceType: serviceRequest.serviceType,
              mechanicalType: serviceRequest.mechanicalType || 'general',
              location: {
                lat: Number(serviceRequest.location.lat || userLocation.lat),
                lng: Number(serviceRequest.location.lng || userLocation.lng),
                address: serviceRequest.location.address || ''
              },
              description: serviceRequest.description,
              status: serviceRequest.status,
              user: serviceRequest.user
            };

            // Log the formatted data
            console.log('Broadcasting formatted service request:', broadcastData);
            
            // NOTE: The server HTTP endpoint already broadcasts the saved request to providers.
            // Avoid double-broadcasting via socket here to prevent duplicate notifications.
            // If needed in future, use socket broadcast only when creating requests locally without HTTP.
            console.log('Service request created; server will broadcast to providers:', broadcastData);
          } catch (socketError) {
            console.error('Error broadcasting service request:', socketError);
            // Don't show this error to user as the request was created successfully
          }        // Reset form
        setDescription('');
        setQuantity(0);
        setImages([]);
        setSuccessMessage('Service request created successfully! Searching for nearby providers...');
        
            // Normalize and store the active request so frontend code has predictable fields
            const raw = response.data.serviceRequest;
            const normalized = { ...raw };
            // Normalize location: prefer lat/lng fields, fallback to GeoJSON coordinates
            if (normalized.location) {
              if ((normalized.location.lat === undefined || normalized.location.lng === undefined) && Array.isArray(normalized.location.coordinates)) {
                normalized.location = {
                  ...normalized.location,
                  lng: normalized.location.coordinates[0],
                  lat: normalized.location.coordinates[1],
                  address: normalized.location.address || ''
                };
              } else {
                normalized.location = {
                  ...normalized.location,
                  lat: Number(normalized.location.lat),
                  lng: Number(normalized.location.lng),
                  address: normalized.location.address || ''
                };
              }
            } else if (userLocation) {
              normalized.location = {
                lat: Number(userLocation.lat),
                lng: Number(userLocation.lng),
                address: userLocation.address || ''
              };
            }

            // Ensure fuelDetails is an object (sometimes stringified when submitted as FormData)
            if (normalized.fuelDetails && typeof normalized.fuelDetails === 'string') {
              try {
                normalized.fuelDetails = JSON.parse(normalized.fuelDetails);
              } catch (e) {
                console.warn('Could not parse fuelDetails string:', normalized.fuelDetails);
                normalized.fuelDetails = normalized.fuelDetails || {};
              }
            }

            // Store the active request
            setActiveRequest(normalized);
        
        // Only call onServiceCreated if it exists
        if (onServiceCreated) {
          onServiceCreated(response.data);
        }
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(''), 5000);
      }
    } catch (err) {
      setError('Failed to create service request. Please try again.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="service-request-container">
      <h2>Request Assistance</h2>
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="serviceType">Service Type</label>
          <select
            id="serviceType"
            value={serviceType}
            onChange={(e) => {
              setServiceType(e.target.value);
              setImages([]);
            }}
            required
          >
            <option value="mechanical">Mechanical Assistance</option>
            <option value="fuel">Fuel Delivery</option>
          </select>
        </div>
        {serviceType === 'mechanical' && (
          <div className="form-group">
            <label htmlFor="mechanicalType">Service Category</label>
            <select
              id="mechanicalType"
              value={mechanicalType}
              onChange={(e) => setMechanicalType(e.target.value)}
              required
            >
              <option value="general">General Service</option>
              <option value="engine">Engine Issues</option>
              <option value="battery">Battery Service</option>
              <option value="tires">Tire Service</option>
              <option value="towing">Towing Service</option>
            </select>
          </div>
        )}
        {serviceType === 'fuel' && (
          <>
            <div className="form-group">
              <label htmlFor="fuelType">Fuel Type</label>
              <select id="fuelType" value={fuelType} onChange={(e) => setFuelType(e.target.value)}>
                <option value="petrol">Petrol</option>
                <option value="diesel">Diesel</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="quantity">Quantity (litres)</label>
              <input id="quantity" type="number" value={quantity} onChange={(e) => {
                const v = e.target.value;
                setQuantity(v === '' ? '' : Number(v));
              }} />
            </div>
          </>
        )}
        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="Describe your issue or fuel requirements"
          ></textarea>
        </div>
        {serviceType === 'mechanical' && (
          <div className="form-group">
            <label htmlFor="images">Upload Images (Optional)</label>
            <div className="image-upload-container">
              <input
                type="file"
                id="images"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files);
                  setImages(prev => [...prev, ...files].slice(0, 3)); // Limit to 3 images
                }}
              />
              {images.length > 0 && (
                <div className="image-preview">
                  {images.map((image, index) => (
                    <div key={index} className="preview-item">
                      <img src={URL.createObjectURL(image)} alt={`Preview ${index + 1}`} />
                      <button
                        type="button"
                        className="remove-image"
                        onClick={() => setImages(images.filter((_, i) => i !== index))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <small>Up to 3 images, showing vehicle issue</small>
            </div>
          </div>
        )}
        <button 
          type="submit" 
          className="btn btn-primary" 
          disabled={isSubmitting || !userLocation}
        >
          {isSubmitting ? 'Submitting...' : 'Request Service'}
        </button>
      </form>

      {/* Show tracking when a service request is active */}
      {activeRequest && (
        <ServiceTracking
          serviceRequest={activeRequest}
          userLocation={userLocation}
          providerLocation={mechanicLocation}
          role="user"
        />
      )}

      {/* OTP Toast Notification for user */}
      {otpModal.open && (
        <div className="otp-toast">
          <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 2 }}>Service OTP</div>
          <div style={{ fontSize: '0.98rem', marginBottom: 6 }}>Share this OTP with your mechanic to start your service.</div>
          <div className="otp-code">{otpModal.otp}</div>
          <button className="close-btn" onClick={() => setOtpModal({ open: false, otp: '', serviceRequestId: '' })}>Dismiss</button>
        </div>
      )}
    </div>
  );
};

export default ServiceRequest;