import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import { socket, connectSocket, listenForProviderLocation, stopListeningForProviderLocation } from '../../services/socket';
import './ServiceTracking.css';

// Import marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom icons for user and provider
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const providerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// OSRM Routing component for Leaflet
const OSRMRouting = ({ userLocation, providerLocation, setEstimatedTime }) => {
  const map = useMap();
  const polylineRef = useRef(null);
  const distanceMarkerRef = useRef(null);

  useEffect(() => {
    if (!userLocation || !providerLocation) return;

    // Fetch route from OSRM
    const fetchRoute = async () => {
      const url = `https://router.project-osrm.org/route/v1/driving/${providerLocation.lng},${providerLocation.lat};${userLocation.lng},${userLocation.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.routes || !data.routes[0]) return;
      const route = data.routes[0];
      const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

      // Remove previous polyline
      if (polylineRef.current) {
        try { map.removeLayer(polylineRef.current); } catch (e) {}
        polylineRef.current = null;
      }
      polylineRef.current = L.polyline(coords, {
        color: '#4285F4',
        weight: 5,
        opacity: 0.85
      }).addTo(map);

      // Fit bounds to route
      try {
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, { padding: [60, 60] });
      } catch (e) {}

      // Show distance and ETA
      const midIdx = Math.floor(coords.length / 2);
      const midPoint = coords[midIdx];
      const distanceKm = (route.distance / 1000).toFixed(2);
      const durationMin = Math.round(route.duration / 60);
      setEstimatedTime(`${durationMin} min (${distanceKm} km)`);

      // Remove previous marker
      if (distanceMarkerRef.current) {
        try { map.removeLayer(distanceMarkerRef.current); } catch (e) {}
        distanceMarkerRef.current = null;
      }
      const distanceIcon = L.divIcon({
        className: 'distance-label',
        html: `<div>${distanceKm} km, ${durationMin} min</div>`
      });
      distanceMarkerRef.current = L.marker(midPoint, {
        icon: distanceIcon,
        interactive: false
      }).addTo(map);
    };
    fetchRoute();

    return () => {
      if (polylineRef.current) {
        try { map.removeLayer(polylineRef.current); } catch (e) {}
        polylineRef.current = null;
      }
      if (distanceMarkerRef.current) {
        try { map.removeLayer(distanceMarkerRef.current); } catch (e) {}
        distanceMarkerRef.current = null;
      }
    };
  }, [map, userLocation, providerLocation, setEstimatedTime]);
  return null;
};

const ServiceTracking = ({ serviceRequest, userLocation, providerLocation: providerLocationProp, role = 'user' }) => {
  const [providerLocation, setProviderLocation] = useState(providerLocationProp || null);
  const [estimatedTime, setEstimatedTime] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!socket || !serviceRequest) return;

    // If providerLocationProp is provided, use it and skip socket updates
    if (providerLocationProp) {
      setProviderLocation(providerLocationProp);
      return;
    }

    // Otherwise, listen for provider location updates via socket
    if (!socket.connected) {
      const userId = serviceRequest.user;
      if (userId) {
        connectSocket(userId, 'user').catch(err => 
          console.error('Failed to connect socket:', err)
        );
      }
    }

    console.log('Setting up provider location listener for request:', serviceRequest._id);
    listenForProviderLocation(serviceRequest._id, (location) => {
      console.log('Received provider location update:', location);
      if (location.lat && location.lng) {
        setProviderLocation({
          lat: parseFloat(location.lat),
          lng: parseFloat(location.lng),
          timestamp: location.timestamp
        });
      }
    });

    // Listen for connection events
    const handleConnect = () => {
      console.log('Socket connected');
    };

    const handleDisconnect = () => {
      console.log('Socket disconnected');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Cleanup socket listeners on unmount
    return () => {
      if (serviceRequest?._id) {
        stopListeningForProviderLocation();
      }
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [serviceRequest, providerLocationProp]);

  // Center map on user location or default to a fallback position
  const center = userLocation || { lat: 0, lng: 0 };

  // Custom marker labels based on role
  const userLabel = role === 'mechanic' ? 'User Location' : 'Your Location';
  const providerLabel = role === 'mechanic' ? 'Mechanic Location' : 'Service Provider';

  return (
    <div className="service-tracking-container">
      {/* Only show heading and ETA for user panel */}
      {role === 'user' && <h3>Service Provider Tracking</h3>}
      {role === 'user' && estimatedTime && (
        <div className="estimated-time">
          Estimated arrival time: {estimatedTime}
        </div>
      )}
      <div className="map-container">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={14}
          style={{ height: '400px', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {/* User location marker */}
          {userLocation && (
            <Marker 
              position={[userLocation.lat, userLocation.lng]}
              icon={userIcon}
            >
              <Popup>{userLabel}</Popup>
            </Marker>
          )}
          {/* Provider location marker */}
          {providerLocation && (
            <Marker
              position={[providerLocation.lat, providerLocation.lng]}
              icon={providerIcon}
            >
              <Popup>{providerLabel}</Popup>
            </Marker>
          )}
          {/* Subtle pulsing overlay at provider location for emphasis */}
          {providerLocation && (
            <CircleMarker
              center={[providerLocation.lat, providerLocation.lng]}
              radius={10}
              pathOptions={{ color: '#e53935', fillOpacity: 0.12 }}
              interactive={false}
              />
          )}
          {/* Routing between provider and user */}
          {userLocation && providerLocation && (
            <OSRMRouting
              userLocation={userLocation}
              providerLocation={providerLocation}
              setEstimatedTime={setEstimatedTime}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default ServiceTracking;