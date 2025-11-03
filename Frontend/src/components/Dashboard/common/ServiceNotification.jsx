import React from 'react';
import './ServiceNotification.css';

const ServiceNotification = ({ request, onAccept, onReject }) => {
  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const formatAddress = (location) => {
    return location.address || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
  };

  const getServiceTypeIcon = (type, mechanicalType) => {
    const icons = {
      'fuel': '⛽',
      'mechanical': {
        'engine': '🔧',
        'battery': '🔋',
        'tires': '🛞',
        'towing': '🚛',
        'general': '⚙️'
      }
    };
    return type === 'mechanical' ? icons[type][mechanicalType] : icons[type];
  };

  return (
    <div className="service-notification">
      <div className="notification-header">
        <span className="service-icon">
          {getServiceTypeIcon(request.serviceType, request.mechanicalType)}
        </span>
        <span className="service-time">{formatDateTime(request.createdAt)}</span>
      </div>
      
      <div className="notification-content">
        <p className="service-type">
          {request.serviceType === 'mechanical' 
            ? `${request.mechanicalType.charAt(0).toUpperCase() + request.mechanicalType.slice(1)} Service` 
            : 'Fuel Delivery'}
        </p>
        <p className="service-location">📍 {formatAddress(request.location)}</p>
        {request.notes && <p className="service-notes">📝 {request.notes}</p>}
      </div>

      <div className="notification-actions">
        <button className="accept-btn" onClick={() => onAccept(request)}>
          Accept
        </button>
        <button className="reject-btn" onClick={() => onReject(request)}>
          Reject
        </button>
      </div>
    </div>
  );
};

export default ServiceNotification;