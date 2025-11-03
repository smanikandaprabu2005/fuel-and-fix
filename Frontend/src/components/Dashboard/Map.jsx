import React, { useEffect, useRef } from 'react';
import './Map.css';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const containerStyle = {
  width: '100%',
  height: '500px'
};

const defaultZoom = 12;

// Marker icons for providers
const icons = {
  user: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  mechanic: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  delivery: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  selected: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  })
};

// Component to recenter map when location changes
const RecenterMap = ({ location }) => {
  const map = useMap();
  useEffect(() => {
    if (location?.lat != null && location?.lng != null) {
      map.setView([location.lat, location.lng], defaultZoom);
    }
  }, [location, map]);
  return null;
};

const OSRMRouting = ({ userPos, providerPos }) => {
  const map = useMap();
  const polylineRef = useRef(null);
  const distanceMarkerRef = useRef(null);
  useEffect(() => {
    if (!userPos || !providerPos) return;
    const fetchRoute = async () => {
      const url = `https://router.project-osrm.org/route/v1/driving/${providerPos.lng},${providerPos.lat};${userPos.lng},${userPos.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.routes || !data.routes[0]) return;
      const route = data.routes[0];
      const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      if (polylineRef.current) {
        try { map.removeLayer(polylineRef.current); } catch (e) {}
        polylineRef.current = null;
      }
      polylineRef.current = L.polyline(coords, {
        color: '#4285F4',
        weight: 5,
        opacity: 0.85
      }).addTo(map);
      try {
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, { padding: [60, 60] });
      } catch (e) {}
      // Show distance and ETA
      const midIdx = Math.floor(coords.length / 2);
      const midPoint = coords[midIdx];
      const distanceKm = (route.distance / 1000).toFixed(2);
      const durationMin = Math.round(route.duration / 60);
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
  }, [map, userPos, providerPos]);
  return null;
};

const ProvidersMap = ({ userLocation, providerLocation, isProvider = false, requestType = null }) => {
  const mapRef = useRef(null);

  if (!userLocation) return <div className="map-container">Loading map...</div>;

  const userPos = {
    lat: userLocation.lat ?? userLocation.coordinates?.[1],
    lng: userLocation.lng ?? userLocation.coordinates?.[0]
  };

  const providerPos = providerLocation ? {
    lat: providerLocation.lat ?? providerLocation.coordinates?.[1],
    lng: providerLocation.lng ?? providerLocation.coordinates?.[0]
  } : null;

  return (
    <div style={containerStyle}>
      <MapContainer
        center={[userPos.lat, userPos.lng]}
        zoom={defaultZoom}
        style={containerStyle}
        whenCreated={(mapInstance) => { mapRef.current = mapInstance; }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* User Location Marker */}
        <Marker 
          position={[userPos.lat, userPos.lng]}
          icon={icons.user}
        >
          <Popup>
            {isProvider ? 'Customer Location' : 'Your Location'}
          </Popup>
        </Marker>
        {/* Provider Location Marker */}
        {providerPos && (
          <Marker
            position={[providerPos.lat, providerPos.lng]}
            icon={icons[requestType] || icons.mechanic}
          >
            <Popup>
              {isProvider ? 'Your Location' : `${requestType ? requestType.charAt(0).toUpperCase() + requestType.slice(1) : 'Provider'} Location`}
            </Popup>
          </Marker>
        )}
        {/* OSRM Routing Polyline */}
        {userPos && providerPos && <OSRMRouting userPos={userPos} providerPos={providerPos} />}
        <RecenterMap location={userPos} />
      </MapContainer>
    </div>
  );
};

export default ProvidersMap;
      

