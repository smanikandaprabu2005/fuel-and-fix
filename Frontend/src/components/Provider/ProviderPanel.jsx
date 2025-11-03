import React, { useEffect, useState } from 'react';
import './ProviderPanel.css';
import { socket, connectSocket } from '../../services/socket';
import { acceptServiceRequest } from '../../services/authService';
import { updateServiceStatus } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';

const ProviderPanel = ({ providerId, role, coordinates }) => {
  const { logout } = useAuth();
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    // Connect socket with provider id and role so server will add this socket to the right rooms
    connectSocket(providerId, role).catch(err => console.error('Socket connect failed in ProviderPanel:', err));

    socket.on('connect', () => {
      // No custom register event required - joinRoom is handled by connectSocket
      console.log('Provider socket connected', { providerId, role });
    });

    // Server emits 'newRequest' (camelCase) when broadcasting new service requests
    socket.on('newRequest', (data) => {
      // Add to list of pending requests
      if (data) setRequests(prev => [data, ...prev]);
    });

    socket.on('disconnect', () => {
      // clear or notify
    });

    return () => {
      socket.off('newRequest');
      socket.disconnect();
    };
  }, [providerId, role, coordinates]);

  // Periodically send location updates if browser geolocation is available
  useEffect(() => {
    let watchId = null;
      if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition((pos) => {
        const coords = [pos.coords.longitude, pos.coords.latitude];
        // Use server's expected event name for location updates
        socket.emit('locationUpdate', { serviceRequestId: null, location: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
      }, (err) => {
        console.warn('Geolocation watch failed', err);
      }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
    }

    return () => {
      if (watchId && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
    };
  }, [providerId]);

  const handleAccept = async (request) => {
    try {
      const payload = { requestId: request._id, providerId, providerModel: role === 'mechanic' ? 'Mechanic' : 'DeliveryPerson' };
      const res = await acceptServiceRequest(payload);
      if (res.data) {
        // remove from pending and show confirmation
        setRequests(prev => prev.filter(r => r._id !== request._id));
        // Add to accepted list for status updates
        setAccepted(prev => [res.data.request, ...prev]);
      }
    } catch (err) {
      console.error('Accept failed', err);
    }
  };

  const [accepted, setAccepted] = useState([]);

  const changeStatus = async (reqId, status) => {
    try {
      await updateServiceStatus({ requestId: reqId, status });
      setAccepted(prev => prev.map(a => a._id === reqId ? ({ ...a, status }) : a));
    } catch (err) {
      console.error('Status update failed', err);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{role === 'mechanic' ? 'Mechanic' : 'Delivery'} Panel</h2>
        <div>
          <button
            className="btn btn-secondary"
            onClick={() => {
              try {
                // call context logout to clear auth state
                logout && logout();
              } catch (e) {
                console.warn('Logout failed in ProviderPanel context:', e);
              }
              try { socket.disconnect(); } catch (e) { /* ignore */ }
              // Redirect to login page
              window.location.href = '/login';
            }}
          >
            Logout
          </button>
        </div>
      </div>
      <p>Socket status: {socket.connected ? 'connected' : 'disconnected'}</p>
      <div id="requests-list">
        <h3>Incoming Requests</h3>
        {requests.length === 0 ? <p>No pending requests</p> : (
          <ul>
            {requests.map(r => (
              <li key={r._id} style={{border: '1px solid #ccc', padding: 8, margin: 6}}>
                <div><strong>{r.serviceType}</strong> - {r.description}</div>
                <div>Location: {r.location?.coordinates?.[1]}, {r.location?.coordinates?.[0]}</div>
                <button onClick={() => handleAccept(r)}>Accept</button>
              </li>
            ))}
          </ul>
        )}
        <div>
          <h3>Accepted Jobs</h3>
          {accepted.length === 0 ? <p>No accepted jobs</p> : (
            <ul>
              {accepted.map(a => (
                <li key={a._id} style={{border: '1px dashed #666', padding: 8, margin: 6}}>
                  <div><strong>{a.serviceType}</strong> - {a.description}</div>
                  <div>Status: {a.status}</div>
                  <button onClick={() => changeStatus(a._id, 'in-progress')}>In Progress</button>
                  <button onClick={() => changeStatus(a._id, 'completed')}>Complete</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProviderPanel;
